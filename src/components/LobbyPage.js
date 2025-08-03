// src/components/LobbyPage.js
import React, { useState, useEffect } from 'react';
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
    const [playerNicknames, setPlayerNicknames] = useState({}); // Stav pre ukladanie prezývok všetkých hráčov v hrách

    useEffect(() => {
        if (!db) {
            setError("Databáza nie je inicializovaná.");
            return;
        }
        const gamesCollectionRef = collection(db, 'scrabbleGames');
        const q = query(gamesCollectionRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const gamesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const nicknamesToFetch = new Set();
            gamesList.forEach(game => {
                game.players.forEach(player => {
                    if (player && player.id && !playerNicknames[player.id]) {
                        nicknamesToFetch.add(player.id);
                    }
                });
            });

            const newNicknames = { ...playerNicknames };
            const fetchPromises = Array.from(nicknamesToFetch).map(async (playerId) => {
                try {
                    const userDocRef = doc(db, 'users', playerId);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        newNicknames[playerId] = userDocSnap.data().nickname;
                    } else {
                        newNicknames[playerId] = 'Neznámy Hráč';
                    }
                } catch (e) {
                    console.error(`Chyba pri načítaní prezývky pre ${playerId}:`, e);
                    newNicknames[playerId] = 'Chyba Načítania';
                }
            });

            await Promise.all(fetchPromises);
            setPlayerNicknames(newNicknames);
            setGames(gamesList);
            setError('');
        }, (err) => {
            console.error("Chyba pri načítaní hier z Firestore:", err);
            setError("Chyba pri načítaní zoznamu hier.");
        });

        return () => unsubscribe();
    }, [db, userId, playerNicknames]);

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
                creatorId: userId,
                creatorNickname: currentUserNickname,
                players: [{ id: userId, playerIndex: 0, nickname: currentUserNickname }],
                status: 'waiting',
                createdAt: new Date(),
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

            let newPlayerIndex = 0;
            if (existingPlayers.length > 0) {
                const maxIndex = Math.max(...existingPlayers.map(p => p.playerIndex));
                newPlayerIndex = maxIndex + 1;
            }
            
            if (newPlayerIndex >= 2) {
                setError("Hra je už plná (max 2 hráči).");
                return;
            }

            await updateDoc(gameRef, {
                players: arrayUnion({ id: userId, playerIndex: newPlayerIndex, nickname: currentUserNickname })
            });
            onStartGame(gameId);
            setError('');
        } catch (e) {
            console.error("Chyba pri pripájaní sa k hre:", e);
            setError("Nepodarilo sa pripojiť k hre. Skúste to znova.");
        }
    };

    const handleLeaveGame = async (gameId) => {
        if (!userId) {
            setError("Nie si prihlásený.");
            return;
        }
        if (!currentUserNickname) {
            setError("Tvoja prezývka sa nenačítala. Skús sa znova prihlásiť.");
            return;
        }

        const gameRef = doc(db, 'scrabbleGames', gameId);
        try {
            const gameDoc = await getDoc(gameRef);
            if (gameDoc.exists()) {
                const currentPlayers = gameDoc.data().players || [];
                const updatedPlayers = currentPlayers.filter(player => !(player.id === userId && player.nickname === currentUserNickname));
                await updateDoc(gameRef, {
                    players: updatedPlayers
                });
            }
            setError('');
        } catch (e) {
            console.error("Chyba pri opúšťaní hry:", e);
            setError("Nepodarilo sa opustiť hru.");
        }
    };

    return (
        <div className="lobby-container">
            <h2>Vitajte v Lobby, {currentUserNickname || 'Hráč'}!</h2>

            <div className="create-game-section">
                <h3>Vytvoriť novú hru</h3>
                {/* Pôvodné pole na zadávanie názvu hry bolo odstránené */}
                <button onClick={handleCreateGame} className="create-game-button">
                    Vytvoriť hru
                </button>
                {error && <p className="error-message">{error}</p>}
            </div>

            <div className="available-games-section">
                <h3>Dostupné hry</h3>
                {games.length === 0 ? (
                    <p>Momentálne nie sú k dispozícii žiadne hry. Vytvorte novú!</p>
                ) : (
                    <ul className="games-list">
                        {games.map((game) => (
                            <li key={game.id} className="game-item">
                                <span>
                                    {/* KLÚČOVÁ ZMENA: Názov hry sa už nezobrazuje */}
                                    Tvorca: {game.creatorNickname || 'Neznámy'} - Hráči: {
                                        game.players.map(player => playerNicknames[player.id] || player.id.substring(0, 8)).join(', ')
                                    } - Status: {game.status}
                                </span>
                                {game.players.some(p => p.id === userId) ? (
                                    <button onClick={() => onStartGame(game.id)} className="join-game-button active">
                                        Pokračovať v hre
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleJoinGame(game.id, game.players)}
                                        disabled={game.players.length >= 2 || game.status !== 'waiting'}
                                        className="join-game-button"
                                    >
                                        Pripojiť sa
                                    </button>
                                )}
                                {game.players.some(p => p.id === userId) && (
                                    <button onClick={() => handleLeaveGame(game.id)} className="leave-game-button">
                                        Opustiť hru
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default LobbyPage;