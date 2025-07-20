// src/components/RackSlot.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/RackSlot.css';

// Pridávame isMyRack, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot ako prop
function RackSlot({ letter, index, playerIndex, moveLetter, isMyRack, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot }) {
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

  // Logika pre isDraggable a isVisible
  const shouldBeDraggable = isMyRack; // Iba vlastné písmená
  const shouldBeVisible = isMyRack; // Vlastné písmená sú vždy viditeľné, súperove nie

  // Triedy pre zvýraznenie drop zóny
  const dropHighlightClass = isOver && canDrop ? 'rack-slot-highlight-can-drop' : (isOver ? 'rack-slot-highlight' : '');

  // Handler pre ťuknutie na slot
  const handleSlotClick = () => {
    if (onTapSlot && letter === null) { // Ak je slot prázdny, voláme onTapSlot
      onTapSlot({ type: 'rack', index, playerIndex: myPlayerIndex });
    }
    // Ak slot obsahuje písmeno, kliknutie sa spracuje v komponente Letter
  };

  // NOVÉ: Handler pre pravé kliknutie na písmeno v racku
  const handleLetterRightClick = (letterData, source) => {
    // Ak je to môj rack a je môj ťah
    if (isMyRack && currentPlayerIndex === myPlayerIndex) {
      // Presunieme písmeno do výmennej zóny
      moveLetter(letterData, source, { type: 'exchangeZone' });
    } else {
      console.log("Nemôžeš presunúť písmeno do výmennej zóny (nie je tvoj rack alebo nie je tvoj ťah).");
    }
  };

  return (
    <div ref={drop} className={`rack-slot ${dropHighlightClass}`} onClick={handleSlotClick}>
      {letter ? (
        <Letter
          id={letter.id}
          letter={letter.letter}
          value={letter.value}
          assignedLetter={letter.assignedLetter}
          source={{ type: 'rack', index, playerIndex }}
          isDraggable={shouldBeDraggable} // Posielame vypočítanú hodnotu
          isVisible={shouldBeVisible}    // Posielame vypočítanú hodnotu
          selectedLetter={selectedLetter} // NOVÉ: Posielame vybrané písmeno
          onTapLetter={onTapLetter}     // NOVÉ: Posielame handler pre ťuknutie na písmeno
          onRightClick={handleLetterRightClick} // <--- PRIDANÉ: Posielame handler na pravé kliknutie
        />
      ) : (
        // Ak je slot prázdny, zobraz empty-rack-slot. Toto sa zobrazí pre oba racky.
        <div className="empty-rack-slot"></div>
      )}
    </div>
  );
}

export default RackSlot;
