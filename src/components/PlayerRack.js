// src/components/PlayerRack.js
import React from 'react';
import RackSlot from './RackSlot'; // Importujeme nový komponent RackSlot
import '../styles/PlayerRack.css'; // Uistite sa, že máte tento CSS súbor

function PlayerRack({ letters, moveLetter }) {
  // Rack má zvyčajne 7 miest
  const rackSize = 7;
  // Vytvoríme pole slotov. Ak je písmeno na danom indexe, vložíme ho do slotu.
  const rackSlots = Array.from({ length: rackSize }, (_, index) => {
    const letterInSlot = letters[index] || null; // Ak na indexe nie je písmeno, je to null
    return (
      <RackSlot
        key={index} // Kľúč je dôležitý pre React
        index={index}
        letter={letterInSlot}
        moveLetter={moveLetter}
      />
    );
  });

  return (
    <div className="player-rack-container">
      <h3>Tvoj stojan:</h3>
      <div className="player-rack">
        {rackSlots}
      </div>
    </div>
  );
}

export default PlayerRack;