// src/components/UserMenuIcon.js
import React, { useState } from 'react';
import { signOut } from 'firebase/auth'; // Import signOut funkcie
import { useNavigate } from 'react-router-dom'; // Pre navigáciu na profil (neskôr)
import '../styles/UserMenuIcon.css'; // Import nového CSS súboru pre UserMenuIcon

/**
 * Komponent pre ikonu používateľa s rozbaľovacím menu.
 * Zobrazuje možnosť odhlásenia a (neskôr) prechodu na profil.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.userId - ID aktuálneho používateľa.
 * @param {object} props.auth - Firebase Auth inštancia.
 */
function UserMenuIcon({ userId, auth }) {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const navigate = useNavigate(); // Hook pre navigáciu

    // Funkcia pre odhlásenie používateľa
    const handleLogout = async () => {
        try {
            await signOut(auth); // Volanie funkcie odhlásenia z Firebase Auth
            console.log("Používateľ bol úspešne odhlásený.");
            // App.js sa postará o presmerovanie na prihlasovaciu stránku
        } catch (e) {
            console.error("Chyba pri odhlasovaní: ", e);
            // Tu by ste mohli zobraziť správu používateľovi pomocou vlastného MessageDisplay komponentu
            console.log("Nepodarilo sa odhlásiť. Skúste to prosím znova.");
        }
    };

    // Funkcia pre prepínanie viditeľnosti užívateľského menu
    const toggleUserMenu = () => {
        setShowUserMenu(!showUserMenu);
    };

    // Funkcia pre navigáciu na profil (placeholder)
    const handleGoToProfile = () => {
        // Tu by ste neskôr mohli navigovať na stránku profilu
        // navigate('/profile'); // Napríklad
        console.log("Funkcia profilu zatiaľ nie je implementovaná.");
        setShowUserMenu(false); // Zatvoriť menu po kliknutí
    };

    return (
        <div className="user-icon-container">
            <button className="user-icon-button" onClick={toggleUserMenu}>
                {/* SVG ikona používateľa */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-user">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </button>
            {showUserMenu && (
                <div className="user-menu-dropdown"> {/* ZMENA: Používame user-menu-dropdown */}
                    <button onClick={handleGoToProfile}>Profil</button>
                    <button onClick={handleLogout}>Odhlásiť sa</button>
                </div>
            )}
        </div>
    );
}

export default UserMenuIcon;
