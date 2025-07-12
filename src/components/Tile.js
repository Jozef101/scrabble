// src/components/Tile.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import { getBonusType, BONUS_TYPES } from '../utils/boardUtils';
import '../styles/Tile.css';

// Tile teraz prijíma boardAtStartOfTurn
function Tile({ x, y, letter, moveLetter, boardAtStartOfTurn }) {
  const bonusType = getBonusType(x, y);

  // Uistíme sa, že isDraggable je true iba pre písmená na racku alebo pre písmená práve položené na dosku
  // Ak letter === null, nie je tam písmeno, takže nie je dragovateľné.
  // Ak letter !== null A boardAtStartOfTurn[x][y] NIE JE null, znamená to, že písmeno je už zamknuté.
  const isDraggable = letter !== null && (boardAtStartOfTurn[x][y] === null);


  const [{ isOver }, drop] = useDrop({
    accept: 'LETTER',
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      moveLetter(
        item.letterData,
        item.source,
        { type: 'board', x, y }
      );
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const dropHighlightClass = isOver ? 'tile-highlight' : '';
  const hasLetterClass = letter ? 'tile-has-letter' : '';
  const bonusClass = bonusType ? `tile-bonus-${bonusType.toLowerCase()}` : '';
  const startSquareClass = bonusType === BONUS_TYPES.START_SQUARE ? 'tile-start-square' : '';

  // Nová trieda pre zamknuté písmená
  const lockedClass = isDraggable ? '' : 'tile-locked';

  return (
    <div
      ref={drop}
      // Komentár presunutý mimo reťazec className
      className={`tile ${dropHighlightClass} ${hasLetterClass} ${bonusClass} ${startSquareClass} ${lockedClass}`} 
    >
      {letter && (
        <Letter
          id={letter.id}
          letter={letter.letter}
          value={letter.value}
          source={{ type: 'board', x, y }}
          isDraggable={isDraggable} // Odovzdávame isDraggable do Letter komponentu
        />
      )}
      {!letter && bonusType && (
        <span className="bonus-text">
          {bonusType === BONUS_TYPES.START_SQUARE ? '★' : bonusType}
        </span>
      )}
    </div>
  );
}

export default Tile;