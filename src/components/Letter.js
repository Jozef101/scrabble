// src/components/Letter.js
import React from 'react';
import { useDrag } from 'react-dnd';
import '../styles/Letter.css'; // Importujeme CSS pre Letter

// Pridaná isDraggable prop
function Letter({ id, letter, value, source, isDraggable = true }) { // isDraggable s default hodnotou true
  const [{ isDragging }, drag] = useDrag({
    type: 'LETTER',
    item: {
      letterData: { id, letter, value },
      source: source,
    },
    // Dôležité: canDrag závisí od isDraggable prop
    canDrag: isDraggable, 
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const opacity = isDragging ? 0 : 1; // 0 pre skrývanie ťahaného, 1 pre normálne zobrazenie
  const cursorStyle = isDraggable ? 'grab' : 'not-allowed'; // Zmení kurzor

  return (
    <div
      ref={drag}
      className="letter"
      style={{ opacity, cursor: cursorStyle }} // Aplikujeme štýl kurzora
    >
      <span className="letter-char">{letter}</span>
      <span className="letter-value">{value}</span>
    </div>
  );
}

export default Letter;