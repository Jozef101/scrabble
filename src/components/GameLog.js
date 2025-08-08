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
            orderBy("turnNumber", "asc")
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
                                <li key={index} className="turn-item">
                                    {turn.actionType === 'placeLetters' && (
                                        <>
                                            <span className="player-info">
                                                {playerNicknames?.[turn.playerIndex] || `Hráč ${turn.playerIndex + 1}`}
                                            </span>
                                            <span> položil písmená </span>
                                            <span className="placed-letters-info">
                                                '{placedLetters.map(l => l.letterData.letter || l.letterData.assignedLetter).join('')}'
                                            </span>
                                            <span>, čím zahral slová </span>
                                            <span className="word-info">'{newWords.join(', ')}'</span>
                                            {turn.score > 0 && (
                                                <>
                                                    <span> za </span>
                                                    <span className="points-info">{turn.score}</span>
                                                    <span> bodov.</span>
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
                                            <span> písmen{exchangedLetters.length === 1 ? 'o' : 'á'}.</span>
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
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default GameLog;