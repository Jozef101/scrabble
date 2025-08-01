// src/components/ChatWindow.jsx
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import '../styles/ChatWindow.css';

const ChatWindow = forwardRef(({ chatMessages, newChatMessage, myPlayerIndex, handleSendChatMessage, setNewChatMessage, playerNicknames, onScrollStateChange, onCloseChat }, ref) => {
  const chatMessagesContainerRef = useRef(null);
  const isUserScrolledToBottom = useRef(true);

  useImperativeHandle(ref, () => ({
    isScrolledToBottom: () => {
      const element = chatMessagesContainerRef.current;
      if (element) {
        const tolerance = 1;
        return element.scrollHeight - element.scrollTop <= element.clientHeight + tolerance;
      }
      return false;
    },
    scrollToBottom: () => {
      const element = chatMessagesContainerRef.current;
      if (element) {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }));

  // Nový useEffect na posúvanie pri prvom načítaní a pri nových správach
  useEffect(() => {
    const element = chatMessagesContainerRef.current;
    if (element) {
      // Ak je to prvé načítanie alebo ak je používateľ na konci, posunieme chat dole
      if (isUserScrolledToBottom.current) {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [chatMessages]);

  // Efekt na počiatočné posunutie pri prvom vykreslení, bez animácie
  // Spustí sa len raz pri prvej inicializácii komponentu.
  useEffect(() => {
    const element = chatMessagesContainerRef.current;
    if (element) {
      // Okamžité posunutie na koniec bez animácie ('auto')
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'auto'
      });
      // Ak je definovaný callback, zavoláme ho na resetovanie neprečítaných správ
      if (onScrollStateChange) {
        onScrollStateChange();
      }
    }
  }, []); // Prázdne pole závislostí zabezpečí, že sa spustí len raz

  const handleScroll = () => {
    const element = chatMessagesContainerRef.current;
    if (element) {
      const tolerance = 1;
      isUserScrolledToBottom.current = element.scrollHeight - element.scrollTop <= element.clientHeight + tolerance;
      if (isUserScrolledToBottom.current && onScrollStateChange) {
        onScrollStateChange();
      }
    }
  };

  // ... (zvyšok komponentu ostáva rovnaký)
  return (
    <div className="chat-container">
      <div className="chat-header-row">
        <h3>Chat</h3>
        {onCloseChat && (
          <button onClick={onCloseChat} className="close-chat-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="close-chat-icon">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>
      <div className="chat-messages" ref={chatMessagesContainerRef} onScroll={handleScroll}>
        {chatMessages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.senderIndex === myPlayerIndex ? 'my-message' : 'other-message'}`}>
            <strong>{msg.senderNickname || playerNicknames[msg.senderIndex] || `Hráč ${msg.senderIndex + 1}`}:</strong> {msg.text}
          </div>
        ))}
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
        <button onClick={handleSendChatMessage} disabled={myPlayerIndex === null} className="send-chat-button">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="send-chat-icon">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

export default ChatWindow;