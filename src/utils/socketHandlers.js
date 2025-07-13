// src/utils/socketHandlers.js

// Funkcia na nastavenie Socket.IO poslucháčov
export const setupSocketListeners = (socket, setConnectionStatus, setMyPlayerIndex, setGameState, setChatMessages) => {
    socket.on('connect', () => {
        setConnectionStatus('Pripojený');
        console.log('Pripojený k serveru Socket.IO');
        socket.emit('joinGame'); // Po pripojení sa pokúsime pripojiť k hre
    });

    socket.on('disconnect', () => {
        setConnectionStatus('Odpojený');
        console.log('Odpojený od servera Socket.IO');
        // Pri odpojení servera resetujeme stav hry
        setGameState({
            letterBag: [],
            playerRacks: [Array(7).fill(null), Array(7).fill(null)],
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
        setGameState(prevState => ({ ...prevState, hasInitialGameStateReceived: false }));
    });

    // Nový poslucháč pre stav čakania
    socket.on('waitingForPlayers', (message) => {
        console.log(`Čakám na hráčov: ${message}`);
        // Resetujeme stav hry len natoľko, aby sa zobrazila správa o čakaní
        setGameState(prevState => ({
            ...prevState,
            letterBag: [],
            playerRacks: [Array(7).fill(null), Array(7).fill(null)],
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
            playerRacks: [Array(7).fill(null), Array(7).fill(null)],
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
        socket.emit('joinGame'); // Znovu sa pokúsime pripojiť k hre
    });

    socket.on('receiveChatMessage', (message) => {
        setChatMessages((prevMessages) => [...prevMessages, message]);
    });

    socket.on('chatHistory', (history) => {
        setChatMessages(history);
    });
};

// Funkcia na odosielanie chatových správ
export const sendChatMessage = (socket, message) => {
    if (message.trim() !== '') {
        socket.emit('chatMessage', message);
    }
};

// Funkcia na odosielanie akcií hráča
export const sendPlayerAction = (socket, actionType, payload) => {
    socket.emit('playerAction', { type: actionType, payload });
};