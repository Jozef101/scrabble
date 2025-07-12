import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter'; // Importujeme komponent Letter
import '../styles/RackSlot.css'; // Pre štýlovanie slotu

function RackSlot({ index, letter, moveLetter }) {
  const [{ isOver }, drop] = useDrop({
    accept: 'LETTER', // Tento slot akceptuje písmená
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      // Voláme moveLetter z App.js, source je pôvodná pozícia písmena
      // target je nová pozícia na racku
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
        // Ak je v slote písmeno, zobrazíme ho
        <Letter
          id={letter.id}
          letter={letter.letter}
          value={letter.value}
          source={{ type: 'rack', index: index }} // Písmeno je na racku na danom indexe
        />
      )}
    </div>
  );
}

export default RackSlot;