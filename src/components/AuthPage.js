// src/components/AuthPage.js
import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import '../styles/AuthPage.css'; // Import štýlov pre AuthPage

/**
 * Komponent pre autentifikáciu používateľa.
 * Umožňuje prihlásenie alebo registráciu pomocou e-mailu a hesla.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {object} props.auth - Firebase Auth inštancia.
 */
function AuthPage({ auth }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // ZMENA: Definícia actionCodeSettings s explicitnou URL
            const actionCodeSettings = {
                // DÔLEŽITÉ: Táto URL MUSÍ byť v zozname "Authorized domains" vo vašej Firebase konzole!
                // Pre lokálne testovanie: 'http://localhost:3000/' (alebo váš port)
                // Pre nasadenú aplikáciu: 'https://scrabble-3ba2d.web.app/' alebo 'https://skrebl.vercel.app/'
                url: 'https://skrebl.vercel.app/', // <<-- NASTAVTE TÚTO URL PODĽA VAŠEJ APLIKÁCIE
                handleCodeInApp: true, // Ak chcete spracovať overenie priamo v aplikácii (odporúčané)
                // iOS a Android nastavenia môžete pridať, ak máte mobilné aplikácie
                // iOS: {
                //   bundleId: 'com.example.ios'
                // },
                // android: {
                //   packageName: 'com.example.android',
                //   installApp: true,
                //   minimumVersion: '12'
                // }
            };

            // ZMENA: Odoslanie potvrdzovacieho e-mailu s actionCodeSettings
            await sendEmailVerification(user, actionCodeSettings);

            console.log("Registrácia úspešná pre:", email);
            setSuccessMessage("Registrácia úspešná! Skontrolujte si e-mail pre overenie účtu.");
        } catch (error) {
            console.error("Chyba pri registrácii alebo odosielaní overovacieho e-mailu:", error); // ZMENA: Detailnejší log
            let message = "Chyba pri registrácii. Skúste to znova.";
            if (error.code === 'auth/email-already-in-use') {
                message = "Tento e-mail je už zaregistrovaný.";
            } else if (error.code === 'auth/invalid-email') {
                message = "Neplatný formát e-mailu.";
            } else if (error.code === 'auth/weak-password') {
                message = "Heslo je príliš slabé (min. 6 znakov).";
            } else if (error.code === 'auth/unauthorized-continue-uri') { // NOVINKA: Chybová správa pre URL
                message = "Chyba pri odosielaní overovacieho e-mailu: Neplatná adresa pre presmerovanie. Skontrolujte nastavenia Firebase.";
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
                    />
                </div>
                <div className="auth-form-group">
                    <label htmlFor="password">Heslo:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="zadajte svoje heslo"
                        className="auth-input"
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
                    <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="auth-button auth-button-secondary">
                        {isRegistering ? 'Mám účet? Prihlásiť sa' : 'Nemám účet? Zaregistrovať sa'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AuthPage;
