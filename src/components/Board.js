import React from 'react';
import Tile from './Tile';
import '../styles/Board.css'; // Importujeme CSS pre Board

function Board({ board, moveLetter }) {
  return (
    <div className="board">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="board-row">
          {row.map((tileData, colIndex) => (
            <Tile
              key={`${rowIndex}-${colIndex}`}
              x={rowIndex}
              y={colIndex}
              letter={tileData} // tileData bude buď objekt písmena alebo null
              moveLetter={moveLetter}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Board;