// src/utils/socketHandlers.js
import { BOARD_SIZE, RACK_SIZE } from './constants'; // Importujeme konštanty

// Funkcia na nastavenie Socket.IO poslucháčov
// Pridaný parameter 'displayMessage' pre vlastné správy namiesto alert()
export const setupSocketListeners = (socket, setConnectionStatus, setMyPlayerIndex, setGameState, setChatMessages, setWaitingForSecondPlayer, displayMessage) => {
    // KLÚČOVÁ ZMENA: ODSTRÁNENÝ DUPLICITNÝ 'connect' POSLUCHÁČ
    // Logika pripojenia a emitovania 'joinGame' je teraz plne spravovaná v useSocketConnection.js

    socket.on('disconnect', (reason) => {
        setConnectionStatus('Odpojený');
        console.log('Odpojený od servera Socket.IO. Dôvod:', reason);
        // Pri odpojení servera alebo hráča resetujeme stav hry
        setGameState({
            letterBag: [],
            playerRacks: Array(2).fill(null).map(() => Array(RACK_SIZE).fill(null)), // Používame RACK_SIZE
            board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)), // Používame BOARD_SIZE
            boardAtStartOfTurn: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
            isFirstTurn: true,
            playerScores: [0, 0],
            currentPlayerIndex: 0,
            exchangeZoneLetters: [],
            hasPlacedOnBoardThisTurn: false,
            hasMovedToExchangeZoneThisTurn: false,
            consecutivePasses: 0,
            isGameOver: false,
            isBagEmpty: false,
            hasInitialGameStateReceived: false, // Resetujeme aj toto
            playerNicknames: {}, // KLÚČOVÁ ZMENA: Reset prezývok
            highlightedLetters: [], // KLÚČOVÁ ZMENA: Reset zvýraznených písmen
        });
        setMyPlayerIndex(null);
        // setChatMessages([]); // Môžeme ponechať históriu chatu, ak chceme
        setWaitingForSecondPlayer(true); // Reset na true pri odpojení
        if (displayMessage) {
            displayMessage(`Odpojený od servera. Dôvod: ${reason}`, 'error');
        }
    });

    socket.on('playerAssigned', (playerIndex) => {
        setMyPlayerIndex(playerIndex);
        console.log(`Bol si priradený ako Hráč ${playerIndex + 1}.`);
        console.log(`DEBUG: myPlayerIndex po priradení: ${playerIndex}`);
    });

    socket.on('gameStateUpdate', (serverGameState) => {
        console.log('Prijatá aktualizácia stavu hry (RAW):', serverGameState);
        if (!serverGameState || typeof serverGameState !== 'object') {
            console.warn("Prijatý neplatný (undefined, null alebo nie objekt) stav hry zo servera cez Socket.IO. Preskakujem aktualizáciu v socketHandlers.");
            return; // Preskočíme aktualizáciu, ak je stav neplatný
        }
        
        // DÔLEŽITÁ OPRAVA: Kontrolujeme počet hráčov pri každej aktualizácii stavu hry
        const numberOfPlayers = serverGameState.playerRacks.filter(rack => rack !== null).length;
        console.log("Počet aktívnych hráčov v gameStateUpdate:", numberOfPlayers);
        if (numberOfPlayers < 2) {
            setWaitingForSecondPlayer(true);
        } else {
            setWaitingForSecondPlayer(false);
        }

        // KLÚČOVÁ ZMENA: setGameState teraz prijíma celý objekt serverGameState,
        // ktorý už obsahuje playerNicknames a upravený players objekt.
        setGameState(prevState => ({
            ...prevState,
            ...serverGameState,
            hasInitialGameStateReceived: true // Teraz vieme, že máme kompletný stav
        }));
    });

    socket.on('gameError', (message) => {
        console.error('Chyba hry:', message);
        // KLÚČOVÁ ZMENA: Používame displayMessage namiesto alert()
        if (displayMessage) {
            displayMessage(`Chyba hry: ${message}`, 'error');
        }
    });

    socket.on('waitingForPlayers', (message) => {
        console.log(`Čakám na hráčov: ${message}`);
        setWaitingForSecondPlayer(true);
        if (displayMessage) {
            displayMessage(message, 'info');
        }
    });

    socket.on('gameStarted', () => {
        console.log("Server message (game started): Hra začala!");
        setWaitingForSecondPlayer(false); // Zruší stav čakania
        if (displayMessage) {
            displayMessage("Hra začala!", 'success');
        }
    });

    socket.on('gameReset', (message) => {
        console.log('Hra bola resetovaná.');
        // Resetujeme stav klienta na počiatočný
        setGameState({
            letterBag: [],
            playerRacks: Array(2).fill(null).map(() => Array(RACK_SIZE).fill(null)),
            board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
            boardAtStartOfTurn: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
            isFirstTurn: true,
            playerScores: [0, 0],
            currentPlayerIndex: 0,
            exchangeZoneLetters: [],
            hasPlacedOnBoardThisTurn: false,
            hasMovedToExchangeZoneThisTurn: false,
            consecutivePasses: 0,
            isGameOver: false,
            isBagEmpty: false,
            hasInitialGameStateReceived: false, // Po resete potrebujeme znova inicializovať
            playerNicknames: {}, // KLÚČOVÁ ZMENA: Reset prezývok pri resete hry
            highlightedLetters: [], // KLÚČOVÁ ZMENA: Reset zvýraznených písmen
        });
        setMyPlayerIndex(null);
        // setChatMessages([]); // Môžeme ponechať históriu chatu
        setWaitingForSecondPlayer(true); // Reset na true pri resete hry
        // KLÚČOVÁ ZMENA: Používame displayMessage namiesto alert()
        if (displayMessage) {
            displayMessage(`Hra bola resetovaná: ${message}`, 'info');
        }
    });

    socket.on('receiveChatMessage', (message) => {
        // KLÚČOVÁ ZMENA: Správa teraz obsahuje senderNickname
        setChatMessages((prevMessages) => [...prevMessages, message]);
    });

    socket.on('chatHistory', (history) => {
        console.log('socketHandlers: chatHistory event received, history length:', history.length);
        setChatMessages(history);
        console.log('socketHandlers: Chat history applied to state.');
    });
};

// Funkcia na odosielanie chatových správ
// KLÚČOVÁ ZMENA: Táto funkcia už nie je priamo používaná pre chat, ale je ponechaná pre konzistentnosť.
// Používame sendPlayerAction.
export const sendChatMessage = (socket, gameId, message) => {
    if (socket && socket.connected && message.trim() !== '') {
        console.log(`Odosielam chat správu pre hru ${gameId}: ${message}`);
        socket.emit('playerAction', {
            gameId: gameId,
            type: 'chatMessage', // Typ akcie je 'chatMessage'
            payload: message    // Obsah správy je v payload
        });
    } else {
        console.warn('Socket nie je pripojený alebo správa je prázdna, správu nemožno odoslať.');
    }
};

// Funkcia na odosielanie akcií hráča
export const sendPlayerAction = (socket, gameId, actionType, payload) => {
    if (socket && socket.connected) { // Pridaná kontrola, či je socket pripojený
        // Posielame gameId spolu s typom akcie a dátami
        socket.emit('playerAction', { gameId, type: actionType, payload });
    } else {
        console.warn('Socket nie je pripojený, akcia nemôže byť odoslaná.');
    }
};
