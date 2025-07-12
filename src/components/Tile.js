// src/components/Tile.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import { getBonusType, BONUS_TYPES } from '../utils/boardUtils'; // Importujeme naše bonusy
import '../styles/Tile.css';

function Tile({ x, y, letter, moveLetter }) {
  // Získame typ bonusu pre toto políčko
  const bonusType = getBonusType(x, y);

  const [{ isOver }, drop] = useDrop({
    accept: 'LETTER',
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      // Voláme funkciu moveLetter z App.js
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

  // Dynamicky pridávame triedy na základe typu bonusu
  const dropHighlightClass = isOver ? 'tile-highlight' : '';
  const hasLetterClass = letter ? 'tile-has-letter' : '';
  const bonusClass = bonusType ? `tile-bonus-${bonusType.toLowerCase()}` : ''; // Napr. 'tile-bonus-tw'

  // Pre stredové políčko pridáme špeciálnu triedu pre hviezdičku
  const startSquareClass = bonusType === BONUS_TYPES.START_SQUARE ? 'tile-start-square' : '';

  return (
    <div
      ref={drop}
      className={`tile ${dropHighlightClass} ${hasLetterClass} ${bonusClass} ${startSquareClass}`}
    >
      {letter && (
        <Letter
          id={letter.id}
          letter={letter.letter}
          value={letter.value}
          source={{ type: 'board', x, y }}
        />
      )}
      {/* Zobrazíme text bonusu (voliteľné, môžete namiesto textu použiť ikony) */}
      {!letter && bonusType && (
        <span className="bonus-text">
          {bonusType === BONUS_TYPES.START_SQUARE ? '★' : bonusType}
        </span>
      )}
    </div>
  );
}

export default Tile;