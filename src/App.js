// src/App.js
/* global __app_id, __firebase_config, __initial_auth_token */
import { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged, applyActionCode } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore'; 

// Import nových komponentov
import AuthPage from './components/AuthPage';
import LobbyPage from './components/LobbyPage';
import GamePage from './components/GamePage';
import UserMenuIcon from './components/UserMenuIcon';
import EmailVerificationPage from './components/EmailVerificationPage';

import slovakWords from './data/slovakWords.json';
import './styles/App.css';

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
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState(null);
    const [currentUserNickname, setCurrentUserNickname] = useState(null);
    const [slovakWordsSet, setSlovakWordsSet] = useState(null); 

    const navigate = useNavigate();
    const location = useLocation();
    const initialGameIdRef = useRef(sessionStorage.getItem('activeGameId'));

    useEffect(() => {
        // Slovník je už importovaný ako 'slovakWords'
        const wordsSet = new Set(slovakWords.map(word => word.toUpperCase()));
        setSlovakWordsSet(wordsSet);
        console.log("App.js: Slovník načítaný a spracovaný do Set. Veľkosť:", wordsSet.size);
    }, []); // Prázdne pole závislostí zabezpečí, že sa vykoná len raz

    // Effect pre Firebase Authentication
    useEffect(() => {
        const authenticateFirebase = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                    console.log("App.js: Prihlásený pomocou vlastného tokenu (Canvas).");
                } else {
                    console.log("App.js: Žiadny Canvas token. Čakám na prihlásenie/registráciu používateľa cez AuthPage.");
                    if (!auth.currentUser && location.pathname !== '/' && location.pathname !== '/verify-email') {
                        navigate('/');
                    }
                }
            } catch (error) {
                console.error("App.js: Chyba pri prihlasovaní do Firebase (z App.js):", error);
                if (location.pathname !== '/' && location.pathname !== '/verify-email') {
                    navigate('/');
                }
            }
        };

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("App.js: onAuthStateChanged - Spustený.");
            if (user) {
                setUserId(user.uid);
                setCurrentUserEmail(user.email);
                console.log("App.js: Aktuálny používateľ:", user.uid, "Email:", user.email, "Email Verified (pred reload):", user.emailVerified);

                try {
                    await user.reload();
                    console.log("App.js: Používateľské dáta prečítané znova.");

                    // Načítanie prezývky používateľa z Firestore
                    if (db) {
                        const userDocRef = doc(db, 'users', user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            const userData = userDocSnap.data();
                            setCurrentUserNickname(userData.nickname);
                            console.log("App.js: Načítaná prezývka používateľa:", userData.nickname);
                        } else {
                            console.warn("App.js: Dokument používateľa pre ID", user.uid, "nebol nájdený. Prezývka nenastavená.");
                            setCurrentUserNickname(null);
                        }
                    } else {
                        console.warn("App.js: Firestore DB nie je inicializovaná pri načítaní prezývky používateľa.");
                        setCurrentUserNickname(null);
                    }

                } catch (reloadError) {
                    console.error("App.js: Chyba pri opätovnom načítaní používateľa alebo načítaní prezývky:", reloadError);
                    setCurrentUserNickname(null); // Reset prezývky pri chybe
                }

                console.log("App.js: User emailVerified (po reload):", user.emailVerified);
                setIsEmailVerified(user.emailVerified);

                if (user.emailVerified) {
                    console.log("App.js: E-mail je overený. Navigácia.");
                    if (initialGameIdRef.current) {
                        console.log("App.js: Nájdené aktívne ID hry v sessionStorage. Navigujem do hry.");
                        navigate(`/game/${initialGameIdRef.current}`, { replace: true });
                    } else if (!location.pathname.startsWith('/game/') && location.pathname !== '/lobby') {
                        navigate('/lobby');
                    }
                } else {
                    console.log("App.js: E-mail NIE JE overený. Navigácia na /verify-email.");
                    if (location.pathname !== '/verify-email') {
                        navigate('/verify-email');
                    }
                }
            } else {
                setUserId(null);
                setIsEmailVerified(false);
                setCurrentUserEmail(null);
                setCurrentUserNickname(null); // Reset prezývky pri odhlásení
                console.log("App.js: Používateľ odhlásený z Firebase. Navigácia na /.");
                if (location.pathname !== '/') {
                    navigate('/');
                }
            }
            setIsAuthReady(true);
            console.log("App.js: onAuthStateChanged - Dokončený.");
        });

        authenticateFirebase();

        return () => unsubscribe();
    }, [auth, navigate, initialAuthToken, location.pathname, db]);

    // Effect pre spracovanie overovacieho odkazu z e-mailu
    useEffect(() => {
        const handleEmailVerificationLink = async () => {
            const params = new URLSearchParams(location.search);
            const oobCode = params.get('oobCode');
            const currentUser = auth.currentUser;

            if (!oobCode) return; // Ak nie je oobCode, nerob nič

            if (!currentUser) {
            console.log("App.js: Čakám na načítanie currentUser pred overením e-mailu...");
            return; // Počkám, až bude currentUser načítaný
            }

            if (currentUser.emailVerified) {
            console.log("App.js: E-mail už overený, presmerujem do lobby.");
            navigate('/lobby', { replace: true });
            return;
            }

            try {
            console.log("App.js: Pokúšam sa overiť e-mail pomocou oobCode...");
            await applyActionCode(auth, oobCode);

            // Aktualizuj currentUser stav, aby sa emailVerified zmenilo na true
            await auth.currentUser.reload();

            console.log("App.js: E-mail úspešne overený pomocou oobCode.");
            alert('Váš e-mail bol úspešne overený! Môžete začať hrať.');
            navigate('/lobby', { replace: true });
            } catch (error) {
            console.error("App.js: Chyba pri overovaní e-mailu pomocou oobCode:", error);
            navigate('/', { replace: true });
            }
        };

        handleEmailVerificationLink();
        }, [auth, location.search, navigate, userId]);


    const handleStartGame = (id) => {
        sessionStorage.setItem('activeGameId', id);
        navigate(`/game/${id}`);
    };

    const handleGoToLobby = () => {
        sessionStorage.removeItem('activeGameId');
        navigate('/lobby');
    };

    // ZMENA 4: Pridanie isSlovakWordsReady do podmienky pre načítavanie
    if (!isAuthReady || !slovakWordsSet) { 
        return (
            <div className="app-container flex items-center justify-center min-h-screen bg-gray-100">
                <p className="text-lg text-gray-700">Načítavam autentifikáciu a slovník...</p>
            </div>
        );
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="app-container">
                {userId && location.pathname !== '/verify-email' && <UserMenuIcon userId={userId} auth={auth} />}

                <Routes>
                    <Route path="/" element={<AuthPage auth={auth} db={db} />} />

                    <Route
                        path="/verify-email"
                        element={<EmailVerificationPage auth={auth} userId={userId} />}
                    />

                    <Route
                        path="/lobby"
                        element={
                            <LobbyPage
                                userId={userId}
                                currentUserNickname={currentUserNickname} 
                                onStartGame={handleStartGame}
                                db={db}
                                appId={appId}
                            />
                        }
                    />

                    <Route
                        path="/game/:gameId"
                        element={
                            <GamePageWrapper
                                userId={userId}
                                onGoToLobby={handleGoToLobby}
                                slovakWordsSet={slovakWordsSet} 
                            />
                        }
                    />

                    <Route path="*" element={<h1>404: Stránka nenájdená</h1>} />
                </Routes>
            </div>
        </DndProvider>
    );
}

function GamePageWrapper({ userId, onGoToLobby, slovakWordsSet }) {
    const { gameId } = useParams();
    return (
        <GamePage
            gameId={gameId}
            userId={userId}
            onGoToLobby={onGoToLobby}
            slovakWordsSet={slovakWordsSet} 
        />
    );
}

export default App;