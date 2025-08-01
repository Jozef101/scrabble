// src/components/GameLog.js
import React from 'react';
import '../styles/GameLog.css';

/**
 * Komponent na zobrazenie záznamu ťahov v hre.
 * Prijíma pole ťahov (turnLog) a prezývky hráčov na správne zobrazenie.
 *
 * @param {Array<Object>} turnLog - Pole objektov s informáciami o ťahoch.
 * @param {Array<string>} playerNicknames - Pole prezývok hráčov.
 */
function GameLog({ turnLog=[], playerNicknames }) {
    // Ak je turnLog prázdny alebo neexistuje, zobrazíme správu, inak iterujeme cez ťahy.
    return (
        <div className="gamelog-container">
            <h3 className="gamelog-title">Záznam ťahov</h3>
            <div className="gamelog-content">
                {turnLog.length === 0 ? (
                    <p className="no-moves-message">Zatiaľ žiadne ťahy neboli zaznamenané.</p>
                ) : (
                    <ul className="turn-list">
                        {turnLog.map((turn, index) => (
                            <li key={index} className="turn-item">
                                {/* Zobrazujeme rôzne typy ťahov na základe vlastnosti 'type' */}
                                {turn.type === 'wordPlayed' && (
                                    <>
                                        <span className="player-info">
                                            {playerNicknames[turn.playerIndex] || `Hráč ${turn.playerIndex + 1}`}
                                        </span>
                                        <span> zahral slovo </span>
                                        <span className="word-info">'{turn.word}'</span>
                                        <span> za </span>
                                        <span className="points-info">{turn.points}</span>
                                        <span> bodov.</span>
                                    </>
                                )}
                                {turn.type === 'exchange' && (
                                    <>
                                        <span className="player-info">
                                            {playerNicknames[turn.playerIndex] || `Hráč ${turn.playerIndex + 1}`}
                                        </span>
                                        <span> vymenil </span>
                                        <span className="exchange-info">{turn.count}</span>
                                        <span> písmen{turn.count === 1 ? 'o' : 'á'}.</span>
                                    </>
                                )}
                                {turn.type === 'pass' && (
                                    <>
                                        <span className="player-info">
                                            {playerNicknames[turn.playerIndex] || `Hráč ${turn.playerIndex + 1}`}
                                        </span>
                                        <span> sa vzdal ťahu.</span>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default GameLog;
