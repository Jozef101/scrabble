import React from 'react';
import '../styles/LetterSelectionModal.css';

function LetterSelectionModal({ onSelectLetter, onClose }) {
  // Abeceda pre výber písmen
  const alphabet = 'AÁÄBCČDĎEÉFGHIÍJKLĹĽMNŇOÓÔPRŔSŠTŤUÚVXYÝZŽ'.split('');

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Vyber písmeno pre žolíka</h2>
        <div className="alphabet-grid">
          {alphabet.map(letter => (
            <button
              key={letter}
              className="alphabet-button"
              onClick={() => onSelectLetter(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
        <button className="modal-close-button" onClick={onClose}>Zavrieť</button>
      </div>
    </div>
  );
}

export default LetterSelectionModal;
