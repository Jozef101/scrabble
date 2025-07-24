// src/components/GamePage.js
/* global __app_id */ // Pridané pre ESLint
import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import io from 'socket.io-client';

import Board from './Board';
import PlayerRack from './PlayerRack';
import LetterBag from './LetterBag';
import Scoreboard from './Scoreboard';
import ExchangeZone from './ExchangeZone';
import LetterSelectionModal from './LetterSelectionModal';

import {
  drawLetters, // Still used for client-side validation logic, but server will execute
  getPlacedLettersDuringCurrentTurn, // Still used for client-side validation
  isStraightLine, // Still used for client-side validation
  getFullWordLetters, // Still used for client-side validation
  areLettersContiguous, // Still used for client-side validation
  isConnected, // Still used for client-side validation
  getAllWordsInTurn, // Still used for client-side validation
  calculateWordScore, // Still used for client-side validation
  calculateFinalScores, // Still used for client-side validation
} from '../utils/gameLogic';
import { setupSocketListeners, sendChatMessage, sendPlayerAction } from '../utils/socketHandlers';
import { SERVER_URL, BOARD_SIZE, RACK_SIZE } from '../utils/constants';

import slovakWordsArray from '../data/slovakWords.json';
import '../styles/App.css'; // Používame App.css pre základné štýly
import '../styles/GamePage.css'; // Nový súbor pre špecifické štýly GamePage

import { moveLetter as importedMoveLetter } from '../utils/moveLetterLogic';

// ====================================================================
// KLÚČOVÁ ZMENA: Definovanie appId s fallback hodnotou pre lokálny vývoj
// ====================================================================
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/**
 * Komponent, ktorý obsahuje celú logiku a UI hry Scrabble.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.gameId - ID hry, ku ktorej sa pripájame.
 * @param {string} props.userId - ID aktuálneho používateľa z Firebase.
 * @param {function} props.onGoToLobby - Callback funkcia na návrat do lobby.
 * @param {object} props.db - Inštancia Firestore databázy. (Už sa nepoužíva priamo na načítanie stavu hry)
 */
function GamePage({ gameId, userId, onGoToLobby, db }) { // Ponechávame db prop, ak by sa v budúcnosti použila
  // Debug log pre userId prop na začiatku renderu komponentu
  console.log('GamePage: userId prop value at render:', userId);

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
    hasInitialGameStateReceived: false, // Predvolene false, kým sa nenačíta/inicializuje
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

  const [selectedLetter, setSelectedLetter] = useState(null);

  // NOVÉ: Stav pre zobrazenie prekryvnej vrstvy "Čaká sa na druhého hráča"
  const [waitingForSecondPlayer, setWaitingForSecondPlayer] = useState(true);

  // Ref na sledovanie, či bola udalosť joinGame už odoslaná pre aktuálnu kombináciu gameId a userId
  const hasJoinedGameRef = useRef(false);

  // Effect pre inicializáciu Socket.IO pripojenia a nastavenie poslucháčov
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    // Poslucháč pre udalosť 'connect'
    const handleConnect = () => {
      setConnectionStatus('Pripojený');
      console.log('GamePage: Socket connected. Now checking userId and gameId to emit joinGame.');
      // Emitujeme 'joinGame' AŽ KEĎ je socket pripojený A userId je k dispozícii
      if (userId && gameId && !hasJoinedGameRef.current) {
        console.log(`GamePage: Emitting joinGame from handleConnect for ID: ${gameId}, User ID: ${userId}`);
        newSocket.emit('joinGame', { gameId: gameId, userId: userId });
        hasJoinedGameRef.current = true; // Označíme, že udalosť bola odoslaná
      } else if (!userId) {
        console.warn('GamePage: Socket connected, but userId is not available yet. Cannot emit joinGame from handleConnect.');
      }
    };

    newSocket.on('connect', handleConnect);

    // Poslucháč pre udalosť 'disconnect'
    newSocket.on('disconnect', () => {
      setConnectionStatus('Odpojený');
      console.log('GamePage: Odpojený od servera Socket.IO.');
      // Pri odpojení servera alebo hráča resetujeme stav hry
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
        hasInitialGameStateReceived: false, // Resetujeme aj toto
      });
      setMyPlayerIndex(null);
      setChatMessages([]);
      hasJoinedGameRef.current = false; // Reset pre opätovné pripojenie
      setWaitingForSecondPlayer(true); // NOVÉ: Reset na true pri odpojení
    });

    // Nastavenie základných poslucháčov socketu
    setupSocketListeners(
      newSocket,
      setConnectionStatus,
      setMyPlayerIndex,
      setGameState, // Priamo odovzdávame setGameState
      setChatMessages,
      setWaitingForSecondPlayer // NOVÉ: Pass the setter for waiting state
    );

    // Poslucháč pre udalosť 'gameReset' zo servera
    newSocket.on('gameReset', (message) => {
      alert(message);
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
        hasInitialGameStateReceived: false, // Po resete potrebujeme znova inicializovať
      });
      setMyPlayerIndex(null);
      hasJoinedGameRef.current = false; // Reset pre opätovné pripojenie
      setWaitingForSecondPlayer(true); // NOVÉ: Reset na true pri resete hry
    });

    // Cleanup funkcia pre odpojenie socketu a odstránenie poslucháčov
    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect'); // Odstránime aj poslucháča disconnect
      newSocket.off('gameReset'); // Odstránime aj poslucháča gameReset
      // NOVÉ: Odstránime aj poslucháčov pre waitingForPlayers a gameStarted
      newSocket.off('waitingForPlayers');
      newSocket.off('gameStarted');
      newSocket.disconnect();
      hasJoinedGameRef.current = false;
    };
  }, [gameId, userId]); // Závislosti pre tento useEffect sú gameId a userId, aby sa znova spustil, ak sa zmenia

  // Effect pre posúvanie chatu na koniec
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

  // KĽÚČOVÁ ZMENA: Podmienka pre renderovanie hernej plochy (až po priradení hráča)
  // hasInitialGameStateReceived už nie je súčasťou tejto podmienky, ale je aktualizovaný
  // v gameStateUpdate, aby sa zabezpečila správna logika hry.
  const isGameReadyToRender = myPlayerIndex !== null;


  // Funkcia pre presúvanie písmen
  const moveLetter = importedMoveLetter({
    gameState,
    setGameState,
    myPlayerIndex,
    setJokerTileCoords,
    setShowLetterSelectionModal,
    socket,
    gameIdToJoin: gameId, // Používame prop gameId
  });

  // Handlery pre ťuknutie na písmeno a slot (pre mobilné zariadenia a alternatívne ovládanie)
  const handleTapLetter = (letterData, source) => {
    console.log('handleTapLetter called:', { letterData, source });
    if (isGameOver || myPlayerIndex === null) { // Pridaná kontrola ťahu
      console.log("Nemôžeš presúvať písmená (hra skončila, nie si pripojený alebo nie je tvoj ťah).");
      setSelectedLetter(null);
      return;
    }

    // NOVÁ KONTROLA: Ak sa snažíš presunúť zamknuté písmeno z dosky
    if (source.type === 'board' && boardAtStartOfTurn[source.x][source.y] !== null) {
      console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
      setSelectedLetter(null); // Zrušíme výber, ak sa nedá presunúť
      return;
    }

    // Pridaná kontrola pre drag-and-drop z racku iného hráča
    if (source.type === 'rack' && source.playerIndex !== myPlayerIndex) {
      console.log("Nemôžeš presúvať písmená z racku iného hráča.");
      setSelectedLetter(null);
      return;
    }

    if (selectedLetter) {
      if (selectedLetter.letterData.id === letterData.id) {
        setSelectedLetter(null);
        return;
      }

      // If tapping on a different letter, move the selected one to the tapped one's position
      // This is an in-rack reordering, so source and target are both 'rack'
      if (selectedLetter.source.type === 'rack' && source.type === 'rack' && selectedLetter.source.playerIndex === source.playerIndex) {
        moveLetter(selectedLetter.letterData, selectedLetter.source, source); // source here is the target slot for reordering
        setSelectedLetter(null);
        return;
      }

      // If selected letter is from rack and tapped on board/exchange zone
      moveLetter(selectedLetter.letterData, selectedLetter.source, source); // source here is the target slot
      setSelectedLetter(null);
      return;
    }

    // If no letter is selected, select the tapped one
    if (source.type === 'rack' && source.playerIndex === myPlayerIndex) {
      setSelectedLetter({ letterData, source });
    } else if (source.type === 'board' && currentPlayerIndex === myPlayerIndex && boardAtStartOfTurn[source.x][source.y] === null) {
      // Only allow selecting letters placed in current turn on board
      console.log('Attempting to select board letter:', { letterData, source, isMyTurn: currentPlayerIndex === myPlayerIndex });
      setSelectedLetter({ letterData, source });
    } else if (source.type === 'exchangeZone' && currentPlayerIndex === myPlayerIndex) {
      setSelectedLetter({ letterData, source });
    }
  };

  const handleTapSlot = (target) => {
    // KĽÚČOVÁ ZMENA: Overenia pred volaním moveLetter
    if (isGameOver || myPlayerIndex === null) { // Pridaná kontrola ťahu
      console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený alebo nie je tvoj ťah).");
      setSelectedLetter(null);
      return;
    }

    // NOVÁ KONTROLA: Ak je cieľové políčko na doske už obsadené, zabránime presunu
    if (target.type === 'board' && board[target.x][target.y] !== null) {
      console.log("Cieľové políčko na doske je už obsadené, nemôžeš tam položiť písmeno.");
      alert("Cieľové políčko na doske je už obsadené!"); // Pridáme aj alert pre používateľa
      setSelectedLetter(null);
      return;
    }

    if (selectedLetter) {
      moveLetter(selectedLetter.letterData, selectedLetter.source, target);
      setSelectedLetter(null);
    } else {
      console.log("Ťukol(a) si na prázdny slot, ale nemáš vybrané žiadne písmeno.");
    }
  };

  // Funkcia pre priradenie písmena žolíkovi
  const assignLetterToJoker = (selectedLetter) => {
    if (jokerTileCoords) {
      // KĽÚČOVÁ ZMENA: Posielame akciu na server, server aktualizuje stav
      sendPlayerAction(socket, gameId, 'assignJoker', {
        x: jokerTileCoords.x,
        y: jokerTileCoords.y,
        assignedLetter: selectedLetter,
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

    tempRack.forEach(letter => {
      const isLetterPlaced = actualPlacedLetters.some(placed => placed.letterData.id === letter?.id);
      if (letter !== null && !isLetterPlaced) {
        newRackForCurrentPlayer.push(letter);
      }
    });

    newLetters.forEach(letter => {
      if (newRackForCurrentPlayer.length < RACK_SIZE) {
        newRackForCurrentPlayer.push(letter);
      }
    });

    while (newRackForCurrentPlayer.length < RACK_SIZE) {
      newRackForCurrentPlayer.push(null);
    }
    newRackForCurrentPlayer = newRackForCurrentPlayer.slice(0, RACK_SIZE);


    const finalRackAfterPlay = newRackForCurrentPlayer.filter(l => l !== null);

    if (currentBagEmpty && finalRackAfterPlay.length === 0) {
      const finalScores = calculateFinalScores(currentPlayerIndex, newRackForCurrentPlayer, playerScores, playerRacks);
      sendPlayerAction(socket, gameId, 'updateGameState', { // Používame prop gameId
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
      });
      alert(`Hra skončila! Konečné skóre: Hráč 1: ${finalScores[0]}, Hráč 2: ${finalScores[1]}`);
      return;
    }

    sendPlayerAction(socket, gameId, 'updateGameState', { // Používame prop gameId
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

    if (letterBag.length < exchangeZoneLetters.length) {
      alert(`Vo vrecúšku nie je dostatok písmen na výmenu (potrebných je ${exchangeZoneLetters.length}, k dispozícii ${letterBag.length})!`);
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
    let lettersToKeepInRack = newRack.filter(letter =>
      letter !== null && !exchangeZoneLetters.some(exchanged => exchanged.id === letter.id)
    );

    newLettersForRack.forEach(newLetter => {
      if (lettersToKeepInRack.length < RACK_SIZE) {
        lettersToKeepInRack.push(newLetter);
      }
    });

    while (lettersToKeepInRack.length < RACK_SIZE) {
      lettersToKeepInRack.push(null);
    }
    newRack = lettersToKeepInRack.slice(0, RACK_SIZE);


    sendPlayerAction(socket, gameId, 'updateGameState', { // Používame prop gameId
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

    sendPlayerAction(socket, gameId, 'updateGameState', { // Používame prop gameId
      ...gameState,
      currentPlayerIndex: (currentPlayerIndex === 0 ? 1 : 0), // Prepneme hráča
      hasPlacedOnBoardThisTurn: false,
      hasMovedToExchangeZoneThisTurn: false,
      consecutivePasses: newConsecutivePasses,
      isGameOver: (newConsecutivePasses >= 4), // Hra končí po 4 po sebe idúcich pasoch
    });

    if (newConsecutivePasses >= 4) {
      alert("Hra skončila! Obaja hráči pasovali dvakrát po sebe.");
    } else {
      alert("Ťah bol prenesený na ďalšieho hráča.");
    }
  };

  const handleSendChatMessage = () => {
    sendChatMessage(socket, gameId, newChatMessage); // Používame prop gameId
    setNewChatMessage('');
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="game-page-container"> {/* Nová trieda pre GamePage */}
        <div className="game-header">
          <h1>Scrabble (Hra ID: {gameId})</h1> {/* Zobrazíme ID hry */}
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

        {/* KĽÚČOVÁ ZMENA: Renderujeme hernú oblasť, ak je hráč priradený */}
        {isGameReadyToRender ? (
          <> {/* Použijeme Fragment pre zoskupenie viacerých elementov */}
            {waitingForSecondPlayer && (
              <div className="second-player-status-message"> {/* Nová trieda pre štýlovanie */}
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
          <div className="waiting-message"> {/* Ak hráč ešte nie je priradený, zobrazí sa jednoduchá správa */}
            <p>Pripájam sa k hre ID: **{gameId}**...</p>
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
                setGameState(prevState => {
                  const newBoard = prevState.board.map(row => [...row]);
                  const { x, y } = jokerTileCoords;
                  const jokerLetter = newBoard[x][y];
                  newBoard[x][y] = null;

                  const currentPlayersRack = [...prevState.playerRacks[myPlayerIndex]];
                  let targetIndex = -1;

                  if (jokerLetter.originalRackIndex !== undefined && currentPlayersRack[jokerLetter.originalRackIndex] === null) {
                      targetIndex = jokerLetter.originalRackIndex;
                  } else {
                      targetIndex = currentPlayersRack.findIndex(l => l === null);
                  }

                  if (targetIndex !== -1) {
                    currentPlayersRack[targetIndex] = { ...jokerLetter, assignedLetter: null };
                  } else {
                    currentPlayersRack.push({ ...jokerLetter, assignedLetter: null });
                  }

                  const updatedState = {
                    ...prevState,
                    board: newBoard,
                    playerRacks: prevState.playerRacks.map((rack, idx) => idx === myPlayerIndex ? currentPlayersRack : rack),
                    hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, prevState.boardAtStartOfTurn).length > 0,
                  };
                  sendPlayerAction(socket, gameId, 'updateGameState', updatedState);
                  return updatedState;
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

export default GamePage;
