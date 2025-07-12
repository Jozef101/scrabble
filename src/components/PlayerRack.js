import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import '../styles/PlayerRack.css'; // Importujeme CSS pre PlayerRack

function PlayerRack({ letters, moveLetter }) {
  // useDrop hook robí z tohto komponentu "drop target"
  const [{ isOver }, drop] = useDrop({
    accept: 'LETTER', // Akceptuje iba draggable položky typu 'LETTER'
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      // Voláme funkciu moveLetter z App.js
      moveLetter(
        item.letterData,
        item.source, // Odkiaľ prišlo (doska)
        { type: 'rack' } // Kam ide (stojanček)
      );
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(), // Je nejaká draggable položka nad týmto cieľom?
    }),
  });

  const dropHighlightClass = isOver ? 'rack-highlight' : '';

  return (
    <div
      ref={drop} // Pripojíme ref na DOM element, aby ho react-dnd mohol spravovať
      className={`player-rack ${dropHighlightClass}`}
    >
      {letters.map((letterData) => (
        <Letter
          key={letterData.id}
          id={letterData.id}
          letter={letterData.letter}
          value={letterData.value}
          source={{ type: 'rack' }} // Označujeme, že písmeno je na stojančeku
        />
      ))}
    </div>
  );
}

export default PlayerRack;