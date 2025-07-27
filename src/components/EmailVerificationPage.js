// src/components/EmailVerificationPage.js
import React, { useState, useEffect } from 'react';
import { sendEmailVerification, reload } from 'firebase/auth'; // Importujeme funkcie z Firebase Auth

const EmailVerificationPage = ({ auth, userId }) => {
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0); // Časovač pre opätovné odoslanie

    // Efekt pre nastavenie časovača opätovného odoslania
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Funkcia na odoslanie overovacieho e-mailu
    const handleSendVerificationEmail = async () => {
        const user = auth.currentUser;
        if (user) {
            setIsLoading(true);
            setMessage('');
            try {
                await sendEmailVerification(user);
                setMessage('Overovací e-mail bol odoslaný. Skontrolujte si doručenú poštu (aj priečinok SPAM).');
                setResendCooldown(60); // Nastavíme 60-sekundový cooldown
                console.log('Overovací e-mail odoslaný pre:', user.email);
            } catch (error) {
                console.error('Chyba pri odosielaní overovacieho e-mailu:', error);
                setMessage(`Chyba pri odosielaní e-mailu: ${error.message}. Skúste to znova.`);
            } finally {
                setIsLoading(false);
            }
        } else {
            setMessage('Používateľ nie je prihlásený. Prosím, prihláste sa.');
        }
    };

    // Funkcia na kontrolu stavu overenia
    const handleCheckVerificationStatus = async () => {
        const user = auth.currentUser;
        if (user) {
            setIsLoading(true);
            setMessage('Kontrolujem stav overenia...');
            try {
                // Toto vynúti obnovenie stavu používateľa z Firebase
                await reload(user);
                // Po opätovnom načítaní sa `onAuthStateChanged` v App.js znova spustí
                // a ak je e-mail overený, presmeruje používateľa.
                if (user.emailVerified) {
                    setMessage('Váš e-mail je overený! Presmerovávam vás do Lobby...');
                    // App.js by mal automaticky presmerovať, ale pre istotu
                    // môžete tu pridať aj navigate('/lobby'); ak by ste chceli
                    // priame presmerovanie, ale App.js je lepšie miesto pre to.
                } else {
                    setMessage('E-mail ešte nie je overený. Prosím, skontrolujte si e-mail a kliknite na odkaz.');
                }
            } catch (error) {
                console.error('Chyba pri kontrole stavu overenia:', error);
                setMessage(`Chyba pri kontrole stavu: ${error.message}.`);
            } finally {
                setIsLoading(false);
            }
        } else {
            setMessage('Používateľ nie je prihlásený. Prosím, prihláste sa.');
        }
    };

    // Automatické odoslanie verifikačného e-mailu pri prvom načítaní stránky
    // Len ak používateľ existuje a e-mail nie je overený
    useEffect(() => {
        const user = auth.currentUser;
        if (user && !user.emailVerified) {
            console.log("Automaticky odosielam overovací e-mail pri načítaní stránky.");
            handleSendVerificationEmail();
        }
    }, [auth]); // Spustí sa len raz pri mountovaní komponentu

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-inter">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Overenie e-mailu</h2>
                <p className="text-gray-700 mb-4">
                    Ďakujeme za registráciu! Pre prístup do Lobby je potrebné overiť váš e-mail.
                </p>
                <p className="text-gray-700 mb-6">
                    Práve sme vám poslali overovací odkaz na vašu e-mailovú adresu.
                    Prosím, skontrolujte si doručenú poštu.
                    <br />
                    <span className="font-semibold text-red-600">Nezabudnite skontrolovať aj priečinok SPAM/Nevyžiadaná pošta!</span>
                    <br />
                    Overenie môže trvať niekoľko minút.
                </p>

                {message && (
                    <p className={`mt-4 mb-4 p-3 rounded-md ${message.includes('Chyba') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </p>
                )}

                <div className="flex flex-col space-y-4">
                    <button
                        onClick={handleSendVerificationEmail}
                        disabled={isLoading || resendCooldown > 0}
                        className={`w-full py-3 px-6 rounded-md text-white font-semibold transition duration-300 ease-in-out
                            ${isLoading || resendCooldown > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75'}`}
                    >
                        {isLoading ? 'Odosielam...' : resendCooldown > 0 ? `Znova odoslať za ${resendCooldown}s` : 'Znova odoslať overovací e-mail'}
                    </button>
                    <button
                        onClick={handleCheckVerificationStatus}
                        disabled={isLoading}
                        className={`w-full py-3 px-6 rounded-md text-blue-600 border border-blue-600 font-semibold transition duration-300 ease-in-out
                            ${isLoading ? 'bg-gray-200 cursor-not-allowed' : 'hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75'}`}
                    >
                        {isLoading ? 'Kontrolujem...' : 'Už som overil(a) e-mail (skontrolovať stav)'}
                    </button>
                </div>

                <p className="text-sm text-gray-500 mt-6">
                    Váš ID používateľa: <span className="font-mono text-gray-700">{userId || 'Neznámy'}</span>
                </p>
            </div>
        </div>
    );
};

export default EmailVerificationPage;
