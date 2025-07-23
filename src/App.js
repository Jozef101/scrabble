// src/App.js
/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
// import io from 'socket.io-client'; // Socket.IO sa inicializuje v GamePage

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// import { getAnalytics } from "firebase/analytics"; // ODSTRÁNENÉ: Analytics nie sú potrebné pre základnú funkčnosť

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

// ************************************************************************************
// KĽÚČOVÁ ZMENA: Používame __firebase_config z Canvas prostredia.
// Ak testuješ lokálne a __firebase_config nie je definované, MUSÍŠ nahradiť
// CELÝ TENTO OBJEKT SVOJOU SKUTOČNOU FIREBASE KONFIGURÁCIOU Z FIREBASE CONSOLE.
// Ak to neurobíš, `firebaseApp` nebude inicializovaný správne a dostaneš chybu
// "auth/api-key-not-valid".
// ************************************************************************************
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
  const [currentPage, setCurrentPage] = useState('auth'); // 'auth', 'lobby', 'game'
  const [currentGameId, setCurrentGameId] = useState(null); // ID aktuálne hranej hry

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
        setCurrentPage('lobby'); // Ak je používateľ prihlásený, presunieme ho do lobby
      } else {
        setUserId(null);
        console.log("Používateľ odhlásený z Firebase.");
        setCurrentPage('auth'); // Ak nie je prihlásený, vrátime ho na autentifikačnú stránku
      }
      setIsAuthReady(true);
    });

    authenticateFirebase();

    return () => unsubscribe();
  }, []); // Prázdne pole závislostí zabezpečí, že sa spustí len raz

  // Funkcia na spustenie hry (prechod z lobby na hernú stránku)
  const handleStartGame = (id) => {
    setCurrentGameId(id);
    setCurrentPage('game');
  };

  // Funkcia na návrat do lobby z hry
  const handleGoToLobby = () => {
    setCurrentGameId(null);
    setCurrentPage('lobby');
  };

  // Podmienené renderovanie na základe currentPage
  if (!isAuthReady) {
    return (
      <div className="app-container">
        <p>Načítavam autentifikáciu...</p>
      </div>
    );
  }

  if (currentPage === 'auth') {
    return (
      <div className="app-container">
        <AuthPage auth={auth} />
      </div>
    );
  }

  if (currentPage === 'lobby') {
    return (
      <div className="app-container">
        <LobbyPage userId={userId} onStartGame={handleStartGame} db={db} />
      </div>
    );
  }

  if (currentPage === 'game' && currentGameId) {
    return (
      <div className="app-container">
        <GamePage
          gameId={currentGameId}
          userId={userId}
          onGoToLobby={handleGoToLobby}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <p>Neznámy stav aplikácie.</p>
    </div>
  );
}

export default App;
