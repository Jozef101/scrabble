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
import { LETTER_VALUES } from './utils/LettersDistribution';
import { bonusSquares, BONUS_TYPES } from './utils/boardUtils';
import slovakWordsArray from './data/slovakWords.json';
import './styles/App.css';

const SERVER_URL = 'http://localhost:4000';

function App() {
  const [letterBag, setLetterBag] = useState([]); 
  const [playerRacks, setPlayerRacks] = useState([
    Array(7).fill(null),
    Array(7).fill(null)
  ]);
  const [board, setBoard] = useState(
    Array(15).fill(null).map(() => Array(15).fill(null))
  );
  const [boardAtStartOfTurn, setBoardAtStartOfTurn] = useState(
    Array(15).fill(null).map(() => Array(15).fill(null))
  );
  const [isFirstTurn, setIsFirstTurn] = useState(true);

  const [playerScores, setPlayerScores] = useState([0, 0]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  const [exchangeZoneLetters, setExchangeZoneLetters] = useState([]);

  const [hasPlacedOnBoardThisTurn, setHasPlacedOnBoardThisTurn] = useState(false);
  const [hasMovedToExchangeZoneThisTurn, setHasMovedToExchangeZoneThisTurn] = useState(false);

  const [consecutivePasses, setConsecutivePasses] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isBagEmpty, setIsBagEmpty] = useState(false);

  const [showLetterSelectionModal, setShowLetterSelectionModal] = useState(false);
  const [jokerTileCoords, setJokerTileCoords] = useState(null);

  const [socket, setSocket] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Nepripojený');
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const chatMessagesEndRef = useRef(null);

  // NOVÝ STAV: Sleduje, či bol prijatý počiatočný stav hry zo servera
  const [hasInitialGameStateReceived, setHasInitialGameStateReceived] = useState(false);

  const validWordsSet = useRef(new Set(slovakWordsArray.map(word => word.toUpperCase())));

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnectionStatus('Pripojený');
      console.log('Pripojený k serveru Socket.IO');
      newSocket.emit('joinGame');
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('Odpojený');
      console.log('Odpojený od servera Socket.IO');
      // Reset všetkých stavov pri odpojení
      setLetterBag([]);
      setPlayerRacks([Array(7).fill(null), Array(7).fill(null)]);
      setBoard(Array(15).fill(null).map(() => Array(15).fill(null)));
      setBoardAtStartOfTurn(Array(15).fill(null).map(() => Array(15).fill(null)));
      setIsFirstTurn(true);
      setPlayerScores([0, 0]);
      setCurrentPlayerIndex(0);
      setExchangeZoneLetters([]);
      setHasPlacedOnBoardThisTurn(false);
      setHasMovedToExchangeZoneThisTurn(false);
      setConsecutivePasses(0);
      setIsGameOver(false);
      setIsBagEmpty(false);
      setMyPlayerIndex(null);
      setChatMessages([]);
      setHasInitialGameStateReceived(false); // Reset tohto flagu
    });

    newSocket.on('playerAssigned', (playerIndex) => {
      setMyPlayerIndex(playerIndex);
      console.log(`Bol si priradený ako Hráč ${playerIndex + 1}.`);
      console.log(`DEBUG: myPlayerIndex po priradení: ${playerIndex}`);
    });

    newSocket.on('gameStateUpdate', (serverGameState) => {
      console.log('Prijatá aktualizácia stavu hry:', serverGameState);
      setLetterBag(serverGameState.letterBag);
      setPlayerRacks(serverGameState.playerRacks);
      setBoard(serverGameState.board);
      setBoardAtStartOfTurn(serverGameState.boardAtStartOfTurn);
      setIsFirstTurn(serverGameState.isFirstTurn);
      setPlayerScores(serverGameState.playerScores);
      setCurrentPlayerIndex(serverGameState.currentPlayerIndex);
      setExchangeZoneLetters(serverGameState.exchangeZoneLetters);
      setConsecutivePasses(serverGameState.consecutivePasses);
      setIsGameOver(serverGameState.isGameOver);
      setIsBagEmpty(serverGameState.isBagEmpty);
      setHasPlacedOnBoardThisTurn(serverGameState.hasPlacedOnBoardThisTurn);
      setHasMovedToExchangeZoneThisTurn(serverGameState.hasMovedToExchangeZoneThisTurn);
      
      // Nastavíme tento flag na true, keď je prijatý stav hry
      setHasInitialGameStateReceived(true); 
    });

    newSocket.on('gameError', (message) => {
      alert(`Chyba hry: ${message}`);
      console.error('Chyba hry:', message);
      setHasInitialGameStateReceived(false); // Ak je chyba, predpokladáme, že nie je pripravené
    });

    newSocket.on('gameReset', (message) => {
      alert(`Hra bola resetovaná: ${message}`);
      console.log('Hra bola resetovaná.');
      setLetterBag([]);
      setPlayerRacks([Array(7).fill(null), Array(7).fill(null)]);
      setBoard(Array(15).fill(null).map(() => Array(15).fill(null)));
      setBoardAtStartOfTurn(Array(15).fill(null).map(() => Array(15).fill(null)));
      setIsFirstTurn(true);
      setPlayerScores([0, 0]);
      setCurrentPlayerIndex(0);
      setExchangeZoneLetters([]);
      setHasPlacedOnBoardThisTurn(false);
      setHasMovedToExchangeZoneThisTurn(false);
      setConsecutivePasses(0);
      setIsGameOver(false);
      setIsBagEmpty(false);
      setMyPlayerIndex(null);
      setChatMessages([]);
      setHasInitialGameStateReceived(false); // Reset tohto flagu
      newSocket.emit('joinGame');
    });

    newSocket.on('receiveChatMessage', (message) => {
      setChatMessages((prevMessages) => [...prevMessages, message]);
    });

    newSocket.on('chatHistory', (history) => {
      setChatMessages(history);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Tento useEffect zabezpečí, že herná oblasť sa zobrazí až po priradení hráča
  // A po prijatí počiatočného stavu hry.
  const isGameReadyToRender = myPlayerIndex !== null && hasInitialGameStateReceived;

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const drawLetters = (currentBag, numToDraw) => {
    const drawn = [];
    const tempBag = [...currentBag];

    for (let i = 0; i < numToDraw; i++) {
      if (tempBag.length > 0) {
        drawn.push(tempBag.pop());
      } else {
        console.warn("Vrecúško je prázdne, nedá sa ťahať viac písmen.");
        return { drawnLetters: drawn, remainingBag: tempBag, bagEmpty: true };
      }
    }
    return { drawnLetters: drawn, remainingBag: tempBag, bagEmpty: false };
  };

  const getPlacedLettersDuringCurrentTurn = (currentBoardState, initialBoardState) => {
    const placed = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (currentBoardState[r][c] && !initialBoardState[r][c]) {
          placed.push({ x: r, y: c, letterData: currentBoardState[r][c] });
        }
      }
    }
    return placed;
  };

  const moveLetter = (letterData, source, target) => {
    console.log("DEBUG (moveLetter call): letterData:", letterData, "source:", source, "target:", target);
    console.log("DEBUG (moveLetter conditions): isGameOver:", isGameOver, "myPlayerIndex:", myPlayerIndex, "currentPlayerIndex:", currentPlayerIndex);
    console.log("DEBUG (moveLetter condition check): isGameOver || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex =>", 
      isGameOver || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex);

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
      while (newPlayerRacks[myPlayerIndex].length < 7) { newPlayerRacks[myPlayerIndex].push(null); }
      while (newPlayerRacks[myPlayerIndex].length > 7) { newPlayerRacks[myPlayerIndex].pop(); }

      socket.emit('playerAction', {
        type: 'updateGameState',
        payload: {
          ...getCurrentGameState(),
          playerRacks: newPlayerRacks,
        }
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

    socket.emit('playerAction', {
      type: 'updateGameState',
      payload: {
        ...getCurrentGameState(),
        playerRacks: newPlayerRacks,
        board: newBoard,
        exchangeZoneLetters: newExchangeZoneLetters,
        hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, boardAtStartOfTurn).length > 0,
        hasMovedToExchangeZoneThisTurn: newExchangeZoneLetters.length > 0,
      }
    });
  };

  const assignLetterToJoker = (selectedLetter) => {
    if (jokerTileCoords) {
      const newBoard = board.map(row => [...row]);
      const { x, y } = jokerTileCoords;
      if (newBoard[x][y] && newBoard[x][y].letter === '') {
        newBoard[x][y] = { ...newBoard[x][y], assignedLetter: selectedLetter };
      }
      socket.emit('playerAction', {
        type: 'updateGameState',
        payload: {
          ...getCurrentGameState(),
          board: newBoard,
        }
      });
    }
    setShowLetterSelectionModal(false);
    setJokerTileCoords(null);
  };

  const isStraightLine = (letters) => {
    if (letters.length <= 1) return true;
    const firstX = letters[0].x;
    const firstY = letters[0].y;
    let isRow = true;
    let isCol = true;
    for (let i = 1; i < letters.length; i++) {
      if (letters[i].x !== firstX) isRow = false;
      if (letters[i].y !== firstY) isCol = false;
    }
    return isRow || isCol;
  };

  const getSequenceInDirection = (startCoordX, startCoordY, boardState, dx, dy) => {
    let letters = [];
    
    let scanX = startCoordX;
    let scanY = startCoordY;
    while (scanX >= 0 && scanX < 15 && scanY >= 0 && scanY < 15 && boardState[scanX][scanY]) {
        scanX -= dx;
        scanY -= dy;
    }
    let wordStartX = scanX + dx;
    let wordStartY = scanY + dy;

    while (wordStartX >= 0 && wordStartX < 15 && wordStartY >= 0 && wordStartY < 15 && boardState[wordStartX][wordStartY]) {
        letters.push({ x: wordStartX, y: wordStartY, letterData: boardState[wordStartX][wordStartY] });
        wordStartX += dx;
        wordStartY += dy;
    }
    return letters;
  };

  const getFullWordLetters = (currentPlacedLetters, currentBoard) => {
    if (currentPlacedLetters.length === 0) return [];

    const sortedPlaced = [...currentPlacedLetters].sort((a, b) => {
        if (a.x === b.x) return a.y - b.y;
        return a.x - b.x;
    });

    const firstPlaced = sortedPlaced[0];
    let mainWord = [];

    let isHorizontal = false;
    if (sortedPlaced.length > 1 && sortedPlaced[0].x === sortedPlaced[1].x) {
        isHorizontal = true;
    } else if (sortedPlaced.length === 1) {
        const x = firstPlaced.x;
        const y = firstPlaced.y;
        const hasHorizontalNeighbor = (y > 0 && currentBoard[x][y - 1] !== null) || (y < 14 && currentBoard[x][y + 1] !== null);
        const hasVerticalNeighbor = (x > 0 && currentBoard[x - 1][y] !== null) || (x < 14 && currentBoard[x + 1][y] !== null);

        if (hasHorizontalNeighbor && !hasVerticalNeighbor) {
            isHorizontal = true;
        } else if (!hasHorizontalNeighbor && hasVerticalNeighbor) {
            isHorizontal = false;
        } else if (hasHorizontalNeighbor && hasVerticalNeighbor) {
            isHorizontal = true;
        } else {
            return [firstPlaced];
        }
    }

    if (isHorizontal) {
        mainWord = getSequenceInDirection(firstPlaced.x, firstPlaced.y, currentBoard, 0, 1);
    } else {
        mainWord = getSequenceInDirection(firstPlaced.x, firstPlaced.y, currentBoard, 1, 0);
    }

    return mainWord;
  };

  const areLettersContiguous = (allWordLetters) => {
    if (allWordLetters.length <= 1) return true;
    for (let i = 0; i < allWordLetters.length - 1; i++) {
      const current = allWordLetters[i];
      const next = allWordLetters[i + 1];
      if (current.x === next.x) {
        if (next.y - current.y !== 1) { return false; }
      } else if (current.y === next.y) {
        if (next.x - current.x !== 1) { return false; }
      } else {
        return false;
      }
    }
    return true;
  };

  const isConnected = (currentPlacedLetters, currentBoard, isFirstTurn, allWordLetters) => {
    if (currentPlacedLetters.length === 0) return false;

    if (isFirstTurn) {
      const centerSquare = { x: 7, y: 7 };
      const coversCenter = currentPlacedLetters.some(
        (l) => l.x === centerSquare.x && l.y === centerSquare.y
      );
      if (!coversCenter) { return false; }
    } else {
      const hasExistingLetterInLine = allWordLetters.some(l => 
        !currentPlacedLetters.some(pl => pl.x === l.x && pl.y === l.y)
      );
      
      const touchesExistingNeighbor = currentPlacedLetters.some(pl => {
        const neighbors = [
          [pl.x - 1, pl.y], [pl.x + 1, pl.y], [pl.x, pl.y - 1], [pl.x, pl.y + 1]
        ];
        return neighbors.some(([nx, ny]) =>
          nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && currentBoard[nx][ny] &&
          !currentPlacedLetters.some(l => l.x === nx && l.y === ny)
        );
      });

      if (!hasExistingLetterInLine && !touchesExistingNeighbor) {
        return false;
      }
    }
    return true;
  };

  const getAllWordsInTurn = (actualPlacedLetters, currentBoard) => {
    const formedWordObjects = [];
    const addedWordStrings = new Set();

    const addWordIfNew = (wordLetters) => {
        if (wordLetters.length > 1) {
            const wordString = wordLetters.map(l => (l.letterData.letter === '' ? l.letterData.assignedLetter : l.letterData.letter)).join('');
            if (!addedWordStrings.has(wordString)) {
                addedWordStrings.add(wordString);
                formedWordObjects.push({ wordString, letters: wordLetters });
            }
        }
    };

    const mainWord = getFullWordLetters(actualPlacedLetters, currentBoard);
    addWordIfNew(mainWord);

    actualPlacedLetters.forEach(pLetter => {
        const { x, y } = pLetter;

        const horizontalCrossWord = getSequenceInDirection(x, y, currentBoard, 0, 1);
        addWordIfNew(horizontalCrossWord);

        const verticalCrossWord = getSequenceInDirection(x, y, currentBoard, 1, 0);
        addWordIfNew(verticalCrossWord);
    });

    return formedWordObjects;
  };

  const calculateWordScore = (wordLetters, boardAtStartOfTurn) => {
    let wordScore = 0;
    let wordMultiplier = 1;

    wordLetters.forEach(letterObj => {
      const { x, y, letterData } = letterObj;
      const bonusType = bonusSquares[`${x},${y}`];
      let letterValue = (letterData.letter === '' ? (LETTER_VALUES[letterData.assignedLetter] || 0) : (LETTER_VALUES[letterData.letter] || 0));

      const isNewLetter = boardAtStartOfTurn[x][y] === null;

      if (isNewLetter) {
        if (bonusType === BONUS_TYPES.DOUBLE_LETTER) {
          letterValue *= 2;
        } else if (bonusType === BONUS_TYPES.TRIPLE_LETTER) {
          letterValue *= 3;
        } else if (bonusType === BONUS_TYPES.DOUBLE_WORD || bonusType === BONUS_TYPES.START_SQUARE) {
          wordMultiplier *= 2;
        } else if (bonusType === BONUS_TYPES.TRIPLE_WORD) {
          wordMultiplier *= 3;
        }
      }
      wordScore += letterValue;
    });

    wordScore *= wordMultiplier;
    return wordScore;
  };

  const getRackPoints = (rack) => {
    return rack.reduce((sum, letter) => {
        if (!letter) return sum;
        return sum + (letter.letter === '' ? 0 : (LETTER_VALUES[letter.letter] || 0));
    }, 0);
  };

  const calculateFinalScores = (endingPlayerIndex, finalRackLetters) => {
    let finalScores = [...playerScores];
    let totalOpponentRackPoints = 0;

    for (let i = 0; i < playerScores.length; i++) {
        const rack = (i === endingPlayerIndex) ? finalRackLetters : playerRacks[i];
        const pointsOnRack = getRackPoints(rack);
        finalScores[i] -= pointsOnRack;

        if (i !== endingPlayerIndex) {
            totalOpponentRackPoints += pointsOnRack;
        }
    }

    if (endingPlayerIndex !== null) {
        finalScores[endingPlayerIndex] += totalOpponentRackPoints;
    }

    socket.emit('playerAction', {
        type: 'updateGameState',
        payload: {
            ...getCurrentGameState(),
            playerScores: finalScores,
            isGameOver: true,
        }
    });
    alert(`Hra skončila! Konečné skóre: Hráč 1: ${finalScores[0]}, Hráč 2: ${finalScores[1]}`);
  };

  const getCurrentGameState = () => {
    return {
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
    };
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


    const actualPlacedLetters = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (board[r][c] && !boardAtStartOfTurn[r][c]) {
          actualPlacedLetters.push({
            letterData: board[r][c],
            x: r,
            y: c,
          });
        }
      }
    }

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
    while (newRackForCurrentPlayer.length < 7) newRackForCurrentPlayer.push(null);
    newRackForCurrentPlayer = newRackForCurrentPlayer.slice(0, 7);

    const finalRackAfterPlay = newRackForCurrentPlayer.filter(l => l !== null);

    if (currentBagEmpty && finalRackAfterPlay.length === 0) {
        let finalScores = [...newScores];
        let totalOpponentRackPoints = 0;

        for (let i = 0; i < playerScores.length; i++) {
            const rack = (i === currentPlayerIndex) ? newRackForCurrentPlayer : playerRacks[i];
            const pointsOnRack = getRackPoints(rack);
            finalScores[i] -= pointsOnRack;

            if (i !== currentPlayerIndex) {
                totalOpponentRackPoints += pointsOnRack;
            }
        }
        finalScores[currentPlayerIndex] += totalOpponentRackPoints;

        socket.emit('playerAction', {
            type: 'updateGameState',
            payload: {
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
            }
        });
        alert(`Hra skončila! Konečné skóre: Hráč 1: ${finalScores[0]}, Hráč 2: ${finalScores[1]}`);
        return;
    }

    socket.emit('playerAction', {
        type: 'updateGameState',
        payload: {
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
        }
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
      alert("Vo vrecúšku nie je dostatok písmen na výmenu!");
      return;
    }

    const numToDraw = exchangeZoneLetters.length;
    const { drawnLetters: newLettersForRack, remainingBag: bagAfterDraw, bagEmpty: currentBagEmpty } = drawLetters(letterBag, numToDraw);
    
    let updatedBag = [...bagAfterDraw, ...exchangeZoneLetters];
    
    for (let i = updatedBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [updatedBag[i], updatedBag[j]] = [updatedBag[j], updatedBag[i]];
    }

    // NOVÁ LOGIKA: Konštrukcia newRack pre aktuálneho hráča
    let newRack = [...playerRacks[currentPlayerIndex]];
    let newLetterIndex = 0;
    // Najprv odstránime písmená, ktoré boli vymenené z racku (sú už vo exchangeZoneLetters)
    // Tieto písmená už boli odstránené z rackLetters v moveLetter, keď boli presunuté do ExchangeZone.
    // Teraz len vložíme nové písmená na prázdne miesta.
    for (let i = 0; i < newRack.length; i++) {
      // Ak je slot prázdny a máme nové písmená na pridanie
      if (newRack[i] === null && newLetterIndex < newLettersForRack.length) {
        newRack[i] = newLettersForRack[newLetterIndex];
        newLetterIndex++;
      } else if (exchangeZoneLetters.some(l => l.id === newRack[i]?.id)) {
        // Ak písmeno v racku je jedno z tých, ktoré sa vymieňajú, nastavíme ho na null
        newRack[i] = null;
      }
    }
    // Ak zostali nejaké nové písmená, pridáme ich na koniec
    while (newLetterIndex < newLettersForRack.length) {
      newRack.push(newLettersForRack[newLetterIndex]);
      newLetterIndex++;
    }
    while (newRack.length < 7) newRack.push(null); // Doplníme null, ak je menej ako 7
    newRack = newRack.slice(0, 7); // Orezanie na 7


    socket.emit('playerAction', {
        type: 'updateGameState',
        payload: {
            letterBag: updatedBag,
            playerRacks: playerRacks.map((rack, idx) => idx === currentPlayerIndex ? newRack : rack), // Používame newRack
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
        }
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
    
    socket.emit('playerAction', {
        type: 'updateGameState',
        payload: {
            ...getCurrentGameState(),
            currentPlayerIndex: (currentPlayerIndex === 0 ? 1 : 0),
            hasPlacedOnBoardThisTurn: false,
            hasMovedToExchangeZoneThisTurn: false,
            consecutivePasses: newConsecutivePasses,
            isGameOver: (newConsecutivePasses >= 4),
        }
    });

    if (newConsecutivePasses >= 4) {
        alert("Hra skončila! Obaja hráči pasovali dvakrát po sebe.");
    } else {
        alert("Ťah bol prenesený na ďalšieho hráča.");
    }
  };

  const handleSendChatMessage = () => {
    if (newChatMessage.trim() !== '' && socket) {
      socket.emit('chatMessage', newChatMessage);
      setNewChatMessage('');
    }
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
                  disabled={isGameOver || letterBag.length < 7 || showLetterSelectionModal || myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex}
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
                
                socket.emit('playerAction', {
                  type: 'updateGameState',
                  payload: {
                    ...getCurrentGameState(),
                    board: newBoard,
                    playerRacks: playerRacks.map((rack, idx) => idx === myPlayerIndex ? currentPlayersRack : rack),
                    hasPlacedOnBoardThisTurn: getPlacedLettersDuringCurrentTurn(newBoard, boardAtStartOfTurn).length > 0,
                  }
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
