// src/App.js
import React, { useState, useEffect } from 'react'; // Pridáme useEffect
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Board from './components/Board';
import PlayerRack from './components/PlayerRack';
import LetterBag from './components/LetterBag'; // Importujeme LetterBag
import { createLetterBag } from './utils/LetterDistribution'; // Importujeme funkciu pre vrecúško
import './styles/App.css';

function App() {
  // Inicializujeme vrecúško pri štarte aplikácie
  const [letterBag, setLetterBag] = useState(() => createLetterBag());
  const [rackLetters, setRackLetters] = useState(Array(7).fill(null)); // Rack začína prázdny
  const [board, setBoard] = useState(
    Array(15).fill(null).map(() => Array(15).fill(null))
  );

  // Funkcia na ťahanie písmen z vrecúška
  const drawLetters = (numToDraw) => {
    const drawn = [];
    const newBag = [...letterBag]; // Pracujeme s kópiou vrecúška

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

  // Efekt na naplnenie racku pri prvom načítaní
  useEffect(() => {
    const initialLetters = drawLetters(7); // Na začiatku potiahneme 7 písmen
    setRackLetters(initialLetters);
  }, []); // Prázdne pole závislostí zabezpečí, že sa spustí len raz pri mountovaní

  const moveLetter = (letterData, source, target) => {
    let newRackLetters = [...rackLetters];
    let newBoard = board.map(row => [...row]);

    // Ošetrenie presunu z racku na rack (vkladanie)
    if (source.type === 'rack' && target.type === 'rack') {
      const fromIndex = source.index;
      const toIndex = target.index;

      if (fromIndex === toIndex) {
        return;
      }

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

    // --- Ostatné presuny (medzi rackom a doskou) ---

    let currentLetter = letterData; // Písmeno, ktoré presúvame

    // Odstránime písmeno z pôvodného miesta
    if (source.type === 'rack') {
      newRackLetters[source.index] = null; // Vymažeme písmeno z racku
    } else if (source.type === 'board') {
      currentLetter = newBoard[source.x][source.y]; // Zoberieme písmeno z dosky
      newBoard[source.x][source.y] = null; // Vymažeme písmeno z dosky
    }

    // Umiestnime písmeno na nové miesto
    if (target.type === 'rack') {
      // Ak je cieľom rack, umiestnime písmeno na daný index
      // Pre Scrabble by sa písmená z dosky mali vracať len na prázdne miesta na racku.
      // Ak je target.index už obsadený, toto prepíše existujúce písmeno.
      // Pre komplexnejšiu logiku by sme tu museli riešiť, čo s pôvodným písmenom.
      newRackLetters[target.index] = currentLetter;
    } else if (target.type === 'board') {
      // Ak je cieľom doska, umiestnime písmeno na dané súradnice
      // Pre Scrabble sa písmená umiestňujú len na prázdne políčka.
      // Ak je target.x, target.y už obsadené, toto prepíše existujúce písmeno.
      newBoard[target.x][target.y] = currentLetter;
    }

    setRackLetters(newRackLetters);
    setBoard(newBoard);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app-container">
        <h1>Scrabble</h1>
        <Board board={board} moveLetter={moveLetter} />
        <PlayerRack letters={rackLetters} moveLetter={moveLetter} />
        {/* Zobrazíme komponent LetterBag s počtom zostávajúcich písmen */}
        <LetterBag remainingLettersCount={letterBag.length} />
      </div>
    </DndProvider>
  );
}

export default App;