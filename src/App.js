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

// Importujeme funkcie z nových utility súborov
import {
  drawLetters,
  getPlacedLettersDuringCurrentTurn,
  isStraightLine,
  getSequenceInDirection,
  getFullWordLetters,
  areLettersContiguous,
  isConnected,
  getAllWordsInTurn,
  calculateWordScore,
  getRackPoints,
  calculateFinalScores,
  createLetterBag // Importujeme aj createLetterBag pre počiatočné nastavenie
} from './utils/gameLogic';
import { setupSocketListeners, sendChatMessage, sendPlayerAction } from './utils/socketHandlers';
import { SERVER_URL, BOARD_SIZE, RACK_SIZE } from './utils/constants'; // Importujeme konštanty

import { LETTER_VALUES } from './utils/LettersDistribution'; // Stále potrebujeme pre zobrazenie hodnôt
import { bonusSquares, BONUS_TYPES } from './utils/boardUtils'; // Stále potrebujeme pre zobrazenie bonusov
import slovakWordsArray from './data/slovakWords.json';
import './styles/App.css';

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
    hasInitialGameStateReceived: false, // Nový stav pre sledovanie počiatočného stavu
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

  // Effect pre Socket.IO pripojenie a poslucháčov
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    // Používame setupSocketListeners z nového súboru
    setupSocketListeners(
      newSocket,
      setConnectionStatus,
      setMyPlayerIndex,
      (updatedState) => {
        setGameState(prevState => ({ ...prevState, ...updatedState, hasInitialGameStateReceived: true }));
      },
      setChatMessages
    );

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Effect pre posúvanie chatu
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Destrukturujeme stav hry pre jednoduchší prístup
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
    hasInitialGameStateReceived,
  } = gameState;

  // Tento useEffect zabezpečí, že herná oblasť sa zobrazí až po priradení hráča
  // A po prijatí počiatočného stavu hry.
  const isGameReadyToRender = myPlayerIndex !== null && hasInitialGameStateReceived;


  const moveLetter = (letterData, source, target) => {
    if (isGameOver || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex) {
      console.log("Nemôžeš presúvať písmená (hra skončila, nie si pripojený alebo nie je tvoj ťah).");
      return;
    }

    let newPlayerRacks = playerRacks.map(rack => [...rack]);
    let newBoard = board.map(row => [...row]);
    let newExchangeZoneLetters = [...exchangeZoneLetters];

    if (source.type === 'board' && boardAtStartOfTurn[source.x][source.y] !== null) {
      console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
      return;
    }

    if (source.type === 'rack' && target.type === 'rack') {
      if (source.playerIndex !== myPlayerIndex) {
        console.log("Nemôžeš presúvať písmená z racku iného hráča.");
        return;
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

      newPlayerRacks[myPlayerIndex] = newPlayerRacks[myPlayerIndex].filter(l => l !== undefined && l !== null);
      while (newPlayerRacks[myPlayerIndex].length < RACK_SIZE) { newPlayerRacks[myPlayerIndex].push(null); }
      while (newPlayerRacks[myPlayerIndex].length > RACK_SIZE) { newPlayerRacks[myPlayerIndex].pop(); }

      sendPlayerAction(socket, 'updateGameState', {
        ...gameState, // Posielame celý aktuálny stav
        playerRacks: newPlayerRacks,
      });
      return;
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
        return;
      }
      letterToMove = { ...newPlayerRacks[myPlayerIndex][source.index] };
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
        return;
      }
    }

    if (!letterToMove || letterToMove.id === undefined) {
        console.warn("Nepodarilo sa nájsť platné písmeno na presun alebo chýba ID.");
        return;
    }

    if (target.type === 'rack') {
      if (target.playerIndex !== myPlayerIndex) {
        console.log("Nemôžeš presúvať písmená na rack iného hráča.");
        return;
      }
      newPlayerRacks[myPlayerIndex][target.index] = letterToMove;
    } else if (target.type === 'board') {
      newBoard[target.x][target.y] = letterToMove;
      if (letterToMove.letter === '') {
        setJokerTileCoords({ x: target.x, y: target.y });
        setShowLetterSelectionModal(true);
      }
    } else if (target.type === 'exchangeZone') {
        newExchangeZoneLetters.push(letterToMove);
    }

    // Posielame aktualizovaný stav na server
    sendPlayerAction(socket, 'updateGameState', {
      ...gameState, // Posielame celý aktuálny stav
      playerRacks: newPlayerRacks,
      board: newBoard,
      exchangeZoneLetters: newExchangeZoneLetters,
      hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, boardAtStartOfTurn).length > 0,
      hasMovedToExchangeZoneThisTurn: newExchangeZoneLetters.length > 0,
    });
  };

  const assignLetterToJoker = (selectedLetter) => {
    if (jokerTileCoords) {
      const newBoard = board.map(row => [...row]);
      const { x, y } = jokerTileCoords;
      if (newBoard[x][y] && newBoard[x][y].letter === '') {
        newBoard[x][y] = { ...newBoard[x][y], assignedLetter: selectedLetter };
      }
      sendPlayerAction(socket, 'updateGameState', {
        ...gameState,
        board: newBoard,
      });
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
        if (wordString.length > 5) {
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

    for (let i = 0; i < tempRack.length; i++) {
      if (tempRack[i] === null && newLetterIndex < newLetters.length) {
        newRackForCurrentPlayer.push(newLetters[newLetterIndex]);
        newLetterIndex++;
      } else {
        newRackForCurrentPlayer.push(tempRack[i]);
      }
    }
    while(newLetterIndex < newLetters.length) {
      newRackForCurrentPlayer.push(newLetters[newLetterIndex]);
      newLetterIndex++;
    }
    while (newRackForCurrentPlayer.length < RACK_SIZE) newRackForCurrentPlayer.push(null);
    newRackForCurrentPlayer = newRackForCurrentPlayer.slice(0, RACK_SIZE);

    const finalRackAfterPlay = newRackForCurrentPlayer.filter(l => l !== null);

    if (currentBagEmpty && finalRackAfterPlay.length === 0) {
        const finalScores = calculateFinalScores(currentPlayerIndex, newRackForCurrentPlayer, playerScores, playerRacks);
        sendPlayerAction(socket, 'updateGameState', {
            ...gameState,
            letterBag: updatedBagAfterTurn,
            playerRacks: playerRacks.map((rack, idx) => idx === currentPlayerIndex ? newRackForCurrentPlayer : rack),
            board: board,
            boardAtStartOfTurn: newBoardAtStartOfTurn,
            isFirstTurn: false,
            playerScores: finalScores,
            currentPlayerIndex: currentPlayerIndex,
            exchangeZoneLetters: [],
            hasPlacedOnBoardThisTurn: false,
            hasMovedToExchangeZoneThisTurn: false,
            consecutivePasses: 0,
            isGameOver: true,
            isBagEmpty: currentBagEmpty,
        });
        alert(`Hra skončila! Konečné skóre: Hráč 1: ${finalScores[0]}, Hráč 2: ${finalScores[1]}`);
        return;
    }

    sendPlayerAction(socket, 'updateGameState', {
        ...gameState,
        letterBag: updatedBagAfterTurn,
        playerRacks: playerRacks.map((rack, idx) => idx === currentPlayerIndex ? newRackForCurrentPlayer : rack),
        board: board,
        boardAtStartOfTurn: newBoardAtStartOfTurn,
        isFirstTurn: false,
        playerScores: newScores,
        currentPlayerIndex: (currentPlayerIndex === 0 ? 1 : 0),
        exchangeZoneLetters: [],
        hasPlacedOnBoardThisTurn: false,
        hasMovedToExchangeZoneThisTurn: false,
        consecutivePasses: 0,
        isGameOver: false,
        isBagEmpty: currentBagEmpty,
    });
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

    if (letterBag.length < RACK_SIZE) { // Minimálne 7 písmen na výmenu
      alert("Vo vrecúšku nie je dostatok písmen na výmenu (potrebných je aspoň 7)!");
      return;
    }

    const numToDraw = exchangeZoneLetters.length;
    const { drawnLetters: newLettersForRack, remainingBag: bagAfterDraw, bagEmpty: currentBagEmpty } = drawLetters(letterBag, numToDraw);
    
    let updatedBag = [...bagAfterDraw, ...exchangeZoneLetters];
    
    for (let i = updatedBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [updatedBag[i], updatedBag[j]] = [updatedBag[j], updatedBag[i]];
    }
    
    let newRack = [...playerRacks[currentPlayerIndex]];
    let newLetterIndex = 0;
    for (let i = 0; i < newRack.length; i++) {
      if (newRack[i] === null && newLetterIndex < newLettersForRack.length) {
        newRack[i] = newLettersForRack[newLetterIndex];
        newLetterIndex++;
      } else if (exchangeZoneLetters.some(l => l.id === newRack[i]?.id)) {
        newRack[i] = null; // Odstránime písmeno, ktoré bolo presunuté do výmennej zóny
      }
    }
    while (newLetterIndex < newLettersForRack.length) {
      newRack.push(newLettersForRack[newLetterIndex]);
      newLetterIndex++;
    }
    while (newRack.length < RACK_SIZE) newRack.push(null);
    newRack = newRack.slice(0, RACK_SIZE);


    sendPlayerAction(socket, 'updateGameState', {
        ...gameState,
        letterBag: updatedBag,
        playerRacks: playerRacks.map((rack, idx) => idx === currentPlayerIndex ? newRack : rack),
        board: board,
        boardAtStartOfTurn: boardAtStartOfTurn,
        isFirstTurn: isFirstTurn,
        playerScores: playerScores,
        currentPlayerIndex: (currentPlayerIndex === 0 ? 1 : 0),
        exchangeZoneLetters: [],
        hasPlacedOnBoardThisTurn: false,
        hasMovedToExchangeZoneThisTurn: false,
        consecutivePasses: 0,
        isGameOver: false,
        isBagEmpty: currentBagEmpty,
    });
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
    
    sendPlayerAction(socket, 'updateGameState', {
        ...gameState,
        currentPlayerIndex: (currentPlayerIndex === 0 ? 1 : 0),
        hasPlacedOnBoardThisTurn: false,
        hasMovedToExchangeZoneThisTurn: false,
        consecutivePasses: newConsecutivePasses,
        isGameOver: (newConsecutivePasses >= 4),
    });

    if (newConsecutivePasses >= 4) {
        alert("Hra skončila! Obaja hráči pasovali dvakrát po sebe.");
    } else {
        alert("Ťah bol prenesený na ďalšieho hráča.");
    }
  };

  const handleSendChatMessage = () => {
    sendChatMessage(socket, newChatMessage);
    setNewChatMessage('');
  };


  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app-container">
        <div className="game-header">
          <h1>Scrabble</h1>
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
                  disabled={isGameOver || letterBag.length < RACK_SIZE || showLetterSelectionModal || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex}
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
            <p>Čaká sa na pripojenie hráčov...</p>
            <p>Uistite sa, že máte otvorené dve karty prehliadača.</p>
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
                const newBoard = board.map(row => [...row]);
                const { x, y } = jokerTileCoords;
                const jokerLetter = newBoard[x][y];
                newBoard[x][y] = null;

                const currentPlayersRack = [...playerRacks[myPlayerIndex]];
                const firstEmptyRackSlot = currentPlayersRack.findIndex(l => l === null);
                if (firstEmptyRackSlot !== -1) {
                  currentPlayersRack[firstEmptyRackSlot] = { ...jokerLetter, assignedLetter: null };
                } else {
                  currentPlayersRack.push({ ...jokerLetter, assignedLetter: null });
                }
                
                sendPlayerAction(socket, 'updateGameState', {
                  ...gameState,
                  board: newBoard,
                  playerRacks: playerRacks.map((rack, idx) => idx === myPlayerIndex ? currentPlayersRack : rack),
                  hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, boardAtStartOfTurn).length > 0,
                });
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
