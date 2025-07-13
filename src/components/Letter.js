import React from 'react';
import { useDrag } from 'react-dnd';
import '../styles/Letter.css';

function Letter({ id, letter, value, assignedLetter, source, isDraggable = true }) {
  // Ak je písmeno žolík, zobrazíme priradené písmeno, inak pôvodné písmeno
  const displayLetter = letter === '' ? (assignedLetter || '') : letter;
  const isJoker = letter === ''; // Kontrola, či je to žolík

  const [{ isDragging }, drag] = useDrag({
    type: 'LETTER',
    item: { letterData: { id, letter, value, assignedLetter }, source },
    canDrag: isDraggable,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const dragClass = isDragging ? 'dragging' : '';
  const jokerClass = isJoker ? 'joker-tile' : ''; // Trieda pre žolíka

  // Dynamická trieda pre farbu písmena žolíka
  const jokerAssignedColorClass = isJoker && assignedLetter ? 'joker-assigned-color' : '';

  return (
    <div
      ref={drag}
      className={`letter-tile ${dragClass} ${jokerClass}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <span className={`main-letter ${jokerAssignedColorClass}`}>{displayLetter}</span>
      <span className="letter-value">{value}</span>
    </div>
  );
}

export default Letter;