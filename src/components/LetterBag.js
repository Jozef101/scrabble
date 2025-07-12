import React from 'react';
import '../styles/LetterBag.css'; // Pre štýlovanie vrecúška

function LetterBag({ remainingLettersCount }) {
  return (
    <div className="letter-bag-container">
      <div className="letter-bag-icon">
        {/* Môže to byť jednoduchý text alebo ikonka */}
        🎒
      </div>
      <div className="letter-bag-count">
        Písmen vo vrecúšku: {remainingLettersCount}
      </div>
    </div>
  );
}

export default LetterBag;