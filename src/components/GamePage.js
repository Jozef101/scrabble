// src/components/GamePage.js
import React, { useRef, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Importy pre hernú logiku (z gameLogic.js)
// BOARD_SIZE a RACK_SIZE už nie sú priamo používané v GamePage.js po refaktorovaní
// import { BOARD_SIZE, RACK_SIZE } from '../utils/constants'; // ODSTRÁNENÉ
import slovakWordsArray from '../data/slovakWords.json'; // UISTITE SA, ŽE TENTO SÚBOR EXISTUJE V src/utils/

// Import vlastných hookov pre refaktorovanú logiku
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

// KLÚČOVÁ ZMENA: Import sendPlayerAction
import { sendPlayerAction } from '../utils/socketHandlers';

import '../styles/GamePage.css'; // Štýly pre GamePage

function GamePage({ gameId, userId, onGoToLobby, db }) {
  // Debug log pre userId prop na začiatku renderu komponentu
  console.log('GamePage: userId prop value at render:', userId);

  // 1. Hook pre pripojenie Socket.IO a chat
  const {
    socket,
    myPlayerIndex,
    connectionStatus,
    chatMessages,
    // setChatMessages, // ODSTRÁNENÉ: setChatMessages je použité v useSocketConnection, nie priamo tu
    newChatMessage,
    setNewChatMessage,
    waitingForSecondPlayer,
  } = useSocketConnection(gameId, userId);

  // Ref pre posúvanie chatu
  const chatMessagesEndRef = useRef(null);
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 2. Hook pre hlavnú hernú logiku a stav
  const {
    gameState,
    setGameState, // Potrebné pre moveLetterLogic
    showLetterSelectionModal,
    setShowLetterSelectionModal,
    jokerTileCoords,
    setJokerTileCoords,
    moveLetter, // Funkcia moveLetter vrátená z hooku
    assignLetterToJoker,
    confirmTurn,
    handleExchangeLetters,
    handlePassTurn,
  } = useGameLogic(socket, gameId, myPlayerIndex, slovakWordsArray);

  // 3. Hook pre logiku ťuknutia na písmeno/slot
  const {
    selectedLetter,
    handleTapLetter,
    handleTapSlot,
  } = useTapToMove(moveLetter, gameState, myPlayerIndex);

  // Destrukturujeme stav hry pre jednoduchší prístup
  const {
    letterBag,
    playerRacks,
    board,
    boardAtStartOfTurn,
    // isFirstTurn, // ODSTRÁNENÉ: isFirstTurn je použité v useGameLogic, nie priamo tu
    playerScores,
    currentPlayerIndex,
    exchangeZoneLetters,
    isGameOver,
  } = gameState;

  // Podmienka pre renderovanie hernej plochy (až po priradení hráča)
  const isGameReadyToRender = myPlayerIndex !== null;

  // Handler pre odoslanie chat správy
  // KLÚČOVÁ ZMENA: Používame sendPlayerAction namiesto priameho socket.emit('chatMessage')
  const handleSendChatMessage = () => {
    if (socket && gameId && newChatMessage.trim()) {
      sendPlayerAction(socket, gameId, 'chatMessage', newChatMessage); // Používame sendPlayerAction
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
        <Scoreboard playerScores={playerScores} currentPlayerIndex={currentPlayerIndex} isGameOver={isGameOver} />
        <LetterBag remainingLettersCount={letterBag.length} />

        {isGameReadyToRender ? (
          <>
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
                highlightedLetters={gameState.highlightedLetters} // NOVÉ: Posielame zvýraznené písmená
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
                      selectedLetter={selectedLetter}
                      onTapLetter={handleTapLetter}
                      onTapSlot={handleTapSlot}
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
                      selectedLetter={selectedLetter}
                      onTapLetter={handleTapLetter}
                      onTapSlot={handleTapSlot}
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
          </>
        ) : (
          <div className="waiting-message">
            <p>Pripájam sa k hre ID: **{gameId}**...</p>
          </div>
        )}

        <ChatWindow
        chatMessages={chatMessages}
        newChatMessage={newChatMessage}
        myPlayerIndex={myPlayerIndex}
        handleSendChatMessage={handleSendChatMessage}
        setNewChatMessage={setNewChatMessage}
      />

        {showLetterSelectionModal && (
          <LetterSelectionModal
            onSelectLetter={assignLetterToJoker}
            onClose={() => {
              // KĽÚČOVÁ ZMENA: Ak sa modálne okno žolíka zatvorí bez priradenia písmena,
              // žolík sa vráti späť na stojan.
              if (jokerTileCoords) {
                // Získame písmeno žolíka z dosky
                const currentJokerLetter = gameState.board[jokerTileCoords.x][jokerTileCoords.y];
                if (currentJokerLetter) {
                    // Zavoláme moveLetter, aby sa žolík presunul z dosky na stojan
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
