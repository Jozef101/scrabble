// src/components/Board.js
import React from 'react';
import Tile from './Tile';
import '../styles/Board.css';

// Board teraz prijíma aj boardAtStartOfTurn, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot
function Board({ board, moveLetter, boardAtStartOfTurn, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot, highlightedLetters = [] }) {
  return (
    <div className="board">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="board-row">
          {row.map((tileData, colIndex) => (
            <Tile
              key={`${rowIndex}-${colIndex}`}
              x={rowIndex}
              y={colIndex}
              letter={tileData}
              moveLetter={moveLetter}
              boardAtStartOfTurn={boardAtStartOfTurn}
              myPlayerIndex={myPlayerIndex}
              currentPlayerIndex={currentPlayerIndex}
              selectedLetter={selectedLetter} // NOVÉ: Posielame vybrané písmeno
              onTapLetter={onTapLetter} // NOVÉ: Posielame handler pre ťuknutie na písmeno
              onTapSlot={onTapSlot} // NOVÉ: Posielame handler pre ťuknutie na slot
              isHighlighted={highlightedLetters.some(h => h.x === rowIndex && h.y === colIndex)} // Kontrola, či je tento slot zvýraznený
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Board;
