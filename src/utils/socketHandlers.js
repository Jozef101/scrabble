// src/utils/socketHandlers.js

// Funkcia na nastavenie Socket.IO poslucháčov
export const setupSocketListeners = (socket, setConnectionStatus, setMyPlayerIndex, setGameState, setChatMessages, GAME_ID_TO_JOIN) => {
    socket.on('connect', () => {
        setConnectionStatus('Pripojený');
        console.log('Pripojený k serveru Socket.IO.');
        // Po pripojení sa pokúsime pripojiť k SPECIFICKEJ hre pomocou ID
        socket.emit('joinGame', GAME_ID_TO_JOIN); 
    });

    socket.on('disconnect', () => {
        setConnectionStatus('Odpojený');
        console.log('Odpojený od servera Socket.IO.');
        // Pri odpojení servera alebo hráča resetujeme stav hry
        setGameState({
            letterBag: [],
            playerRacks: Array(7).fill(null).map(() => Array(7).fill(null)), // Používame RACK_SIZE z constants, ak je to možné
            board: Array(15).fill(null).map(() => Array(15).fill(null)), // Používame BOARD_SIZE z constants, ak je to možné
            boardAtStartOfTurn: Array(15).fill(null).map(() => Array(15).fill(null)),
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
        setChatMessages([]);
    });

    socket.on('playerAssigned', (playerIndex) => {
        setMyPlayerIndex(playerIndex);
        console.log(`Bol si priradený ako Hráč ${playerIndex + 1}.`);
        console.log(`DEBUG: myPlayerIndex po priradení: ${playerIndex}`);
    });

    socket.on('gameStateUpdate', (serverGameState) => {
        console.log('Prijatá aktualizácia stavu hry:', serverGameState);
        setGameState(prevState => ({
            ...prevState,
            ...serverGameState,
            hasInitialGameStateReceived: true // Teraz vieme, že máme kompletný stav
        }));
    });

    socket.on('gameError', (message) => {
        alert(`Chyba hry: ${message}`);
        console.error('Chyba hry:', message);
        // Pri chybe by sme mohli chcieť resetovať stav alebo zobraziť špecifickú správu.
        // Ponechávam tvoju pôvodnú logiku, ktorá nastaví hasInitialGameStateReceived na false.
        setGameState(prevState => ({ ...prevState, hasInitialGameStateReceived: false }));
    });

    // Nový poslucháč pre stav čakania
    socket.on('waitingForPlayers', (message) => {
        console.log(`Čakám na hráčov: ${message}`);
        // Resetujeme stav hry len natoľko, aby sa zobrazila správa o čakaní
        // Používame rovnaké defaultné hodnoty ako pri disconnect
        setGameState(prevState => ({
            ...prevState,
            letterBag: [],
            playerRacks: Array(7).fill(null).map(() => Array(7).fill(null)),
            board: Array(15).fill(null).map(() => Array(15).fill(null)),
            boardAtStartOfTurn: Array(15).fill(null).map(() => Array(15).fill(null)),
            playerScores: [0, 0],
            exchangeZoneLetters: [],
            hasPlacedOnBoardThisTurn: false,
            hasMovedToExchangeZoneThisTurn: false,
            consecutivePasses: 0,
            isGameOver: false,
            isBagEmpty: false,
            hasInitialGameStateReceived: false, // Dôležité: nastaviť na false
        }));
    });


    socket.on('gameReset', (message) => {
        alert(`Hra bola resetovaná: ${message}`);
        console.log('Hra bola resetovaná.');
        // Resetujeme stav klienta na počiatočný
        setGameState({
            letterBag: [],
            playerRacks: Array(7).fill(null).map(() => Array(7).fill(null)),
            board: Array(15).fill(null).map(() => Array(15).fill(null)),
            boardAtStartOfTurn: Array(15).fill(null).map(() => Array(15).fill(null)),
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
        setChatMessages([]);
        // Znovu sa pokúsime pripojiť k hre po resete s pôvodným gameId
        socket.emit('joinGame', GAME_ID_TO_JOIN); 
    });

    socket.on('receiveChatMessage', (message) => {
        setChatMessages((prevMessages) => [...prevMessages, message]);
    });

    socket.on('chatHistory', (history) => {
        setChatMessages(history);
    });
};

// Funkcia na odosielanie chatových správ
export const sendChatMessage = (socket, gameId, message) => {
    if (socket && socket.connected && message.trim() !== '') { // Pridal som kontrolu socket.socket.connected
        console.log(`Odosielam chat správu pre hru ${gameId}: ${message}`);
        // KĽÚČOVÁ ZMENA: Posielame 'playerAction' event, aby server správne reagoval
        socket.emit('playerAction', { 
            gameId: gameId, 
            type: 'chatMessage', // Typ akcie je 'chatMessage'
            payload: message     // Obsah správy je v payload
        });
    } else {
        console.warn('Socket nie je pripojený alebo správa je prázdna, správu nemožno odoslať.');
    }
};

// Funkcia na odosielanie akcií hráča
// Teraz prijíma gameId
export const sendPlayerAction = (socket, gameId, actionType, payload) => {
    // Posielame gameId spolu s typom akcie a dátami
    socket.emit('playerAction', { gameId, type: actionType, payload });
};