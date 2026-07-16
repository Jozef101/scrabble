import { RACK_SIZE } from './constants';
import { getPlacedLettersDuringCurrentTurn } from './gameLogic';
import { sendPlayerAction } from './socketHandlers';

/**
 * Čistá funkcia, ktorá aplikuje presun písmena na daný stav hry.
 * Nevykonáva žiadne vedľajšie efekty (nevolá setGameState, neposiela akcie).
 * @param {object} gameState Aktuálny stav hry.
 * @param {object} action Objekt s detailmi o akcii: { letterData, source, target, playerIndex }.
 * @returns {object} Nový, upravený stav hry.
 */
export const applyMoveLetter = (gameState, action) => {
    const { letterData, source, target, playerIndex } = action;

    // Vytvoríme kópie polí, aby sme neupravovali pôvodný stav (immutability)
    let newPlayerRacks = gameState.playerRacks.map(rack => rack ? [...rack] : null);
    let newBoard = gameState.board.map(row => [...row]);
    let newExchangeZoneLetters = [...gameState.exchangeZoneLetters];

    // Špeciálny prípad: presun v rámci stojana
    if (source.type === 'rack' && target.type === 'rack') {
        const fromIndex = source.index;
        const toIndex = target.index;

        if (newPlayerRacks[playerIndex]?.[toIndex] === null) {
            newPlayerRacks[playerIndex][toIndex] = newPlayerRacks[playerIndex][fromIndex];
            newPlayerRacks[playerIndex][fromIndex] = null;
        } else if (newPlayerRacks[playerIndex]) {
            const [movedLetter] = newPlayerRacks[playerIndex].splice(fromIndex, 1);
            newPlayerRacks[playerIndex].splice(toIndex, 0, movedLetter);
        }
        return { ...gameState, playerRacks: newPlayerRacks };
    }

    // Nájdenie a odstránenie písmena zo zdroja
    let letterToMove = null;
    if (source.type === 'board') {
        letterToMove = { ...newBoard[source.x][source.y] };
        newBoard[source.x][source.y] = null;
        if (letterToMove.letter === '') letterToMove.assignedLetter = null;
    } else if (source.type === 'rack') {
        letterToMove = { ...letterData };
        if (newPlayerRacks[playerIndex]) {
            newPlayerRacks[playerIndex][source.index] = null;
        }
    } else if (source.type === 'exchangeZone') {
        const index = newExchangeZoneLetters.findIndex(l => l.id === letterData.id);
        if (index !== -1) {
            [letterToMove] = newExchangeZoneLetters.splice(index, 1);
            if (letterToMove.letter === '') letterToMove.assignedLetter = null;
        }
    }

    if (!letterToMove) return gameState; // Ak sa písmeno nenašlo, vrátime pôvodný stav

    // Umiestnenie písmena na cieľ
    if (target.type === 'rack') {
        const targetRack = newPlayerRacks[playerIndex];
        if (targetRack) {
            // PRIORITA 1: Umiestniť na konkrétny voľný slot, kam hráč ťahal.
            if (target.index !== undefined && targetRack[target.index] === null) {
                targetRack[target.index] = letterToMove;
            }
            // PRIORITA 2: Vrátiť na pôvodné miesto (pre pravé kliknutie).
            else if (letterToMove.originalRackIndex !== undefined && targetRack[letterToMove.originalRackIndex] === null) {
                targetRack[letterToMove.originalRackIndex] = letterToMove;
            }
            // PRIORITA 3: Ak všetko ostatné zlyhá, nájsť prvé voľné miesto.
            else {
                const firstEmptyIndex = targetRack.findIndex(l => l === null);
                if (firstEmptyIndex !== -1) {
                    targetRack[firstEmptyIndex] = letterToMove;
                }
            }
        }
    } else if (target.type === 'board') {
        const { originalRackIndex, ...letterWithoutOriginalIndex } = letterToMove;
        newBoard[target.x][target.y] = letterData.originalRackIndex !== undefined
            ? { ...letterWithoutOriginalIndex, originalRackIndex: letterData.originalRackIndex }
            : letterWithoutOriginalIndex;
    } else if (target.type === 'exchangeZone') {
        newExchangeZoneLetters.push(letterToMove);
    }
    
    // Vypočítame pomocné stavy, podobne ako predtým
    const placedLettersCount = getPlacedLettersDuringCurrentTurn(newBoard, gameState.boardAtStartOfTurn).length;

    return {
        ...gameState,
        playerRacks: newPlayerRacks,
        board: newBoard,
        exchangeZoneLetters: newExchangeZoneLetters,
        hasPlacedOnBoardThisTurn: placedLettersCount > 0,
        hasMovedToExchangeZoneThisTurn: newExchangeZoneLetters.length > 0,
    };
};


/**
 * Pôvodná funkcia, teraz refaktorizovaná.
 * Vykonáva lokálne validácie, optimisticky aktualizuje stav a posiela malú akciu na server.
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

    // --- Lokálne validácie (zostávajú nezmenené) ---
    if (gameState.isGameOver || myPlayerIndex === null) {
        console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený).");
        return;
    }
    if (source.type === 'board' && gameState.boardAtStartOfTurn[source.x][source.y] !== null) {
        alert("Nemôžeš presunúť zamknuté písmeno z dosky.");
        return;
    }
    if (target.type === 'board' && gameState.board[target.x][target.y] !== null) {
        alert("Cieľové políčko na doske je už obsadené!");
        return;
    }
    if (target.type === 'rack' && source.type !== 'rack' && gameState.playerRacks[myPlayerIndex].filter(l => l !== null).length >= RACK_SIZE) {
        alert("Rack je plný, písmeno sa nedá vrátiť.");
        return;
    }
    if (target.type === 'board' && gameState.currentPlayerIndex !== myPlayerIndex) {
        return;
    }
    // --- Koniec validácií ---


    // 1. Vytvoríme akčný objekt
    const action = { letterData, source, target, playerIndex: myPlayerIndex };

    // 2. Optimisticky aplikujeme zmenu na lokálny stav pomocou funkcionálnej formy setState.
    // Dôvod: pri rýchlych ťahoch (pred re-renderom) by sa inak použil stale gameState zo closure.
    setGameState(prevState => applyMoveLetter(prevState, action));

    // 3. Pošleme malý akčný objekt na server
    sendPlayerAction(socket, gameIdToJoin, 'moveLetter', {
        letterData,
        source,
        target,
    });
    
    // 4. Ak ide o žolíka, zobrazíme modálne okno (táto logika zostáva na klientovi)
    if (target.type === 'board' && letterData.letter === '') {
        setJokerTileCoords({ x: target.x, y: target.y });
        setShowLetterSelectionModal(true);
    }
};
