// src/components/LobbyPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import '../styles/LobbyPage.css';

/**
 * Komponent pre lobby, kde si používateľ môže vybrať akciu (napr. vytvoriť/pripojiť sa k hre).
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.userId - ID aktuálneho používateľa.
 * @param {string} props.currentUserNickname - Prezývka aktuálneho používateľa.
 * @param {function} props.onStartGame - Callback funkcia na spustenie hry.
 * @param {object} props.db - Inštancia Firestore databázy.
 * @param {string} props.appId - ID aktuálnej aplikácie z Canvas prostredia.
 */
function LobbyPage({ userId, currentUserNickname, onStartGame, db, appId }) {
    const [games, setGames] = useState([]);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('myOngoingGames');

    useEffect(() => {
        if (!db) {
            setError("Databáza nie je inicializovaná.");
            return;
        }
        const gamesCollectionRef = collection(db, 'scrabbleGames');
        const q = query(gamesCollectionRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const gamesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setGames(gamesList);
            setError('');
        }, (err) => {
            console.error("Chyba pri načítaní hier z Firestore:", err);
            setError("Chyba pri načítaní zoznamu hier.");
        });

        return () => unsubscribe();
    }, [db]);

    const handleCreateGame = async () => {
        if (!userId) {
            setError("Nie si prihlásený. Skús sa znova prihlásiť.");
            return;
        }
        if (!currentUserNickname) {
            setError("Tvoja prezývka sa nenačítala. Skús sa znova prihlásiť.");
            return;
        }

        try {
            const gamesCollectionRef = collection(db, 'scrabbleGames');
            await addDoc(gamesCollectionRef, {
                players: [{ id: userId, playerIndex: 0, nickname: currentUserNickname }],
                status: 'waiting',
                createdAt: new Date(),
                scores: [0, 0],
            });
            setError('');
        } catch (e) {
            console.error("Chyba pri vytváraní hry:", e);
            setError("Nepodarilo sa vytvoriť hru. Skúste to znova.");
        }
    };

    const handleJoinGame = async (gameId, existingPlayers) => {
        if (!userId) {
            setError("Nie si prihlásený. Skús sa znova prihlásiť.");
            return;
        }
        if (!currentUserNickname) {
            setError("Tvoja prezývka sa nenačítala. Skús sa znova prihlásiť.");
            return;
        }

        const gameRef = doc(db, 'scrabbleGames', gameId);

        try {
            if (existingPlayers.some(player => player.id === userId)) {
                onStartGame(gameId);
                return;
            }
            
            const maxIndex = Math.max(...existingPlayers.map(p => p.playerIndex));
            const newPlayerIndex = existingPlayers.length > 0 ? maxIndex + 1 : 0;
            
            if (newPlayerIndex >= 2) {
                setError("Hra je už plná (max 2 hráči).");
                return;
            }

            await updateDoc(gameRef, {
                players: arrayUnion({
                    id: userId,
                    playerIndex: newPlayerIndex,
                    nickname: currentUserNickname
                }),
                scores: [0, 0]
            }, { merge: true });
            onStartGame(gameId);
            setError('');
        } catch (e) {
            console.error("Chyba pri pripájaní sa k hre:", e);
            setError("Nepodarilo sa pripojiť k hre. Skúste to znova.");
        }
    };

    const filteredGames = useMemo(() => {
        if (!games) return [];
        const userIsInGame = (game) => game.players.some(p => p.id === userId);

        switch (filter) {
            case 'myOngoingGames':
                return games.filter(game => 
                    userIsInGame(game) && (game.status === 'waiting' || game.status === 'in-progress')
                );
            case 'waitingToJoin':
                return games.filter(game => 
                    !userIsInGame(game) && game.status === 'waiting' && game.players.length < 2
                );
            case 'allOngoingGames':
                return games.filter(game => 
                    game.status === 'waiting' || game.status === 'in-progress'
                );
            case 'myFinishedGames':
                return games.filter(game => 
                    userIsInGame(game) && game.status === 'finished'
                );
            default:
                return games;
        }
    }, [games, filter, userId]);


    return (
        <div className="lobby-container">
            <h2>Vitaj v Lobby {currentUserNickname || 'Hráč'}</h2>

            <div className="create-game-section">
                <h3>Vytvoriť novú hru</h3>
                <button onClick={handleCreateGame} className="create-game-button">
                    Vytvoriť hru
                </button>
                {error && <p className="error-message">{error}</p>}
            </div>

            <div className="available-games-section">
                <h3>Dostupné hry</h3>
                <div className="lobby-tabs">
                    <button 
                        className={`tab-button ${filter === 'myOngoingGames' ? 'active' : ''}`}
                        onClick={() => setFilter('myOngoingGames')}
                    >
                        Moje rozohrané hry
                    </button>
                    <button 
                        className={`tab-button ${filter === 'waitingToJoin' ? 'active' : ''}`}
                        onClick={() => setFilter('waitingToJoin')}
                    >
                        Čakajúce na hráča
                    </button>
                    <button 
                        className={`tab-button ${filter === 'allOngoingGames' ? 'active' : ''}`}
                        onClick={() => setFilter('allOngoingGames')}
                    >
                        Všetky rozohrané
                    </button>
                    <button 
                        className={`tab-button ${filter === 'myFinishedGames' ? 'active' : ''}`}
                        onClick={() => setFilter('myFinishedGames')}
                    >
                        Moje ukončené hry
                    </button>
                </div>

                {filteredGames.length === 0 ? (
                    <p className="no-games-message">Momentálne tu nie sú žiadne hry.</p>
                ) : (
                    <ul className="games-list">
                        {filteredGames.map((game) => (
                            // NOVINKA: Používame div s triedou game-info-wrapper namiesto li
                            <div
                                key={game.id}
                                className={`game-item-wrapper ${game.currentPlayerIndex !== undefined && game.players[game.currentPlayerIndex]?.id === userId ? 'my-turn-highlight' : ''}`}
                                onClick={() => handleJoinGame(game.id, game.players)} // TOTO JE NOVÝ KLIKATEĽNÝ PRVOK
                                // Pridáme podmienku pre zakázanie kliknutia na plnú hru, kde nie si
                                style={{ cursor: (!game.players.some(p => p.id === userId) && (game.players.length >= 2 || game.status !== 'waiting')) ? 'not-allowed' : 'pointer' }}
                            >
                                <div className="game-info">
                                    <span>
                                        {game.players[0]?.nickname || 'Neznámy'} vs {game.players.length > 1 ? game.players[1]?.nickname || 'Neznámy' : 'Čaká na súpera'}
                                    </span>
                                    <div className="game-score">
                                        Skóre: {game.scores && game.scores.length > 0 ? `${game.scores[0]} : ${game.scores[1]}` : '0 : 0'}
                                    </div>
                                    <div className="game-progress-container">
                                        <div 
                                            className="game-progress-bar"
                                            style={{ width: `${((game.progress || 0) / 100) * 100}%` }}
                                        ></div>
                                        <span className="progress-text">
                                            Progres: {game.progress || 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default LobbyPage;