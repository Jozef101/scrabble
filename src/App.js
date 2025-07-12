// src/App.js
import React, { useState, useEffect, useRef } from 'react'; // Pridáme useRef
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Board from './components/Board';
import PlayerRack from './components/PlayerRack';
import LetterBag from './components/LetterBag';
import { createLetterBag } from './utils/LettersDistribution'; // Opravený názov importu
import { bonusSquares, BONUS_TYPES } from './utils/boardUtils';
import slovakWordsArray from './data/slovakWords.json'; // Importujeme slovník
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

  // NOVÝ KÓD: Slovník ako Set pre rýchle vyhľadávanie
  // useRef zabezpečí, že Set sa vytvorí len raz a uchová sa medzi renderovaním
  const validWordsSet = useRef(new Set(slovakWordsArray.map(word => word.toUpperCase())));

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

    // Po presunoch: Umiestnime písmeno na nové miesto (rack alebo doska)
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

  // Upravená funkcia getFullWordLetters pre presnejšie získanie slova
  const getFullWordLetters = (currentPlacedLetters, currentBoard) => {
    if (currentPlacedLetters.length === 0) return [];

    let primaryOrientation = null;
    let mainWordLetters = [];

    // Ak je len jedno písmeno, musíme určiť orientáciu podľa susedov
    if (currentPlacedLetters.length === 1) {
        const { x, y } = currentPlacedLetters[0];
        const hasHorizontalNeighbor = (y > 0 && currentBoard[x][y - 1] !== null) || (y < 14 && currentBoard[x][y + 1] !== null);
        const hasVerticalNeighbor = (x > 0 && currentBoard[x - 1][y] !== null) || (x < 14 && currentBoard[x + 1][y] !== null);

        if (hasHorizontalNeighbor && !hasVerticalNeighbor) {
            primaryOrientation = 'horizontal';
        } else if (!hasHorizontalNeighbor && hasVerticalNeighbor) {
            primaryOrientation = 'vertical';
        } else if (hasHorizontalNeighbor && hasVerticalNeighbor) {
            // Ak sa spája v oboch smeroch (kríž), hlavné slovo môže byť ľubovoľné.
            // Pre jednoduchosť zvolíme horizontálne, krížové slová sa validujú samostatne.
            primaryOrientation = 'horizontal'; 
        } else {
            // Jedno písmeno bez susedov netvorí slovo (okrem prvého ťahu na stred, ale to sa rieši v isConnected)
            return currentPlacedLetters; // Vráti len to jedno písmeno, ak netvorí slovo
        }
    } else {
        // Viacero písmen: určíme orientáciu z ich pozícií
        const firstLetter = currentPlacedLetters[0];
        const secondLetter = currentPlacedLetters[1]; // Predpokladáme, že sú už zoradené alebo isStraightLine to overí
        if (firstLetter.x === secondLetter.x) {
            primaryOrientation = 'horizontal';
        } else if (firstLetter.y === secondLetter.y) {
            primaryOrientation = 'vertical';
        } else {
            return []; // Nemali by sme sa sem dostať, ak isStraightLine prešla
        }
    }

    if (primaryOrientation === 'horizontal') {
        const row = currentPlacedLetters[0].x;
        let minCol = Math.min(...currentPlacedLetters.map(l => l.y));
        let maxCol = Math.max(...currentPlacedLetters.map(l => l.y));

        // Rozšíriť doľava
        while (minCol > 0 && currentBoard[row][minCol - 1]) {
            minCol--;
        }
        // Rozšíriť doprava
        while (maxCol < 14 && currentBoard[row][maxCol + 1]) {
            maxCol++;
        }

        for (let y = minCol; y <= maxCol; y++) {
            if (currentBoard[row][y]) {
                mainWordLetters.push({ x: row, y: y, letterData: currentBoard[row][y] });
            } else {
                // Ak je diera v rekonštruovanom slove, je to neplatné
                return []; 
            }
        }
        mainWordLetters.sort((a, b) => a.y - b.y);
    } else if (primaryOrientation === 'vertical') {
        const col = currentPlacedLetters[0].y;
        let minRow = Math.min(...currentPlacedLetters.map(l => l.x));
        let maxRow = Math.max(...currentPlacedLetters.map(l => l.x));

        // Rozšíriť nahor
        while (minRow > 0 && currentBoard[minRow - 1][col]) {
            minRow--;
        }
        // Rozšíriť nadol
        while (maxRow < 14 && currentBoard[maxRow + 1][col]) {
            maxRow++;
        }

        for (let x = minRow; x <= maxRow; x++) {
            if (currentBoard[x][col]) {
                mainWordLetters.push({ x: x, y: col, letterData: currentBoard[x][col] });
            } else {
                // Ak je diera v rekonštruovanom slove, je to neplatné
                return [];
            }
        }
        mainWordLetters.sort((a, b) => a.x - b.x);
    }

    return mainWordLetters;
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

  // NOVÁ FUNKCIA: Získanie všetkých slov vytvorených ťahom (hlavné + krížové)
  const getAllWordsInTurn = (actualPlacedLetters, currentBoard) => {
    const words = new Set(); // Použijeme Set na automatické odstránenie duplicít

    // 1. Získanie hlavného slova
    const mainWordLetters = getFullWordLetters(actualPlacedLetters, currentBoard);
    const mainWordString = mainWordLetters.map(l => l.letterData.letter).join('');
    if (mainWordString.length > 1) {
        words.add(mainWordString);
    }

    // 2. Získanie krížových slov
    // Určíme orientáciu hlavného slova
    const isMainWordHorizontal = actualPlacedLetters.length > 1 && actualPlacedLetters[0].x === actualPlacedLetters[1].x;
    const isMainWordVertical = actualPlacedLetters.length > 1 && actualPlacedLetters[0].y === actualPlacedLetters[1].y;

    actualPlacedLetters.forEach(pLetter => {
        const x = pLetter.x;
        const y = pLetter.y;

        // Skontroluj vertikálne slovo, ak hlavné slovo je horizontálne alebo je to jedno písmeno
        if (isMainWordHorizontal || (actualPlacedLetters.length === 1 && isMainWordHorizontal === false)) {
            let crossWordLetters = [];
            // Hore
            let tempX = x;
            while (tempX >= 0 && currentBoard[tempX][y]) {
                crossWordLetters.unshift({x: tempX, y: y, letterData: currentBoard[tempX][y]});
                tempX--;
            }
            // Dole
            tempX = x + 1;
            while (tempX < 15 && currentBoard[tempX][y]) {
                crossWordLetters.push({x: tempX, y: y, letterData: currentBoard[tempX][y]});
                tempX++;
            }
            const crossWordString = crossWordLetters.map(l => l.letterData.letter).join('');
            if (crossWordString.length > 1) { // Krížové slovo musí mať aspoň 2 písmená
                words.add(crossWordString);
            }
        }

        // Skontroluj horizontálne slovo, ak hlavné slovo je vertikálne alebo je to jedno písmeno
        if (isMainWordVertical || (actualPlacedLetters.length === 1 && isMainWordVertical === false)) {
            let crossWordLetters = [];
            // Vľavo
            let tempY = y;
            while (tempY >= 0 && currentBoard[x][tempY]) {
                crossWordLetters.unshift({x: x, y: tempY, letterData: currentBoard[x][tempY]});
                tempY--;
            }
            // Vpravo
            tempY = y + 1;
            while (tempY < 15 && currentBoard[x][tempY]) {
                crossWordLetters.push({x: x, y: tempY, letterData: currentBoard[x][tempY]});
                tempY++;
            }
            const crossWordString = crossWordLetters.map(l => l.letterData.letter).join('');
            if (crossWordString.length > 1) { // Krížové slovo musí mať aspoň 2 písmená
                words.add(crossWordString);
            }
        }
    });

    return Array.from(words); // Vráti pole unikátnych slov
  };

  const confirmTurn = () => {
    // 1. Získame VŠETKY písmená, ktoré boli položené z Racku v tomto ťahu
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
    
    // 2. Kontrola, či sú všetky novo položené písmená v JEDNOM RADE/STĹPCI
    if (!isStraightLine(actualPlacedLetters)) {
      alert("Písmená musia byť v jednom rade alebo stĺpci!");
      return;
    }
    
    // 3. Získame celý rad/stĺpec, ktorý bol vytvorený, vrátane existujúcich písmen.
    // Používame aktuálny board, ktorý už obsahuje položené písmená.
    const allWordLettersInMainLine = getFullWordLetters(actualPlacedLetters, board);

    if (allWordLettersInMainLine.length === 0 || allWordLettersInMainLine.length === 1 && actualPlacedLetters.length === 1 && !isFirstTurn) {
        alert("Nezistilo sa žiadne platné slovo. Skontroluj umiestnenie.");
        return;
    }

    // 4. Kontrola súvislosti VŠETKÝCH písmen vo vytvorenom slove (vrátane existujúcich)
    if (!areLettersContiguous(allWordLettersInMainLine)) {
      alert("Položené písmená musia tvoriť súvislú líniu s existujúcimi písmenami (žiadne diery)!");
      return;
    }

    // 5. Kontrola pripojenia k existujúcim písmenám alebo stredu
    if (!isConnected(actualPlacedLetters, board, isFirstTurn, allWordLettersInMainLine)) {
      if (isFirstTurn) {
        alert("Prvý ťah musí pokrývať stredové políčko (hviezdičku)!");
      } else {
        alert("Položené písmená sa musia spájať s existujúcimi písmenami na doske (alebo použiť existujúce písmeno ako súčasť slova)!");
      }
      return;
    }

    // 6. Kontrola, či novo položené písmená nevyplnili existujúce písmeno z predchádzajúceho ťahu
    for (const letter of actualPlacedLetters) {
        if (boardAtStartOfTurn[letter.x][letter.y] !== null) {
            alert("Nemôžeš položiť písmeno na už obsadené políčko!");
            return;
        }
    }
    
    // 7. NOVÁ VALIDÁCIA: Overenie platnosti všetkých vytvorených slov
    const allFormedWords = getAllWordsInTurn(actualPlacedLetters, board);
    console.log("Všetky vytvorené slová v ťahu:", allFormedWords);

    const invalidWords = allFormedWords.filter(word => {
        // Kontrolujeme len slová do dĺžky 5, ostatné prejdú
        if (word.length > 5) {
            return false; 
        }
        return !validWordsSet.current.has(word.toUpperCase());
    });

    if (invalidWords.length > 0) {
        alert(`Neplatné slovo(á) nájdené: ${invalidWords.join(', ')}. Skontroluj slovník (platné sú len 2-5 písmenkové slová).`);
        return;
    }


    // Ak všetky validácie prešli:
    alert(`Ťah je platný! Vytvorené slová: ${allFormedWords.join(', ')}`);

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
