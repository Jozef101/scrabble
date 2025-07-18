// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import io from 'socket.io-client';

import Board from './components/Board';
import PlayerRack from './components/PlayerRack';
import LetterBag from './components/LetterBag';
import Scoreboard from './components/Scoreboard';
import ExchangeZone from './components/ExchangeZone';
import LetterSelectionModal from './components/LetterSelectionModal';

import {
  drawLetters,
  getPlacedLettersDuringCurrentTurn,
  isStraightLine,
  getFullWordLetters,
  areLettersContiguous,
  isConnected,
  getAllWordsInTurn,
  calculateWordScore,
  calculateFinalScores,
} from './utils/gameLogic';
// Dôležité: sendPlayerAction musí teraz posielať gameId
import { setupSocketListeners, sendChatMessage, sendPlayerAction } from './utils/socketHandlers';
import { SERVER_URL, BOARD_SIZE, RACK_SIZE } from './utils/constants'; // Importujeme konštanty

import slovakWordsArray from './data/slovakWords.json';
import './styles/App.css';

// NOVÝ IMPORT: Importujeme moveLetter z nového súboru
import { moveLetter as importedMoveLetter } from './utils/moveLetterLogic';


// ====================================================================
// KLÚČOVÁ ZMENA: Definovanie ID hry, ku ktorej sa klient pripojí.
// V reálnej aplikácii by to mohlo pochádzať z URL parametrov,
// z inputu používateľa alebo by ho vygeneroval server.
// ====================================================================
const GAME_ID_TO_JOIN = 'default-scrabble-game'; // Použijeme rovnaké ID ako na serveri pre jednoduchosť

function App() {
  // Stav hry, ktorý bude aktualizovaný zo servera
  const [gameState, setGameState] = useState({
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
    hasInitialGameStateReceived: false, // Toto je teraz riadené serverom a socketHandlers
  });

  const [showLetterSelectionModal, setShowLetterSelectionModal] = useState(false);
  const [jokerTileCoords, setJokerTileCoords] = useState(null);

  const [socket, setSocket] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Nepripojený');
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const chatMessagesEndRef = useRef(null);

  const validWordsSet = useRef(new Set(slovakWordsArray.map(word => word.toUpperCase())));

  // NOVÝ STAV: Pre "ťukni a presuň" funkcionalitu
  const [selectedLetter, setSelectedLetter] = useState(null); // { letterData, source }

  // Effect pre Socket.IO pripojenie a poslucháčov
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    // Kľúčová zmena: Po pripojení ihneď pošleme serveru 'joinGame' s naším GAME_ID_TO_JOIN
    newSocket.on('connect', () => {
      console.log(`Pripojený k serveru, posielam joinGame pre ID: ${GAME_ID_TO_JOIN}`);
      newSocket.emit('joinGame', GAME_ID_TO_JOIN); // Pošleme ID hry
    });

    setupSocketListeners(
      newSocket,
      setConnectionStatus,
      setMyPlayerIndex,
      (updatedState) => {
        setGameState(updatedState);
      },
      setChatMessages,
      GAME_ID_TO_JOIN // <--- Pridávame gameId sem!
    );

    // Pridáme poslucháča na 'gameReset'
    newSocket.on('gameReset', (message) => {
      alert(message);
      // Resetujeme stav hry na počiatočný (prázdny) a čakáme na nový stav zo servera
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
        hasInitialGameStateReceived: false, // Po resete očakávame nový inicializačný stav
      });
      setMyPlayerIndex(null); // Resetujeme aj priradeného hráča
    });


    return () => {
      newSocket.disconnect();
    };
  }, []); // [] zabezpečí, že sa spustí len raz pri mountovaní komponentu

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const {
    letterBag,
    playerRacks,
    board,
    boardAtStartOfTurn,
    isFirstTurn,
    playerScores,
    currentPlayerIndex,
    exchangeZoneLetters,
    hasPlacedOnBoardThisTurn,
    hasMovedToExchangeZoneThisTurn,
    consecutivePasses,
    isGameOver,
    isBagEmpty,
    hasInitialGameStateReceived, // Toto je teraz riadené serverom a socketHandlers
  } = gameState;

  const isGameReadyToRender = myPlayerIndex !== null && hasInitialGameStateReceived;

  // NOVÉ: Vytvoríme inštanciu moveLetter funkcie s potrebnými závislosťami
  const moveLetter = importedMoveLetter({
    gameState,
    setGameState,
    myPlayerIndex,
    setJokerTileCoords,
    setShowLetterSelectionModal,
    socket,
    gameIdToJoin: GAME_ID_TO_JOIN, // Používame konštantu
  });


  // NOVÁ FUNKCIA: Spracovanie ťuknutia na písmeno
  const handleTapLetter = (letterData, source) => {
    if (isGameOver || myPlayerIndex === null) {
      console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený).");
      setSelectedLetter(null); // Zrušíme výber
      return;
    }

    // Ak už je nejaké písmeno vybrané
    if (selectedLetter) {
      // Ak ťukneme na to isté písmeno, zrušíme výber
      if (selectedLetter.letterData.id === letterData.id) {
        setSelectedLetter(null);
        return;
      }

      // Ak ťukneme na iné písmeno na tom istom stojane, vykonáme výmenu/presun
      if (selectedLetter.source.type === 'rack' && source.type === 'rack' && selectedLetter.source.playerIndex === source.playerIndex) {
        // Toto je tap-to-swap na vlastnom stojane
        moveLetter(selectedLetter.letterData, selectedLetter.source, source);
        setSelectedLetter(null); // Po presune zrušíme výber
        return;
      }

      // Ak je vybrané písmeno a ťukneme na písmeno na doske/výmennej zóne, pokúsime sa ho presunúť
      // (ak je to povolené podľa pravidiel ťahu)
      moveLetter(selectedLetter.letterData, selectedLetter.source, source);
      setSelectedLetter(null); // Po presune zrušíme výber
      return;
    }

    // Ak nie je žiadne písmeno vybrané a ťukneme na písmeno na vlastnom stojane, vyberieme ho
    if (source.type === 'rack' && source.playerIndex === myPlayerIndex) {
      setSelectedLetter({ letterData, source });
    } else if (source.type === 'board' && boardAtStartOfTurn[source.x][source.y] === null && currentPlayerIndex === myPlayerIndex) {
      // Ak ťukneme na písmeno na doske, ktoré nie je zamknuté a je náš ťah, vyberieme ho
      setSelectedLetter({ letterData, source });
    } else if (source.type === 'exchangeZone' && currentPlayerIndex === myPlayerIndex) {
      // Ak ťukneme na písmeno vo výmennej zóne a je náš ťah, vyberieme ho
      setSelectedLetter({ letterData, source });
    }
  };

  // NOVÁ FUNKCIA: Spracovanie ťuknutia na prázdny slot (na doske, racku, výmennej zóne)
  const handleTapSlot = (target) => {
    if (isGameOver || myPlayerIndex === null) {
      console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený).");
      setSelectedLetter(null); // Zrušíme výber
      return;
    }

    if (selectedLetter) {
      // Ak je písmeno vybrané a ťukneme na slot, pokúsime sa ho presunúť
      moveLetter(selectedLetter.letterData, selectedLetter.source, target);
      setSelectedLetter(null); // Po presune zrušíme výber
    } else {
      // Ak nie je vybrané žiadne písmeno a ťukneme na prázdny slot, nič sa nestane
      // (alebo môžeme pridať logiku pre zrušenie výberu, ak by sa niečo dialo)
      console.log("Ťukol(a) si na prázdny slot, ale nemáš vybrané žiadne písmeno.");
    }
  };

  const assignLetterToJoker = (selectedLetter) => {
    if (jokerTileCoords) {
      let stateToUpdateAndSend = null;
      setGameState(prevState => {
        const newBoard = prevState.board.map(row => [...row]);
        const { x, y } = jokerTileCoords;
        if (newBoard[x][y] && newBoard[x][y].letter === '') {
          newBoard[x][y] = { ...newBoard[x][y], assignedLetter: selectedLetter };
        }
        stateToUpdateAndSend = {
          ...prevState,
          board: newBoard,
        };
        return stateToUpdateAndSend;
      });
      if (stateToUpdateAndSend) {
        sendPlayerAction(socket, GAME_ID_TO_JOIN, 'updateGameState', stateToUpdateAndSend);
      }
    }
    setShowLetterSelectionModal(false);
    setJokerTileCoords(null);
  };

  const confirmTurn = () => {
    if (isGameOver || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(board, boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno!");
      return;
    }

    const actualPlacedLetters = getPlacedLettersDuringCurrentTurn(board, boardAtStartOfTurn);

    if (actualPlacedLetters.length === 0) {
      alert("Najprv polož aspoň jedno písmeno na dosku!");
      return;
    }

    if (hasMovedToExchangeZoneThisTurn) {
      alert("Nemôžeš potvrdiť ťah na doske, ak si už presunul(a) písmeno do výmennej zóny v tomto ťahu!");
      return;
    }

    console.log("DEBUG: Actual Placed Letters:", actualPlacedLetters.map(l => ({ letter: l.letterData.letter, assigned: l.letterData.assignedLetter, x: l.x, y: l.y })));

    if (!isStraightLine(actualPlacedLetters)) {
      alert("Písmená musia byť v jednom rade alebo stĺpci!");
      return;
    }

    const allFormedWords = getAllWordsInTurn(actualPlacedLetters, board);

    console.log("DEBUG: All Formed Words (before validation):", allFormedWords.map(w => ({ word: w.wordString, letters: w.letters.map(l => (l.letterData.letter === '' ? l.letterData.assignedLetter : l.letterData.letter)) })));

    if (allFormedWords.length === 0) {
      alert("Nezistilo sa žiadne platné slovo. Skontroluj umiestnenie.");
      return;
    }

    for (const wordObj of allFormedWords) {
      console.log(`DEBUG: Checking contiguity for word: "${wordObj.wordString}"`);
      console.log("DEBUG: Letters for contiguity check:", wordObj.letters.map(l => ({ letter: (l.letterData.letter === '' ? l.letterData.assignedLetter : l.letterData.letter), x: l.x, y: l.y })));

      if (!areLettersContiguous(wordObj.letters)) {
        alert(`Slovo "${wordObj.wordString}" nie je súvislé (žiadne diery)!`);
        return;
      }
    }

    const mainWordLettersForConnectionCheck = getFullWordLetters(actualPlacedLetters, board);
    if (!isConnected(actualPlacedLetters, board, isFirstTurn, mainWordLettersForConnectionCheck)) {
      if (isFirstTurn) {
        alert("Prvý ťah musí pokrývať stredové políčko (hviezdičku)!");
      } else {
        alert("Položené písmená sa musia spájať s existujúcimi písmenami na doske (alebo použiť existujúce písmeno ako súčasť slova)!");
      }
      return;
      }

    for (const letter of actualPlacedLetters) {
      if (boardAtStartOfTurn[letter.x][letter.y] !== null) {
        alert("Nemôžeš položiť písmeno na už obsadené políčko!");
        return;
      }
    }

    if (actualPlacedLetters.length === 1 && allFormedWords[0].wordString.length === 1 && !isFirstTurn) {
      alert("Musíš vytvoriť slovo spojením s existujúcimi písmenami.");
      return;
    }

    const invalidWords = allFormedWords.filter(wordObj => {
      const wordString = wordObj.wordString.toUpperCase();
      if (wordString.length > 5) { // Slovak scrabble max word length is often defined as 5 for dictionary.
        return false;
      }
      return !validWordsSet.current.has(wordString);
    });

    if (invalidWords.length > 0) {
      alert(`Neplatné slovo(á) nájdené: ${invalidWords.map(w => w.wordString).join(', ')}. Skontroluj slovník.`);
      return;
    }


    let turnScore = 0;
    allFormedWords.forEach(wordObj => {
      turnScore += calculateWordScore(wordObj.letters, boardAtStartOfTurn);
    });

    if (actualPlacedLetters.length === 7) {
      turnScore += 50;
      alert("BINGO! +50 bodov!");
    }

    let newScores = [...playerScores];
    newScores[currentPlayerIndex] += turnScore;

    alert(`Ťah je platný! Získal si ${turnScore} bodov. Vytvorené slová: ${allFormedWords.map(w => w.wordString).join(', ')}`);

    const newBoardAtStartOfTurn = board.map(row => [...row]);

    const numToDraw = actualPlacedLetters.length;
    const { drawnLetters: newLetters, remainingBag: updatedBagAfterTurn, bagEmpty: currentBagEmpty } = drawLetters(letterBag, numToDraw);

    let tempRack = [...playerRacks[currentPlayerIndex]];
    let newRackForCurrentPlayer = [];
    let newLetterIndex = 0;

    // Pridajte už existujúce písmená, ktoré neboli použité v ťahu
    tempRack.forEach(letter => {
      // Skontrolujte, či písmeno nie je v `actualPlacedLetters`
      const isLetterPlaced = actualPlacedLetters.some(placed => placed.letterData.id === letter?.id);
      if (letter !== null && !isLetterPlaced) {
        newRackForCurrentPlayer.push(letter);
      }
    });

    // Teraz pridajte nové písmená
    newLetters.forEach(letter => {
      if (newRackForCurrentPlayer.length < RACK_SIZE) {
        newRackForCurrentPlayer.push(letter);
      }
    });

    // Doplnenie null hodnôt na RACK_SIZE
    while (newRackForCurrentPlayer.length < RACK_SIZE) {
      newRackForCurrentPlayer.push(null);
    }
    // Orezanie, ak je náhodou viac ako RACK_SIZE (nemalo by sa stať pri správnej logike)
    newRackForCurrentPlayer = newRackForCurrentPlayer.slice(0, RACK_SIZE);


    const finalRackAfterPlay = newRackForCurrentPlayer.filter(l => l !== null);

    let stateToUpdateAndSend = null;

    if (currentBagEmpty && finalRackAfterPlay.length === 0) {
      const finalScores = calculateFinalScores(currentPlayerIndex, newRackForCurrentPlayer, playerScores, playerRacks);
      stateToUpdateAndSend = {
        ...gameState,
        letterBag: updatedBagAfterTurn,
        playerRacks: playerRacks.map((rack, idx) => idx === currentPlayerIndex ? newRackForCurrentPlayer : rack),
        board: board,
        boardAtStartOfTurn: newBoardAtStartOfTurn,
        isFirstTurn: false,
        playerScores: finalScores,
        currentPlayerIndex: currentPlayerIndex, // Zostáva rovnaký, hra skončila
        exchangeZoneLetters: [],
        hasPlacedOnBoardThisTurn: false,
        hasMovedToExchangeZoneThisTurn: false,
        consecutivePasses: 0,
        isGameOver: true,
        isBagEmpty: currentBagEmpty,
      };
      setGameState(stateToUpdateAndSend);
      sendPlayerAction(socket, GAME_ID_TO_JOIN, 'updateGameState', stateToUpdateAndSend);
      alert(`Hra skončila! Konečné skóre: Hráč 1: ${finalScores[0]}, Hráč 2: ${finalScores[1]}`);
      return;
    }

    stateToUpdateAndSend = {
      ...gameState,
      letterBag: updatedBagAfterTurn,
      playerRacks: playerRacks.map((rack, idx) => idx === currentPlayerIndex ? newRackForCurrentPlayer : rack),
      board: board,
      boardAtStartOfTurn: newBoardAtStartOfTurn,
      isFirstTurn: false,
      playerScores: newScores,
      currentPlayerIndex: (currentPlayerIndex === 0 ? 1 : 0), // Prepneme hráča
      exchangeZoneLetters: [],
      hasPlacedOnBoardThisTurn: false,
      hasMovedToExchangeZoneThisTurn: false,
      consecutivePasses: 0,
      isGameOver: false,
      isBagEmpty: currentBagEmpty,
    };
    setGameState(stateToUpdateAndSend);
    sendPlayerAction(socket, GAME_ID_TO_JOIN, 'updateGameState', stateToUpdateAndSend);
  };

  const handleExchangeLetters = () => {
    if (isGameOver || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(board, boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno, aby si mohol(a) vymeniť písmená!");
      return;
    }

    if (exchangeZoneLetters.length === 0) {
      alert("Najprv presuň písmená do výmennej zóny!");
      return;
    }
    if (hasPlacedOnBoardThisTurn) {
      alert("Nemôžeš vymeniť písmená, ak si už položil(a) písmeno na dosku v tomto ťahu!");
      return;
    }

    if (letterBag.length < exchangeZoneLetters.length) { // Musí byť dostatok písmen na výmenu
      alert(`Vo vrecúšku nie je dostatok písmen na výmenu (potrebných je ${exchangeZoneLetters.length}, k dispozícii ${letterBag.length})!`);
      return;
    }

    const numToDraw = exchangeZoneLetters.length;
    const { drawnLetters: newLettersForRack, remainingBag: bagAfterDraw, bagEmpty: currentBagEmpty } = drawLetters(letterBag, numToDraw);

    let updatedBag = [...bagAfterDraw, ...exchangeZoneLetters];

    // Zamiešame vrátené písmená do vrecúška
    for (let i = updatedBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [updatedBag[i], updatedBag[j]] = [updatedBag[j], updatedBag[i]];
    }

    let newRack = [...playerRacks[currentPlayerIndex]];
    let lettersToKeepInRack = newRack.filter(letter =>
      letter !== null && !exchangeZoneLetters.some(exchanged => exchanged.id === letter.id)
    );

    // Pridáme nové písmená
    newLettersForRack.forEach(newLetter => {
      if (lettersToKeepInRack.length < RACK_SIZE) {
        lettersToKeepInRack.push(newLetter);
      }
    });

    // Doplníme null hodnoty, aby bol rack plný (RACK_SIZE)
    while (lettersToKeepInRack.length < RACK_SIZE) {
      lettersToKeepInRack.push(null);
    }
    newRack = lettersToKeepInRack.slice(0, RACK_SIZE); // Zabezpečíme správnu veľkosť


    let stateToUpdateAndSend = {
      ...gameState,
      letterBag: updatedBag,
      playerRacks: playerRacks.map((rack, idx) => idx === currentPlayerIndex ? newRack : rack),
      board: board, // Board sa nemení pri výmene písmen
      boardAtStartOfTurn: boardAtStartOfTurn, // Rovnako ani boardAtStartOfTurn
      isFirstTurn: isFirstTurn, // Nezmenené
      playerScores: playerScores, // Skóre sa pri výmene nemení
      currentPlayerIndex: (currentPlayerIndex === 0 ? 1 : 0), // Prepneme hráča
      exchangeZoneLetters: [], // Vyprázdnime výmennú zónu
      hasPlacedOnBoardThisTurn: false,
      hasMovedToExchangeZoneThisTurn: false,
      consecutivePasses: 0, // Resetujeme passy
      isGameOver: false,
      isBagEmpty: currentBagEmpty,
    };
    setGameState(stateToUpdateAndSend);

    // Kľúčová zmena: Posielame GAME_ID_TO_JOIN aj s akciou
    sendPlayerAction(socket, GAME_ID_TO_JOIN, 'updateGameState', stateToUpdateAndSend);
  };

  const handlePassTurn = () => {
    if (isGameOver || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(board, boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno, aby si mohol(a) prejsť ťah!");
      return;
    }

    if (hasPlacedOnBoardThisTurn) {
      alert("Nemôžeš prejsť ťah, ak máš položené písmená na doske. Buď ich potvrď, alebo vráť na stojan.");
      return;
    }
    if (hasMovedToExchangeZoneThisTurn) {
      alert("Nemôžeš prejsť ťah, ak máš písmená vo výmennej zóne. Buď ich vymeň, alebo vráť na stojan.");
      return;
    }

    const newConsecutivePasses = consecutivePasses + 1;

    let stateToUpdateAndSend = {
      ...gameState,
      currentPlayerIndex: (currentPlayerIndex === 0 ? 1 : 0), // Prepneme hráča
      hasPlacedOnBoardThisTurn: false,
      hasMovedToExchangeZoneThisTurn: false,
      consecutivePasses: newConsecutivePasses,
      isGameOver: (newConsecutivePasses >= 4), // Hra končí po 4 po sebe idúcich pasoch
    };
    setGameState(stateToUpdateAndSend);

    // Kľúčová zmena: Posielame GAME_ID_TO_JOIN aj s akciou
    sendPlayerAction(socket, GAME_ID_TO_JOIN, 'updateGameState', stateToUpdateAndSend);

    if (newConsecutivePasses >= 4) {
      alert("Hra skončila! Obaja hráči pasovali dvakrát po sebe.");
    } else {
      alert("Ťah bol prenesený na ďalšieho hráča.");
    }
  };

  const handleSendChatMessage = () => {
    // Kľúčová zmena: Posielame GAME_ID_TO_JOIN aj s chat správou
    sendChatMessage(socket, GAME_ID_TO_JOIN, newChatMessage);
    setNewChatMessage('');
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app-container">
        <div className="game-header">
          <h1>Scrabble (Hra ID: {GAME_ID_TO_JOIN})</h1> {/* Zobrazíme ID hry */}
          <div className="connection-status">
            Stav pripojenia: <span className={connectionStatus === 'Pripojený' ? 'connected' : 'disconnected'}>{connectionStatus}</span>
            {myPlayerIndex !== null && ` | Si Hráč ${myPlayerIndex + 1}`}
          </div>
        </div>

        {isGameOver && <h2 className="game-over-message">Hra skončila!</h2>}
        <Scoreboard playerScores={playerScores} currentPlayerIndex={currentPlayerIndex} isGameOver={isGameOver} />
        <LetterBag remainingLettersCount={letterBag.length} />

        {/* Podmienené renderovanie hernej plochy a ovládacích prvkov */}
        {isGameReadyToRender ? (
          <div className="game-area-container">
            <Board
              board={board}
              moveLetter={moveLetter}
              boardAtStartOfTurn={boardAtStartOfTurn}
              myPlayerIndex={myPlayerIndex}
              currentPlayerIndex={currentPlayerIndex}
            />

            <div className="right-panel-content">
              <div className="player-racks-container">
                <div className="player-rack-section">
                  <h3>Hráč 1 Rack:</h3>
                  <PlayerRack
                    letters={playerRacks[0]}
                    moveLetter={moveLetter}
                    playerIndex={0}
                    myPlayerIndex={myPlayerIndex}
                    currentPlayerIndex={currentPlayerIndex}
                  />
                </div>
                <div className="player-rack-section">
                  <h3>Hráč 2 Rack:</h3>
                  <PlayerRack
                    letters={playerRacks[1]}
                    moveLetter={moveLetter}
                    playerIndex={1}
                    myPlayerIndex={myPlayerIndex}
                    currentPlayerIndex={currentPlayerIndex}
                  />
                </div>
              </div>

              <ExchangeZone
                lettersInZone={exchangeZoneLetters}
                moveLetter={moveLetter}
                myPlayerIndex={myPlayerIndex}
                currentPlayerIndex={currentPlayerIndex}
              />

              <div className="game-controls">
                <button
                  className="confirm-turn-button"
                  onClick={confirmTurn}
                  disabled={isGameOver || showLetterSelectionModal || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex}
                >
                  Potvrdiť ťah
                </button>
                <button
                  className="exchange-letters-button"
                  onClick={handleExchangeLetters}
                  disabled={isGameOver || letterBag.length < exchangeZoneLetters.length || showLetterSelectionModal || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex}
                >
                  Vymeniť písmená ({exchangeZoneLetters.length})
                </button>
                <button
                  className="pass-turn-button"
                  onClick={handlePassTurn}
                  disabled={isGameOver || showLetterSelectionModal || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex}
                >
                  Pass
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="waiting-message">
            <p>Čaká sa na pripojenie hráčov k hre ID: **{GAME_ID_TO_JOIN}**...</p>
            <p>Uistite sa, že máte otvorené dve karty prehliadača, obe s touto URL.</p>
          </div>
        )}

        <div className="chat-container">
          <h3>Chat</h3>
          <div className="chat-messages">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.senderIndex === myPlayerIndex ? 'my-message' : 'other-message'}`}>
                <strong>Hráč {msg.senderIndex + 1}:</strong> {msg.text}
              </div>
            ))}
            <div ref={chatMessagesEndRef} />
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={newChatMessage}
              onChange={(e) => setNewChatMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSendChatMessage();
              }}
              placeholder="Napíš správu..."
              disabled={myPlayerIndex === null}
            />
            <button onClick={handleSendChatMessage} disabled={myPlayerIndex === null}>Odoslať</button>
          </div>
        </div>

        {showLetterSelectionModal && (
          <LetterSelectionModal
            onSelectLetter={assignLetterToJoker}
            onClose={() => {
              if (jokerTileCoords) {
                let stateToUpdateAndSend = null;
                setGameState(prevState => {
                  const newBoard = prevState.board.map(row => [...row]);
                  const { x, y } = jokerTileCoords;
                  const jokerLetter = newBoard[x][y];
                  newBoard[x][y] = null; // Odstránime žolíka z dosky

                  const currentPlayersRack = [...prevState.playerRacks[myPlayerIndex]];
                  let targetIndex = -1;

                  // Pokúsime sa vrátiť na originalRackIndex
                  if (jokerLetter.originalRackIndex !== undefined && currentPlayersRack[jokerLetter.originalRackIndex] === null) {
                      targetIndex = jokerLetter.originalRackIndex;
                  } else {
                      // Inak nájdeme prvý voľný slot
                      targetIndex = currentPlayersRack.findIndex(l => l === null);
                  }

                  if (targetIndex !== -1) {
                    currentPlayersRack[targetIndex] = { ...jokerLetter, assignedLetter: null }; // Vrátime žolíka späť do racku
                  } else {
                    currentPlayersRack.push({ ...jokerLetter, assignedLetter: null });
                  }

                  stateToUpdateAndSend = {
                    ...prevState,
                    board: newBoard,
                    playerRacks: prevState.playerRacks.map((rack, idx) => idx === myPlayerIndex ? currentPlayersRack : rack),
                    hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, prevState.boardAtStartOfTurn).length > 0,
                  };
                  return stateToUpdateAndSend;
                });
                if (stateToUpdateAndSend) {
                  sendPlayerAction(socket, GAME_ID_TO_JOIN, 'updateGameState', stateToUpdateAndSend);
                }
              }
              setShowLetterSelectionModal(false);
              setJokerTileCoords(null);
            }}
          />
        )}
      </div>
    </DndProvider>
  );
}

export default App;
