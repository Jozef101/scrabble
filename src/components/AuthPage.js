// src/components/AuthPage.js
import React from 'react';
import { getAuth, signInAnonymously } from 'firebase/auth';

/**
 * Komponent pre autentifikáciu používateľa.
 * Umožňuje anonymné prihlásenie do Firebase.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {object} props.firebaseApp - Inštancia Firebase aplikácie.
 */
function AuthPage({ firebaseApp }) {
    const auth = getAuth(firebaseApp);

    const handleSignInAnonymously = async () => {
        try {
            await signInAnonymously(auth);
            console.log("Anonymné prihlásenie úspešné!");
        } catch (error) {
            console.error("Chyba pri anonymnom prihlásení:", error);
            alert("Chyba pri prihlásení. Skúste to znova.");
        }
    };

    return (
        <div className="auth-container">
            <h2>Vitajte v Scrabble!</h2>
            <p>Pre pokračovanie sa prosím prihláste.</p>
            <button onClick={handleSignInAnonymously} className="auth-button">
                Prihlásiť sa (anonymne)
            </button>
            <p className="auth-note">Vaše ID používateľa bude vygenerované automaticky.</p>
        </div>
    );
}

export default AuthPage;
