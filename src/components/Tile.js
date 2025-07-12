// src/components/Tile.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import { getBonusType, BONUS_TYPES } from '../utils/boardUtils';
import '../styles/Tile.css';

function Tile({ x, y, letter, moveLetter, boardAtStartOfTurn }) {
  const bonusType = getBonusType(x, y);

  const isDraggable = letter !== null && (boardAtStartOfTurn[x][y] === null);

  const [{ isOver, canDrop }, drop] = useDrop({ // Pridaný 'canDrop' do destructuring
    accept: 'LETTER',
    // KĽÚČOVÁ ZMENA: canDrop funkcia
    canDrop: (item) => {
      // Písmeno je možné položiť, len ak políčko (this.props.letter) je prázdne
      // ALEBO ak sa presúva z tohto istého políčka (čo by sa nemalo stať, ale pre istotu)
      // A NESMIE byť zamknuté (teda už bolo na doske na začiatku ťahu)
      // Táto logika canDrop zabráni položeniu na obsadené políčko
      return letter === null || (item.source.type === 'board' && item.source.x === x && item.source.y === y);
    },
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      // Pred volaním moveLetter, ak by sa náhodou dostal drop sem, skontrolujeme opäť
      if (letter !== null && !(item.source.type === 'board' && item.source.x === x && item.source.y === y)) {
          console.log("Políčko už je obsadené, nemôžeš tam položiť písmeno.");
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
      canDrop: monitor.canDrop(), // Zbiera aj canDrop stav
    }),
  });

  // Vizuálne zvýraznenie pre "canDrop"
  const dropHighlightClass = isOver && canDrop ? 'tile-highlight-can-drop' : (isOver ? 'tile-highlight' : '');
  const hasLetterClass = letter ? 'tile-has-letter' : '';
  const bonusClass = bonusType ? `tile-bonus-${bonusType.toLowerCase()}` : '';
  const startSquareClass = bonusType === BONUS_TYPES.START_SQUARE ? 'tile-start-square' : '';
  const lockedClass = isDraggable ? '' : 'tile-locked';

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
          source={{ type: 'board', x, y }}
          isDraggable={isDraggable}
        />
      )}
      {!letter && bonusType && (
        <span className="bonus-text">
          {bonusType === BONUS_TYPES.STAR ? '★' : bonusType.replace(/_/g, ' ')}
        </span>
      )}
    </div>
  );
}

export default Tile;