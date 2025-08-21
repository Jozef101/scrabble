// src/components/ConfirmationModal.js
import React from 'react';

// Komponent prijíma stav viditeľnosti, správu a funkcie pre potvrdenie/zrušenie
function ConfirmationModal({ isOpen, message, onConfirm, onCancel }) {
  // Ak nie je otvorený, nič nevykresľujeme
  if (!isOpen) {
    return null;
  }

  return (
    // "Overlay" je polopriehľadné pozadie za dialógom
    <div className="confirmation-modal-overlay" onClick={onCancel}>
      {/* Samotný dialóg, kliknutie naň nezatvorí okno */}
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="confirmation-modal-buttons">
          <button onClick={onConfirm} className="confirm-button">
            Áno
          </button>
          <button onClick={onCancel} className="cancel-button">
            Nie
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;