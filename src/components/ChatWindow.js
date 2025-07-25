// src/components/ChatWindow.jsx
import React, { useRef, useEffect } from 'react';

function ChatWindow({ chatMessages, newChatMessage, myPlayerIndex, handleSendChatMessage, setNewChatMessage }) {
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
            <strong>Hráč {msg.senderIndex + 1}:</strong> {msg.text}
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