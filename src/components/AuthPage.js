// src/components/AuthPage.js
import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'; // ZMENA: Pridaná sendEmailVerification
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
    const [successMessage, setSuccessMessage] = useState(''); // Nový stav pre úspešné správy
    const [isRegistering, setIsRegistering] = useState(false); // Nový stav pre prepínanie medzi prihlásením a registráciou

    // Funkcia na prihlásenie používateľa
    const handleLogin = async () => {
        setErrorMessage(''); // Vyčistiť predchádzajúce chyby
        setSuccessMessage(''); // Vyčistiť úspešné správy
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Prihlásenie úspešné pre:", email);
            // Navigácia sa spracuje v App.js cez onAuthStateChanged
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
        setErrorMessage(''); // Vyčistiť predchádzajúce chyby
        setSuccessMessage(''); // Vyčistiť úspešné správy
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // ZMENA: Odoslanie potvrdzovacieho e-mailu
            await sendEmailVerification(user);

            console.log("Registrácia úspešná pre:", email);
            setSuccessMessage("Registrácia úspešná! Skontrolujte si e-mail pre overenie účtu.");
            // Po registrácii sa používateľ automaticky prihlási.
            // Môžete ho presmerovať alebo zobraziť správu.
        } catch (error) {
            console.error("Chyba pri registrácii:", error);
            let message = "Chyba pri registrácii. Skúste to znova.";
            if (error.code === 'auth/email-already-in-use') {
                message = "Tento e-mail je už zaregistrovaný.";
            } else if (error.code === 'auth/invalid-email') {
                message = "Neplatný formát e-mailu.";
            } else if (error.code === 'auth/weak-password') {
                message = "Heslo je príliš slabé (min. 6 znakov).";
            }
            setErrorMessage(message);
        }
    };

    // Funkcia pre spracovanie odoslania formulára
    const handleSubmit = (e) => {
        e.preventDefault(); // Zabráni predvolenému správaniu formulára (obnovenie stránky)
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
                {successMessage && <p className="success-message">{successMessage}</p>} {/* ZMENA: Zobrazenie úspešnej správy */}

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
