// src/components/Board.js
import React from 'react';
import Tile from './Tile';
import '../styles/Board.css';

// Board teraz prijíma aj boardAtStartOfTurn
function Board({ board, moveLetter, boardAtStartOfTurn }) { // PRIDANÉ boardAtStartOfTurn
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
              boardAtStartOfTurn={boardAtStartOfTurn} // PRIDANÉ PROP
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Board;