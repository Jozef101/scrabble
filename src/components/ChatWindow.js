// src/components/ChatWindow.jsx
import React, { useRef, useEffect } from 'react';

/**
 * Komponent ChatWindow zobrazuje chatové správy a umožňuje odosielanie nových správ.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {Array<object>} props.chatMessages - Pole chatových správ. Každá správa by mala obsahovať senderIndex a text.
 * @param {string} props.newChatMessage - Aktuálny text novej chatovej správy.
 * @param {number} props.myPlayerIndex - Index aktuálneho používateľa.
 * @param {function} props.handleSendChatMessage - Funkcia na odoslanie chatovej správy.
 * @param {function} props.setNewChatMessage - Funkcia na nastavenie textu novej chatovej správy.
 * @param {object} props.playerNicknames - Objekt s prezývkami hráčov, kde kľúč je playerIndex a hodnota je prezývka.
 */
function ChatWindow({ chatMessages, newChatMessage, myPlayerIndex, handleSendChatMessage, setNewChatMessage, playerNicknames }) {
  const chatMessagesEndRef = useRef(null);

  // Funkcia na automatické scrollovanie nadol, keď prídu nové správy
  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Použi useEffect na scrollovanie pri zmene chatMessages
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  return (
    <div className="chat-container">
      <h3>Chat</h3>
      <div className="chat-messages">
        {chatMessages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.senderIndex === myPlayerIndex ? 'my-message' : 'other-message'}`}>
            {/* KLÚČOVÁ ZMENA: Používame msg.senderNickname, ktoré je posielané zo servera */}
            <strong>{msg.senderNickname || playerNicknames[msg.senderIndex] || `Hráč ${msg.senderIndex + 1}`}:</strong> {msg.text}
          </div>
        ))}
        <div ref={chatMessagesEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={newChatMessage}
          onChange={(e) => setNewChatMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleSendChatMessage();
          }}
          placeholder="Napíš správu..."
          disabled={myPlayerIndex === null}
        />
        <button onClick={handleSendChatMessage} disabled={myPlayerIndex === null}>Odoslať</button>
      </div>
    </div>
  );
}

export default ChatWindow;
