import React from 'react';
import '../styles/Scoreboard.css'; // Vytvoríme si aj CSS súbor pre Scoreboard

function Scoreboard({ playerScores, currentPlayerIndex }) {
  return (
    <div className="scoreboard-container">
      <div className={`player-score ${currentPlayerIndex === 0 ? 'active-player' : ''}`}>
        Hráč 1: {playerScores[0]}
      </div>
      <div className={`player-score ${currentPlayerIndex === 1 ? 'active-player' : ''}`}>
        Hráč 2: {playerScores[1]}
      </div>
    </div>
  );
}

export default Scoreboard;
