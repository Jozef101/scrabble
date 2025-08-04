// src/utils/moveLetterLogic.js
import { RACK_SIZE } from './constants';
import { getPlacedLettersDuringCurrentTurn } from './gameLogic';
import { sendPlayerAction } from './socketHandlers';

/**
 * Spracováva logiku presunu písmena medzi rackom, doskou a výmennou zónou.
 * Táto funkcia je navrhnutá tak, aby bola oddelená od komponentu App.js a prijímala
 * všetky potrebné stavy a funkcie ako argumenty.
 *
 * @param {object} params - Objekt obsahujúci všetky potrebné parametre.
 * @param {object} params.gameState - Aktuálny stav hry.
 * @param {function} params.setGameState - Funkcia na aktualizáciu stavu hry.
 * @param {number} params.myPlayerIndex - Index aktuálneho hráča.
 * @param {function} params.setJokerTileCoords - Funkcia na nastavenie súradníc žolíka.
 * @param {function} params.setShowLetterSelectionModal - Funkcia na zobrazenie/skrytie modálneho okna pre výber písmena žolíka.
 * @param {object} params.socket - Socket.IO inštancia pre komunikáciu so serverom.
 * @param {string} params.gameIdToJoin - ID aktuálnej hry.
 * @param {object} letterData - Dáta o presúvanom písmene (id, letter, value, assignedLetter, originalRackIndex).
 * @param {object} source - Objekt popisujúci zdroj presunu (type: 'rack' | 'board' | 'exchangeZone', index | x, y, playerIndex).
 * @param {object} target - Objekt popisujúci cieľ presunu (type: 'rack' | 'board' | 'exchangeZone', index | x, y, playerIndex).
 */
export const moveLetter = ({
    gameState,
    setGameState,
    myPlayerIndex,
    setJokerTileCoords,
    setShowLetterSelectionModal,
    socket,
    gameIdToJoin,
}) => (letterData, source, target) => {

    // KĽÚČOVÁ ZMENA: VALIDÁCIA A ALERTY SA PRESUNULI SEM.
    // Tieto kontroly sa vykonajú PREDTÝM, než sa pokúsime o aktualizáciu stavu.

    if (gameState.isGameOver || myPlayerIndex === null) {
        console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený).");
        return;
    }

    // Presunuté z vnútra setGameState callbacku:
    // Kontrola, či sa snažíš presunúť už potvrdené písmeno z dosky
    if (source.type === 'board' && gameState.boardAtStartOfTurn[source.x][source.y] !== null) {
        console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
        alert("Nemôžeš presunúť zamknuté písmeno z dosky.");
        return;
    }

    // Presunuté z vnútra setGameState callbacku:
    // NOVÁ KONTROLA: Ak je cieľové políčko na doske už obsadené, zabránime presunu
    if (target.type === 'board' && gameState.board[target.x][target.y] !== null) {
        console.log("Cieľové políčko na doske je už obsadené, nemôžeš tam položiť písmeno.");
        alert("Cieľové políčko na doske je už obsadené!");
        return;
    }

    // Presunuté z vnútra setGameState callbacku:
    // NOVÁ KONTROLA: Rack je plný.
    if (target.type === 'rack' && source.type !== 'rack' && gameState.playerRacks[myPlayerIndex].filter(l => l !== null).length === RACK_SIZE) {
        console.warn("Rack je plný, písmeno sa nedá vrátiť.");
        alert("Rack je plný, písmeno sa nedá vrátiť.");
        return;
    }

    setGameState(prevState => {
        let newPlayerRacks = prevState.playerRacks.map(rack => [...rack]);
        let newBoard = prevState.board.map(row => [...row]);
        let newExchangeZoneLetters = [...prevState.exchangeZoneLetters];

        // POZNÁMKA: Všetky alerty a kontroly, ktoré viedli k alertom,
        // boli presunuté na začiatok funkcie. Tu už sa iba vypočíta nový stav.

        // Spracovanie presunu v rámci racku (špeciálny prípad)
        if (source.type === 'rack' && target.type === 'rack') {
            if (source.playerIndex !== myPlayerIndex) {
                console.log("Nemôžeš presúvať písmená z racku iného hráča.");
                return prevState;
            }

            const fromIndex = source.index;
            const toIndex = target.index;

            // Ak je cieľový slot prázdny, jednoducho presunieme
            if (newPlayerRacks[myPlayerIndex][toIndex] === null) {
                newPlayerRacks[myPlayerIndex][toIndex] = newPlayerRacks[myPlayerIndex][fromIndex];
                newPlayerRacks[myPlayerIndex][fromIndex] = null;
            } else {
                // Ak je cieľový slot obsadený, vykonáme výmenu
                const [movedLetter] = newPlayerRacks[myPlayerIndex].splice(fromIndex, 1);
                newPlayerRacks[myPlayerIndex].splice(toIndex, 0, movedLetter);
            }

            const updatedState = {
                ...prevState,
                playerRacks: newPlayerRacks,
            };
            sendPlayerAction(socket, gameIdToJoin, 'updateGameState', updatedState);
            return updatedState;
        }

        let letterToMove = null;

        // Určenie písmena na presun a jeho odstránenie zo zdroja
        if (source.type === 'board') {
            letterToMove = { ...newBoard[source.x][source.y] };
            newBoard[source.x][source.y] = null;
            if (letterToMove && letterToMove.letter === '') {
                letterToMove.assignedLetter = null;
            }
        } else if (source.type === 'rack') {
            if (source.playerIndex !== myPlayerIndex) {
                console.log("Nemôžeš presúvať písmená z racku iného hráča.");
                return prevState;
            }
            letterToMove = { ...letterData };
            newPlayerRacks[myPlayerIndex][source.index] = null;
        } else if (source.type === 'exchangeZone') {
            const indexInExchangeZone = newExchangeZoneLetters.findIndex(l => l.id === letterData.id);
            if (indexInExchangeZone !== -1) {
                letterToMove = { ...newExchangeZoneLetters[indexInExchangeZone] };
                newExchangeZoneLetters.splice(indexInExchangeZone, 1);
                if (letterToMove && letterToMove.letter === '') {
                    letterToMove.assignedLetter = null;
                }
            } else {
                console.warn("Písmeno sa nenašlo vo výmennej zóne pri pokuse o presun.");
                return prevState;
            }
        }

        if (!letterToMove || letterToMove.id === undefined) {
            console.warn("Nepodarilo sa nájsť platné písmeno na presun alebo chýba ID.");
            return prevState;
        }

        // Umiestnenie písmena na cieľové miesto
        if (target.type === 'rack') {
            if (target.playerIndex !== myPlayerIndex) {
                console.log("Nemôžeš presúvať písmená na rack iného hráča.");
                return prevState;
            }
            let targetRack = newPlayerRacks[myPlayerIndex];
            if (target.index !== undefined && targetRack[target.index] === null) {
                targetRack[target.index] = letterToMove;
            } else if (letterToMove.originalRackIndex !== undefined && targetRack[letterToMove.originalRackIndex] === null) {
                targetRack[letterToMove.originalRackIndex] = letterToMove;
            } else {
                const firstEmptyIndex = targetRack.findIndex(l => l === null);
                if (firstEmptyIndex !== -1) {
                    targetRack[firstEmptyIndex] = letterToMove;
                } else {
                    return prevState;
                }
            }
        } else if (target.type === 'board') {
            if (prevState.currentPlayerIndex !== myPlayerIndex) {
                console.log("Nemôžeš umiestniť písmeno na dosku, keď nie je tvoj ťah.");
                return prevState;
            }
            newBoard[target.x][target.y] = { ...letterToMove, originalRackIndex: letterData.originalRackIndex };
            if (letterToMove.letter === '') {
                setJokerTileCoords({ x: target.x, y: target.y });
                setShowLetterSelectionModal(true);
            }
        } else if (target.type === 'exchangeZone') {
            newExchangeZoneLetters.push(letterToMove);
        }

        // Vytvoríme kompletný nový stav na základe predchádzajúceho stavu a vykonaných zmien
        const updatedState = {
            ...prevState,
            playerRacks: newPlayerRacks,
            board: newBoard,
            exchangeZoneLetters: newExchangeZoneLetters,
            hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, prevState.boardAtStartOfTurn).length > 0,
            hasMovedToExchangeZoneThisTurn: newExchangeZoneLetters.length > 0,
        };
        sendPlayerAction(socket, gameIdToJoin, 'updateGameState', updatedState);
        return updatedState;
    });
};