// src/components/AuthPage.js
import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
// KLÚČOVÁ ZMENA: Importy pre Firestore
import { doc, setDoc, runTransaction } from 'firebase/firestore';
import '../styles/AuthPage.css'; // Import štýlov pre AuthPage

/**
 * Komponent pre autentifikáciu používateľa.
 * Umožňuje prihlásenie alebo registráciu pomocou e-mailu a hesla.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {object} props.auth - Firebase Auth inštancia.
 * @param {object} props.db - Inštancia Firebase Firestore. // KLÚČOVÁ ZMENA: Pridaný db prop
 */
function AuthPage({ auth, db }) { // KLÚČOVÁ ZMENA: Prijímame aj db ako prop
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState(''); // KLÚČOVÁ ZMENA: Stav pre prezývku
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    // Funkcia na prihlásenie používateľa
    const handleLogin = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Prihlásenie úspešné pre:", email);
        } catch (error) {
            console.error("Chyba pri prihlasovaní:", error);
            let message = "Chyba pri prihlasovaní. Skúste to znova.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = "Nesprávny e-mail alebo heslo.";
            } else if (error.code === 'auth/invalid-email') {
                message = "Neplatný formát e-mailu.";
            } else if (error.code === 'auth/invalid-credential') {
                message = "Neplatné prihlasovacie údaje.";
            }
            setErrorMessage(message);
        }
    };

    // Funkcia na registráciu nového používateľa
    const handleRegister = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        // KLÚČOVÁ ZMENA: Validácia prezývky
        if (!email || !password || !nickname) {
            setErrorMessage("Vyplňte, prosím, všetky polia (E-mail, Heslo, Prezývka).");
            return;
        }

        if (nickname.length < 3) {
            setErrorMessage("Prezývka musí mať aspoň 3 znaky.");
            return;
        }

        try {
            // KLÚČOVÁ ZMENA: Kontrola unikátnosti nickname-u pomocou transakcie
            // Zabezpečíme, že `db` je definované pred použitím
            if (!db) {
                throw new Error("Firestore databáza nie je inicializovaná. Kontaktujte podporu.");
            }

            await runTransaction(db, async (transaction) => {
                const nicknameDocRef = doc(db, 'nicknames', nickname.toLowerCase()); // Používame malými písmenami pre konzistentnosť
                const nicknameDocSnap = await transaction.get(nicknameDocRef);

                if (nicknameDocSnap.exists()) {
                    throw new Error("Prezývka je už obsadená. Zvoľte si inú.");
                }

                // Ak je nickname unikátny, pokračujeme s registráciou používateľa
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Uložíme nickname a userId do Firestore
                const userDocRef = doc(db, 'users', user.uid);
                transaction.set(userDocRef, {
                    nickname: nickname,
                    email: email, // Uložíme aj e-mail pre referenciu
                    createdAt: new Date(),
                    userId: user.uid // Uložíme aj userId pre ľahší prístup
                });

                // Zaznamenáme nickname ako obsadený
                transaction.set(nicknameDocRef, {
                    userId: user.uid,
                    nickname: nickname,
                    createdAt: new Date(),
                });

                // ZMENA: Definícia actionCodeSettings s explicitnou URL
                const actionCodeSettings = {
                    url: 'https://skrebl.vercel.app/verify-email', // <-- NASTAVTE TÚTO URL PODĽA VAŠEJ APLIKÁCIE
                    handleCodeInApp: true,
                };

                // ZMENA: Odoslanie potvrdzovacieho e-mailu s actionCodeSettings
                await sendEmailVerification(user, actionCodeSettings);

                console.log("Registrácia úspešná pre:", email);
                setSuccessMessage("Registrácia úspešná! Skontrolujte si e-mail pre overenie účtu.");
                // Vyčistíme polia po úspešnej registrácii
                setEmail('');
                setPassword('');
                setNickname('');
            });

        } catch (error) {
            console.error("Chyba pri registrácii alebo odosielaní overovacieho e-mailu:", error);
            let message = "Chyba pri registrácii. Skúste to znova.";
            if (error.code === 'auth/email-already-in-use') {
                message = "Tento e-mail je už zaregistrovaný.";
            } else if (error.code === 'auth/invalid-email') {
                message = "Neplatný formát e-mailu.";
            } else if (error.code === 'auth/weak-password') {
                message = "Heslo je príliš slabé (min. 6 znakov).";
            } else if (error.code === 'auth/unauthorized-continue-uri') {
                message = "Chyba pri odosielaní overovacieho e-mailu: Neplatná adresa pre presmerovanie. Skontrolujte nastavenia Firebase.";
            } else if (error.message.includes("Prezývka je už obsadená.")) { // KLÚČOVÁ ZMENA: Správa o obsadenej prezývke
                message = error.message;
            }
            setErrorMessage(message);
        }
    };

    // Funkcia pre spracovanie odoslania formulára
    const handleSubmit = (e) => {
        e.preventDefault();
        if (isRegistering) {
            handleRegister();
        } else {
            handleLogin();
        }
    };

    return (
        <div className="auth-container">
            <h2>Vitajte v Scrabble!</h2>
            <p>Prosím, {isRegistering ? 'zaregistrujte sa' : 'prihláste sa'} pre pokračovanie.</p>

            <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-form-group">
                    <label htmlFor="email">E-mail:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="zadajte svoj e-mail"
                        className="auth-input"
                        required
                    />
                </div>
                {isRegistering && ( // KLÚČOVÁ ZMENA: Zobrazí sa len pri registrácii
                    <div className="auth-form-group">
                        <label htmlFor="nickname">Prezývka:</label>
                        <input
                            type="text"
                            id="nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="zadajte svoju prezývku"
                            className="auth-input"
                            required
                            minLength="3"
                        />
                    </div>
                )}
                <div className="auth-form-group">
                    <label htmlFor="password">Heslo:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="zadajte svoje heslo"
                        className="auth-input"
                        required
                    />
                </div>

                {errorMessage && <p className="auth-error-message">{errorMessage}</p>}
                {successMessage && <p className="success-message">{successMessage}</p>}

                <div className="auth-buttons">
                    {isRegistering ? (
                        <button type="submit" className="auth-button auth-button-primary">
                            Zaregistrovať sa
                        </button>
                    ) : (
                        <button type="submit" className="auth-button auth-button-primary">
                            Prihlásiť sa
                        </button>
                    )}
                    <button type="button" onClick={() => {
                        setIsRegistering(!isRegistering);
                        setErrorMessage(''); // Vyčistíme správy pri prepínaní
                        setSuccessMessage('');
                        setEmail(''); // Vyčistíme polia
                        setPassword('');
                        setNickname('');
                    }} className="auth-button auth-button-secondary">
                        {isRegistering ? 'Mám účet? Prihlásiť sa' : 'Nemám účet? Zaregistrovať sa'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AuthPage;
