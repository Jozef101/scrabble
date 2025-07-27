// src/App.js
/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom'; // <-- PRIDANÉ: Routes, Route, useNavigate, useParams

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import nových komponentov
import AuthPage from './components/AuthPage';
import LobbyPage from './components/LobbyPage';
import GamePage from './components/GamePage';
import UserMenuIcon from './components/UserMenuIcon';

import './styles/App.css'; // Základné štýly

// ====================================================================
// Firebase konfigurácia a inicializácia
// Tieto premenné sú poskytované prostredím Canvas.
// ====================================================================
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyDG8ogdZUMTsy960A8E4rzAZlPvdlJ5d68",
    authDomain: "scrabble-3ba2d.firebaseapp.com",
    projectId: "scrabble-3ba2d",
    storageBucket: "scrabble-3ba2d.firebasestorage.app",
    messagingSenderId: "644874770580",
    appId: "1:644874770580:web:0987c43aaa8fa8beb67c81",
    measurementId: "G-CYE7T1EDWL"
};

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// DEBUG LOG: Skontroluj, aká konfigurácia sa používa
console.log("Firebase konfigurácia použitá v App.js:", firebaseConfig);

// Inicializácia Firebase aplikácie
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// DEBUG LOG: Skontroluj, či je inštancia Firestore databázy platná
console.log("Firestore DB inštancia v App.js:", db);


function App() {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    // Effect pre Firebase Authentication
    useEffect(() => {
        const authenticateFirebase = async () => {
            try {
                if (initialAuthToken) {
                    // Ak je dostupný Canvas token, použijeme ho
                    await signInWithCustomToken(auth, initialAuthToken);
                    console.log("Prihlásený pomocou vlastného tokenu (Canvas).");
                } else {
                    // Ak nie je Canvas token, necháme AuthPage spracovať prihlásenie e-mailom/heslom.
                    // Tu už nebudeme volať signInAnonymously.
                    console.log("Žiadny Canvas token. Čakám na prihlásenie/registráciu používateľa cez AuthPage.");
                }
            } catch (error) {
                console.error("Chyba pri prihlasovaní do Firebase (z App.js):", error);
                // Tu môžete zobraziť všeobecnú chybu, ak sa nepodarí prihlásiť cez Canvas token
                // Konkrétnejšie chyby pre e-mail/heslo sa spracujú v AuthPage.
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                console.log("Firebase User ID:", user.uid);
                // Ak je používateľ prihlásený a nie je už na hernej stránke, presmeruj na lobby
                if (!location.pathname.startsWith('/game/')) {
                    navigate('/lobby');
                }
            } else {
                setUserId(null);
                console.log("Používateľ odhlásený z Firebase.");
                // Presmeruj na autentifikačnú stránku, ak nie je už tam
                if (location.pathname !== '/') {
                    navigate('/');
                }
            }
            setIsAuthReady(true); // Nastaví sa na true, keď je stav autentifikácie známy
        });

        authenticateFirebase(); // Spustí počiatočnú autentifikáciu

        return () => unsubscribe(); // Čistenie pri odpojení komponentu
    }, [auth, navigate, initialAuthToken, location.pathname]); // Pridaná location.pathname do závislostí

    // Funkcia na spustenie hry (prechod z lobby na hernú stránku)
    const handleStartGame = (id) => {
        navigate(`/game/${id}`);
    };

    // Funkcia na návrat do lobby z hry
    const handleGoToLobby = () => {
        navigate('/lobby');
    };

    // Podmienené renderovanie na základe isAuthReady (pred Routami)
    if (!isAuthReady) {
        return (
            <div className="app-container">
                <p>Načítavam autentifikáciu...</p>
            </div>
        );
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="app-container">
                {/* UserMenuIcon sa zobrazí len ak je userId (používateľ je prihlásený) */}
                {userId && <UserMenuIcon userId={userId} auth={auth} />}

                <Routes>
                    {/* Cesta pre autentifikačnú stránku */}
                    <Route path="/" element={<AuthPage auth={auth} />} />

                    {/* Cesta pre lobby stránku */}
                    <Route
                        path="/lobby"
                        element={
                            <LobbyPage
                                userId={userId}
                                onStartGame={handleStartGame}
                                db={db}
                            />
                        }
                    />

                    {/* Cesta pre hernú stránku s dynamickým gameId */}
                    <Route
                        path="/game/:gameId"
                        element={
                            <GamePageWrapper
                                userId={userId}
                                onGoToLobby={handleGoToLobby}
                            />
                        }
                    />

                    {/* 404 stránka pre neznáme cesty */}
                    <Route path="*" element={<h1>404: Stránka nenájdená</h1>} />
                </Routes>
            </div>
        </DndProvider>
    );
}

// Pomocný komponent na získanie gameId z URL parametrov
function GamePageWrapper({ userId, onGoToLobby }) {
    const { gameId } = useParams();
    return (
        <GamePage
            gameId={gameId}
            userId={userId}
            onGoToLobby={onGoToLobby}
        />
    );
}

export default App;
