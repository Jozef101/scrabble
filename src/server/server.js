// server/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Používame CORS, aby frontend (bežiaci na inom porte/doméne) mohol komunikovať so serverom
app.use(cors({
    origin: '*', // Povoliť všetky domény pre jednoduchosť testovania. V produkcii by ste chceli obmedziť na doménu vášho frontendu.
    methods: ['GET', 'POST']
}));

// Inicializácia Socket.IO servera
const io = socketIo(server, {
    cors: {
        origin: '*', // Rovnako ako pre Express, povoliť všetky domény
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 4000;

// ====================================================================
// Herný stav (držaný v pamäti servera - pre jednoduché testovanie)
// V plnej implementácii by toto bolo v databáze
// ====================================================================
let game = {
    players: [], // Pole objektov hráčov: [{ id: socket.id, playerIndex: 0 }, { id: socket.id, playerIndex: 1 }]
    gameState: null, // Bude obsahovať celý stav hry (board, racks, bag, scores, currentPlayerIndex)
    gameId: 'scrabble-game-1', // Jednoduché ID pre jednu hru
    chatMessages: [], // Pole pre chatové správy
    isGameStarted: false,
};

// Pomocná funkcia na vytvorenie vrecúška s písmenami (musí byť tu, lebo server spravuje bag)
const LETTER_VALUES = {
    'A': 1, 'Á': 4, 'Ä': 10, 'B': 4, 'C': 4, 'Č': 5, 'D': 2, 'Ď': 8, 'E': 1, 'É': 7,
    'F': 8, 'G': 8, 'H': 4, 'I': 1, 'Í': 5, 'J': 3, 'K': 2, 'L': 2, 'Ľ': 7, 'Ĺ': 10,
    'M': 2, 'N': 1, 'Ň': 8, 'O': 1, 'Ô': 8, 'Ó': 10, 'P': 2, 'Q': 10, 'R': 1, 'Ŕ': 10,
    'S': 1, 'Š': 5, 'T': 1, 'Ť': 7, 'U': 3, 'Ú': 7, 'V': 1, 'W': 5, 'X': 10, 'Y': 4, 'Ý': 5,
    'Z': 4, 'Ž': 5, '': 0
};

const LETTER_DISTRIBUTION = [
    { letter: 'A', count: 9 }, { letter: 'Á', count: 1 }, { letter: 'Ä', count: 1 },
    { letter: 'B', count: 2 }, { letter: 'C', count: 1 }, { letter: 'Č', count: 1 },
    { letter: 'D', count: 3 }, { letter: 'Ď', count: 1 }, { letter: 'E', count: 8 },
    { letter: 'É', count: 1 }, { letter: 'F', count: 1 }, { letter: 'G', count: 1 },
    { letter: 'H', count: 1 }, { letter: 'I', count: 5 }, { letter: 'Í', count: 1 },
    { letter: 'J', count: 2 }, { letter: 'K', count: 3 }, { letter: 'L', count: 3 },
    { letter: 'Ľ', count: 1 }, { letter: 'Ĺ', count: 1 }, { letter: 'M', count: 4 },
    { letter: 'N', count: 5 }, { letter: 'Ň', count: 1 }, { letter: 'O', count: 9 },
    { letter: 'Ô', count: 1 }, { letter: 'Ó', count: 1 }, { letter: 'P', count: 3 },
    { letter: 'R', count: 4 }, { letter: 'Ŕ', count: 1 }, { letter: 'S', count: 4 },
    { letter: 'Š', count: 1 }, { letter: 'T', count: 4 }, { letter: 'Ť', count: 1 },
    { letter: 'U', count: 2 }, { letter: 'Ú', count: 1 }, { letter: 'V', count: 4 },
    { letter: 'X', count: 1 }, { letter: 'Y', count: 1 }, { letter: 'Ý', count: 1 },
    { letter: 'Z', count: 1 }, { letter: 'Ž', count: 1 },
    { letter: '', count: 2 } // Dva žolíky (blank tiles)
];

function createLetterBag() {
    const bag = [];
    let idCounter = 0;
    LETTER_DISTRIBUTION.forEach(item => {
        for (let i = 0; i < item.count; i++) {
            bag.push({ id: `letter-${idCounter++}`, letter: item.letter, value: LETTER_VALUES[item.letter] });
        }
    });
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

function drawLetters(currentBag, numToDraw) {
    const drawn = [];
    const tempBag = [...currentBag];
    let bagEmpty = false;

    for (let i = 0; i < numToDraw; i++) {
        if (tempBag.length > 0) {
            drawn.push(tempBag.pop());
        } else {
            console.warn("Vrecúško je prázdne, nedá sa ťahať viac písmen.");
            bagEmpty = true;
            break;
        }
    }
    return { drawnLetters: drawn, remainingBag: tempBag, bagEmpty: bagEmpty };
}


// ====================================================================
// Socket.IO pripojenia a logika hry
// ====================================================================
io.on('connection', (socket) => {
    console.log(`Nový klient pripojený: ${socket.id}`);

    // Pripojenie hráča k hre
    socket.on('joinGame', () => {
        // Kontrola, či sa hráč už pripojil (pri rekonexii)
        let existingPlayer = game.players.find(p => p.id === socket.id);
        let playerIndex;

        if (existingPlayer) {
            playerIndex = existingPlayer.playerIndex;
            console.log(`Klient ${socket.id} sa znovu pripojil ako Hráč ${playerIndex + 1}.`);
            socket.playerIndex = playerIndex; // Znovu priradíme playerIndex do socketu
        } else {
            // Ak už sú dvaja hráči a nie je to rekonexia, odmietneme
            if (game.players.length >= 2) {
                socket.emit('gameError', 'Hra je už plná.');
                console.log(`Klient ${socket.id} sa nemohol pripojiť, hra je plná.`);
                return;
            }
            // Priradenie nového indexu hráča (0 alebo 1)
            playerIndex = game.players.length;
            game.players.push({ id: socket.id, playerIndex: playerIndex });
            socket.playerIndex = playerIndex; // Uložíme index hráča do socketu
            console.log(`Klient ${socket.id} sa pripojil ako Hráč ${playerIndex + 1}.`);
        }

        // Oznámime klientovi jeho playerIndex
        socket.emit('playerAssigned', playerIndex);

        // Pošleme históriu chatu vždy
        socket.emit('chatHistory', game.chatMessages);

        // Logika pre spustenie/pokračovanie hry
        if (game.players.length === 2 && !game.isGameStarted) {
            // Dvaja hráči pripojení a hra ešte nezačala, inicializujeme ju
            console.log('Dvaja hráči pripojení, inicializujem hru!');
            game.isGameStarted = true;
            initializeGame(); // Inicializujeme herný stav na serveri
            io.emit('gameStateUpdate', game.gameState); // Pošleme počiatočný stav všetkým
        } else if (game.isGameStarted && game.gameState) {
            // Hra už beží, pošleme aktuálny stav pripájajúcemu sa (alebo znovu pripájajúcemu sa) hráčovi
            socket.emit('gameStateUpdate', game.gameState);
        } else {
            // Pripojený len jeden hráč, alebo hra ešte nezačala a čaká sa na druhého
            console.log(`Čaká sa na druhého hráča. Aktuálni hráči: ${game.players.length}`);
            // Neposielame plný herný stav, len informáciu o čakaní
            io.emit('waitingForPlayers', 'Čaká sa na druhého hráča...'); // Nový event pre klienta
        }
    });

    // Klient posiela akciu (ťah, výmena, pass)
    socket.on('playerAction', (action) => {
        // Overenie, či je na ťahu správny hráč
        if (!game.isGameStarted || game.players[game.gameState.currentPlayerIndex]?.id !== socket.id) {
            socket.emit('gameError', 'Nie je váš ťah alebo hra ešte nezačala.');
            return;
        }

        console.log(`Akcia od Hráča ${socket.playerIndex + 1}: ${action.type}`);

        if (action.type === 'updateGameState') {
            game.gameState = action.payload; // Celý stav hry
            io.emit('gameStateUpdate', game.gameState); // Pošleme aktualizovaný stav všetkým
        } else {
            console.warn(`Neznámy typ akcie: ${action.type}`);
        }
    });

    // Klient posiela chatovú správu
    socket.on('chatMessage', (message) => {
        const fullMessage = { senderId: socket.id, senderIndex: socket.playerIndex, text: message, timestamp: Date.now() };
        game.chatMessages.push(fullMessage);
        // Odošleme správu všetkým klientom
        io.emit('receiveChatMessage', fullMessage);
        console.log(`Chat správa od ${socket.id}: ${message}`);
    });

    // Odpojenie klienta
    socket.on('disconnect', () => {
        console.log(`Klient odpojený: ${socket.id}`);
        // Odstránime hráča z poľa
        game.players = game.players.filter(player => player.id !== socket.id);

        // Ak sa odpojí jeden z dvoch hráčov, alebo posledný hráč
        if (game.isGameStarted && game.players.length < 2) {
            console.log('Hra bola prerušená, resetujem stav.');
            game.gameState = null; // Resetujeme stav hry
            game.isGameStarted = false;
            game.chatMessages = []; // Vyčistíme chat
            io.emit('gameReset', 'Jeden z hráčov sa odpojil. Hra bola resetovaná.');
        } else if (game.players.length === 0) {
            console.log('Všetci hráči odpojení, herný stav vyčistený.');
            game.gameState = null;
            game.isGameStarted = false;
            game.chatMessages = [];
        }
    });
});

// Funkcia na inicializáciu stavu hry
function initializeGame() {
    const initialBag = createLetterBag();
    const { drawnLetters: player0Rack, remainingBag: bagAfterP0, bagEmpty: p0BagEmpty } = drawLetters(initialBag, 7);
    const { drawnLetters: player1Rack, remainingBag: finalBag, bagEmpty: p1BagEmpty } = drawLetters(bagAfterP0, 7);

    game.gameState = {
        playerRacks: [player0Rack, player1Rack],
        board: Array(15).fill(null).map(() => Array(15).fill(null)),
        letterBag: finalBag,
        playerScores: [0, 0],
        currentPlayerIndex: 0,
        boardAtStartOfTurn: Array(15).fill(null).map(() => Array(15).fill(null)),
        isFirstTurn: true,
        isBagEmpty: p0BagEmpty || p1BagEmpty, // Ak bolo vrecúško prázdne už pri ťahaní
        exchangeZoneLetters: [],
        hasPlacedOnBoardThisTurn: false,
        hasMovedToExchangeZoneThisTurn: false,
        consecutivePasses: 0,
        isGameOver: false,
    };
    console.log("Počiatočný herný stav inicializovaný na serveri.");
}

// Spustenie servera
server.listen(PORT, () => {
    console.log(`Server beží na porte ${PORT}`);
});