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
import FloatingChatIcon from '../components/FloatingChatIcon';

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

  // Ref pre hernú dosku (z predchádzajúceho tasku)
  const boardRef = useRef(null);
  // Ref pre ChatWindow komponent
  const chatWindowRef = useRef(null);

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

  // Stav pre počet neprečítaných správ
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  // Ref na uloženie predchádzajúceho počtu správ pre detekciu nových
  const previousChatMessagesLength = useRef(0);
  // Stav pre viditeľnosť chatového okna
  const [isChatVisible, setIsChatVisible] = useState(false); // Zmenené na false, chat je predvolene skrytý

  const {
    socket,
    myPlayerIndex,
    connectionStatus,
    chatMessages,
    newChatMessage,
    setNewChatMessage,
    waitingForSecondPlayer,
  } = useSocketConnection(gameId, userId, setGameState);

  // useEffect na posun okna na hernú dosku po načítaní a pripravenosti hry (z predchádzajúceho tasku)
  useEffect(() => {
    if (boardRef.current && myPlayerIndex !== null) {
      boardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('GamePage: Okno posunuté na hernú dosku.');
    }
  }, [myPlayerIndex]);

  // useEffect na sledovanie nových správ a aktualizáciu počtu neprečítaných správ
  useEffect(() => {
    // Ak pribudli nové správy
    if (chatMessages.length > previousChatMessagesLength.current) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      const isMyMessage = lastMessage && lastMessage.senderIndex === myPlayerIndex;

      // Ak chat nie je viditeľný alebo nie je posunutý dole a správa nie je od nás, zvýšime počet neprečítaných správ.
      if ((!isChatVisible || !chatWindowRef.current?.isScrolledToBottom()) && !isMyMessage) {
        setUnreadMessageCount(prevCount => prevCount + 1);
        console.log('GamePage: Incremented unread message count.');
      }
      // Dôležité: Neresetujeme počítadlo tu. Reset sa vykoná pri explicitnej akcii (odoslanie, otvorenie, posun).
    }
    // Vždy aktualizujeme predchádzajúcu dĺžku správ
    previousChatMessagesLength.current = chatMessages.length;
  }, [chatMessages, myPlayerIndex, isChatVisible]); // Pridaná závislosť isChatVisible

  // Funkcia na resetovanie počtu neprečítaných správ
  const resetUnreadMessages = () => {
    setUnreadMessageCount(0);
    // Po resetovaní môžeme aj posunúť chat dole, ak ho používateľ otvoril
    chatWindowRef.current?.scrollToBottom();
  };

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
    playerNicknames,
  } = gameState;

  // Debugovací výpis pre playerNicknames
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
      // Po odoslaní vlastnej správy by sa mal chat posunúť dole a resetovať neprečítané správy
      resetUnreadMessages(); 
    }
  };

  // NOVÉ: Funkcia na OTVORENIE chatu a resetovanie počtu neprečítaných správ
  const openChatAndResetUnread = () => {
    setIsChatVisible(true); // Vždy nastavíme chat na viditeľný
    // Použijeme setTimeout, aby sa zabezpečilo, že chat je už vykreslený a má správnu výšku
    setTimeout(() => {
      chatWindowRef.current?.scrollToBottom();
      resetUnreadMessages();
    }, 0);
  };

  // NOVÉ: Funkcia na ZATVORENIE chatu
  const handleCloseChat = () => {
    setIsChatVisible(false);
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
              playerNicknames={playerNicknames}
              myPlayerIndex={myPlayerIndex}
            />
            <LetterBag remainingLettersCount={letterBag.length} />
            {waitingForSecondPlayer && (
              <div className="second-player-status-message">
                <p>Druhý hráč nie je pri stole.</p>
              </div>
            )}
            {/* Priradenie ref boardRef k hlavnému kontajneru hernej plochy */}
            <div className="game-area-container" ref={boardRef}>
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
            {/* Podmienené vykresľovanie ChatWindow */}
            {isChatVisible && (
              <ChatWindow
                chatMessages={chatMessages}
                newChatMessage={newChatMessage}
                myPlayerIndex={myPlayerIndex}
                handleSendChatMessage={handleSendChatMessage}
                setNewChatMessage={setNewChatMessage}
                playerNicknames={playerNicknames}
                ref={chatWindowRef}
                onScrollStateChange={resetUnreadMessages}
                onCloseChat={handleCloseChat}
              />
            )}
            {/* Vykreslenie FloatingChatIcon */}
            <FloatingChatIcon
              unreadCount={unreadMessageCount}
              onClick={openChatAndResetUnread}
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
