import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Board from './components/Board';
import PlayerRack from './components/PlayerRack';
import './styles/App.css'; // Importujeme CSS

function App() {
  // Inicializácia stavu hracej dosky (15x15 matica, kde null znamená prázdne políčko)
  const [board, setBoard] = useState(Array(15).fill(null).map(() => Array(15).fill(null)));

  // Inicializácia písmen na hráčskom stojančeku
  const [playerLetters, setPlayerLetters] = useState([
    { id: 'rack-l1', letter: 'S', value: 1 },
    { id: 'rack-l2', letter: 'C', value: 3 },
    { id: 'rack-l3', letter: 'R', value: 1 },
    { id: 'rack-l4', letter: 'A', value: 1 },
    { id: 'rack-l5', letter: 'B', value: 2 },
    { id: 'rack-l6', letter: 'B', value: 2 },
    { id: 'rack-l7', letter: 'L', value: 1 },
  ]);

  // Funkcia pre presun písmena
  // letterData: objekt písmena (id, letter, value)
  // from: { type: 'rack' } alebo { type: 'board', x, y }
  // to: { type: 'rack' } alebo { type: 'board', x, y }
  const moveLetter = (letterData, from, to) => {
    // Kópia existujúcich stavov pre immutable aktualizácie
    let newPlayerLetters = [...playerLetters];
    let newBoard = board.map(row => [...row]); // Deep copy pre 2D pole

    // Logika presunu:
    // 1. Odstránenie písmena z pôvodného miesta
    if (from.type === 'rack') {
      newPlayerLetters = newPlayerLetters.filter(l => l.id !== letterData.id);
    } else if (from.type === 'board') {
      newBoard[from.x][from.y] = null;
    }

    // 2. Položenie písmena na nové miesto
    if (to.type === 'rack') {
      // Ak už je na racku (napr. zmenila sa len pozícia v rámci racku), nepridávaj znovu
      if (!newPlayerLetters.some(l => l.id === letterData.id)) {
        newPlayerLetters.push(letterData);
      }
    } else if (to.type === 'board') {
      newBoard[to.x][to.y] = letterData;
    }

    // Aktualizácia stavov
    setPlayerLetters(newPlayerLetters);
    setBoard(newBoard);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <h1>Singleplayer Scrabble</h1>
        <div className="game-area">
          <Board board={board} moveLetter={moveLetter} />
        </div>
        <PlayerRack letters={playerLetters} moveLetter={moveLetter} />
      </div>
    </DndProvider>
  );
}

export default App;