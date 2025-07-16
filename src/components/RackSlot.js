// src/components/RackSlot.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/RackSlot.css';

// Pridávame isMyRack, myPlayerIndex, currentPlayerIndex ako prop
function RackSlot({ letter, index, playerIndex, moveLetter, isMyRack, myPlayerIndex, currentPlayerIndex }) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'LETTER',
    canDrop: (item) => {
      // Môžeš dropnúť len na svoj vlastný rack
      if (!isMyRack) return false;

      // Môžeš dropnúť na prázdny slot
      if (letter === null) return true;

      // Ak slot nie je prázdny, je možné naň položiť písmeno len ak sa presúva
      // z rovnakého stojana (pre preusporiadanie) a nie je to to isté písmeno.
      return item.source.type === 'rack' && item.source.playerIndex === myPlayerIndex && item.letterData.id !== letter.id;
    },
    drop: (item, monitor) => {
      // Ak drop nebol spracovaný inou drop zónou (napr. Board)
      if (!monitor.didDrop()) {
        const target = { type: 'rack', index, playerIndex: myPlayerIndex };

        moveLetter(item.letterData, item.source, target);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // KĽÚČOVÁ ZMENA: Logika pre isDraggable a isVisible
  const isCurrentPlayerTurn = (currentPlayerIndex === myPlayerIndex);
  const shouldBeDraggable = isMyRack && isCurrentPlayerTurn; // Iba vlastné písmená, keď je tvoj ťah
  const shouldBeVisible = isMyRack; // Vlastné písmená sú vždy viditeľné, súperove nie

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
          source={{ type: 'rack', index, playerIndex }}
          isDraggable={shouldBeDraggable} // Posielame vypočítanú hodnotu
          isVisible={shouldBeVisible}   // Posielame vypočítanú hodnotu
        />
      ) : (
        // Ak je slot prázdny, zobraz empty-rack-slot. Toto sa zobrazí pre oba racky.
        <div className="empty-rack-slot"></div>
      )}
    </div>
  );
}

export default RackSlot;