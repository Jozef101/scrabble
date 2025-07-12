import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/ExchangeZone.css';

function ExchangeZone({ lettersInZone, moveLetter }) {
  const [{ isOver }, drop] = useDrop({
    accept: 'LETTER',
    drop: (item, monitor) => {
      // Táto kontrola je dôležitá: Ak sa písmeno presúva z racku alebo dosky do výmennej zóny,
      // zavoláme centrálnu funkciu moveLetter v App.js.
      if (item.source.type === 'rack' || item.source.type === 'board') { // PRIDANÉ: item.source.type === 'board'
        moveLetter(item.letterData, item.source, { type: 'exchangeZone' });
      } else {
        console.warn("Neplatný presun do výmennej zóny.");
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
          <p className="placeholder-text">Presuň sem písmená z racku alebo dosky, ktoré chceš vymeniť.</p>
        ) : (
          lettersInZone.map((letter) => (
            <Letter
              key={letter.id} // Použijeme unikátne ID písmena ako kľúč
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