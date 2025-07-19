// src/components/ExchangeZone.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/ExchangeZone.css';

// Pridávame selectedLetter, onTapLetter, onTapSlot ako prop
function ExchangeZone({ lettersInZone, moveLetter, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot }) {
  const [{ isOver, canDrop: dropAllowed }, drop] = useDrop({ // Premenované canDrop na dropAllowed
    accept: 'LETTER',
    canDrop: (item) => {
      // Povoliť drop iba ak je na ťahu správny hráč
      if (myPlayerIndex === null || currentPlayerIndex !== myPlayerIndex) {
        return false;
      }
      // Povoliť drop ak sa presúva z racku alebo z hracej dosky
      return item.source.type === 'rack' || item.source.type === 'board';
    },
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      moveLetter(item.letterData, item.source, { type: 'exchangeZone' });
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(), // Stále zbierame canDrop z monitora
    }),
  });

  const highlightClass = isOver && dropAllowed ? 'exchange-zone-highlight' : ''; // Používame dropAllowed

  // NOVÉ: Handler pre ťuknutie na prázdnu zónu výmeny
  const handleExchangeZoneClick = () => {
    if (onTapSlot) {
      onTapSlot({ type: 'exchangeZone' });
    }
    // Ak zóna obsahuje písmená, kliknutie na ne sa spracuje v komponente Letter
  };

  return (
    <div ref={drop} className={`exchange-zone-container ${highlightClass}`} onClick={handleExchangeZoneClick}> {/* NOVÉ: onClick handler */}
      <h3>Písmená na výmenu:</h3>
      <div className="exchange-zone-slots">
        {lettersInZone.length === 0 ? (
          <p className="placeholder-text">Presuň sem písmená z racku, ktoré chceš vymeniť.</p>
        ) : (
          lettersInZone.map((letter) => (
            <Letter
              key={letter.id}
              id={letter.id}
              letter={letter.letter}
              value={letter.value}
              assignedLetter={letter.assignedLetter}
              source={{ type: 'exchangeZone' }}
              // Písmená vo výmennej zóne sú draggable len ak je na ťahu aktuálny hráč
              isDraggable={myPlayerIndex !== null && currentPlayerIndex === myPlayerIndex}
              selectedLetter={selectedLetter} // NOVÉ: Posielame vybrané písmeno
              onTapLetter={onTapLetter}     // NOVÉ: Posielame handler pre ťuknutie na písmeno
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ExchangeZone;
