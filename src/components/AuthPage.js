// src/components/AuthPage.js
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';
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
    const [confirmPassword, setConfirmPassword] = useState(''); // NOVINKA: Stav pre zopakovanie hesla
    const [nickname, setNickname] = useState(''); // KLÚČOVÁ ZMENA: Stav pre prezývku
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Ikonky oka pre zobrazenie/skrytie hesla
    const EyeOpenIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    );

    const EyeClosedIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
    );

    // Funkcia na prihlásenie používateľa
    const handleLogin = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // console.log("Prihlásenie úspešné pre:", email);
        } catch (error) {
            console.error("Chyba pri prihlasovaní:", error);
            let message = "Chyba pri prihlasovaní. Skúste to znova.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = "Nesprávny e-mail alebo heslo.";
            } else if (error.code === 'auth/invalid-email') {
                message = "Neplatný formát e-mailu.";
            } else if (error.code === 'auth/invalid-credential') {
                message = "Nesprávne prihlasovacie údaje.";
            }
            setErrorMessage(message);
        }
    };

    // Funkcia na odoslanie e-mailu pre reset hesla
    const handlePasswordReset = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        if (!email) {
            setErrorMessage("Najprv zadajte svoj e-mail, potom kliknite na 'Zabudli ste heslo?'.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            setSuccessMessage("Ak e-mail existuje v systéme, bol naň odoslaný odkaz na reset hesla.");
        } catch (error) {
            console.error("Chyba pri odosielaní e-mailu pre reset hesla:", error);
            let message = "Chyba pri odosielaní e-mailu. Skúste to znova.";
            if (error.code === 'auth/invalid-email') {
                message = "Neplatný formát e-mailu.";
            } else if (error.code === 'auth/too-many-requests') {
                message = "Príliš veľa pokusov. Skúste to neskôr.";
            }
            setErrorMessage(message);
        }
    };

    // Funkcia na registráciu nového používateľa
    const handleRegister = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        // NOVINKA: Kontrola, či sú všetky polia vyplnené
        if (!email || !password || !confirmPassword || !nickname) {
            setErrorMessage("Vyplňte, prosím, všetky polia.");
            return;
        }

        // NOVINKA: Kontrola hesla a zopakovania hesla
        if (password !== confirmPassword) {
            setErrorMessage("Heslá sa nezhodujú.");
            return;
        }

        // NOVINKA: Kontrola zložitosti hesla (aspoň 8 znakov, aspoň 1 veľké písmeno)
        const passwordRegex = /^(?=.*[A-Z]).{8,}$/;
        if (!passwordRegex.test(password)) {
            setErrorMessage("Heslo musí mať aspoň 8 znakov a obsahovať aspoň jedno veľké písmeno.");
            return;
        }

        // NOVINKA: Kontrola prezývky (len alfanumerické znaky)
        const nicknameRegex = /^[a-zA-Z0-9]+$/;
        if (!nicknameRegex.test(nickname)) {
            setErrorMessage("Prezývka môže obsahovať iba písmená a čísla.");
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
                    userId: user.uid, // Uložíme aj userId pre ľahší prístup
                    elo: 1600, // Predvolená hodnota ELO
                    role: 'player'
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
                setConfirmPassword(''); // NOVINKA: Vyčistenie pola pre zopakovanie hesla
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
            <h2>Vitaj v Našej herni!</h2>
            <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-form-group">
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e-mail"
                        className="auth-input"
                        required
                    />
                </div>
                {isRegistering && ( // KLÚČOVÁ ZMENA: Zobrazí sa len pri registrácii
                    <div className="auth-form-group">
                        <input
                            type="text"
                            id="nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="prezývka"
                            className="auth-input"
                            required
                            minLength="3"
                        />
                        {/* NOVINKA: Popis pre správnu prezývku */}
                        <p className="input-description">Môže obsahovať len písmená a čísla.</p>
                    </div>
                )}
                <div className="auth-form-group">
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="heslo"
                            className="auth-input"
                            required
                        />
                        <span className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? EyeOpenIcon : EyeClosedIcon}
                        </span>
                    </div>
                    {isRegistering && (
                        <p className="input-description">Aspoň 8 znakov a 1 veľké písmeno.</p>
                    )}
                </div>
                {isRegistering && (
                    <div className="auth-form-group">
                        <div className="password-input-wrapper">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                id="confirm-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="zopakuj svoje heslo"
                                className="auth-input"
                                required
                            />
                            <span className="password-toggle-icon" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                {showConfirmPassword ? EyeOpenIcon : EyeClosedIcon}
                            </span>
                        </div>
                    </div>
                )}

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
                        setConfirmPassword(''); // NOVINKA: Vyčistenie pola pre zopakovanie hesla
                        setNickname('');
                    }} className="auth-button auth-button-secondary">
                        {isRegistering ? 'Máš účet? Prihlás sa' : 'Nemáš účet? Zaregistruj sa'}
                    </button>
                    {!isRegistering && (
                        <button
                            type="button"
                            onClick={handlePasswordReset}
                            className="auth-button auth-button-tertiary"
                        >
                            Nepamätam si heslo
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

export default AuthPage;