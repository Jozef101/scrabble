// src/App.js
/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import nových komponentov
import AuthPage from './components/AuthPage';
import LobbyPage from './components/LobbyPage';
import GamePage from './components/GamePage';
import UserMenuIcon from './components/UserMenuIcon';
import EmailVerificationPage from './components/EmailVerificationPage'; // <-- NOVINKA: Import novej stránky

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
                    await signInWithCustomToken(auth, initialAuthToken);
                    console.log("Prihlásený pomocou vlastného tokenu (Canvas).");
                } else {
                    console.log("Žiadny Canvas token. Čakám na prihlásenie/registráciu používateľa cez AuthPage.");
                }
            } catch (error) {
                console.error("Chyba pri prihlasovaní do Firebase (z App.js):", error);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                console.log("Firebase User ID:", user.uid);

                // ZMENA: Nová logika pre presmerovanie na základe overenia e-mailu
                if (user.emailVerified) {
                    // Ak je e-mail overený, presmeruj do lobby (ak nie je už v hre)
                    if (!location.pathname.startsWith('/game/')) {
                        navigate('/lobby');
                    }
                } else {
                    // Ak e-mail NIE JE overený, presmeruj na stránku overenia e-mailu
                    if (location.pathname !== '/verify-email') { // Zabráni nekonečnej slučke
                        navigate('/verify-email');
                    }
                }
            } else {
                setUserId(null);
                console.log("Používateľ odhlásený z Firebase.");
                // Presmeruj na autentifikačnú stránku, ak nie je už tam
                if (location.pathname !== '/') {
                    navigate('/');
                }
            }
            setIsAuthReady(true);
        });

        authenticateFirebase();

        return () => unsubscribe();
    }, [auth, navigate, initialAuthToken, location.pathname]);

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
                {userId && <UserMenuIcon userId={userId} auth={auth} />}

                <Routes>
                    {/* Cesta pre autentifikačnú stránku */}
                    <Route path="/" element={<AuthPage auth={auth} />} />

                    {/* NOVINKA: Cesta pre stránku overenia e-mailu */}
                    <Route
                        path="/verify-email"
                        element={<EmailVerificationPage auth={auth} userId={userId} />}
                    />

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
