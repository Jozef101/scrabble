import React from 'react';
import '../styles/Scoreboard.css';

/**
 * Komponent Scoreboard zobrazuje skóre hráčov a indikuje aktuálneho hráča.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {Array<number>} props.playerScores - Pole skóre pre každého hráča.
 * @param {number} props.currentPlayerIndex - Index hráča, ktorý je aktuálne na ťahu.
 * @param {boolean} props.isGameOver - Indikuje, či hra skončila.
 * @param {object} props.playerNicknames - Objekt s prezývkami hráčov, kde kľúč je playerIndex a hodnota je prezývka.
 * @param {object} props.playerElo - Objekt s ELO skóre hráčov, kde kľúč je playerIndex a hodnota je ELO.
 * @param {number} props.myPlayerIndex - Index aktuálneho používateľa (môjho hráča).
 */
function Scoreboard({ playerScores, currentPlayerIndex, isGameOver, playerNicknames, playerElo, myPlayerIndex }) {
  return (
    <div className="scoreboard-container">
      <div className={`player-score ${currentPlayerIndex === 0 ? 'active-player' : ''} ${myPlayerIndex === 0 ? 'my-player' : ''}`}>
        {playerNicknames[0] || 'Hráč 1'} {playerElo[0] ? `(ELO: ${playerElo[0]})` : ''}: {playerScores[0]}
      </div>
      <div className={`player-score ${currentPlayerIndex === 1 ? 'active-player' : ''} ${myPlayerIndex === 1 ? 'my-player' : ''}`}>
        {playerNicknames[1] || 'Hráč 2'} {playerElo[1] ? `(ELO: ${playerElo[1]})` : ''}: {playerScores[1]}
       </div>
     </div>
   );
}

export default Scoreboard;