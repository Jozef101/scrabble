import React, { useState, useEffect } from 'react';
import '../styles/Toast.css';

// Komponent pre jednu "toast" notifikáciu
function Toast({ message, type, onDismiss }) {
  const [visible, setVisible] = useState(false);

  // Po pripojení komponentu ho zviditeľníme a nastavíme časovač na jeho skrytie
  useEffect(() => {
    // Zviditeľnenie s malým oneskorením pre plynulú animáciu
    const showTimeout = setTimeout(() => setVisible(true), 10);
    
    // Časovač na automatické skrytie po 4 sekundách
    const hideTimeout = setTimeout(() => {
      setVisible(false);
      // Po skončení animácie skrytia zavoláme onDismiss, aby sa toast odstránil zo zoznamu
      setTimeout(onDismiss, 400); // 400ms je dĺžka CSS transition
    }, 4000);

    // Vyčistenie časovačov pri odpojení komponentu
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [onDismiss]);

  // Vyberieme ikonu a farbu podľa typu notifikácie
  const icons = {
    success: '✓',
    error: '!',
    info: 'ℹ',
  };
  const icon = icons[type] || icons.info;

  return (
    <div 
      className={`toast ${type} ${visible ? 'visible' : ''}`}
      onClick={() => { // Umožníme zatvorenie kliknutím
        setVisible(false);
        setTimeout(onDismiss, 400);
      }}
    >
      <div className="toast-icon">{icon}</div>
      <div className="toast-message">{message}</div>
    </div>
  );
}

// Komponent, ktorý bude obsahovať všetky aktívne notifikácie
export function ToastContainer({ toasts, dismissToast }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}
