// src/components/LobbyPage.js
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import '../styles/LobbyPage.css'; // Nový štýlový súbor pre LobbyPage

// ====================================================================
// KLÚČOVÁ ZMENA: Definovanie appId s fallback hodnotou pre lokálny vývoj
// ====================================================================
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/**
 * Komponent pre lobby, kde si používateľ môže vybrať akciu (napr. vytvoriť/pripojiť sa k hre).
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.userId - ID aktuálneho používateľa.
 * @param {function} props.onStartGame - Callback funkcia na spustenie hry.
 * @param {object} props.db - Inštancia Firestore databázy.
 */
function LobbyPage({ userId, onStartGame, db }) {
    const [gameName, setGameName] = useState('');
    const [games, setGames] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!db) {
            setError("Databáza nie je inicializovaná.");
            return;
        }

        // Vytvoríme referenciu na kolekciu hier
        // Používame lokálne definované 'appId'
        const gamesCollectionRef = collection(db, `artifacts/${appId}/public/data/games`);
        // Vytvoríme dotaz na hry, zoradené podľa dátumu vytvorenia
        const q = query(gamesCollectionRef, orderBy('createdAt', 'desc'));

        // Nastavíme poslucháča na zmeny v kolekcii hier v reálnom čase
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const gamesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setGames(gamesList);
            setError(''); // Vyčistíme chybu, ak sa dáta načítali
        }, (err) => {
            console.error("Chyba pri načítaní hier z Firestore:", err);
            setError("Chyba pri načítaní zoznamu hier.");
        });

        // Funkcia na odhlásenie poslucháča pri unmountovaní komponentu
        return () => unsubscribe();
    }, [db, userId]); // Závisí od db a userId

    const handleCreateGame = async () => {
        if (!gameName.trim()) {
            setError("Názov hry nemôže byť prázdny.");
            return;
        }
        if (!userId) {
            setError("Nie si prihlásený. Skús sa znova prihlásiť.");
            return;
        }

        try {
            // Používame lokálne definované 'appId'
            const gamesCollectionRef = collection(db, `artifacts/${appId}/public/data/games`);
            await addDoc(gamesCollectionRef, {
                name: gameName,
                players: [{ id: userId, playerIndex: 0 }], // Prvý hráč je vždy tvorca hry
                status: 'waiting', // 'waiting', 'in-progress', 'finished'
                createdAt: new Date(),
                // Ďalšie počiatočné stavy hry môžu byť tu alebo inicializované na serveri
            });
            setGameName('');
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

        // Používame lokálne definované 'appId'
        const gameRef = doc(db, `artifacts/${appId}/public/data/games`, gameId);

        try {
            // Skontrolujeme, či už používateľ nie je v hre
            if (existingPlayers.some(player => player.id === userId)) {
                onStartGame(gameId); // Ak už je hráč v hre, pripojíme ho priamo
                return;
            }

            // Priradíme ďalší dostupný playerIndex
            let newPlayerIndex = 0;
            if (existingPlayers.length > 0) {
                const maxIndex = Math.max(...existingPlayers.map(p => p.playerIndex));
                newPlayerIndex = maxIndex + 1;
            }
            
            // Limit na 2 hráčov pre Scrabble
            if (newPlayerIndex >= 2) {
                setError("Hra je už plná (max 2 hráči).");
                return;
            }

            await updateDoc(gameRef, {
                players: arrayUnion({ id: userId, playerIndex: newPlayerIndex })
            });
            onStartGame(gameId); // Spustíme hru po úspešnom pripojení
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
        // Používame lokálne definované 'appId'
        const gameRef = doc(db, `artifacts/${appId}/public/data/games`, gameId);
        try {
            // Na odstránenie hráča z poľa 'players' je potrebné vedieť jeho presný objekt.
            // Preto je lepšie najprv načítať dokument, nájsť hráča a potom ho odstrániť.
            const gameDoc = await getDoc(gameRef);
            if (gameDoc.exists()) {
                const currentPlayers = gameDoc.data().players || [];
                const updatedPlayers = currentPlayers.filter(player => player.id !== userId);
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
            <h2>Vitajte v Lobby, {userId}!</h2>

            <div className="create-game-section">
                <h3>Vytvoriť novú hru</h3>
                <input
                    type="text"
                    placeholder="Názov hry"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    className="game-name-input"
                />
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
                                <span>{game.name} ({game.players.length}/2 hráčov) - Status: {game.status}</span>
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
