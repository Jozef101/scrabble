import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/RackSlot.css'; // Nový CSS súbor pre RackSlot

function RackSlot({ letter, index, playerIndex, moveLetter }) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'LETTER',
    canDrop: (item) => {
      // Ak je slot prázdny, vždy je možné naň položiť písmeno
      if (letter === null) return true;

      // Ak slot nie je prázdny, je možné naň položiť písmeno len ak sa presúva
      // z rovnakého stojana (pre preusporiadanie) a nie je to to isté písmeno
      return item.source.type === 'rack' && item.source.playerIndex === playerIndex && item.letterData.id !== letter.id;
    },
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }

      // Cieľový index je index tohto slotu
      const target = { type: 'rack', index, playerIndex };

      // Zavoláme moveLetter s presnými informáciami o zdroji a cieli
      moveLetter(item.letterData, item.source, target);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Triedy pre zvýraznenie drop zóny
  const dropHighlightClass = isOver && canDrop ? 'rack-slot-highlight-can-drop' : (isOver ? 'rack-slot-highlight' : '');

  return (
    <div ref={drop} className={`rack-slot ${dropHighlightClass}`}>
      {letter ? (
        <Letter
          id={letter.id}
          letter={letter.letter}
          value={letter.value}
          assignedLetter={letter.assignedLetter}
          source={{ type: 'rack', index, playerIndex }} // Pridaný playerIndex do zdroja
          isDraggable={true} // Písmená na racku sú vždy draggable
        />
      ) : (
        <div className="empty-rack-slot"></div>
      )}
    </div>
  );
}

export default RackSlot;