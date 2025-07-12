// src/App.js
import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Board from './components/Board';
import PlayerRack from './components/PlayerRack';
import LetterBag from './components/LetterBag';
import { createLetterBag } from './utils/LettersDistribution';
import { bonusSquares, BONUS_TYPES } from './utils/boardUtils';
import './styles/App.css';

function App() {
  const [letterBag, setLetterBag] = useState(() => createLetterBag());
  const [rackLetters, setRackLetters] = useState(Array(7).fill(null));
  const [board, setBoard] = useState(
    Array(15).fill(null).map(() => Array(15).fill(null))
  );
  // NOVÝ STAV: Uchováva stav dosky na začiatku ťahu.
  const [boardAtStartOfTurn, setBoardAtStartOfTurn] = useState(
    Array(15).fill(null).map(() => Array(15).fill(null))
  );
  const [isFirstTurn, setIsFirstTurn] = useState(true);

  const drawLetters = (numToDraw) => {
    const drawn = [];
    const newBag = [...letterBag];

    for (let i = 0; i < numToDraw; i++) {
      if (newBag.length > 0) {
        drawn.push(newBag.pop());
      } else {
        console.warn("Vrecúško je prázdne, nedá sa ťahať viac písmen.");
        break;
      }
    }
    setLetterBag(newBag);
    return drawn;
  };

  useEffect(() => {
    const initialLetters = drawLetters(7);
    setRackLetters(initialLetters);
    // Pri prvom načítaní nastavíme aj boardAtStartOfTurn
    setBoardAtStartOfTurn(Array(15).fill(null).map(() => Array(15).fill(null)));
  }, []);

  const moveLetter = (letterData, source, target) => {
    let newRackLetters = [...rackLetters];
    let newBoard = board.map(row => [...row]);

    // Dôležité: Kontrola, či sa pokúšame presunúť už ZAMKNUTÉ písmeno z dosky
    // Táto podmienka musí byť TU, pretože moveLetter spracováva VŠETKY presuny.
    if (source.type === 'board' && boardAtStartOfTurn[source.x][source.y] !== null) {
      console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
      return; // Zastaví presun
    }

    // --- Logika presunu z racku na rack (vkladanie) ---
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

    // --- Logika presunu medzi rackom a doskou ---

    let currentLetter = letterData; // Písmeno, ktoré sa presúva
    
    // Pred presunom: Ak sa presúva písmeno Z DOSKY, odstránime ho z jej pôvodnej pozície
    if (source.type === 'board') {
      currentLetter = newBoard[source.x][source.y]; // Zoberieme písmeno z dosky
      newBoard[source.x][source.y] = null; // Vymažeme z pôvodnej pozície na doske
    } else if (source.type === 'rack') {
      newRackLetters[source.index] = null; // Vymažeme písmeno z racku
    }

    // Po presune: Umiestnime písmeno na nové miesto (rack alebo doska)
    if (target.type === 'rack') {
      newRackLetters[target.index] = currentLetter;
    } else if (target.type === 'board') {
      newBoard[target.x][target.y] = currentLetter;
    }

    setRackLetters(newRackLetters);
    setBoard(newBoard);
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

  const getFullWordLetters = (currentPlacedLetters, currentBoard) => {
    if (currentPlacedLetters.length === 0) return [];

    let primaryOrientation = null; // 'horizontal' or 'vertical'

    // Determine primary orientation if more than one letter is placed
    if (currentPlacedLetters.length > 1) {
        // Sort letters to make sure we can easily determine orientation and contiguity later
        currentPlacedLetters.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

        const firstLetter = currentPlacedLetters[0];
        const secondLetter = currentPlacedLetters[1];

        if (firstLetter.x === secondLetter.x) {
            primaryOrientation = 'horizontal';
        } else if (firstLetter.y === secondLetter.y) {
            primaryOrientation = 'vertical';
        } else {
            // If more than one letter but not in a straight line, it's invalid here.
            // isStraightLine check should catch this earlier, but good to be safe.
            return [];
        }
    } else { // Only one letter placed
        const [singleLetter] = currentPlacedLetters;
        const x = singleLetter.x;
        const y = singleLetter.y;

        // Check for horizontal neighbors
        const hasHorizontalNeighbor = (y > 0 && currentBoard[x][y - 1]) ||
                                      (y < 14 && currentBoard[x][y + 1]);
        // Check for vertical neighbors
        const hasVerticalNeighbor = (x > 0 && currentBoard[x - 1][y]) ||
                                    (x < 14 && currentBoard[x + 1][y]);

        if (hasHorizontalNeighbor && !hasVerticalNeighbor) {
            primaryOrientation = 'horizontal';
        } else if (!hasHorizontalNeighbor && hasVerticalNeighbor) {
            primaryOrientation = 'vertical';
        } else if (hasHorizontalNeighbor && hasVerticalNeighbor) {
            // If it connects both horizontally and vertically, it's a crossroad.
            // For simplicity, let's assume primary word is horizontal.
            // The secondary word will be checked by cross-word validation later (not implemented yet, but for future)
            primaryOrientation = 'horizontal'; 
        } else {
            // No neighbors and only one letter placed: this is an isolated letter, not a valid word yet.
            // Unless it's the first turn and it's on the center square, which isChecked handles.
            // For now, if no neighbors, no "word" is formed by this single letter itself.
            return [];
        }
    }

    let wordLetters = [];
    if (primaryOrientation === 'horizontal') {
        const row = currentPlacedLetters[0].x; // All letters are in the same row
        let minCol = currentPlacedLetters[0].y;
        let maxCol = currentPlacedLetters[0].y;

        // Find the leftmost and rightmost column for the potential word
        currentPlacedLetters.forEach(l => {
            if (l.y < minCol) minCol = l.y;
            if (l.y > maxCol) maxCol = l.y;
        });

        // Expand left to find existing letters
        while (minCol > 0 && currentBoard[row][minCol - 1]) {
            minCol--;
        }
        // Expand right to find existing letters
        while (maxCol < 14 && currentBoard[row][maxCol + 1]) {
            maxCol++;
        }

        // Collect all letters in this determined range
        for (let y = minCol; y <= maxCol; y++) {
            if (currentBoard[row][y]) { // If there is a letter at this position
                wordLetters.push({ x: row, y: y, letterData: currentBoard[row][y] });
            }
        }
        wordLetters.sort((a, b) => a.y - b.y); // Sort horizontally
    } else if (primaryOrientation === 'vertical') {
        const col = currentPlacedLetters[0].y; // All letters are in the same column
        let minRow = currentPlacedLetters[0].x;
        let maxRow = currentPlacedLetters[0].x;

        // Find the topmost and bottommost row for the potential word
        currentPlacedLetters.forEach(l => {
            if (l.x < minRow) minRow = l.x;
            if (l.x > maxRow) maxRow = l.x;
        });

        // Expand up to find existing letters
        while (minRow > 0 && currentBoard[minRow - 1][col]) {
            minRow--;
        }
        // Expand down to find existing letters
        while (maxRow < 14 && currentBoard[maxRow + 1][col]) {
            maxRow++;
        }

        // Collect all letters in this determined range
        for (let x = minRow; x <= maxRow; x++) {
            if (currentBoard[x][col]) { // If there is a letter at this position
                wordLetters.push({ x: x, y: col, letterData: currentBoard[x][col] });
            }
        }
        wordLetters.sort((a, b) => a.x - b.x); // Sort vertically
    }

    return wordLetters;
  };

  const areLettersContiguous = (allWordLetters) => {
    if (allWordLetters.length <= 1) return true;
    for (let i = 0; i < allWordLetters.length - 1; i++) {
      const current = allWordLetters[i];
      const next = allWordLetters[i + 1];
      if (current.x === next.x) { // Horizontálne
        if (next.y - current.y !== 1) { return false; }
      } else if (current.y === next.y) { // Vertikálne
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
      // Pre ostatné ťahy: Slovo musí použiť aspoň jedno existujúce písmeno
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

  const confirmTurn = () => {
    // 1. Získame VŠETKY písmená, ktoré boli položené z Racku v tomto ťahu
    // Porovnáme aktuálny `board` s `boardAtStartOfTurn`.
    const actualPlacedLetters = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Ak je na aktuálnej doske písmeno, ale na doske na začiatku ťahu tam nebolo,
        // potom je to písmeno, ktoré bolo položené v tomto ťahu.
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
    
    // 2. Kontrola, či sú všetky novo položené písmená v JEDNOM RADE/STĹPCI
    if (!isStraightLine(actualPlacedLetters)) {
      alert("Písmená musia byť v jednom rade alebo stĺpci!");
      return;
    }
    
    // 3. Získame celý rad/stĺpec, ktorý bol vytvorený, vrátane existujúcich písmen.
    const allWordLetters = getFullWordLetters(actualPlacedLetters, board);

    if (allWordLetters.length === 0) {
        alert("Nezistilo sa žiadne platné slovo. Skontroluj umiestnenie.");
        return;
    }

    // 4. Kontrola súvislosti VŠETKÝCH písmen vo vytvorenom slove (vrátane existujúcich)
    if (!areLettersContiguous(allWordLetters)) {
      alert("Položené písmená musia tvoriť súvislú líniu s existujúcimi písmenami (žiadne diery)!");
      return;
    }

    // 5. Kontrola pripojenia k existujúcim písmenám alebo stredu
    if (!isConnected(actualPlacedLetters, board, isFirstTurn, allWordLetters)) {
      if (isFirstTurn) {
        alert("Prvý ťah musí pokrývať stredové políčko (hviezdičku)!");
      } else {
        alert("Položené písmená sa musia spájať s existujúcimi písmenami na doske (alebo použiť existujúce písmeno ako súčasť slova)!");
      }
      return;
    }

    // 6. Kontrola, či novo položené písmená nevyplnili existujúce písmeno z predchádzajúceho ťahu
    // (t.j. či sa písmeno položilo na prázdne políčko)
    for (const letter of actualPlacedLetters) {
        if (boardAtStartOfTurn[letter.x][letter.y] !== null) {
            alert("Nemôžeš položiť písmeno na už obsadené políčko!");
            return;
        }
    }
    
    // Ak sa v tomto ťahu položilo len jedno písmeno, ale nejaké slovo už existovalo,
    // potom getFullWordLetters by malo vrátiť slovo s viacerými písmenami.
    // Ak je length 1, a nie je to prvý ťah, znamená to, že sa neprichytilo.
    if (actualPlacedLetters.length === 1 && allWordLetters.length === 1 && !isFirstTurn) {
         alert("Musíš vytvoriť slovo spojením s existujúcimi písmenami.");
         return;
    }


    // Ak všetky validácie prešli:
    alert("Ťah je platný!");

    // Aktualizácia stavu boardAtStartOfTurn na aktuálny stav boardu PO PLATNOM ŤAHU
    setBoardAtStartOfTurn(board.map(row => [...row]));
    
    // Doplň rack novými písmenami
    const numToDraw = actualPlacedLetters.length;
    const newLetters = drawLetters(numToDraw);
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
    
    // TODO: Tu príde výpočet a pripísanie skóre hráčovi
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app-container">
        <h1>Scrabble</h1>
        <Board board={board} moveLetter={moveLetter} boardAtStartOfTurn={boardAtStartOfTurn} />
        <PlayerRack letters={rackLetters} moveLetter={moveLetter} />
        <LetterBag remainingLettersCount={letterBag.length} />

        <button className="confirm-turn-button" onClick={confirmTurn}>
          Potvrdiť ťah
        </button>
      </div>
    </DndProvider>
  );
}

export default App;