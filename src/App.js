import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Board from './components/Board';
import PlayerRack from './components/PlayerRack';
import LetterBag from './components/LetterBag';
import Scoreboard from './components/Scoreboard'; // Importujeme nový Scoreboard komponent
import { createLetterBag, LETTER_VALUES } from './utils/LettersDistribution'; // Importujeme aj LETTER_VALUES
import { bonusSquares, BONUS_TYPES } from './utils/boardUtils';
import slovakWordsArray from './data/slovakWords.json'; // Importujeme slovník
import './styles/App.css';

function App() {
  const [letterBag, setLetterBag] = useState(() => createLetterBag());
  const [rackLetters, setRackLetters] = useState(Array(7).fill(null));
  const [board, setBoard] = useState(
    Array(15).fill(null).map(() => Array(15).fill(null))
  );
  // Uchováva stav dosky na začiatku ťahu, aby sme vedeli, ktoré písmená sú "zamknuté"
  const [boardAtStartOfTurn, setBoardAtStartOfTurn] = useState(
    Array(15).fill(null).map(() => Array(15).fill(null))
  );
  const [isFirstTurn, setIsFirstTurn] = useState(true);

  // Stavy pre skóre a aktuálneho hráča
  const [playerScores, setPlayerScores] = useState([0, 0]); // Skóre pre Hráča 1 a Hráča 2
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0); // 0 pre Hráča 1, 1 pre Hráča 2

  // Slovník ako Set pre rýchle vyhľadávanie (načíta sa len raz)
  const validWordsSet = useRef(new Set(slovakWordsArray.map(word => word.toUpperCase())));

  // Funkcia na ťahanie písmen z vrecúška
  const drawLetters = (numToDraw) => {
    const drawn = [];
    const newBag = [...letterBag];

    for (let i = 0; i < numToDraw; i++) {
      if (newBag.length > 0) {
        drawn.push(newBag.pop()); // Odoberieme písmeno z konca (ako z vrecúška)
      } else {
        console.warn("Vrecúško je prázdne, nedá sa ťahať viac písmen.");
        break;
      }
    }
    setLetterBag(newBag); // Aktualizujeme stav vrecúška
    return drawn;
  };

  // Efekt na naplnenie racku pri prvom načítaní hry
  useEffect(() => {
    const initialLetters = drawLetters(7); // Na začiatku potiahneme 7 písmen
    setRackLetters(initialLetters);
    // Pri prvom načítaní nastavíme aj boardAtStartOfTurn (prázdna doska)
    setBoardAtStartOfTurn(Array(15).fill(null).map(() => Array(15).fill(null)));
  }, []); // Prázdne pole závislostí zabezpečí, že sa spustí len raz pri mountovaní

  // Funkcia pre presúvanie písmen
  const moveLetter = (letterData, source, target) => {
    let newRackLetters = [...rackLetters];
    let newBoard = board.map(row => [...row]);

    // Kontrola, či sa pokúšame presunúť už zamknuté písmeno z dosky
    if (source.type === 'board' && boardAtStartOfTurn[source.x][source.y] !== null) {
      console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
      return; // Zastaví presun
    }

    // Logika presunu z racku na rack (preskupovanie)
    if (source.type === 'rack' && target.type === 'rack') {
      const fromIndex = source.index;
      const toIndex = target.index;

      if (fromIndex === toIndex) return;

      const [movedLetter] = newRackLetters.splice(fromIndex, 1);
      newRackLetters.splice(toIndex, 0, movedLetter);

      // Zabezpečíme, že rack má vždy 7 slotov a žiadne undefined
      newRackLetters = newRackLetters.filter(l => l !== undefined);
      while (newRackLetters.length < 7) {
        newRackLetters.push(null);
      }
      while (newRackLetters.length > 7) {
        newRackLetters.pop();
      }

      setRackLetters(newRackLetters);
      return;
    }

    // Logika presunu medzi rackom a doskou
    let currentLetter = letterData; // Písmeno, ktoré sa presúva
    
    // Odstránime písmeno z pôvodného miesta
    if (source.type === 'board') {
      currentLetter = newBoard[source.x][source.y]; // Zoberieme písmeno z dosky
      newBoard[source.x][source.y] = null; // Vymažeme z pôvodnej pozície na doske
    } else if (source.type === 'rack') {
      newRackLetters[source.index] = null; // Vymažeme písmeno z racku
    }

    // Umiestnime písmeno na nové miesto (rack alebo doska)
    if (target.type === 'rack') {
      newRackLetters[target.index] = currentLetter;
    } else if (target.type === 'board') {
      newBoard[target.x][target.y] = currentLetter;
    }

    setRackLetters(newRackLetters);
    setBoard(newBoard);
  };

  // --- Pomocné funkcie pre validáciu a skóre ---

  // Skontroluje, či sú všetky písmená v jednom rade alebo stĺpci
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

  // NOVÁ/REFAKTOROVANÁ POMOCNÁ FUNKCIA: Získa súvislú sekvenciu písmen v danom smere
  const getSequenceInDirection = (startCoordX, startCoordY, boardState, dx, dy) => {
    let letters = [];
    
    // Nájdeme skutočný začiatok slova v tomto smere
    let scanX = startCoordX;
    let scanY = startCoordY;
    while (scanX >= 0 && scanX < 15 && scanY >= 0 && scanY < 15 && boardState[scanX][scanY]) {
        scanX -= dx;
        scanY -= dy;
    }
    // Posunieme sa späť na prvé písmeno sekvencie
    let wordStartX = scanX + dx;
    let wordStartY = scanY + dy;

    // Zbierame písmená smerom dopredu
    while (wordStartX >= 0 && wordStartX < 15 && wordStartY >= 0 && wordStartY < 15 && boardState[wordStartX][wordStartY]) {
        letters.push({ x: wordStartX, y: wordStartY, letterData: boardState[wordStartX][wordStartY] });
        wordStartX += dx;
        wordStartY += dy;
    }
    return letters;
  };

  // Získa hlavné slovo vytvorené položenými písmenami (vrátane existujúcich medzi nimi)
  const getFullWordLetters = (currentPlacedLetters, currentBoard) => {
    if (currentPlacedLetters.length === 0) return [];

    // Zoradíme položené písmená, aby sme určili orientáciu a rozsah
    const sortedPlaced = [...currentPlacedLetters].sort((a, b) => {
        if (a.x === b.x) return a.y - b.y;
        return a.x - b.x;
    });

    const firstPlaced = sortedPlaced[0];
    let mainWord = [];

    // Určíme orientáciu na základe položených písmen
    let isHorizontal = false;
    if (sortedPlaced.length > 1 && sortedPlaced[0].x === sortedPlaced[1].x) {
        isHorizontal = true;
    } else if (sortedPlaced.length === 1) {
        // Pre jedno položené písmeno, skontrolujeme susedov pre inferenciu orientácie
        const x = firstPlaced.x;
        const y = firstPlaced.y;
        const hasHorizontalNeighbor = (y > 0 && currentBoard[x][y - 1] !== null) || (y < 14 && currentBoard[x][y + 1] !== null);
        const hasVerticalNeighbor = (x > 0 && currentBoard[x - 1][y] !== null) || (x < 14 && currentBoard[x + 1][y] !== null);

        if (hasHorizontalNeighbor && !hasVerticalNeighbor) {
            isHorizontal = true;
        } else if (!hasHorizontalNeighbor && hasVerticalNeighbor) {
            isHorizontal = false; // Vertikálne
        } else if (hasHorizontalNeighbor && hasVerticalNeighbor) {
            // Ak sa spája oboma smermi (kríž), hlavné slovo môže byť ľubovoľné.
            // Predvolíme horizontálne, krížové slová sa nájdu neskôr.
            isHorizontal = true;
        } else {
            // Jediné položené písmeno bez existujúcich susedov, zatiaľ netvorí slovo samo o sebe
            return [firstPlaced];
        }
    }

    if (isHorizontal) {
        mainWord = getSequenceInDirection(firstPlaced.x, firstPlaced.y, currentBoard, 0, 1); // Horizontálne (dx=0, dy=1)
    } else {
        mainWord = getSequenceInDirection(firstPlaced.x, firstPlaced.y, currentBoard, 1, 0); // Vertikálne (dx=1, dy=0)
    }

    return mainWord;
  };


  // Skontroluje, či písmená vo slove tvoria súvislú líniu (bez dier)
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
        return false; // Nie sú ani horizontálne ani vertikálne
      }
    }
    return true;
  };

  // Skontroluje, či sa novo položené písmená spájajú s existujúcimi alebo pokrývajú stred
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
        // Skontrolujeme, či písmeno nie je v actualPlacedLetters (teda je existujúce na doske)
        !currentPlacedLetters.some(pl => pl.x === l.x && pl.y === l.y)
      );
      
      const touchesExistingNeighbor = currentPlacedLetters.some(pl => {
        const neighbors = [
          [pl.x - 1, pl.y], [pl.x + 1, pl.y], [pl.x, pl.y - 1], [pl.x, pl.y + 1]
        ];
        return neighbors.some(([nx, ny]) =>
          nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && currentBoard[nx][ny] &&
          // Skontrolujeme, či sused nie je jedno z novo položených písmen
          !currentPlacedLetters.some(l => l.x === nx && l.y === ny)
        );
      });

      if (!hasExistingLetterInLine && !touchesExistingNeighbor) {
        return false;
      }
    }
    return true;
  };

  // Získa všetky slová vytvorené ťahom (hlavné + krížové)
  // Vracia objekty { wordString: string, letters: [{ x, y, letterData }] }
  const getAllWordsInTurn = (actualPlacedLetters, currentBoard) => {
    const formedWordObjects = [];
    const addedWordStrings = new Set(); // Na sledovanie unikátnych slov (stringov)

    // Pomocná funkcia na pridanie slova, ak je nové a platné
    const addWordIfNew = (wordLetters) => {
        if (wordLetters.length > 1) { // Slovo musí mať aspoň 2 písmená
            const wordString = wordLetters.map(l => l.letterData.letter).join('');
            if (!addedWordStrings.has(wordString)) {
                addedWordStrings.add(wordString);
                formedWordObjects.push({ wordString, letters: wordLetters });
            }
        }
    };

    // 1. Získanie hlavného slova vytvoreného položenými písmenami
    const mainWord = getFullWordLetters(actualPlacedLetters, currentBoard);
    addWordIfNew(mainWord);

    // 2. Kontrola krížových slov vytvorených každým novo položeným písmenom
    actualPlacedLetters.forEach(pLetter => {
        const { x, y } = pLetter;

        // Skontroluj horizontálne krížové slovo
        const horizontalCrossWord = getSequenceInDirection(x, y, currentBoard, 0, 1); // dx=0, dy=1 pre horizontálne
        addWordIfNew(horizontalCrossWord);

        // Skontroluj vertikálne krížové slovo
        const verticalCrossWord = getSequenceInDirection(x, y, currentBoard, 1, 0); // dx=1, dy=0 pre vertikálne
        addWordIfNew(verticalCrossWord);
    });

    return formedWordObjects;
  };

  // NOVÁ FUNKCIA: Výpočet skóre pre jedno slovo
  const calculateWordScore = (wordLetters, actualPlacedLetters, boardStateAtStartOfTurn) => {
    let wordScore = 0;
    let wordMultiplier = 1; // Násobiteľ pre celé slovo (DW, TW)

    wordLetters.forEach(letterObj => {
      const { x, y, letterData } = letterObj;
      const bonusType = bonusSquares[`${x},${y}`];
      let letterValue = LETTER_VALUES[letterData.letter] || 0; // Získame základnú hodnotu písmena

      // Zistíme, či bolo písmeno položené v tomto ťahu (nie je zamknuté)
      // Porovnávame s boardStateAtStartOfTurn
      const isNewLetter = boardStateAtStartOfTurn[x][y] === null;

      if (isNewLetter) {
        // Aplikujeme bonusy len na novo položené písmená
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
    // 1. Získame VŠETKY písmená, ktoré boli položené z Racku v tomto ťahu
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
    
    // Pre ladenie: Vypíšeme aktuálne položené písmená
    console.log("DEBUG: Actual Placed Letters:", actualPlacedLetters.map(l => ({ letter: l.letterData.letter, x: l.x, y: l.y })));

    // 2. Kontrola, či sú všetky novo položené písmená v JEDNOM RADE/STĹPCI
    if (!isStraightLine(actualPlacedLetters)) {
      alert("Písmená musia byť v jednom rade alebo stĺpci!");
      return;
    }
    
    // 3. Získame všetky slová vytvorené v tomto ťahu (hlavné + krížové)
    const allFormedWords = getAllWordsInTurn(actualPlacedLetters, board);

    // Pre ladenie: Vypíšeme všetky vytvorené slová
    console.log("DEBUG: All Formed Words (before validation):", allFormedWords.map(w => ({ word: w.wordString, letters: w.letters.map(l => l.letterData.letter) })));

    if (allFormedWords.length === 0) {
        alert("Nezistilo sa žiadne platné slovo. Skontroluj umiestnenie.");
        return;
    }

    // 4. Kontrola súvislosti VŠETKÝCH písmen vo vytvorených slovách (vrátane existujúcich)
    for (const wordObj of allFormedWords) {
        // Pre ladenie: Kontrola súvislosti pre konkrétne slovo
        console.log(`DEBUG: Checking contiguity for word: "${wordObj.wordString}"`);
        console.log("DEBUG: Letters for contiguity check:", wordObj.letters.map(l => ({ letter: l.letterData.letter, x: l.x, y: l.y })));

        if (!areLettersContiguous(wordObj.letters)) {
            alert(`Slovo "${wordObj.wordString}" nie je súvislé (žiadne diery)!`);
            return;
        }
    }
    
    // 5. Kontrola pripojenia k existujúcim písmenám alebo stredu
    // Túto kontrolu vykonáme len pre hlavné slovo, aby sme predišli duplicitným chybám
    const mainWordLettersForConnectionCheck = getFullWordLetters(actualPlacedLetters, board);
    if (!isConnected(actualPlacedLetters, board, isFirstTurn, mainWordLettersForConnectionCheck)) {
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
    
    // 7. Kontrola, či sa v neprvom ťahu vytvorilo slovo s viac ako jedným písmenom
    // (t.j. či sa jedno položené písmeno pripojilo k existujúcemu slovu)
    if (actualPlacedLetters.length === 1 && allFormedWords[0].wordString.length === 1 && !isFirstTurn) {
        alert("Musíš vytvoriť slovo spojením s existujúcimi písmenami.");
        return;
    }

    // 8. Overenie platnosti všetkých vytvorených slov podľa slovníka
    const invalidWords = allFormedWords.filter(wordObj => {
        const wordString = wordObj.wordString.toUpperCase();
        // Ak je slovo dlhšie ako 5 písmen, považujeme ho za platné pre účely tohto slovníka.
        // (predpokladáme, že slovník obsahuje len 2-5 písmenové slová a dlhšie slová sa neoverujú)
        if (wordString.length > 5) {
            return false; // Nie je neplatné podľa tohto kritéria
        }
        // Inak skontrolujeme, či slovo existuje v našom slovníku
        return !validWordsSet.current.has(wordString);
    });

    if (invalidWords.length > 0) {
        alert(`Neplatné slovo(á) nájdené: ${invalidWords.map(w => w.wordString).join(', ')}. Skontroluj slovník.`);
        return;
    }


    // Ak všetky validácie prešli: VÝPOČET SKÓRE
    let turnScore = 0;
    allFormedWords.forEach(wordObj => {
        // Počítame skóre každého vytvoreného slova
        turnScore += calculateWordScore(wordObj.letters, actualPlacedLetters, boardAtStartOfTurn);
    });

    // Bingo bonus: 50 bodov, ak hráč použil všetkých 7 písmen z racku
    if (actualPlacedLetters.length === 7) {
        turnScore += 50;
        alert("BINGO! +50 bodov!");
    }

    // Aktualizácia skóre pre aktuálneho hráča
    setPlayerScores(prevScores => {
        const newScores = [...prevScores];
        newScores[currentPlayerIndex] += turnScore;
        return newScores;
    });

    alert(`Ťah je platný! Získal si ${turnScore} bodov. Vytvorené slová: ${allFormedWords.map(w => w.wordString).join(', ')}`);

    // Aktualizácia stavu boardAtStartOfTurn na aktuálny stav boardu PO PLATNOM ŤAHU
    setBoardAtStartOfTurn(board.map(row => [...row]));
    
    // Doplň rack novými písmenami
    const numToDraw = actualPlacedLetters.length;
    const newLetters = drawLetters(numToDraw);
    let tempRack = [...rackLetters];
    let newRack = [];
    let newLetterIndex = 0;

    // Vyplníme prázdne miesta na racku novými písmenami
    for (let i = 0; i < tempRack.length; i++) {
      if (tempRack[i] === null && newLetterIndex < newLetters.length) {
        newRack.push(newLetters[newLetterIndex]);
        newLetterIndex++;
      } else {
        newRack.push(tempRack[i]);
      }
    }
    // Ak zostali nejaké nevytiahnuté písmená (napr. rack bol plný, ale niektoré sa vrátili)
    while(newLetterIndex < newLetters.length) {
      newRack.push(newLetters[newLetterIndex]);
      newLetterIndex++;
    }
    // Zabezpečíme, že rack má presne 7 miest
    while (newRack.length < 7) newRack.push(null);
    newRack = newRack.slice(0, 7); // Orezanie, ak by náhodou bolo viac ako 7

    setRackLetters(newRack);
    setIsFirstTurn(false); // Už to nie je prvý ťah
    
    // PREPNUTIE HRÁČA
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app-container">
        <h1>Scrabble</h1>
        <Scoreboard playerScores={playerScores} currentPlayerIndex={currentPlayerIndex} /> {/* Zobrazíme Scoreboard */}
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