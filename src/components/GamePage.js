// src/components/GamePage.js
import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  // console.log('GamePage: userId prop value at render:', userId);

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
  } = useSocketConnection(gameId, userId, handleGameStateUpdate);

  useEffect(() => {
    // console.log('GamePage: Komponent pripojený (mounted)');
  }, []); // Prázdne pole znamená, že sa spustí iba raz

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
    handleSurrender,
    handleDrawForTurn,
  } = useGameLogic(socket, gameId, myPlayerIndex, slovakWordsSet, gameState, setGameState);

  const isSpectator = myPlayerIndex === null;
  
  const {
    selectedLetter,
    handleTapLetter,
    handleTapSlot,
  } = useTapToMove(moveLetter, gameState, myPlayerIndex, isActionInProgress, setIsActionInProgress, gameState.gameStatus);

  const handleApproveTurn = useCallback(() => {
    setIsActionInProgress(true);
    if (socket) {
      sendPlayerAction(socket, gameId, 'resolveTurnValidation', { approved: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, gameId]);

  const handleRejectTurn = useCallback(() => {
    setIsActionInProgress(true);
    if (socket) {
      sendPlayerAction(socket, gameId, 'resolveTurnValidation', { approved: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, gameId]);

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
    players,
  } = gameState;

  const opponentIndex = myPlayerIndex !== null ? 1 - myPlayerIndex : null;
  const opponentPlayer = opponentIndex !== null
    ? players?.find(p => p && p.playerIndex === opponentIndex)
    : null;
  const isOpponentAtTable = !!opponentPlayer?.socketId;

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
                    // console.log(`GamePage: Hľadá sa player ${playerIndex}, nájdený objekt:`, player);
                    if (player && player.userId) {
                        const userDocRef = doc(db, 'users', player.userId);
                        const userDocSnap = await getDoc(userDocRef);
                        // console.log(`GamePage: Načítaný dokument pre userId ${player.userId}, existuje?`, userDocSnap.exists());
                        
                        if (userDocSnap.exists()) {
                           const userData = userDocSnap.data();
                          //  console.log(`GamePage: Načítané dáta používateľa:`, userData);
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
            // console.log('GamePage: Načítané ELO skóre:', eloScores);
            setPlayerElo(eloScores);
        };
        fetchEloScores();
    } else {
      // console.log('GamePage: Podmienka na načítanie ELO nie je splnená.');
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

  const handleReturnAllToRack = () => {
    if (myPlayerIndex === null || gameState.isGameOver || gameState.currentPlayerIndex !== myPlayerIndex) return;

    // Všetka výpočtová logika je vnútri prev => aby sme vždy pracovali
    // s aktuálnym stavom — nie so stale hodnotami zo closure.
    setGameState(prev => {
      const placedOnBoard = [];
      for (let x = 0; x < prev.board.length; x++) {
        for (let y = 0; y < prev.board[x].length; y++) {
          if (prev.board[x][y] !== null && prev.boardAtStartOfTurn[x][y] === null) {
            placedOnBoard.push({ letter: prev.board[x][y], x, y });
          }
        }
      }
      const inExchangeZone = [...prev.exchangeZoneLetters];
      if (placedOnBoard.length === 0 && inExchangeZone.length === 0) return prev;

      let newBoard = prev.board.map(row => [...row]);
      let newRack = [...(prev.playerRacks[myPlayerIndex] || [])];
      for (const { letter, x, y } of placedOnBoard) {
        newBoard[x][y] = null;
        const slot = newRack.findIndex(s => s === null);
        if (slot !== -1) newRack[slot] = letter;
      }
      for (const letter of inExchangeZone) {
        const slot = newRack.findIndex(s => s === null);
        if (slot !== -1) newRack[slot] = letter;
      }

      return {
        ...prev,
        board: newBoard,
        playerRacks: prev.playerRacks.map((r, i) => i === myPlayerIndex ? newRack : r),
        exchangeZoneLetters: [],
        hasPlacedOnBoardThisTurn: false,
        hasMovedToExchangeZoneThisTurn: false,
      };
    });

    // Server má vlastnú kontrolu (if (!changed) break), takže volanie je vždy bezpečné.
    if (socket) {
      sendPlayerAction(socket, gameId, 'returnAllToRack', {});
    }
  };

  const handleRightClickFromExchangeZone = (letterData, source) => {
    // Kontrolujeme, či je na ťahu aktuálny hráč a nie je divák
    if (myPlayerIndex === null || gameState.currentPlayerIndex !== myPlayerIndex) {
      return;
    }
    // Zavoláme hlavnú funkciu moveLetter s cieľom nastaveným na hráčov stojan (rack)
    moveLetter(letterData, source, { type: 'rack', playerIndex: myPlayerIndex });
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

  const topPlayerIndex = myPlayerIndex !== null ? myPlayerIndex : 0;
  const bottomPlayerIndex = myPlayerIndex !== null ? 1 - myPlayerIndex : 1;



  return (
    <DndProvider backend={HTML5Backend}>
      <div className="game-page-container">
        <div className="game-header">
          <div className="connection-status">
            Stav pripojenia: <span className={connectionStatus === 'Pripojený' ? 'connected' : 'disconnected'}>{connectionStatus}</span>
            {myPlayerIndex !== null && ` | Si Hráč ${myPlayerIndex + 1}`}
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
              gameMode={gameState.gameMode}
              playerTimes={gameState.playerTimes}
              gameStatus={gameState.gameStatus}
              turnDraw={gameState.turnDraw}
            />
            <LetterBag remainingLettersCount={letterBag.length} />
            {!isSpectator && (
              <div className="second-player-status-message">
                <p>{isOpponentAtTable ? 'Súper je pri stole.' : 'Súper nie je pri stole.'}</p>
              </div>
            )}
            {/* Priradenie ref boardRef k hlavnému kontajneru hernej plochy */}
            {/* ZMENA: Vytvorenie nového kontajnera pre trojstĺpcové rozloženie */}
            
            {(gameState.gameStatus === 'drawing_for_turn' || gameState.gameStatus === 'turn_draw_reveal') ? (
              <div className="draw-for-turn-container">
                <h2>Losovanie o prvý ťah</h2>
                <p>Hráč, ktorý si vylosuje písmeno bližšie k začiatku abecedy, začína.</p>
                <div className="draw-players-container">
                  {/* --- Zobrazenie výsledku losovania --- */}
                  {gameState.gameStatus === 'turn_draw_reveal' && (
                      <div className="draw-result-message">
                          <h3>
                              {playerNicknames[gameState.turnDrawWinner] || `Hráč ${gameState.turnDrawWinner + 1}`} vyhral losovanie!
                          </h3>
                          <p>Hra sa začne o malú chvíľu...</p>
                      </div>
                  )}
                    {/* Zobrazenie pre Hráča 1 (index 0) */}
                    <div className="draw-player-box">
                        <h3>{playerNicknames[0] || 'Hráč 1'}</h3>
                        <div className="drawn-letter-display">
                            {gameState.turnDraw && gameState.turnDraw[0] ? (
                                <div className="letter-tile-static">{gameState.turnDraw[0].letter || '?'}</div>
                            ) : (
                                <span>Čaká...</span>
                            )}
                        </div>
                    </div>

                    {/* Zobrazenie pre Hráča 2 (index 1) */}
                    <div className="draw-player-box">
                        <h3>{playerNicknames[1] || 'Hráč 2'}</h3>
                        <div className="drawn-letter-display">
                            {gameState.turnDraw && gameState.turnDraw[1] ? (
                                <div className="letter-tile-static">{gameState.turnDraw[1].letter || '?'}</div>
                            ) : (
                                <span>Čaká...</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tlačidlo sa zobrazí len mne a len vtedy, ak som ešte nelosoval */}
                {myPlayerIndex !== null && gameState.turnDraw && gameState.turnDraw[myPlayerIndex] === null && (
                    <>
                        <button
                            onClick={handleDrawForTurn}
                            className="draw-button"
                        >
                            Vylosovať písmeno
                        </button>
                    </>
                )}

                {/* Správa, ak čakáme na súpera */}
                {gameState.gameStatus === 'drawing_for_turn' && myPlayerIndex !== null && gameState.turnDraw && gameState.turnDraw[myPlayerIndex] !== null && gameState.turnDraw[1 - myPlayerIndex] === null && (
                    <p className="waiting-for-opponent-draw">Čaká sa na súpera...</p>
                )}
            </div>
            ) : (
            <div className="main-game-layout">
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
                  gameStatus={gameState.gameStatus}
                />
              </div>

              {/* Druhý stĺpec - Racks a ovládacie prvky */}
              <div className="right-panel-column">
                <div className="player-racks-container">
                  <div className="player-rack-section">
                      <div className="rack-label-row">
                        <h3>{playerNicknames[topPlayerIndex] || `Hráč ${topPlayerIndex + 1}`} Rack:</h3>
                        {topPlayerIndex === myPlayerIndex && (
                          <button
                            className="return-to-rack-button"
                            onClick={handleReturnAllToRack}
                            disabled={(!gameState.hasPlacedOnBoardThisTurn && gameState.exchangeZoneLetters.length === 0) || gameState.currentPlayerIndex !== myPlayerIndex}
                          >↩ Vrátiť</button>
                        )}
                      </div>
                      <PlayerRack
                          letters={playerRacks[topPlayerIndex]}
                          moveLetter={moveLetter}
                          playerIndex={topPlayerIndex}
                          myPlayerIndex={myPlayerIndex}
                          currentPlayerIndex={currentPlayerIndex}
                          selectedLetter={selectedLetter}
                          onTapLetter={handleTapLetter}
                          onTapSlot={handleTapSlot}
                          isActionInProgress={isActionInProgress}
                          isGameOver={isGameOver}
                          gameStatus={gameState.gameStatus}
                      />
                  </div>
                  
                  {gameState.gameStatus === 'AWAITING_WORD_VALIDATION' ? (
                  <div className="validation-controls">
                    {myPlayerIndex !== null && myPlayerIndex !== gameState.pendingTurn.playerIndex ? (
                      <>
                        <h4>Súper zahral slovo, ktoré nie je v slovníku: "{gameState.pendingTurn.unverifiedWords.join(', ')}"</h4>
                        <p>Prajete si tento ťah schváliť?</p>
                        <div className='validation-buttons'>
                          <button onClick={handleApproveTurn} className="approve-turn-button" disabled={isActionInProgress}>Schváliť</button>
                        <button onClick={handleRejectTurn} className="reject-turn-button" disabled={isActionInProgress}>Zamietnuť</button>
                        </div>
                        
                      </>
                    ) : (
                    <p>Čaká sa na schválenie ťahu od súpera...</p>
                    )}
                  </div>
                  ) : (
                    <ExchangeZone
                      lettersInZone={exchangeZoneLetters}
                      moveLetter={moveLetter}
                      myPlayerIndex={myPlayerIndex}
                      currentPlayerIndex={currentPlayerIndex}
                      selectedLetter={selectedLetter}
                      onTapLetter={handleTapLetter}
                      onTapSlot={handleTapSlot}
                      onRightClick={handleRightClickFromExchangeZone}
                      isActionInProgress={isActionInProgress}
                      gameStatus={gameState.gameStatus}
                    />
                  )}
                  <div className="player-rack-section">
                    <h3>{playerNicknames[bottomPlayerIndex] || `Hráč ${bottomPlayerIndex + 1}`} Rack:</h3>
                    <PlayerRack
                      letters={playerRacks[bottomPlayerIndex]}
                      moveLetter={moveLetter}
                      playerIndex={bottomPlayerIndex}
                      myPlayerIndex={myPlayerIndex}
                      currentPlayerIndex={currentPlayerIndex}
                      selectedLetter={selectedLetter}
                      onTapLetter={handleTapLetter}
                      onTapSlot={handleTapSlot}
                      isActionInProgress={isActionInProgress}
                      isGameOver={isGameOver}
                      gameStatus={gameState.gameStatus}
                    />
                  </div>
                </div>

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
                  <button
                      className="surrender-button" // Nová trieda pre štýlovanie
                      onClick={() => openConfirmation('Naozaj chcete vzdať hru? Súper vyhrá.', handleSurrender)}
                      disabled={isGameOver || isSpectator || myPlayerIndex === null}
                  >
                      Vzdať hru
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
            
            </div> 
            )} {/* Koniec podmienky pre gameStatus */}

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
