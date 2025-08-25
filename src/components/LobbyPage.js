// src/components/LobbyPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import '../styles/LobbyPage.css';
import ConfirmationModal from './ConfirmationModal';

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
    const [confirmation, setConfirmation] = useState({ isOpen: false, message: '', onConfirm: null });
    const [gameMode, setGameMode] = useState('competitive');

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
            // Už nie je potrebné nič dodatočne načítavať, ELO je priamo v dátach hry.
            setGames(gamesList);
            setError('');
        }, (err) => {
            console.error("Chyba pri načítaní hier z Firestore:", err);
            setError("Chyba pri načítaní zoznamu hier.");
        });

        return () => unsubscribe();
    }, [db]);

    const handleCreateGame = async () => {
        if (!userId || !currentUserNickname) {
            setError("Nie si prihlásený alebo sa nenačítala prezývka.");
            return;
        }

        try {
            // 1. Získame aktuálne ELO hráča, ktorý vytvára hru
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            const currentUserElo = userDocSnap.exists() ? userDocSnap.data().elo : 1600;

            // 2. Uložíme hru aj s ELO hodnotou
            const gamesCollectionRef = collection(db, 'scrabbleGames');
            await addDoc(gamesCollectionRef, {
                players: [{ 
                    id: userId, 
                    playerIndex: 0, 
                    nickname: currentUserNickname, 
                    elo: currentUserElo // Pridali sme ELO
                }],
                status: 'waiting',
                createdAt: new Date(),
                scores: [0, 0],
                progress: 0,
                gameMode: gameMode,
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

        const isAlreadyPlayer = existingPlayers.some(p => p.id === userId);

        if (isAlreadyPlayer || existingPlayers.length >= 2) {
            onStartGame(gameId);
            return;
        }

        if (!currentUserNickname) {
            setError("Tvoja prezývka sa nenačítala. Skús sa znova prihlásiť.");
            return;
        }
        
        const gameRef = doc(db, 'scrabbleGames', gameId);
        try {
            // 1. Získame aktuálne ELO hráča, ktorý sa pripája
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            const currentUserElo = userDocSnap.exists() ? userDocSnap.data().elo : 1600;

            // 2. Pridáme hráča do hry aj s jeho ELO
            const newPlayerIndex = existingPlayers.length;
            await updateDoc(gameRef, {
                players: arrayUnion({
                    id: userId,
                    playerIndex: newPlayerIndex,
                    nickname: currentUserNickname,
                    elo: currentUserElo // PRIDALI SME ELO
                }),
            });
            onStartGame(gameId);
        } catch (e) {
            console.error("Chyba pri pripájaní sa k hre:", e);
            setError("Nepodarilo sa pripojiť k hre.");
        }
    };

    const openConfirmation = (message, onConfirmAction) => {
        setConfirmation({
            isOpen: true,
            message,
            onConfirm: () => {
                onConfirmAction();
                closeConfirmation();
            }
        });
    };

    const closeConfirmation = () => {
        setConfirmation({ isOpen: false, message: '', onConfirm: null });
    };

    const gameLists = useMemo(() => {
        if (!games) {
            return {
                myOngoingGames: [],
                waitingToJoin: [],
                allOngoingGames: [],
                myFinishedGames: []
            };
        }
        const userIsInGame = (game) => game.players.some(p => p.id === userId);

        return {
            myOngoingGames: games.filter(game =>
                userIsInGame(game) && (game.status === 'waiting' || game.status === 'in-progress')
            ),
            waitingToJoin: games.filter(game =>
                !userIsInGame(game) && game.status === 'waiting' && game.players.length < 2
            ),
            allOngoingGames: games.filter(game =>
                game.status === 'waiting' || game.status === 'in-progress'
            ),
            myFinishedGames: games.filter(game =>
                userIsInGame(game) && game.status === 'finished'
            )
        };
    }, [games, userId]);

    const filteredGames = gameLists[filter] || [];
    const challengesCount = gameLists.waitingToJoin.length;

    return (
        <div className="lobby-container">
            <h2>Vitaj v Lobby {currentUserNickname || 'Hráč'}</h2>

            <div className="create-game-section">
                <h3>Vytvoriť novú hru</h3>
                <div className="game-mode-selection">
                    <div className="toggle-switch-container">
                        <span className={gameMode === 'friendly' ? 'active' : ''}>Priateľská</span>
                        <label className="switch">
                            <input 
                                type="checkbox" 
                                checked={gameMode === 'competitive'}
                                onChange={() => setGameMode(gameMode === 'competitive' ? 'friendly' : 'competitive')}
                            />
                            <span className="slider round"></span>
                        </label>
                        <span className={gameMode === 'competitive' ? 'active' : ''}>Kompetitívna</span>
                    </div>
                </div>
                <button onClick={() => openConfirmation('Naozaj chcete vytvoriť novú hru?', handleCreateGame)} className="create-game-button">
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
                        Čakajúce na súpera {challengesCount > 0 && `(${challengesCount})`}
                    </button>
                    <button 
                        className={`tab-button ${filter === 'allOngoingGames' ? 'active' : ''}`}
                        onClick={() => setFilter('allOngoingGames')}
                    >
                        Všetky rozohrané {gameLists.allOngoingGames.length > 0 ? `(${gameLists.allOngoingGames.length})` : ''}
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
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="game-info">
                                    <span>
                                        {game.players[0] ? `${game.players[0].nickname || 'Neznámy'} ` : 'Neznámy '}
                                        {game.players[0]?.elo && <span className="player-elo">({game.players[0].elo})</span>}
                                        {' vs '}
                                        {game.players.length > 1
                                            ? `${game.players[1].nickname || 'Neznámy'} `
                                            : 'Čaká na súpera'
                                        }
                                        {game.players.length > 1 && game.players[1]?.elo && <span className="player-elo">({game.players[1].elo})</span>}
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
            <ConfirmationModal
                isOpen={confirmation.isOpen}
                message={confirmation.message}
                onConfirm={confirmation.onConfirm}
                onCancel={closeConfirmation}
            />
        </div>
    );
}

export default LobbyPage;