// src/components/Letter.js
import React from 'react';
import { useDrag } from 'react-dnd';
import '../styles/Letter.css';

// Pridávame nový prop `isVisible`
function Letter({ id, letter, value, assignedLetter, source, isDraggable = true, isVisible = true }) {
  // useDrag musí byť volaný vždy, bezpodmienečne, na začiatku komponentu
  const [{ isDragging }, drag] = useDrag({
    type: 'LETTER',
    item: { letterData: { id, letter, value, assignedLetter }, source },
    canDrag: isDraggable, // isDraggable stále kontroluje, či sa dá ťahať
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // KĽÚČOVÁ ZMENA: Ak písmeno nie je viditeľné, renderujeme len skrytý vizuálny zástupca.
  // Toto sa použije pre súperov rack.
  if (!isVisible) {
    return (
      <div
        className="letter-tile hidden-letter-tile"
        // ref={drag} sa tu neaplikuje, pretože ho nechceme spraviť ťahateľným
      >
        {/* Tu sa nezobrazí žiadny text ani hodnota */}
      </div>
    );
  }

  // Ak je písmeno žolík, zobrazíme priradené písmeno, inak pôvodné písmeno
  const displayLetter = letter === '' ? (assignedLetter || '') : letter;
  const isJoker = letter === ''; // Kontrola, či je to žolík

  const dragClass = isDragging ? 'dragging' : '';
  const jokerClass = isJoker ? 'joker-tile' : ''; // Trieda pre žolíka

  // Dynamická trieda pre farbu písmena žolíka
  const jokerAssignedColorClass = isJoker && assignedLetter ? 'joker-assigned-color' : '';

  return (
    <div
      ref={drag} // ref={drag} sa aplikuje len, ak je isVisible true (tzn. nie je to skrytý kameň)
      className={`letter-tile ${dragClass} ${jokerClass}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <span className={`main-letter ${jokerAssignedColorClass}`}>{displayLetter}</span>
      <span className="letter-value">{value}</span>
    </div>
  );
}

export default Letter;