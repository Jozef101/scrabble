// src/components/GamePage.js
import React, { useRef, useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { doc, getDoc } from 'firebase/firestore'; 

// Importy pre hernú logiku
// Import vlastných hookov
import useSocketConnection from '../hooks/useSocketConnection';
import useGameLogic from '../hooks/useGameLogic';
import useTapToMove from '../hooks/useTapToMove';
import ChatWindow from '../components/ChatWindow';
import FloatingChatIcon from '../components/FloatingChatIcon';
import ConfirmationModal from '../components/ConfirmationModal';

// Import komponentov UI
import Board from '../components/Board';
import PlayerRack from '../components/PlayerRack';
import Scoreboard from '../components/Scoreboard';
import LetterBag from '../components/LetterBag';
import ExchangeZone from '../components/ExchangeZone';
import LetterSelectionModal from '../components/LetterSelectionModal';
// NOVÝ IMPORT: Komponent pre záznam ťahov
import GameLog from '../components/GameLog';

// Import sendPlayerAction
import { sendPlayerAction } from '../utils/socketHandlers';

import '../styles/GamePage.css';

function GamePage({ gameId, userId, onGoToLobby, slovakWordsSet, db }) {
  console.log('GamePage: userId prop value at render:', userId);

  // Ref pre hernú dosku
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
    players: [],
    playerNicknames: {},
    turnLogs: [], // NOVÝ STAV: Záznam ťahov
  });

  const [playerElo, setPlayerElo] = useState({});
  // Stav pre počet neprečítaných správ
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  // Stav pre viditeľnosť chatového okna
  const [isChatVisible, setIsChatVisible] = useState(false);
  // NOVÝ STAV: Viditeľnosť okna pre záznam ťahov
  const [isGameLogVisible] = useState(true);

  const [confirmation, setConfirmation] = useState({ isOpen: false, message: '', onConfirm: null });

  const handleGameStateUpdate = React.useCallback(newGameState => {
    setGameState(prevGameState => ({
        ...prevGameState,
        ...newGameState
    }));
}, []);

  const {
    socket,
    myPlayerIndex,
    connectionStatus,
    chatMessages,
    newChatMessage,
    setNewChatMessage,
    waitingForSecondPlayer,
  } = useSocketConnection(gameId, userId, handleGameStateUpdate);

  // useEffect na posun okna na hernú dosku po načítaní a pripravenosti hry
  useEffect(() => {
    if (boardRef.current && myPlayerIndex !== null) {
      boardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('GamePage: Okno posunuté na hernú dosku.');
    }
  }, [myPlayerIndex]);

  // useEffect na sledovanie nových správ a aktualizáciu počtu neprečítaných správ
  useEffect(() => {
    if (!chatMessages || myPlayerIndex === null) return;

    const unreadCount = chatMessages.reduce((count, msg) => {
      return msg.seen && msg.seen[myPlayerIndex] === false ? count + 1 : count;
    }, 0);

    setUnreadMessageCount(unreadCount);
  }, [chatMessages, myPlayerIndex]);

  useEffect(() => {
        // Podmienka: Ak je chat viditeľný a máme neprečítané správy
        if (isChatVisible && unreadMessageCount > 0 && socket && myPlayerIndex !== null) {
            console.log("GamePage: Chat je otvorený a prichádza nová správa. Označujem ako prečítané. " + unreadMessageCount);
            
            // Voláme funkciu na označenie správ na serveri
            socket.emit('markMessagesSeen', {
                gameId,
                playerIndex: myPlayerIndex
            });
            
            // Posunieme chat dole pre zobrazenie najnovšej správy
            chatWindowRef.current?.scrollToBottom();
            console.log("TOTO "+unreadMessageCount)
        }
    }, [isChatVisible, unreadMessageCount, socket, gameId, myPlayerIndex]);

  const {
    isActionInProgress,
    setIsActionInProgress,
    showLetterSelectionModal,
    setShowLetterSelectionModal,
    jokerTileCoords,
    setJokerTileCoords,
    moveLetter,
    assignLetterToJoker,
    confirmTurn,
    handleExchangeLetters,
    handlePassTurn,
  } = useGameLogic(socket, gameId, myPlayerIndex, slovakWordsSet, gameState, setGameState);

  const isSpectator = myPlayerIndex === null;
  
  const {
    selectedLetter,
    handleTapLetter,
    handleTapSlot,
  } = useTapToMove(moveLetter, gameState, myPlayerIndex, isActionInProgress, setIsActionInProgress);

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

  useEffect(() => {
}, [playerNicknames, gameState.players]);

  useEffect(() => {
    if (db && Object.keys(playerNicknames).length > 0 && gameState.players && gameState.players.length > 0) {
        const fetchEloScores = async () => {
            const eloScores = {};
            // Prejdeme cez všetkých hráčov, pre ktorých máme prezývky
            for (const playerIndex of Object.keys(playerNicknames)) {
                try {
                    const player = gameState.players.find(p => p && p.playerIndex === parseInt(playerIndex, 10));
                    console.log(`GamePage: Hľadá sa player ${playerIndex}, nájdený objekt:`, player);
                    if (player && player.userId) {
                        const userDocRef = doc(db, 'users', player.userId);
                        const userDocSnap = await getDoc(userDocRef);
                        console.log(`GamePage: Načítaný dokument pre userId ${player.userId}, existuje?`, userDocSnap.exists());
                        
                        if (userDocSnap.exists()) {
                           const userData = userDocSnap.data();
                           console.log(`GamePage: Načítané dáta používateľa:`, userData);
                           if (userData && userData.elo) {
                               eloScores[playerIndex] = userData.elo;
                           } else {
                               eloScores[playerIndex] = 1000; // Defaultná hodnota, ak ELO nie je v DB
                           }
                        } else {
                           eloScores[playerIndex] = 1000;
                        }
                    } else {
                        // Ak sa nenašiel hráč, preskočíme
                        eloScores[playerIndex] = null;
                    }
                } catch (e) {
                    console.error(`Chyba pri načítaní ELO pre hráča ${playerIndex}:`, e);
                    eloScores[playerIndex] = null;
                }
            }
            console.log('GamePage: Načítané ELO skóre:', eloScores);
            setPlayerElo(eloScores);
        };
        fetchEloScores();
    } else {
      console.log('GamePage: Podmienka na načítanie ELO nie je splnená.');
      setPlayerElo({});
    }
}, [db, playerNicknames, gameState.players]);

  const isGameReadyToRender = gameState.hasInitialGameStateReceived;

  const handleSendChatMessage = () => {
    if (isSpectator) return;
    if (socket && gameId && newChatMessage.trim()) {
      sendPlayerAction(socket, gameId, 'chatMessage', newChatMessage);
      setNewChatMessage('');
    }
  };

  // Funkcia na OTVORENIE chatu a resetovanie počtu neprečítaných správ
  const openChatAndResetUnread = () => {
    setIsChatVisible(true);

    // Označíme správy ako prečítané na serveri
    if (socket && chatMessages.length > 0 && myPlayerIndex !== null) {
      socket.emit('markMessagesSeen', { 
        gameId, 
        playerIndex: myPlayerIndex        
      });
      console.log(`GamePage: Správy označené ako prečítané pre Hráča ${myPlayerIndex + 1} v hre ${gameId}.`);
    }

    // Po vykreslení chat okna posuň na koniec
    setTimeout(() => {
      chatWindowRef.current?.scrollToBottom();
    }, 0);
  };

  // Funkcia na ZATVORENIE chatu
  const handleCloseChat = () => {
    setIsChatVisible(false);
  };

  const handleGoToLobby = () => {
    // Odoslanie správy na server, že hráč opúšťa hru.
    // Server by mal potom odstrániť hráča zo zoznamu a zastaviť posielanie aktualizácií.
    if (socket) {
      sendPlayerAction(socket, gameId, 'playerLeftGame');
      // Vynútené odpojenie, ak je potrebné.
      socket.disconnect();
    }
    // Zavolanie funkcie pre prechod do lobby
    onGoToLobby();
  };

  const openConfirmation = (message, onConfirmAction) => {
    setConfirmation({
      isOpen: true,
      message,
      onConfirm: () => {
        onConfirmAction();
        closeConfirmation();
      }
    });
  };

  const closeConfirmation = () => {
    setConfirmation({ isOpen: false, message: '', onConfirm: null });
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="game-page-container">
        <div className="game-header">
          <div className="connection-status">
            Stav pripojenia: <span className={connectionStatus === 'Pripojený' ? 'connected' : 'disconnected'}>{connectionStatus}</span>
            {myPlayerIndex !== null && ` | Si Hráč ${myPlayerIndex + 1}`}
            {userId && ` | User ID: ${userId}`}
          </div>
          {/* <button onClick={onGoToLobby} className="back-to-lobby-button">Späť do Lobby</button> */}
          <button onClick={handleGoToLobby} className="back-to-lobby-button">Späť do Lobby</button>
          {/* <a href="/" className="back-to-lobby-button" onClick={(e) => { e.preventDefault(); handleGoToLobby(); }}>Späť do Lobby</a> */}
        </div>

        {isGameOver && <h2 className="game-over-message">Hra skončila!</h2>}

        {isSpectator && isGameReadyToRender && <div className="spectator-message">Sledujete hru ako divák.</div>}
        
        {isGameReadyToRender ? (
          <>
            <Scoreboard
              playerScores={playerScores}
              currentPlayerIndex={currentPlayerIndex}
              isGameOver={isGameOver}
              playerNicknames={playerNicknames}
              playerElo={playerElo}
              myPlayerIndex={myPlayerIndex}
            />
            <LetterBag remainingLettersCount={letterBag.length} />
            {waitingForSecondPlayer && (
              <div className="second-player-status-message">
                <p>Druhý hráč nie je pri stole.</p>
              </div>
            )}
            {/* Priradenie ref boardRef k hlavnému kontajneru hernej plochy */}
            {/* ZMENA: Vytvorenie nového kontajnera pre trojstĺpcové rozloženie */}
            <div className="main-game-layout">
              {/* Prvý stĺpec - Hracia doska */}
              <div className="board-column" ref={boardRef}>
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
              </div>

              {/* Druhý stĺpec - Racks a ovládacie prvky */}
              <div className="right-panel-column">
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
                    onClick={() => openConfirmation('Naozaj chcete potvrdiť ťah?', confirmTurn)}
                    disabled={isGameOver || showLetterSelectionModal || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex || isSpectator}
                  >
                    Potvrdiť ťah
                  </button>
                  <button
                    className="exchange-letters-button"
                    onClick={() => openConfirmation('Naozaj chcete urobiť výmenu?', handleExchangeLetters)}
                    disabled={isGameOver || letterBag.length < exchangeZoneLetters.length || showLetterSelectionModal || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex || isSpectator}
                  >
                    Vymeniť ({exchangeZoneLetters.length})
                  </button>
                  <button
                    className="pass-turn-button"
                    onClick={() => openConfirmation('Naozaj chcete preskočiť ťah?', handlePassTurn)}
                    disabled={isGameOver || showLetterSelectionModal || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex || isSpectator}
                  >
                    Pass
                  </button>
                </div>
              </div>

              {/* Tretí stĺpec - Nový komponent GameLog */}
              {gameId && isGameLogVisible && (
                <div className="gamelog-column">
                  <GameLog
                  db={db}
                  gameId={gameId}
                  playerNicknames={playerNicknames}
                  />
                </div>
              )}
            </div> {/* Koniec main-game-layout */}
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
                onCloseChat={handleCloseChat}
              />
            )}
            {/* Vykreslenie FloatingChatIcon */}
            {!isChatVisible && (<FloatingChatIcon
              unreadCount={unreadMessageCount}
              onClick={openChatAndResetUnread}
            /> )}
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
        <ConfirmationModal
        isOpen={confirmation.isOpen}
        message={confirmation.message}
        onConfirm={confirmation.onConfirm}
        onCancel={closeConfirmation}
      />
      </div>
    </DndProvider>
  );
}
export default GamePage;
