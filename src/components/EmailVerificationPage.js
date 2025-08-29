// src/components/EmailVerificationPage.js
import React, { useState, useEffect } from 'react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import '../styles/EmailVerificationPage.css';

const COOLDOWN_SECONDS = 60; // Doba čakania v sekundách pred opätovným odoslaním

function EmailVerificationPage({ auth, userId }) {
    const navigate = useNavigate();
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0); // Časovač pre opätovné odoslanie
    const [loading, setLoading] = useState(false); // Stav načítania pre tlačidlo

    // Načítanie stavu časovača z localStorage pri načítaní komponentu
    useEffect(() => {
        const lastSent = localStorage.getItem('lastEmailVerificationSent');
        if (lastSent) {
            const timeElapsed = Math.floor((Date.now() - parseInt(lastSent)) / 1000);
            if (timeElapsed < COOLDOWN_SECONDS) {
                setResendCooldown(COOLDOWN_SECONDS - timeElapsed);
                setEmailSent(true); // Predpokladáme, že e-mail bol odoslaný
            }
        }
    }, []);

    // Časovač pre opätovné odoslanie e-mailu
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setInterval(() => {
                setResendCooldown((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [resendCooldown]);

    const sendVerificationEmail = async () => {
        if (!auth.currentUser) {
            setError("Používateľ nie je prihlásený. Prosím, prihláste sa znova.");
            return;
        }

        if (resendCooldown > 0) {
            setError(`Prosím, počkajte ${resendCooldown} sekúnd pred opätovným odoslaním.`);
            return;
        }

        setLoading(true); // Začiatok načítania
        setError(''); // Vyčistíme predchádzajúce chyby

        try {
            const actionCodeSettings = {
                url: 'http://localhost:3000/', // Nastavte na port, na ktorom beží vaša React aplikácia pre lokálne testovanie
                handleCodeInApp: true,
            };
            await sendEmailVerification(auth.currentUser, actionCodeSettings);
            setEmailSent(true);
            setResendCooldown(COOLDOWN_SECONDS); // Nastavíme časovač
            localStorage.setItem('lastEmailVerificationSent', Date.now().toString()); // Uložíme čas odoslania
            console.log("Overovací e-mail bol úspešne odoslaný.");
        } catch (err) {
            console.error("Chyba pri odosielaní overovacieho e-mailu:", err);
            if (err.code === 'auth/too-many-requests') {
                setError("Príliš veľa požiadaviek. Skúste to znova neskôr.");
            } else {
                setError(`Chyba pri odosielaní e-mailu: ${err.message}. Skúste to znova.`);
            }
        } finally {
            setLoading(false); // Koniec načítania
        }
    };

    const handleGoToLogin = async () => {
        if (auth.currentUser) {
            try {
                await signOut(auth); // Odhlásime používateľa, aby sa mohol znova prihlásiť
            } catch (error) {
                console.error("Chyba pri odhlasovaní:", error);
            }
        }
        navigate('/'); // Presmerujeme na prihlasovaciu stránku
    };

    const handleRefreshStatus = () => {
        // Jednoducho obnovíme stránku, aby sa znova skontroloval stav overenia e-mailu
        // (App.js useEffect to zachytí a presmeruje do lobby, ak je overený)
        window.location.reload();
    };

    return (
        <div className="verification-page-container">
            <div className="verification-card">
                <h2 className="verification-title">Overenie e-mailu</h2>
                <p className="verification-text">
                    Ďakujeme za registráciu! Pre prístup do Lobby je potrebné overiť váš e-mail.
                </p>
                <p className="verification-text">
                    {emailSent
                        ? "Práve sme vám poslali overovací odkaz na vašu e-mailovú adresu. Prosím, skontrolujte si doručenú poštu."
                        : "Prosím, kliknite na tlačidlo nižšie pre odoslanie overovacieho e-mailu."}
                    <br />
                    Nezabudnite skontrolovať aj priečinok <span className="highlight">SPAM/Nevyžiadaná pošta</span>!
                </p>
                <p className="verification-text large-margin">Overenie môže trvať niekoľko minút.</p>

                {error && (
                    <p className="error-message">{error}</p>
                )}

                <button
                    onClick={sendVerificationEmail}
                    disabled={resendCooldown > 0 || loading}
                    className="verification-button button-primary"
                >
                    {loading ? 'Odosielam...' : (resendCooldown > 0 ? `Odoslať znova (${resendCooldown}s)` : 'Odoslať overovací e-mail')}
                </button>

                <button
                    onClick={handleRefreshStatus}
                    className="verification-button button-success"
                >
                    Overil som e-mail (Obnoviť stav)
                </button>

                <button
                    onClick={handleGoToLogin}
                    className="verification-button button-secondary"
                >
                    Ísť na prihlásenie
                </button>
            </div>
        </div>
    );
}

export default EmailVerificationPage;
