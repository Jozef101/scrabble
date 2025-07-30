// src/components/GamePage.js
import React, { useRef, useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Importy pre hernú logiku
import slovakWordsArray from '../data/slovakWords.json';

// Import vlastných hookov
import useSocketConnection from '../hooks/useSocketConnection';
import useGameLogic from '../hooks/useGameLogic';
import useTapToMove from '../hooks/useTapToMove';
import ChatWindow from '../components/ChatWindow';

// Import komponentov UI
import Board from '../components/Board';
import PlayerRack from '../components/PlayerRack';
import Scoreboard from '../components/Scoreboard';
import LetterBag from '../components/LetterBag';
import ExchangeZone from '../components/ExchangeZone';
import LetterSelectionModal from '../components/LetterSelectionModal';

// Import sendPlayerAction
import { sendPlayerAction } from '../utils/socketHandlers';

import '../styles/GamePage.css';

function GamePage({ gameId, userId, onGoToLobby, db }) {
  console.log('GamePage: userId prop value at render:', userId);

  const [gameState, setGameState] = useState({
    letterBag: [],
    playerRacks: [[], []],
    board: Array(15).fill(null).map(() => Array(15).fill(null)),
    boardAtStartOfTurn: Array(15).fill(null).map(() => Array(15).fill(null)),
    playerScores: [0, 0],
    currentPlayerIndex: 0,
    exchangeZoneLetters: [],
    isGameOver: false,
    highlightedLetters: [],
    playerNicknames: {}, // Dôležité: Inicializujeme playerNicknames ako prázdny objekt
  });

  const {
    socket,
    myPlayerIndex,
    connectionStatus,
    chatMessages,
    newChatMessage,
    setNewChatMessage,
    waitingForSecondPlayer,
  } = useSocketConnection(gameId, userId, setGameState);

  const chatMessagesEndRef = useRef(null);
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const {
    isActionInProgress,
    showLetterSelectionModal,
    setShowLetterSelectionModal,
    jokerTileCoords,
    setJokerTileCoords,
    moveLetter,
    assignLetterToJoker,
    confirmTurn,
    handleExchangeLetters,
    handlePassTurn,
  } = useGameLogic(socket, gameId, myPlayerIndex, slovakWordsArray, gameState, setGameState);

  const {
    selectedLetter,
    handleTapLetter,
    handleTapSlot,
  } = useTapToMove(moveLetter, gameState, myPlayerIndex);

  const {
    letterBag,
    playerRacks,
    board,
    boardAtStartOfTurn,
    playerScores,
    currentPlayerIndex,
    exchangeZoneLetters,
    isGameOver,
    highlightedLetters,
    playerNicknames, // Destrukturujeme playerNicknames zo stavu hry
  } = gameState;

  // KLÚČOVÁ ZMENA: Debugovací výpis pre playerNicknames
  useEffect(() => {
    if (Object.keys(playerNicknames).length > 0) {
      console.log('GamePage: Prijaté playerNicknames:', playerNicknames);
    }
  }, [playerNicknames]);


  const isGameReadyToRender = myPlayerIndex !== null;

  const handleSendChatMessage = () => {
    if (socket && gameId && newChatMessage.trim()) {
      sendPlayerAction(socket, gameId, 'chatMessage', newChatMessage);
      setNewChatMessage('');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="game-page-container">
        <div className="game-header">
          <h1>Scrabble (Hra ID: {gameId})</h1>
          <div className="connection-status">
            Stav pripojenia: <span className={connectionStatus === 'Pripojený' ? 'connected' : 'disconnected'}>{connectionStatus}</span>
            {myPlayerIndex !== null && ` | Si Hráč ${myPlayerIndex + 1}`}
            {userId && ` | User ID: ${userId}`}
          </div>
          <button onClick={onGoToLobby} className="back-to-lobby-button">Späť do Lobby</button>
        </div>

        {isGameOver && <h2 className="game-over-message">Hra skončila!</h2>}
        
        {isGameReadyToRender ? (
          <>
            <Scoreboard
              playerScores={playerScores}
              currentPlayerIndex={currentPlayerIndex}
              isGameOver={isGameOver}
              playerNicknames={playerNicknames} // Odovzdávame playerNicknames
              myPlayerIndex={myPlayerIndex}
            />
            <LetterBag remainingLettersCount={letterBag.length} />
            {waitingForSecondPlayer && (
              <div className="second-player-status-message">
                <p>Druhý hráč nie je pri stole.</p>
              </div>
            )}
            <div className="game-area-container">
              <Board
                board={board}
                moveLetter={moveLetter}
                boardAtStartOfTurn={boardAtStartOfTurn}
                myPlayerIndex={myPlayerIndex}
                currentPlayerIndex={currentPlayerIndex}
                selectedLetter={selectedLetter}
                onTapLetter={handleTapLetter}
                onTapSlot={handleTapSlot}
                highlightedLetters={highlightedLetters}
                isActionInProgress={isActionInProgress}
              />

              <div className="right-panel-content">
                <div className="player-racks-container">
                  <div className="player-rack-section">
                    {/* KLÚČOVÁ ZMENA: Používame playerNicknames pre nadpis stojana */}
                    <h3>{playerNicknames[0] || 'Hráč 1'} Rack:</h3>
                    <PlayerRack
                      letters={playerRacks[0]}
                      moveLetter={moveLetter}
                      playerIndex={0}
                      myPlayerIndex={myPlayerIndex}
                      currentPlayerIndex={currentPlayerIndex}
                      selectedLetter={selectedLetter}
                      onTapLetter={handleTapLetter}
                      onTapSlot={handleTapSlot}
                      isActionInProgress={isActionInProgress}
                    />
                  </div>
                  <div className="player-rack-section">
                    {/* KLÚČOVÁ ZMENA: Používame playerNicknames pre nadpis stojana */}
                    <h3>{playerNicknames[1] || 'Hráč 2'} Rack:</h3>
                    <PlayerRack
                      letters={playerRacks[1]}
                      moveLetter={moveLetter}
                      playerIndex={1}
                      myPlayerIndex={myPlayerIndex}
                      currentPlayerIndex={currentPlayerIndex}
                      selectedLetter={selectedLetter}
                      onTapLetter={handleTapLetter}
                      onTapSlot={handleTapSlot}
                      isActionInProgress={isActionInProgress}
                    />
                  </div>
                </div>

                <ExchangeZone
                  lettersInZone={exchangeZoneLetters}
                  moveLetter={moveLetter}
                  myPlayerIndex={myPlayerIndex}
                  currentPlayerIndex={currentPlayerIndex}
                  selectedLetter={selectedLetter}
                  onTapLetter={handleTapLetter}
                  onTapSlot={handleTapSlot}
                  isActionInProgress={isActionInProgress}
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
            <ChatWindow
              chatMessages={chatMessages}
              newChatMessage={newChatMessage}
              myPlayerIndex={myPlayerIndex}
              handleSendChatMessage={handleSendChatMessage}
              setNewChatMessage={setNewChatMessage}
              playerNicknames={playerNicknames} // Odovzdávame playerNicknames
            />
          </>
        ) : (
          <div className="waiting-message">
            <p>Pripájam sa k hre...</p>
          </div>
        )}        

        {showLetterSelectionModal && (
          <LetterSelectionModal
            onSelectLetter={assignLetterToJoker}
            onClose={() => {
              if (jokerTileCoords) {
                const currentJokerLetter = gameState.board[jokerTileCoords.x][jokerTileCoords.y];
                if (currentJokerLetter) {
                  moveLetter(
                    currentJokerLetter,
                    { type: 'board', x: jokerTileCoords.x, y: jokerTileCoords.y },
                    { type: 'rack', playerIndex: myPlayerIndex }
                  );
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
export default GamePage;
