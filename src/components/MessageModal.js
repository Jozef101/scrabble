// src/components/MessageModal.js
import React from 'react';

const MessageModal = ({ title, message, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onClose}>Zavrieť</button>
      </div>
    </div>
  );
};

export default MessageModal;
