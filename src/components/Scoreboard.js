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
function Scoreboard({
    playerScores,
    currentPlayerIndex,
    isGameOver,
    playerNicknames,
    playerElo,
    myPlayerIndex,
    gameMode,
    playerTimes,
}) {
    const formatTime = (seconds) => {
        if (seconds === null || seconds === undefined) return '--:--';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(
            remainingSeconds
        ).padStart(2, '0')}`;
    };
    return (
		<div className="scoreboard-container">
			<div className={`player-info-box ${currentPlayerIndex === 0 ? 'active-player' : ''}`}>
				<div className="player-name">
					{playerNicknames[0] || 'Hráč 1'} {playerElo[0] ? `(${playerElo[0]})` : ''}
				</div>
				<div className="player-score">{playerScores[0]}</div>
				{playerTimes && (
					<div className="player-timer">{formatTime(playerTimes[0])}</div>
				)}
			</div>

			<div className={`game-mode-display game-mode-display-${gameMode}`}>
				{gameMode === 'competitive' ? '🏆 Kompetitívna' : '😊 Priateľská'}
			</div>
		
			<div className={`player-info-box ${currentPlayerIndex === 1 ? 'active-player' : ''}`}>
				<div className="player-name">
					{playerNicknames[1] || 'Hráč 2'} {playerElo[1] ? `(${playerElo[1]})` : ''}
				</div>
				<div className="player-score">{playerScores[1]}</div>
				{playerTimes && (
					<div className="player-timer">{formatTime(playerTimes[1])}</div>
				)}
			</div>
		</div>
	);
}

export default Scoreboard;