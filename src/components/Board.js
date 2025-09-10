// src/components/Board.js
import React from 'react';
import Tile from './Tile';
import '../styles/Board.css';

// Board teraz prijíma aj boardAtStartOfTurn, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot
function Board({ board, moveLetter, boardAtStartOfTurn, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot, highlightedLetters = [], gameStatus }) {
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
              selectedLetter={selectedLetter}
              onTapLetter={onTapLetter}
              onTapSlot={onTapSlot}
              isHighlighted={highlightedLetters.some(h => h.x === rowIndex && h.y === colIndex)}
              gameStatus={gameStatus}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Board;
