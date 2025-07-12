import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import { getBonusType, BONUS_TYPES } from '../utils/boardUtils';
import '../styles/Tile.css';

function Tile({ x, y, letter, moveLetter, boardAtStartOfTurn }) {
  const bonusType = getBonusType(x, y);

  const isDraggable = letter !== null && (boardAtStartOfTurn[x][y] === null);

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'LETTER',
    canDrop: (item) => {
      if (letter === null) return true;
      return item.source.type === 'board' && item.source.x === x && item.source.y === y;
    },
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      if (letter !== null && !(item.source.type === 'board' && item.source.x === x && item.source.y === y)) {
          console.log("Políčko už je obsadené, nemôžeš tam položiť písmeno.");
          return;
      }

      // Vždy zavoláme moveLetter. Logika pre zobrazenie modálneho okna žolíka
      // je v App.js funkcii moveLetter.
      moveLetter(
        item.letterData,
        item.source,
        { type: 'board', x, y } // 'target' je tu správne definovaný ako objekt
      );
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const dropHighlightClass = isOver && canDrop ? 'tile-highlight-can-drop' : (isOver ? 'tile-highlight' : '');
  const hasLetterClass = letter ? 'tile-has-letter' : '';
  const bonusClass = bonusType ? `tile-bonus-${bonusType.toLowerCase()}` : '';
  const startSquareClass = bonusType === BONUS_TYPES.START_SQUARE ? 'tile-start-square' : '';
  const lockedClass = !isDraggable && letter !== null ? 'tile-locked' : '';


  return (
    <div
      ref={drop}
      className={`tile ${dropHighlightClass} ${hasLetterClass} ${bonusClass} ${startSquareClass} ${lockedClass}`} 
    >
      {letter && (
        <Letter
          id={letter.id}
          letter={letter.letter}
          value={letter.value}
          assignedLetter={letter.assignedLetter}
          source={{ type: 'board', x, y }}
          isDraggable={isDraggable}
        />
      )}
      {!letter && bonusType && (
        <span className="bonus-text">
          {bonusType === BONUS_TYPES.START_SQUARE ? '★' : bonusType.replace(/_/g, ' ')}
        </span>
      )}
    </div>
  );
}

export default Tile;