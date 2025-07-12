// src/components/RackSlot.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/RackSlot.css';

function RackSlot({ index, letter, moveLetter }) {
  const [{ isOver }, drop] = useDrop({
    accept: 'LETTER',
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      moveLetter(
        item.letterData,
        item.source,
        { type: 'rack', index: index }
      );
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const highlightClass = isOver ? 'rack-slot-highlight' : '';

  return (
    <div ref={drop} className={`rack-slot ${highlightClass}`}>
      {letter && (
        <Letter
          id={letter.id}
          letter={letter.letter}
          value={letter.value}
          source={{ type: 'rack', index: index }}
          isDraggable={true} // Písmená na racku sú VŽDY dragovateľné
        />
      )}
    </div>
  );
}

export default RackSlot;