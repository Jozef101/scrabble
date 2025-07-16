// src/components/Board.js
import React from 'react';
import Tile from './Tile';
import '../styles/Board.css';

// Board teraz prijíma aj boardAtStartOfTurn, myPlayerIndex a currentPlayerIndex
function Board({ board, moveLetter, boardAtStartOfTurn, myPlayerIndex, currentPlayerIndex }) {
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
              myPlayerIndex={myPlayerIndex}     // PRIDANÉ PROP
              currentPlayerIndex={currentPlayerIndex} // PRIDANÉ PROP
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Board;