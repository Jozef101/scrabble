import React from 'react';
import RackSlot from './RackSlot'; // Importujeme nový komponent
import '../styles/PlayerRack.css';

function PlayerRack({ letters, moveLetter, playerIndex }) {
  return (
    // Premenovaný názov triedy, aby nedochádzalo ku kolízii s App.css
    <div className="individual-player-rack-container">
      {letters.map((letter, index) => (
        <RackSlot
          key={index} // Používame index ako key, pretože poradie sa mení
          letter={letter}
          index={index}
          playerIndex={playerIndex}
          moveLetter={moveLetter}
        />
      ))}
    </div>
  );
}

export default PlayerRack;