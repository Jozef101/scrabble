// src/components/ExchangeZone.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/ExchangeZone.css';

function ExchangeZone({ lettersInZone, moveLetter, myPlayerIndex, currentPlayerIndex }) { // PRIDANÉ myPlayerIndex, currentPlayerIndex
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

  return (
    <div ref={drop} className={`exchange-zone-container ${highlightClass}`}>
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
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ExchangeZone;
