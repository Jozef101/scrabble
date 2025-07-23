// src/utils/moveLetterLogic.js
import { RACK_SIZE } from './constants'; // Stále potrebné pre RACK_SIZE v logike racku
import { getPlacedLettersDuringCurrentTurn } from './gameLogic'; // Stále potrebné pre hasPlacedOnBoardThisTurn
import { sendPlayerAction } from './socketHandlers';

/**
 * Spracováva logiku presunu písmena medzi rackom, doskou a výmennou zónou.
 * Táto funkcia teraz vykonáva optimistickú aktualizáciu stavu na klientovi
 * a následne odosiela akciu na server. Server je zodpovedný za autoritatívnu
 * aktualizáciu stavu hry, ktorá potom prepíše lokálny stav.
 *
 * @param {object} params - Objekt obsahujúci všetky potrebné parametre.
 * @param {object} params.gameState - Aktuálny stav hry (posledný známy stav z GamePage).
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
    gameState, // Používame gameState z closure, ale pre aktuálny stav je lepšie použiť prevState v setGameState
    setGameState, // Teraz ju budeme volať pre optimistické aktualizácie
    myPlayerIndex,
    setJokerTileCoords,
    setShowLetterSelectionModal,
    socket,
    gameIdToJoin,
}) => (letterData, source, target) => {
    // Základné klientské kontroly, ktoré platia pre všetky presuny (hra skončila alebo nie si pripojený)
    if (gameState.isGameOver || myPlayerIndex === null) {
        console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený).");
        return;
    }

    // Kontrola, či sa snažíš presunúť už potvrdené písmeno z dosky
    if (source.type === 'board' && gameState.boardAtStartOfTurn[source.x][source.y] !== null) {
        console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
        return; // Vrátime sa, žiadna lokálna aktualizácia
    }

    // Pridaná kontrola pre drag-and-drop z racku iného hráča
    if (source.type === 'rack' && source.playerIndex !== myPlayerIndex) {
        console.log("Nemôžeš presúvať písmená z racku iného hráča.");
        return;
    }

    // NOVÁ KONTROLA: Ak je cieľové políčko na doske už obsadené, zabránime presunu
    if (target.type === 'board' && gameState.board[target.x][target.y] !== null) {
        console.log("Cieľové políčko na doske je už obsadené, nemôžeš tam položiť písmeno.");
        alert("Cieľové políčko na doske je už obsadené!"); // Pridáme aj alert pre používateľa
        return;
    }

    // KLÚČOVÁ ZMENA: Rozlíšenie medzi presunmi v rámci racku a ostatnými presunmi
    const isRackInternalMove = (source.type === 'rack' && target.type === 'rack' && source.playerIndex === myPlayerIndex);

    // Kontrola ťahu pre akcie, ktoré ovplyvňujú spoločný herný stav (doska, výmenná zóna, vrátenie z dosky)
    // Ak ide o interný presun v racku, túto kontrolu preskočíme.
    if (!isRackInternalMove && gameState.currentPlayerIndex !== myPlayerIndex) {
        console.log("Nemôžeš vykonať túto akciu, keď nie je tvoj ťah.");
        alert("Nie je tvoj ťah!"); // Pridáme aj alert pre používateľa
        return;
    }

    // Použijeme premennú na uloženie stavu, ktorý sa odošle na server
    let stateToUpdateAndSend = null;

    setGameState(prevState => {
        let newPlayerRacks = prevState.playerRacks.map(rack => [...rack]);
        let newBoard = prevState.board.map(row => [...row]);
        let newExchangeZoneLetters = [...prevState.exchangeZoneLetters];

        // Spracovanie presunu v rámci racku (špeciálny prípad - povolené vždy)
        if (isRackInternalMove) { // Používame novú premennú isRackInternalMove
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

            // Normalizácia racku po preusporiadaní (z GitHub verzie)
            // TOTO SA APLIKUJE LEN PRI INTERNOM PRESUNE V RACKU
            newPlayerRacks[myPlayerIndex] = newPlayerRacks[myPlayerIndex].filter(l => l !== undefined && l !== null);
            while (newPlayerRacks[myPlayerIndex].length < RACK_SIZE) { newPlayerRacks[myPlayerIndex].push(null); }
            while (newPlayerRacks[myPlayerIndex].length > RACK_SIZE) { newPlayerRacks[myPlayerIndex].pop(); }

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
            letterToMove = { ...letterData };
            // Uistíme sa, že na pôvodnej pozícii v racku je null
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
            let targetRack = newPlayerRacks[myPlayerIndex];
            let targetIndex = -1;

            // Prioritizujeme cieľový slot, na ktorý používateľ ťukol/pretiahol, ak je prázdny.
            // Toto je pre drag-and-drop na konkrétny prázdny slot.
            if (target.index !== undefined && targetRack[target.index] === null) {
                targetIndex = target.index;
            }
            // Ak pôvodná pozícia existuje a je prázdna, vrátime tam.
            // Toto je pre pravé kliknutie (kde target.index nie je definovaný)
            // alebo ak drag-and-drop na target.index zlyhal.
            else if (letterToMove.originalRackIndex !== undefined && targetRack[letterToMove.originalRackIndex] === null) {
                targetIndex = letterToMove.originalRackIndex;
            }
            // Inak nájdeme prvý voľný slot.
            else {
                targetIndex = targetRack.findIndex(l => l === null);
            }

            if (targetIndex !== -1) {
                targetRack[targetIndex] = letterToMove;
            } else {
                console.warn("Rack je plný, písmeno sa nedá vrátiť.");
                alert("Rack je plný, písmeno sa nedá vrátiť.");
                return prevState; // Vrátime pôvodný stav
            }
            // KLÚČOVÁ ZMENA: ODSTRÁNENÁ NORMALIZÁCIA RACKU PRE TENTO PRÍPAD.
            // Písmená sa nebudú automaticky posúvať doľava.

        } else if (target.type === 'board') {
            // Keď umiestňujeme písmeno na dosku, explicitne uložíme originalRackIndex
            newBoard[target.x][target.y] = { ...letterToMove, originalRackIndex: letterData.originalRackIndex };
            // Modálne okno žolíka sa spúšťa v GamePage.js, ale túto logiku tu ponechávame pre konzistenciu
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
    // A iba ak nejde o interný presun v racku, ktorý server nepotrebuje vedieť
    if (stateToUpdateAndSend && !isRackInternalMove) {
      sendPlayerAction(socket, gameIdToJoin, 'moveLetter', {
          letterData: {
              id: letterData.id,
              letter: letterData.letter,
              value: letterData.value,
              assignedLetter: letterData.assignedLetter,
              originalRackIndex: letterData.originalRackIndex,
          },
          source: { ...source },
          target: { ...target }
      });
    }
};
