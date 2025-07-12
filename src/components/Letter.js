import React from 'react';
import { useDrag } from 'react-dnd';
import '../styles/Letter.css';

// Pridaný 'assignedLetter' do propov komponentu
function Letter({ id, letter, value, assignedLetter, source, isDraggable = true }) {
  // Ak je písmeno žolík a má priradené písmeno, zobrazíme ho
  const displayLetter = letter === '' ? (assignedLetter || '') : letter;
  const isJoker = letter === ''; // Kontrola, či je to žolík

  const [{ isDragging }, drag] = useDrag({
    type: 'LETTER',
    // Vytvoríme item objekt z propov
    item: { letterData: { id, letter, value, assignedLetter }, source },
    canDrag: isDraggable, // Používame prop isDraggable
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const dragClass = isDragging ? 'dragging' : '';
  const jokerClass = isJoker ? 'joker-tile' : ''; // Trieda pre žolíka

  return (
    <div
      ref={drag}
      className={`letter-tile ${dragClass} ${jokerClass}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <span className="main-letter">{displayLetter}</span>
      {/* Ak je to žolík a má priradené písmeno, zobrazíme ho menším písmom */}
      {isJoker && assignedLetter && ( // Používame priamo prop 'assignedLetter'
        <span className="joker-assigned-letter">{assignedLetter}</span>
      )}
      <span className="letter-value">{value}</span>
    </div>
  );
}

export default Letter;