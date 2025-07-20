// src/App.js
/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import io from 'socket.io-client';

// Firebase Imports
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import nových komponentov
import AuthPage from './components/AuthPage';
import LobbyPage from './components/LobbyPage';
import GamePage from './components/GamePage'; // Nový komponent pre hru

import './styles/App.css'; // Základné štýly

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDG8ogdZUMTsy960A8E4rzAZlPvdlJ5d68",
  authDomain: "scrabble-3ba2d.firebaseapp.com",
  projectId: "scrabble-3ba2d",
  storageBucket: "scrabble-3ba2d.firebasestorage.app",
  messagingSenderId: "644874770580",
  appId: "1:644874770580:web:0987c43aaa8fa8beb67c81",
  measurementId: "G-CYE7T1EDWL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ====================================================================
// Firebase konfigurácia a inicializácia
// Tieto premenné sú poskytované prostredím Canvas.
// ====================================================================
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializácia Firebase aplikácie
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Konštanta pre ID hry, ku ktorej sa klient pripojí.
const GAME_ID_TO_JOIN = 'default-scrabble-game'; // Použijeme rovnaké ID ako na serveri pre jednoduchosť

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
          await signInWithCustomToken(auth, initialAuthToken);
          console.log("Prihlásený pomocou vlastného tokenu.");
        } else {
          await signInAnonymously(auth);
          console.log("Prihlásený anonymne.");
        }
      } catch (error) {
        console.error("Chyba pri prihlasovaní do Firebase:", error);
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
  }, []);

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
        <AuthPage firebaseApp={firebaseApp} />
      </div>
    );
  }

  if (currentPage === 'lobby') {
    return (
      <div className="app-container">
        <LobbyPage userId={userId} onStartGame={handleStartGame} db={db} /> {/* Posielame inštanciu db */}
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
