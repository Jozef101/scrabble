import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const AuthPage = ({ auth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(true); // true pre registráciu, false pre prihlásenie
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(auth, email, password);
                console.log("Používateľ úspešne zaregistrovaný!");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                console.log("Používateľ úspešne prihlásený!");
            }
        } catch (err) {
            console.error("Chyba autentifikácie:", err);
            let errorMessage = "Nastala neznáma chyba.";
            switch (err.code) {
                case 'auth/email-already-in-use':
                    errorMessage = "Tento e-mail je už zaregistrovaný.";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Neplatný formát e-mailu.";
                    break;
                case 'auth/weak-password':
                    errorMessage = "Heslo je príliš slabé (min. 6 znakov).";
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    errorMessage = "Nesprávny e-mail alebo heslo.";
                    break;
                case 'auth/missing-password':
                    errorMessage = "Zadajte heslo.";
                    break;
                case 'auth/invalid-credential':
                    errorMessage = "Neplatné prihlasovacie údaje.";
                    break;
                default:
                    errorMessage = `Chyba: ${err.message}`;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4 font-inter">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
                <h1 className="text-4xl font-bold text-gray-800 mb-6">
                    {isRegistering ? 'Registrácia' : 'Prihlásenie'}
                </h1>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <input
                            type="email"
                            placeholder="E-mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Heslo"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? (isRegistering ? 'Registrujem...' : 'Prihlasujem...') : (isRegistering ? 'Zaregistrovať sa' : 'Prihlásiť sa')}
                    </button>
                </form>

                <p className="mt-6 text-gray-600">
                    {isRegistering ? 'Už máte účet?' : 'Nemáte účet?'}
                    <button
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="ml-2 text-purple-600 hover:text-purple-800 font-semibold transition duration-300"
                    >
                        {isRegistering ? 'Prihláste sa' : 'Zaregistrujte sa'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default AuthPage;
