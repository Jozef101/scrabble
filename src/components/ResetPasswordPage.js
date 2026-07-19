// src/components/ResetPasswordPage.js
import React, { useState, useEffect } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/AuthPage.css';

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

function ResetPasswordPage({ auth }) {
    const navigate = useNavigate();
    const location = useLocation();

    const [status, setStatus] = useState('verifying'); // 'verifying' | 'valid' | 'invalid' | 'success'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const oobCode = new URLSearchParams(location.search).get('oobCode');

    useEffect(() => {
        if (!oobCode) {
            setErrorMessage("Odkaz na reset hesla je neplatný.");
            setStatus('invalid');
            return;
        }

        verifyPasswordResetCode(auth, oobCode)
            .then((verifiedEmail) => {
                setEmail(verifiedEmail);
                setStatus('valid');
            })
            .catch((error) => {
                console.error("Chyba pri overovaní odkazu na reset hesla:", error);
                setErrorMessage("Odkaz na reset hesla je neplatný alebo mu vypršala platnosť. Vyžiadajte si nový.");
                setStatus('invalid');
            });
    }, [auth, oobCode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (password !== confirmPassword) {
            setErrorMessage("Heslá sa nezhodujú.");
            return;
        }

        const passwordRegex = /^(?=.*[A-Z]).{8,}$/;
        if (!passwordRegex.test(password)) {
            setErrorMessage("Heslo musí mať aspoň 8 znakov a obsahovať aspoň jedno veľké písmeno.");
            return;
        }

        try {
            await confirmPasswordReset(auth, oobCode, password);
            setStatus('success');
        } catch (error) {
            console.error("Chyba pri nastavovaní nového hesla:", error);
            let message = "Chyba pri nastavovaní hesla. Skúste to znova.";
            if (error.code === 'auth/expired-action-code' || error.code === 'auth/invalid-action-code') {
                message = "Odkaz na reset hesla je neplatný alebo mu vypršala platnosť. Vyžiadajte si nový.";
                setStatus('invalid');
            } else if (error.code === 'auth/weak-password') {
                message = "Heslo je príliš slabé.";
            }
            setErrorMessage(message);
        }
    };

    if (status === 'verifying') {
        return (
            <div className="auth-container">
                <h2>Overujem odkaz...</h2>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="auth-container">
                <h2>Nepodarilo sa</h2>
                <div className="auth-form">
                    <p className="auth-error-message">{errorMessage}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="auth-button auth-button-primary"
                    >
                        Ísť na prihlásenie
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="auth-container">
                <h2>Heslo bolo zmenené</h2>
                <div className="auth-form">
                    <p className="success-message">Vaše heslo bolo úspešne nastavené. Teraz sa môžete prihlásiť.</p>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="auth-button auth-button-primary"
                    >
                        Ísť na prihlásenie
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <h2>Nastavenie nového hesla</h2>
            <form onSubmit={handleSubmit} className="auth-form">
                <p className="input-description">Nastavujete nové heslo pre {email}</p>
                <div className="auth-form-group">
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="nové heslo"
                            className="auth-input"
                            required
                        />
                        <span className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? EyeOpenIcon : EyeClosedIcon}
                        </span>
                    </div>
                    <p className="input-description">Aspoň 8 znakov a 1 veľké písmeno.</p>
                </div>
                <div className="auth-form-group">
                    <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="zopakuj nové heslo"
                        className="auth-input"
                        required
                    />
                </div>

                {errorMessage && <p className="auth-error-message">{errorMessage}</p>}

                <div className="auth-buttons">
                    <button type="submit" className="auth-button auth-button-primary">
                        Nastaviť nové heslo
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ResetPasswordPage;
