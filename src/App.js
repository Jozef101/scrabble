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
    // const [currentPage, setCurrentPage] = useState('auth'); // <-- ODSTRÁNENÉ: Nahradené React Routerom
    // const [currentGameId, setCurrentGameId] = useState(null); // <-- ODSTRÁNENÉ: Game ID bude z URL parametrov

    const navigate = useNavigate(); // <-- PRIDANÉ: Hook pre navigáciu
    const location = useLocation(); // <-- PRIDANÉ: Hook pre získanie aktuálnej cesty

    // Effect pre Firebase Authentication
    useEffect(() => {
        const authenticateFirebase = async () => {
            try {
                if (initialAuthToken) {
                    // Ak je dostupný Canvas token, použijeme ho
                    await signInWithCustomToken(auth, initialAuthToken);
                    console.log("Prihlásený pomocou vlastného tokenu (Canvas).");
                } else {
                    // Používateľ sa musí prihlásiť/zaregistrovať cez AuthPage.
                    console.log("Čakám na prihlásenie/registráciu používateľa.");
                }
            } catch (error) {
                console.error("Chyba pri prihlasovaní do Firebase:", error);
                let errorMessage = "Nastala neznáma chyba.";
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = "Tento e-mail je už zaregistrovaný.";
                        break;
                    case 'auth/invalid-email':
                        errorMessage = "Neplatný formát e-mailu.";
                        break;
                    case 'auth/weak-password':
                        errorMessage = "Heslo je príliš slabé (min. 6 znakov).";
                        break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = "Nesprávny e-mail alebo heslo.";
                        break;
                    case 'auth/missing-password':
                        errorMessage = "Zadajte heslo.";
                        break;
                    case 'auth/invalid-credential':
                        errorMessage = "Neplatné prihlasovacie údaje.";
                        break;
                    case 'auth/api-key-not-valid':
                        errorMessage = "Neplatný API kľúč Firebase. Skontrolujte konfiguráciu Firebase.";
                        break;
                    default:
                        errorMessage = `Chyba: ${error.message}`;
                }
                console.error("Firebase Auth Error:", errorMessage);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                console.log("Firebase User ID:", user.uid);
                if (!location.pathname.startsWith('/game/')) {
                    navigate('/lobby');
                }
            } else {
                setUserId(null);
                console.log("Používateľ odhlásený z Firebase.");
                // ZMENA: Presmeruj na autentifikačnú stránku, ak nie je už tam
                if (location.pathname !== '/') {
                    navigate('/');
                }
            }
            setIsAuthReady(true);
        });

        authenticateFirebase();

        return () => unsubscribe();
    }, [auth, navigate, initialAuthToken]); // <-- PRIDANÉ: navigate do závislostí

    // Funkcia na spustenie hry (prechod z lobby na hernú stránku)
    const handleStartGame = (id) => {
        navigate(`/game/${id}`); // <-- ZMENA: Navigácia na dynamickú cestu hry
    };

    // Funkcia na návrat do lobby z hry
    const handleGoToLobby = () => {
        navigate('/lobby'); // <-- ZMENA: Navigácia späť do lobby
    };

    // Podmienené renderovanie na základe isAuthReady (pred Routami)
    if (!isAuthReady) {
        return (
            <div className="app-container">
                <p>Načítavam autentifikáciu...</p>
            </div>
        );
    }

    // <-- ZMENA: Nahradené Routes a Route komponentami
    return (
        <DndProvider backend={HTML5Backend}> {/* DndProvider je stále potrebný pre drag-and-drop */}
            <div className="app-container">
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
    const { gameId } = useParams(); // <-- PRIDANÉ: Získanie gameId z URL
    return (
        <GamePage
            gameId={gameId} // <-- gameId sa teraz prenáša z URL
            userId={userId}
            onGoToLobby={onGoToLobby}
        />
    );
}

export default App;
