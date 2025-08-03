// src/utils/moveLetterLogic.js
import { RACK_SIZE } from './constants';
import { getPlacedLettersDuringCurrentTurn } from './gameLogic';
// sendPlayerAction už nie je potrebný pre túto funkciu, pretože ju nebude volať
// import { sendPlayerAction } from './socketHandlers'; 

/**
 * Spracováva logiku presunu písmena medzi rackom, doskou a výmennou zónou.
 * Táto funkcia je navrhnutá tak, aby bola oddelená od komponentu App.js a prijímala
 * všetky potrebné stavy a funkcie ako argumenty.
 *
 * @param {object} params - Objekt obsahujúci všetky potrebné parametre.
 * @param {object} params.gameState - Aktuálny stav hry.
 * @param {function} params.myPlayerIndex - Index aktuálneho hráča.
 * @param {function} params.setJokerTileCoords - Funkcia na nastavenie súradníc žolíka.
 * @param {function} params.setShowLetterSelectionModal - Funkcia na zobrazenie/skrytie modálneho okna pre výber písmena žolíka.
 * @param {object} letterData - Dáta o presúvanom písmene (id, letter, value, assignedLetter, originalRackIndex).
 * @param {object} source - Objekt popisujúci zdroj presunu (type: 'rack' | 'board' | 'exchangeZone', index | x, y, playerIndex).
 * @param {object} target - Objekt popisujúci cieľ presunu (type: 'rack' | 'board' | 'exchangeZone', index | x, y, playerIndex).
 */
export const moveLetter = ({
    gameState,
    myPlayerIndex,
    setJokerTileCoords,
    setShowLetterSelectionModal,
    // socket a gameIdToJoin už nie sú potrebné
}) => (letterData, source, target) => {
    if (gameState.isGameOver || myPlayerIndex === null) {
        console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený).");
        return gameState;
    }

    // --- KĽÚČOVÁ ZMENA: Odstránime setGameState a logiku vrátime ako návratovú hodnotu ---
    let newPlayerRacks = gameState.playerRacks.map(rack => [...rack]);
    let newBoard = gameState.board.map(row => [...row]);
    let newExchangeZoneLetters = [...gameState.exchangeZoneLetters];

    if (source.type === 'board' && gameState.boardAtStartOfTurn[source.x][source.y] !== null) {
        console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
        return gameState;
    }

    if (source.type === 'rack' && target.type === 'rack') {
        if (source.playerIndex !== myPlayerIndex) {
            console.log("Nemôžeš presúvať písmená z racku iného hráča.");
            return gameState;
        }

        const fromIndex = source.index;
        const toIndex = target.index;

        if (newPlayerRacks[myPlayerIndex][toIndex] === null) {
            newPlayerRacks[myPlayerIndex][toIndex] = newPlayerRacks[myPlayerIndex][fromIndex];
            newPlayerRacks[myPlayerIndex][fromIndex] = null;
        } else {
            const [movedLetter] = newPlayerRacks[myPlayerIndex].splice(fromIndex, 1);
            newPlayerRacks[myPlayerIndex].splice(toIndex, 0, movedLetter);
        }

        const updatedState = {
            ...gameState,
            playerRacks: newPlayerRacks,
        };
        // --- KĽÚČOVÁ ZMENA: Namiesto odoslania na server, vrátime aktualizovaný stav ---
        // sendPlayerAction(socket, gameIdToJoin, 'updateGameState', updatedState); 
        return updatedState;
    }

    let letterToMove = null;

    if (source.type === 'board') {
        letterToMove = { ...newBoard[source.x][source.y] };
        newBoard[source.x][source.y] = null;
        if (letterToMove && letterToMove.letter === '') {
            letterToMove.assignedLetter = null;
        }
    } else if (source.type === 'rack') {
        if (source.playerIndex !== myPlayerIndex) {
            console.log("Nemôžeš presúvať písmená z racku iného hráča.");
            return gameState;
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
            return gameState;
        }
    }

    if (!letterToMove || letterToMove.id === undefined) {
        console.warn("Nepodarilo sa nájsť platné písmeno na presun alebo chýba ID.");
        return gameState;
    }

    if (target.type === 'rack') {
        if (target.playerIndex !== myPlayerIndex) {
            console.log("Nemôžeš presúvať písmená na rack iného hráča.");
            return gameState;
        }

        let targetRack = newPlayerRacks[myPlayerIndex];

        if (target.index !== undefined && targetRack[target.index] === null) {
            targetRack[target.index] = letterToMove;
        }
        else if (letterToMove.originalRackIndex !== undefined && targetRack[letterToMove.originalRackIndex] === null) {
            targetRack[letterToMove.originalRackIndex] = letterToMove;
        }
        else {
            const firstEmptyIndex = targetRack.findIndex(l => l === null);
            if (firstEmptyIndex !== -1) {
                targetRack[firstEmptyIndex] = letterToMove;
            } else {
                console.warn("Rack je plný, písmeno sa nedá vrátiť (rollback by bol potrebný).");
                alert("Rack je plný, písmeno sa nedá vrátiť.");
                return gameState;
            }
        }
    } else if (target.type === 'board') {
        if (gameState.currentPlayerIndex !== myPlayerIndex) {
            console.log("Nemôžeš umiestniť písmeno na dosku, keď nie je tvoj ťah.");
            return gameState;
        }
        if (newBoard[target.x][target.y] !== null) {
            console.log("Cieľové políčko na doske je už obsadené, nemôžeš tam položiť písmeno.");
            alert("Cieľové políčko na doske je už obsadené!");
            return gameState;
        }

        newBoard[target.x][target.y] = { ...letterToMove, originalRackIndex: letterData.originalRackIndex };
        if (letterToMove.letter === '') {
            setJokerTileCoords({ x: target.x, y: target.y });
            setShowLetterSelectionModal(true);
        }
    } else if (target.type === 'exchangeZone') {
        newExchangeZoneLetters.push(letterToMove);
    }

    const updatedState = {
        ...gameState,
        playerRacks: newPlayerRacks,
        board: newBoard,
        exchangeZoneLetters: newExchangeZoneLetters,
        hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, gameState.boardAtStartOfTurn).length > 0,
        hasMovedToExchangeZoneThisTurn: newExchangeZoneLetters.length > 0,
    };

    // --- KĽÚČOVÁ ZMENA: Namiesto odoslania na server, vrátime aktualizovaný stav ---
    // sendPlayerAction(socket, gameIdToJoin, 'updateGameState', updatedState);
    return updatedState;
};