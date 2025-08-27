import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import '../styles/GameLog.css';

/**
 * Komponent na zobrazenie záznamu ťahov v hre.
 * Prijíma Firestore db, gameId a prezývky hráčov.
 */
function GameLog({ db, gameId, playerNicknames }) {
    const [turnLog, setTurnLog] = useState([]);

    useEffect(() => {
        if (!db || !gameId) return;
        const q = query(
            collection(db, "scrabbleGames", gameId, "turnLogs"),
            orderBy("timestamp", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => doc.data());
            setTurnLog(docs);
        });
        return () => unsubscribe();
    }, [db, gameId]);

    return (
        <div className="gamelog-container">
            <h3 className="log-title">Záznam ťahov</h3>
            <div className="gamelog-content">
                {turnLog.length === 0 ? (
                    <p className="no-moves-message">Zatiaľ žiadne ťahy neboli zaznamenané.</p>
                ) : (
                    <ul className="turn-list">
                        {turnLog.map((turn, index) => {
                            // Upravené: Netreba parsovať, data sú už vo formáte poľa
                            let newWords = turn.newWords || [];
                            let exchangedLetters = turn.exchangedLetters || [];
                            let placedLetters = turn.placedLetters || [];

                            return (
                                <>
                                    {turn.actionType !== 'draw_result' && (
                                        <li key={index} className="turn-item">
                                            {turn.actionType === 'placeLetters' && (
                                                <>
                                                    <span className="player-info">
                                                        {playerNicknames?.[turn.playerIndex] || `Hráč ${turn.playerIndex + 1}`}
                                                    </span>
                                                    <span> položil </span>
                                                    <span className="placed-letters-info">
                                                        {placedLetters.map(l => l.letterData.letter || l.letterData.assignedLetter).join('')}
                                                    </span>
                                                    <span>, nové slov{newWords.length===1?'o':'á'} </span>
                                                    <span className="word-info">{newWords.join(', ')}</span>
                                                    {turn.score > 0 && (
                                                        <>
                                                            <span> za </span>
                                                            <span className="points-info">{turn.score}</span>
                                                            <span> bod{turn.score === 1 ? '' : (turn.score > 4 ? 'ov' : 'y')}</span>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            {turn.actionType === 'exchange' && (
                                                <>
                                                    <span className="player-info">
                                                        {playerNicknames?.[turn.playerIndex] || `Hráč ${turn.playerIndex + 1}`}
                                                    </span>
                                                    <span> vymenil </span>
                                                    <span className="exchange-info">{exchangedLetters.length}</span>
                                                    <span> písmen{exchangedLetters.length === 1 ? 'o' : (exchangedLetters.length > 4 ? '' : 'á')}</span>
                                                </>
                                            )}
                                            {turn.actionType === 'pass' && (
                                                <>
                                                    <span className="player-info">
                                                        {playerNicknames?.[turn.playerIndex] || `Hráč ${turn.playerIndex + 1}`}
                                                    </span>
                                                    <span> sa vzdal ťahu.</span>
                                                </>
                                            )}
                                            {!turn.actionType && (
                                                <>
                                                    <span className="player-info">
                                                        {playerNicknames?.[turn.playerIndex] || `Hráč ${turn.playerIndex + 1}`}
                                                    </span>
                                                    <span> vykonal neznámy ťah.</span>
                                                </>
                                            )}
                                        </li>
                                    )}
                                    {turn.actionType === 'draw_result' && (
                                        <li key={index} className="turn-item log-draw-result">
                                            <span className="log-icon">🎲</span>
                                            <span>
                                                Losovanie: 
                                                <strong> {playerNicknames[0] || 'Hráč 1'}</strong> si potiahol <strong>'{turn.drawnLetters[0].letter || 'Žolík'}'</strong>, 
                                                <strong> {playerNicknames[1] || 'Hráč 2'}</strong> si potiahol <strong>'{turn.drawnLetters[1].letter || 'Žolík'}'</strong>.
                                                Začína <strong>{playerNicknames[turn.winnerIndex]}</strong>.
                                            </span>
                                        </li>
                                    )}
                                    {turn.actionType === 'game_over' && (
                                        <li key={index} className="turn-item log-game-over">
                                            <span className="log-icon">🏁</span>
                                            <div>
                                                <strong>Hra sa skončila!</strong>

                                                {/* Zobrazíme správu podľa toho, ako hra skončila */}
                                                <div className="game-over-details">
                                                    {turn.reason === 'surrender' ? (
                                                        <span>
                                                            Hráč <strong>{playerNicknames[turn.loserIndex]}</strong> sa vzdal. Víťazom je <strong>{playerNicknames[turn.winnerIndex]}</strong>.
                                                        </span>
                                                    ) : (
                                                        <span>
                                                            Víťazom je <strong>{playerNicknames[turn.winnerIndex] || 'Neznámy hráč'}</strong> s finálnym skóre <strong>{turn.finalScores[0]} : {turn.finalScores[1]}</strong>.
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Detailné skóre zobrazíme len ak nešlo o vzdanie sa */}
                                                {(turn.reason === 'standard_end' || turn.reason === 'pass_end') && (
                                                    <div className="game-over-deductions">
                                                        <span>Upravené skóre:</span>
                                                        <ul>
                                                            <li>
                                                                {playerNicknames[0] || 'Hráč 1'}: 
                                                                {turn.initialScores[0]} - {turn.deductions[0]} bodov
                                                                {turn.bonus > 0 && turn.finishingPlayerIndex === 0 ? ` + ${turn.bonus} (bonus)` : ''} = <strong>{turn.finalScores[0]}</strong>
                                                            </li>
                                                            <li>
                                                                {playerNicknames[1] || 'Hráč 2'}: 
                                                                {turn.initialScores[1]} - {turn.deductions[1]} bodov 
                                                                {turn.bonus > 0 && turn.finishingPlayerIndex === 1 ? ` + ${turn.bonus} (bonus)` : ''} = <strong>{turn.finalScores[1]}</strong>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    )}
                                </>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default GameLog;