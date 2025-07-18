// src/components/PlayerRack.js
import React from 'react';
import RackSlot from './RackSlot';
import '../styles/PlayerRack.css';

// Pridávame myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot ako prop
function PlayerRack({ letters, moveLetter, playerIndex, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot }) {
  // Určíme, či je tento PlayerRack vlastný rack aktuálneho hráča
  const isMyRack = playerIndex === myPlayerIndex;
  const isCurrentPlayerTurnRack = playerIndex === currentPlayerIndex; // Pre vizuálne zvýraznenie racku na ťahu

  return (
    <div className={`individual-player-rack-container ${isCurrentPlayerTurnRack ? 'current-turn-rack' : ''}`}>
      {letters.map((letter, index) => (
        <RackSlot
          key={letter ? letter.id : `empty-${playerIndex}-${index}`} // Lepšie kľúče pre stabilitu
          letter={letter}
          index={index}
          playerIndex={playerIndex} // Toto je playerIndex RACKU (0 alebo 1)
          moveLetter={moveLetter}
          isMyRack={isMyRack} // Posielame informáciu, či je to môj rack
          myPlayerIndex={myPlayerIndex} // Posielame aj myPlayerIndex pre logiku dropu v RackSlot
          currentPlayerIndex={currentPlayerIndex} // Posielame aj currentPlayerIndex pre logiku dragu/viditeľnosti v Letter komponente
          selectedLetter={selectedLetter} // NOVÉ: Posielame vybrané písmeno
          onTapLetter={onTapLetter} // NOVÉ: Posielame handler pre ťuknutie na písmeno
          onTapSlot={onTapSlot} // NOVÉ: Posielame handler pre ťuknutie na slot
        />
      ))}
    </div>
  );
}

export default PlayerRack;
