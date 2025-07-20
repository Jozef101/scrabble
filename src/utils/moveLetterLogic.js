// src/utils/moveLetterLogic.js
import { RACK_SIZE } from './constants';
import { getPlacedLettersDuringCurrentTurn } from './gameLogic';
import { sendPlayerAction } from './socketHandlers'; // Predpokladáme, že sendPlayerAction je tu dostupný

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
    // Základné kontroly, ktoré platia pre všetky presuny, bez ohľadu na ťah
    if (gameState.isGameOver || myPlayerIndex === null) {
        console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený).");
        return;
    }

    let stateToUpdateAndSend = null; // Bude obsahovať stav na odoslanie, ak je povolené

    setGameState(prevState => {
        let newPlayerRacks = prevState.playerRacks.map(rack => [...rack]);
        let newBoard = prevState.board.map(row => [...row]);
        let newExchangeZoneLetters = [...prevState.exchangeZoneLetters];

        // Kontrola, či sa snažíš presunúť už potvrdené písmeno z dosky
        if (source.type === 'board' && prevState.boardAtStartOfTurn[source.x][source.y] !== null) {
            console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
            return prevState; // Vrátime pôvodný stav, ak je neplatný presun
        }

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

            // ODSTRÁNENÁ NORMALIZÁCIA RACKU:
            // newPlayerRacks[myPlayerIndex] = newPlayerRacks[myPlayerIndex].filter(l => l !== undefined && l !== null);
            // while (newPlayerRacks[myPlayerIndex].length < RACK_SIZE) { newPlayerRacks[myPlayerIndex].push(null); }
            // while (newPlayerRacks[myPlayerIndex].length > RACK_SIZE) { newPlayerRacks[myPlayerIndex].pop(); }

            stateToUpdateAndSend = { // Zachytíme stav, ktorý sa odošle
                ...prevState,
                playerRacks: newPlayerRacks,
            };
            return stateToUpdateAndSend; // Vrátime nový stav pre React
        }

        let letterToMove = null;

        // Určenie písmena na presun a jeho odstránenie zo zdroja
        if (source.type === 'board') {
            letterToMove = { ...newBoard[source.x][source.y] };
            newBoard[source.x][source.y] = null;
            if (letterToMove && letterToMove.letter === '') {
                letterToMove.assignedLetter = null; // Žolík stráca priradené písmeno pri návrate
            }
        } else if (source.type === 'rack') {
            if (source.playerIndex !== myPlayerIndex) {
                console.log("Nemôžeš presúvať písmená z racku iného hráča.");
                return prevState;
            }
            // Používame letterData priamo, ktorá už obsahuje originalRackIndex z useDrag
            letterToMove = { ...letterData };
            newPlayerRacks[myPlayerIndex][source.index] = null; // Toto vytvorí prázdny slot na pôvodnej pozícii
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

            // Prioritizujeme cieľový slot, na ktorý používateľ ťukol/pretiahol, ak je prázdny.
            if (target.index !== undefined && targetRack[target.index] === null) {
                targetRack[target.index] = letterToMove;
            }
            // Ak cieľový slot nie je prázdny, alebo target.index nie je definovaný,
            // pokúsime sa vrátiť písmeno na jeho pôvodnú pozíciu (ak je voľná).
            else if (letterToMove.originalRackIndex !== undefined && targetRack[letterToMove.originalRackIndex] === null) {
                targetRack[letterToMove.originalRackIndex] = letterToMove;
            }
            // Ak ani pôvodná pozícia nie je voľná, nájdeme prvý voľný slot.
            else {
                const firstEmptyIndex = targetRack.findIndex(l => l === null);
                if (firstEmptyIndex !== -1) {
                    targetRack[firstEmptyIndex] = letterToMove;
                } else {
                    console.warn("Rack je plný, písmeno sa nedá vrátiť (rollback by bol potrebný).");
                    alert("Rack je plný, písmeno sa nedá vrátiť.");
                    return prevState; // Vrátime pôvodný stav
                }
            }

        } else if (target.type === 'board') {
            // Používame prevState.currentPlayerIndex, ktorý je aktuálny v rámci setGameState callbacku
            if (prevState.currentPlayerIndex !== myPlayerIndex) {
                console.log("Nemôžeš umiestniť písmeno na dosku, keď nie je tvoj ťah.");
                return prevState;
            }
            // NOVÁ KONTROLA: Ak je cieľové políčko na doske už obsadené, zabránime presunu
            if (newBoard[target.x][target.y] !== null) {
                console.log("Cieľové políčko na doske je už obsadené, nemôžeš tam položiť písmeno.");
                alert("Cieľové políčko na doske je už obsadené!"); // Pridáme aj alert pre používateľa
                return prevState; // Vrátime pôvodný stav
            }

            // Keď umiestňujeme písmeno na dosku, explicitne uložíme originalRackIndex
            newBoard[target.x][target.y] = { ...letterToMove, originalRackIndex: letterData.originalRackIndex };
            if (letterToMove.letter === '') {
                setJokerTileCoords({ x: target.x, y: target.y });
                setShowLetterSelectionModal(true);
            }
        } else if (target.type === 'exchangeZone') {
            newExchangeZoneLetters.push(letterToMove);
        }

        // Vytvoríme kompletný nový stav na základe predchádzajúceho stavu a vykonaných zmien
        stateToUpdateAndSend = {
            ...prevState,
            playerRacks: newPlayerRacks,
            board: newBoard,
            exchangeZoneLetters: newExchangeZoneLetters,
            hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, prevState.boardAtStartOfTurn).length > 0,
            hasMovedToExchangeZoneThisTurn: newExchangeZoneLetters.length > 0,
        };
        return stateToUpdateAndSend; // Vrátime nový stav pre React
    });

    // Odošleme akciu na server iba vtedy, ak bol stav úspešne aktualizovaný (t.j. nebol vrátený pôvodný stav kvôli neplatnému ťahu)
    // Aplikujeme logiku, že rack-to-rack presuny mimo ťahu sa neposielajú na server.
    // Ak stateToUpdateAndSend nie je null (t.j. došlo k platnej zmene stavu)
    // A ak je to ťah aktuálneho hráča, alebo ak ide o rack-to-rack presun, ktorý sa má poslať.
    // V tejto verzii sa rack-to-rack presuny mimo ťahu NEPOSIELAJÚ na server.
    // Iba ak je to ťah aktuálneho hráča, posielame update.
    if (stateToUpdateAndSend && gameState.currentPlayerIndex === myPlayerIndex) {
        sendPlayerAction(socket, gameIdToJoin, 'updateGameState', stateToUpdateAndSend);
    }
};
