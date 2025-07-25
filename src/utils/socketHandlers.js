// src/utils/socketHandlers.js
import { BOARD_SIZE, RACK_SIZE } from './constants'; // Importujeme konštanty

// Funkcia na nastavenie Socket.IO poslucháčov
export const setupSocketListeners = (socket, setConnectionStatus, setMyPlayerIndex, setGameState, setChatMessages, setWaitingForSecondPlayer) => { // NOVÉ: Pridaný setWaitingForSecondPlayer
    socket.on('connect', () => {
        setConnectionStatus('Pripojený');
        console.log('Pripojený k serveru Socket.IO.');
        // KLÚČOVÁ ZMENA: Odstránené volanie socket.emit('joinGame') odtiaľto.
        // Túto zodpovednosť teraz preberá GamePage.js, aby sa zabezpečilo, že userId je vždy prítomné.
    });

    socket.on('disconnect', () => {
        setConnectionStatus('Odpojený');
        console.log('Odpojený od servera Socket.IO.');
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
        });
        setMyPlayerIndex(null);
        // setChatMessages([]);
        setWaitingForSecondPlayer(true); // NOVÉ: Reset na true pri odpojení
    });

    socket.on('playerAssigned', (playerIndex) => {
        setMyPlayerIndex(playerIndex);
        console.log(`Bol si priradený ako Hráč ${playerIndex + 1}.`);
        console.log(`DEBUG: myPlayerIndex po priradení: ${playerIndex}`);
    });

    socket.on('gameStateUpdate', (serverGameState) => {
        console.log('Prijatá aktualizácia stavu hry (RAW):', serverGameState);
        // KĽÚČOVÁ ZMENA: Pridávame kontrolu pre serverGameState pred aktualizáciou stavu
        if (!serverGameState || typeof serverGameState !== 'object') {
            console.warn("Prijatý neplatný (undefined, null alebo nie objekt) stav hry zo servera cez Socket.IO. Preskakujem aktualizáciu v socketHandlers.");
            return; // Preskočíme aktualizáciu, ak je stav neplatný
        }
        setGameState(prevState => ({
            ...prevState,
            ...serverGameState,
            hasInitialGameStateReceived: true // Teraz vieme, že máme kompletný stav
        }));
    });

    socket.on('gameError', (message) => {
        alert(`Chyba hry: ${message}`);
        console.error('Chyba hry:', message);
        // KLÚČOVÁ ZMENA: Odstránené setGameState(prevState => ({ ...prevState, hasInitialGameStateReceived: false }));
        // Tento reset by mal byť spracovaný v GamePage.js na základe disconnect alebo gameReset.
    });

    // Nový poslucháč pre stav čakania
    socket.on('waitingForPlayers', (message) => {
        console.log(`Čakám na hráčov: ${message}`);
        // KĽÚČOVÁ ZMENA: Už neresetujeme celý gameState ani hasInitialGameStateReceived.
        // Iba nastavíme stav pre zobrazenie prekryvnej vrstvy.
        setWaitingForSecondPlayer(true);
    });

    // NOVÉ: Poslucháč pre udalosť 'gameStarted' zo servera
    socket.on('gameStarted', () => {
        console.log("Server message (game started): Hra začala!");
        setWaitingForSecondPlayer(false); // NOVÉ: Zruší stav čakania
    });


    socket.on('gameReset', (message) => {
        alert(`Hra bola resetovaná: ${message}`);
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
        });
        setMyPlayerIndex(null);
        // setChatMessages([]);
        setWaitingForSecondPlayer(true); // NOVÉ: Reset na true pri resete hry
    });

    socket.on('receiveChatMessage', (message) => {
        setChatMessages((prevMessages) => [...prevMessages, message]);
    });

    socket.on('chatHistory', (history) => {
        console.log('socketHandlers: chatHistory event received, history length:', history.length);
        setChatMessages(history);
        console.log('socketHandlers: Chat history applied to state.');
    });
};

// Funkcia na odosielanie chatových správ
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
// Teraz prijíma gameId
export const sendPlayerAction = (socket, gameId, actionType, payload) => {
    if (socket && socket.connected) { // Pridaná kontrola, či je socket pripojený
        // Posielame gameId spolu s typom akcie a dátami
        socket.emit('playerAction', { gameId, type: actionType, payload });
    } else {
        console.warn('Socket nie je pripojený, akcia nemôže byť odoslaná.');
    }
};
