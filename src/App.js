import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Board from './components/Board';
import PlayerRack from './components/PlayerRack';
import LetterBag from './components/LetterBag';
import Scoreboard from './components/Scoreboard'; // Importujeme nový Scoreboard komponent
import { createLetterBag, LETTER_VALUES } from './utils/LettersDistribution'; // Importujeme aj LETTER_VALUES
import ExchangeZone from './components/ExchangeZone'; // Importujeme nový ExchangeZone
import LetterSelectionModal from './components/LetterSelectionModal'; // Importujeme nový komponent
import { bonusSquares, BONUS_TYPES } from './utils/boardUtils';
import slovakWordsArray from './data/slovakWords.json'; // Importujeme slovník
import './styles/App.css';

function App() {
  const [letterBag, setLetterBag] = useState(() => createLetterBag());
  const [rackLetters, setRackLetters] = useState(Array(7).fill(null));
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


  const validWordsSet = useRef(new Set(slovakWordsArray.map(word => word.toUpperCase())));

  const drawLetters = (currentBag, numToDraw) => {
    const drawn = [];
    const tempBag = [...currentBag];

    for (let i = 0; i < numToDraw; i++) {
      if (tempBag.length > 0) {
        drawn.push(tempBag.pop());
      } else {
        console.warn("Vrecúško je prázdne, nedá sa ťahať viac písmen.");
        setIsBagEmpty(true);
        break;
      }
    }
    return { drawnLetters: drawn, remainingBag: tempBag };
  };

  useEffect(() => {
    const { drawnLetters, remainingBag } = drawLetters(letterBag, 7);
    setRackLetters(drawnLetters);
    setLetterBag(remainingBag);
    setBoardAtStartOfTurn(Array(15).fill(null).map(() => Array(15).fill(null)));
  }, []);

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
    if (isGameOver) {
      console.log("Hra skončila, nemôžeš presúvať písmená.");
      return;
    }

    let newRackLetters = [...rackLetters];
    let newBoard = board.map(row => [...row]);
    let newExchangeZoneLetters = [...exchangeZoneLetters];

    if (source.type === 'board' && boardAtStartOfTurn[source.x][source.y] !== null) {
      console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
      return;
    }

    if (source.type === 'rack' && target.type === 'rack') {
      const fromIndex = source.index;
      const toIndex = target.index;

      if (fromIndex === toIndex) return;

      const [movedLetter] = newRackLetters.splice(fromIndex, 1);
      newRackLetters.splice(toIndex, 0, movedLetter);

      newRackLetters = newRackLetters.filter(l => l !== undefined);
      while (newRackLetters.length < 7) { newRackLetters.push(null); }
      while (newRackLetters.length > 7) { newRackLetters.pop(); }

      setRackLetters(newRackLetters);
      return;
    }

    // Tieto kontroly sú presunuté do confirmTurn a handleExchangeLetters
    // if (target.type === 'board' && hasMovedToExchangeZoneThisTurn) {
    //     alert("Nemôžeš položiť písmená na dosku, ak si už presunul(a) písmeno do výmennej zóny v tomto ťahu!");
    //     return;
    // }
    // if (target.type === 'exchangeZone' && hasPlacedOnBoardThisTurn) {
    //     alert("Nemôžeš presunúť písmená do výmennej zóny, ak si už položil(a) písmeno na dosku v tomto ťahu!");
    //     return;
    // }

    let letterToMove = null;

    // --- Odstránenie písmena zo zdroja a príprava letterToMove ---
    if (source.type === 'board') {
      // Získame skutočný objekt písmena z dosky a vytvoríme HLBOKÚ KÓPIU
      letterToMove = { ...newBoard[source.x][source.y] };
      newBoard[source.x][source.y] = null; // Vymažeme pôvodné miesto na doske
      // Ak je to žolík presúvajúci sa Z dosky, resetujeme mu priradené písmeno
      if (letterToMove && letterToMove.letter === '') {
        letterToMove.assignedLetter = null;
      }
    } else if (source.type === 'rack') {
      // Získame skutočný objekt písmena z racku a vytvoríme HLBOKÚ KÓPIU
      letterToMove = { ...newRackLetters[source.index] };
      newRackLetters[source.index] = null; // Vymažeme pôvodné miesto na racku
    } else if (source.type === 'exchangeZone') {
      // Nájdeme písmeno v poli výmennej zóny a vytvoríme HLBOKÚ KÓPIU
      const indexInExchangeZone = newExchangeZoneLetters.findIndex(l => l.id === letterData.id);
      if (indexInExchangeZone !== -1) {
        letterToMove = { ...newExchangeZoneLetters[indexInExchangeZone] };
        newExchangeZoneLetters.splice(indexInExchangeZone, 1); // Odstránime ho z výmennej zóny
        // Ak je to žolík presúvajúci sa Z výmennej zóny, resetujeme mu priradené písmeno
        if (letterToMove && letterToMove.letter === '') {
          letterToMove.assignedLetter = null;
        }
      } else {
        console.warn("Písmeno sa nenašlo vo výmennej zóne pri pokuse o presun.");
        return;
      }
    }

    // Zabezpečíme, že máme platné písmeno na presun
    if (!letterToMove || letterToMove.id === undefined) {
        console.warn("Nepodarilo sa nájsť platné písmeno na presun alebo chýba ID.");
        return;
    }

    // --- Umiestnenie písmena na cieľové miesto ---
    if (target.type === 'rack') {
      newRackLetters[target.index] = letterToMove;
    } else if (target.type === 'board') {
      newBoard[target.x][target.y] = letterToMove;
      // Ak je žolík položený NA dosku, zobrazíme modálne okno
      if (letterToMove.letter === '') {
        setJokerTileCoords({ x: target.x, y: target.y });
        setShowLetterSelectionModal(true);
      }
    } else if (target.type === 'exchangeZone') {
        newExchangeZoneLetters.push(letterToMove);
    }

    setRackLetters(newRackLetters);
    setBoard(newBoard);
    setExchangeZoneLetters(newExchangeZoneLetters);

    // --- Aktualizácia flagov na základe aktuálneho stavu ---
    const currentPlacedOnBoard = getPlacedLettersDuringCurrentTurn(newBoard, boardAtStartOfTurn);
    setHasPlacedOnBoardThisTurn(currentPlacedOnBoard.length > 0);
    setHasMovedToExchangeZoneThisTurn(newExchangeZoneLetters.length > 0);
  };

  const assignLetterToJoker = (selectedLetter) => {
    if (jokerTileCoords) {
      setBoard(prevBoard => {
        const newBoard = prevBoard.map(row => [...row]);
        const { x, y } = jokerTileCoords;
        if (newBoard[x][y] && newBoard[x][y].letter === '') {
          newBoard[x][y] = { ...newBoard[x][y], assignedLetter: selectedLetter };
        }
        return newBoard;
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

  const calculateWordScore = (wordLetters, actualPlacedLetters, boardStateAtStartOfTurn) => {
    let wordScore = 0;
    let wordMultiplier = 1;

    wordLetters.forEach(letterObj => {
      const { x, y, letterData } = letterObj;
      const bonusType = bonusSquares[`${x},${y}`];
      let letterValue = (letterData.letter === '') ? 0 : (LETTER_VALUES[letterData.letter] || 0);

      const isNewLetter = boardStateAtStartOfTurn[x][y] === null;

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
        const rack = (i === endingPlayerIndex) ? finalRackLetters : rackLetters;
        const pointsOnRack = getRackPoints(rack);
        finalScores[i] -= pointsOnRack;

        if (i !== endingPlayerIndex) {
            totalOpponentRackPoints += pointsOnRack;
        }
    }

    if (endingPlayerIndex !== null) {
        finalScores[endingPlayerIndex] += totalOpponentRackPoints;
    }

    setPlayerScores(finalScores);
    setIsGameOver(true);
    alert(`Hra skončila! Konečné skóre: Hráč 1: ${finalScores[0]}, Hráč 2: ${finalScores[1]}`);
  };


  const confirmTurn = () => {
    if (isGameOver) {
      alert("Hra skončila!");
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
        turnScore += calculateWordScore(wordObj.letters, actualPlacedLetters, boardAtStartOfTurn);
    });

    if (actualPlacedLetters.length === 7) {
        turnScore += 50;
        alert("BINGO! +50 bodov!");
    }

    let newScores = [...playerScores];
    newScores[currentPlayerIndex] += turnScore;
    setPlayerScores(newScores);

    alert(`Ťah je platný! Získal si ${turnScore} bodov. Vytvorené slová: ${allFormedWords.map(w => w.wordString).join(', ')}`);

    setBoardAtStartOfTurn(board.map(row => [...row]));
    
    const numToDraw = actualPlacedLetters.length;
    const { drawnLetters: newLetters, remainingBag: updatedBagAfterTurn } = drawLetters(letterBag, numToDraw);
    setLetterBag(updatedBagAfterTurn);

    let tempRack = [...rackLetters];
    let newRack = [];
    let newLetterIndex = 0;

    for (let i = 0; i < tempRack.length; i++) {
      if (tempRack[i] === null && newLetterIndex < newLetters.length) {
        newRack.push(newLetters[newLetterIndex]);
        newLetterIndex++;
      } else {
        newRack.push(tempRack[i]);
      }
    }
    while(newLetterIndex < newLetters.length) {
      newRack.push(newLetters[newLetterIndex]);
      newLetterIndex++;
    }
    while (newRack.length < 7) newRack.push(null);
    newRack = newRack.slice(0, 7);

    const finalRackAfterPlay = newRack.filter(l => l !== null);

    if (isBagEmpty && finalRackAfterPlay.length === 0) {
        setRackLetters(newRack);
        calculateFinalScores(currentPlayerIndex, newRack);
        return;
    }

    setRackLetters(newRack);
    setIsFirstTurn(false);
    
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));

    setHasPlacedOnBoardThisTurn(false);
    setHasMovedToExchangeZoneThisTurn(false);
    setConsecutivePasses(0);
  };

  const handleExchangeLetters = () => {
    if (isGameOver) {
      alert("Hra skončila!");
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
    const { drawnLetters: newLettersForRack, remainingBag: bagAfterDraw } = drawLetters(letterBag, numToDraw);
    
    let updatedBag = [...bagAfterDraw, ...exchangeZoneLetters];
    
    for (let i = updatedBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [updatedBag[i], updatedBag[j]] = [updatedBag[j], updatedBag[i]];
    }
    
    setLetterBag(updatedBag);

    let newRack = [...rackLetters];
    let newLetterIndex = 0;
    for (let i = 0; i < newRack.length; i++) {
      if (newRack[i] === null && newLetterIndex < newLettersForRack.length) {
        newRack[i] = newLettersForRack[newLetterIndex];
        newLetterIndex++;
      } else if (exchangeZoneLetters.some(l => l.id === newRack[i]?.id)) {
        newRack[i] = null;
      }
    }
    while (newLetterIndex < newLettersForRack.length) {
      newRack.push(newLettersForRack[newLetterIndex]);
      newLetterIndex++;
    }
    while (newRack.length < 7) newRack.push(null);
    newRack = newRack.slice(0, 7);

    setRackLetters(newRack);
    setExchangeZoneLetters([]);

    alert(`Vymenil si ${numToDraw} písmen.`);
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));

    setHasPlacedOnBoardThisTurn(false);
    setHasMovedToExchangeZoneThisTurn(false);
    setConsecutivePasses(0);
  };

  const handlePassTurn = () => {
    if (isGameOver) {
      alert("Hra skončila!");
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
    setConsecutivePasses(newConsecutivePasses);

    if (newConsecutivePasses >= 4) {
        setIsGameOver(true);
        alert("Hra skončila! Obaja hráči pasovali dvakrát po sebe.");
        calculateFinalScores(null, null);
        return;
    }

    alert("Ťah bol prenesený na ďalšieho hráča.");
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));

    setHasPlacedOnBoardThisTurn(false);
    setHasMovedToExchangeZoneThisTurn(false);
  };


  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app-container">
        <h1>Scrabble</h1>
        {isGameOver && <h2 className="game-over-message">Hra skončila!</h2>}
        <Scoreboard playerScores={playerScores} currentPlayerIndex={currentPlayerIndex} isGameOver={isGameOver} />
        <Board board={board} moveLetter={moveLetter} boardAtStartOfTurn={boardAtStartOfTurn} />
        <PlayerRack letters={rackLetters} moveLetter={moveLetter} />
        <LetterBag remainingLettersCount={letterBag.length} />

        <ExchangeZone
          lettersInZone={exchangeZoneLetters}
          moveLetter={moveLetter}
        />

        <div className="game-controls">
          <button
            className="confirm-turn-button"
            onClick={confirmTurn}
            disabled={isGameOver || showLetterSelectionModal}
          >
            Potvrdiť ťah
          </button>
          <button
            className="exchange-letters-button"
            onClick={handleExchangeLetters}
            disabled={isGameOver || letterBag.length < 7 || showLetterSelectionModal}
          >
            Vymeniť písmená ({exchangeZoneLetters.length})
          </button>
          <button
            className="pass-turn-button"
            onClick={handlePassTurn}
            disabled={isGameOver || showLetterSelectionModal}
          >
            Pass
          </button>
        </div>

        {showLetterSelectionModal && (
          <LetterSelectionModal
            onSelectLetter={assignLetterToJoker}
            onClose={() => {
              if (jokerTileCoords) {
                setBoard(prevBoard => {
                  const newBoard = prevBoard.map(row => [...row]);
                  const { x, y } = jokerTileCoords;
                  const jokerLetter = newBoard[x][y];
                  newBoard[x][y] = null;
                  const firstEmptyRackSlot = rackLetters.findIndex(l => l === null);
                  if (firstEmptyRackSlot !== -1) {
                    setRackLetters(prevRack => {
                      const updatedRack = [...prevRack];
                      updatedRack[firstEmptyRackSlot] = { ...jokerLetter, assignedLetter: null };
                      return updatedRack;
                    });
                  } else {
                    setRackLetters(prevRack => [...prevRack, { ...jokerLetter, assignedLetter: null }]);
                  }
                  return newBoard;
                });
              }
              setShowLetterSelectionModal(false);
              setJokerTileCoords(null);
              const currentPlacedOnBoard = getPlacedLettersDuringCurrentTurn(board, boardAtStartOfTurn);
              setHasPlacedOnBoardThisTurn(currentPlacedOnBoard.length > 0);
              setHasMovedToExchangeZoneThisTurn(exchangeZoneLetters.length > 0);
            }}
          />
        )}
      </div>
    </DndProvider>
  );
}

export default App;