import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Board from './components/Board';
import PlayerRack from './components/PlayerRack';
import LetterBag from './components/LetterBag';
import Scoreboard from './components/Scoreboard'; // Importujeme nový Scoreboard komponent
import { createLetterBag, LETTER_VALUES } from './utils/LettersDistribution'; // Importujeme aj LETTER_VALUES
import ExchangeZone from './components/ExchangeZone'; // Importujeme nový ExchangeZone
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

  const validWordsSet = useRef(new Set(slovakWordsArray.map(word => word.toUpperCase())));

  // REFAKTOROVANÁ FUNKCIA: drawLetters teraz prijíma aktuálny stav vrecúška
  // a vracia nové písmená a zvyšné vrecúško, bez priamej zmeny stavu.
  const drawLetters = (currentBag, numToDraw) => {
    const drawn = [];
    const tempBag = [...currentBag]; // Pracujeme s kópiou vrecúška

    for (let i = 0; i < numToDraw; i++) {
      if (tempBag.length > 0) {
        drawn.push(tempBag.pop());
      } else {
        console.warn("Vrecúško je prázdne, nedá sa ťahať viac písmen.");
        break;
      }
    }
    return { drawnLetters: drawn, remainingBag: tempBag };
  };

  useEffect(() => {
    // Pri prvom načítaní potiahneme 7 písmen a aktualizujeme stav vrecúška
    const { drawnLetters, remainingBag } = drawLetters(letterBag, 7);
    setRackLetters(drawnLetters);
    setLetterBag(remainingBag); // Aktualizujeme stav vrecúška
    setBoardAtStartOfTurn(Array(15).fill(null).map(() => Array(15).fill(null)));
  }, []);

  const moveLetter = (letterData, source, target) => {
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

    let currentLetter = letterData;
    
    if (source.type === 'board') {
      currentLetter = newBoard[source.x][source.y];
      newBoard[source.x][source.y] = null;
    } else if (source.type === 'rack') {
      newRackLetters[source.index] = null;
    } else if (source.type === 'exchangeZone') {
      newExchangeZoneLetters = newExchangeZoneLetters.filter(l => l.id !== letterData.id);
    }

    if (target.type === 'rack') {
      newRackLetters[target.index] = currentLetter;
    } else if (target.type === 'board') {
      newBoard[target.x][target.y] = currentLetter;
    } else if (target.type === 'exchangeZone') {
        newExchangeZoneLetters.push(currentLetter);
    }

    setRackLetters(newRackLetters);
    setBoard(newBoard);
    setExchangeZoneLetters(newExchangeZoneLetters);
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
            const wordString = wordLetters.map(l => l.letterData.letter).join('');
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
      let letterValue = LETTER_VALUES[letterData.letter] || 0;

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


  const confirmTurn = () => {
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
    
    console.log("DEBUG: Actual Placed Letters:", actualPlacedLetters.map(l => ({ letter: l.letterData.letter, x: l.x, y: l.y })));

    if (!isStraightLine(actualPlacedLetters)) {
      alert("Písmená musia byť v jednom rade alebo stĺpci!");
      return;
    }
    
    const allFormedWords = getAllWordsInTurn(actualPlacedLetters, board);

    console.log("DEBUG: All Formed Words (before validation):", allFormedWords.map(w => ({ word: w.wordString, letters: w.letters.map(l => l.letterData.letter) })));

    if (allFormedWords.length === 0) {
        alert("Nezistilo sa žiadne platné slovo. Skontroluj umiestnenie.");
        return;
    }

    for (const wordObj of allFormedWords) {
        console.log(`DEBUG: Checking contiguity for word: "${wordObj.wordString}"`);
        console.log("DEBUG: Letters for contiguity check:", wordObj.letters.map(l => ({ letter: l.letterData.letter, x: l.x, y: l.y })));

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

    setPlayerScores(prevScores => {
        const newScores = [...prevScores];
        newScores[currentPlayerIndex] += turnScore;
        return newScores;
    });

    alert(`Ťah je platný! Získal si ${turnScore} bodov. Vytvorené slová: ${allFormedWords.map(w => w.wordString).join(', ')}`);

    setBoardAtStartOfTurn(board.map(row => [...row]));
    
    const numToDraw = actualPlacedLetters.length;
    const { drawnLetters: newLetters, remainingBag: updatedBagAfterTurn } = drawLetters(letterBag, numToDraw);
    setLetterBag(updatedBagAfterTurn); // Aktualizujeme stav vrecúška po ťahu

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

    setRackLetters(newRack);
    setIsFirstTurn(false);
    
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));
  };

  const handleExchangeLetters = () => {
    if (exchangeZoneLetters.length === 0) {
      alert("Najprv presuň písmená do výmennej zóny!");
      return;
    }
    if (letterBag.length < exchangeZoneLetters.length) {
      alert("Vo vrecúšku nie je dostatok písmen na výmenu!");
      return;
    }

    // 1. Vrátime písmená z výmennej zóny do vrecúška a zamiešame ho
    let updatedBag = [...letterBag, ...exchangeZoneLetters];
    for (let i = updatedBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [updatedBag[i], updatedBag[j]] = [updatedBag[j], updatedBag[i]];
    }
    
    // 2. Vytiahneme nové písmená pre rack z už aktualizovaného a zamiešaného vrecúška
    const numToDraw = exchangeZoneLetters.length;
    const { drawnLetters: newLettersForRack, remainingBag: finalBagAfterExchange } = drawLetters(updatedBag, numToDraw);
    
    // 3. Aktualizujeme stav vrecúška s finálnym stavom po výmene a ťahaní
    setLetterBag(finalBagAfterExchange);

    // 4. Nahradíme vymenené písmená na racku novými
    let newRack = [...rackLetters];
    let newLetterIndex = 0;
    for (let i = 0; i < newRack.length; i++) {
      if (newRack[i] === null && newLetterIndex < newLettersForRack.length) {
        newRack[i] = newLettersForRack[newLetterIndex];
        newLetterIndex++;
      }
    }
    while (newLetterIndex < newLettersForRack.length) {
      newRack.push(newLettersForRack[newLetterIndex]);
      newLetterIndex++;
    }
    while (newRack.length < 7) newRack.push(null);
    newRack = newRack.slice(0, 7);

    setRackLetters(newRack);
    setExchangeZoneLetters([]); // Vyčistíme výmennú zónu

    alert(`Vymenil si ${numToDraw} písmen.`);
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0)); // Prepni hráča, výmena stojí ťah
  };


  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app-container">
        <h1>Scrabble</h1>
        <Scoreboard playerScores={playerScores} currentPlayerIndex={currentPlayerIndex} />
        <Board board={board} moveLetter={moveLetter} boardAtStartOfTurn={boardAtStartOfTurn} />
        <PlayerRack letters={rackLetters} moveLetter={moveLetter} />
        <LetterBag remainingLettersCount={letterBag.length} />

        <ExchangeZone
          lettersInZone={exchangeZoneLetters}
          moveLetter={moveLetter}
        />

        <div className="game-controls">
          <button className="confirm-turn-button" onClick={confirmTurn}>
            Potvrdiť ťah
          </button>
          <button className="exchange-letters-button" onClick={handleExchangeLetters}>
            Vymeniť písmená ({exchangeZoneLetters.length})
          </button>
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
