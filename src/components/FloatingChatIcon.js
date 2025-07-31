// src/components/FloatingChatIcon.jsx
import React from 'react';
import '../styles/FloatingChatIcon.css'; // Importujeme nový CSS súbor pre štýlovanie

/**
 * Komponent FloatingChatIcon zobrazuje plávajúcu ikonu chatu s odznakom
 * pre počet neprečítaných správ.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {number} props.unreadCount - Počet neprečítaných správ.
 * @param {function} props.onClick - Funkcia, ktorá sa zavolá po kliknutí na ikonu.
 */
function FloatingChatIcon({ unreadCount, onClick }) {
  // Zobrazíme ikonu len vtedy, ak je počet neprečítaných správ väčší ako 0,
  // alebo ak je ikona vždy viditeľná (môže byť pridaná podmienka pre trvalú viditeľnosť).
  // Pre účely tohto tasku ju zobrazíme vždy, aby bola viditeľná aj bez správ.
  // Ak by mala byť viditeľná len s neprečítanými správami, pridali by sme:
  // if (unreadCount === 0) return null;

  return (
    <div className="floating-chat-icon-container" onClick={onClick}>
      {/* Ikona chatu - môžeme použiť jednoduché SVG alebo emoji */}
      <svg
        className="chat-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
      </svg>

      {/* Odznak s počtom neprečítaných správ */}
      {unreadCount > 0 && (
        <span className="unread-badge">
          {unreadCount}
        </span>
      )}
    </div>
  );
}

export default FloatingChatIcon;
