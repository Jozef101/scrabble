import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/ExchangeZone.css';

// Odstránený setLettersInZone z propov, keďže App.js's moveLetter bude spravovať stav
function ExchangeZone({ lettersInZone, moveLetter }) {
  const [{ isOver }, drop] = useDrop({
    accept: 'LETTER',
    drop: (item, monitor) => {
      // Táto kontrola je dôležitá: Ak sa písmeno presúva z racku do výmennej zóny,
      // zavoláme centrálnu funkciu moveLetter v App.js.
      // Táto funkcia spracuje odstránenie z racku a pridanie do exchangeZoneLetters.
      if (item.source.type === 'rack') {
        moveLetter(item.letterData, item.source, { type: 'exchangeZone' });
      } else {
        console.warn("Písmená z dosky sa nemôžu presúvať do výmennej zóny.");
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const highlightClass = isOver ? 'exchange-zone-highlight' : '';

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
              // Zdroj pre písmená *vo vnútri* výmennej zóny je 'exchangeZone'
              // To umožňuje ich presúvanie *von* z výmennej zóny späť na rack
              source={{ type: 'exchangeZone' }} // Pre zónu už nie je potrebný index
              isDraggable={true}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ExchangeZone;
