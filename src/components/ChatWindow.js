// src/components/ChatWindow.jsx
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import '../styles/ChatWindow.css'; // Pridaný import pre CSS súbor

/**
 * Komponent ChatWindow zobrazuje chatové správy a umožňuje odosielanie nových správ.
 * Tento komponent je teraz obalený v `forwardRef`, aby mohol prijímať referenciu
 * a sprístupňovať metódy pre rodičovský komponent.
 *
 * @param {object} props - Vlastnosti komponentu.
 * @param {Array<object>} props.chatMessages - Pole chatových správ. Každá správa by mala obsahovať senderIndex a text.
 * @param {string} props.newChatMessage - Aktuálny text novej chatovej správy.
 * @param {number} props.myPlayerIndex - Index aktuálneho používateľa.
 * @param {function} props.handleSendChatMessage - Funkcia na odoslanie chatovej správy.
 * @param {function} props.setNewChatMessage - Funkcia na nastavenie textu novej chatovej správy.
 * @param {object} props.playerNicknames - Objekt s prezývkami hráčov, kde kľúč je playerIndex a hodnota je prezývka.
 * @param {function} [props.onScrollStateChange] - Callback volaný, keď sa stav posúvania zmení (napr. používateľ posunie na koniec).
 * @param {function} [props.onCloseChat] - Callback volaný po kliknutí na tlačidlo zatvorenia chatu.
 */
const ChatWindow = forwardRef(({ chatMessages, newChatMessage, myPlayerIndex, handleSendChatMessage, setNewChatMessage, playerNicknames, onScrollStateChange, onCloseChat }, ref) => {
  // Ref pre kontajner správ chatu (nie pre prázdny div na konci),
  // pretože potrebujeme pristupovať k jeho scroll vlastnostiam.
  const chatMessagesContainerRef = useRef(null);

  // Používame useImperativeHandle na sprístupnenie metód rodičovskému komponentu (GamePage).
  useImperativeHandle(ref, () => ({
    /**
     * Skontroluje, či je chatové okno posunuté úplne dole.
     * @returns {boolean} True, ak je chat posunutý dole, inak false.
     */
    isScrolledToBottom: () => {
      const element = chatMessagesContainerRef.current;
      if (element) {
        // Tolerancia pre posúvanie, aby sa predišlo problémom s floatmi alebo zaokrúhľovaním.
        const tolerance = 1;
        return element.scrollHeight - element.scrollTop <= element.clientHeight + tolerance;
      }
      return false;
    },
    /**
     * Posunie chatové okno úplne dole s plynulou animáciou.
     */
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

  // Efekt na počiatočné posúvanie pri mountovaní komponentu.
  // Zabezpečí, že pri prvom zobrazení chatu budú viditeľné najnovšie správy.
  useEffect(() => {
    if (chatMessagesContainerRef.current) {
      // Použijeme 'auto' pre okamžité posunutie pri načítaní, aby sa predišlo prázdnemu priestoru.
      chatMessagesContainerRef.current.scrollTo({
        top: chatMessagesContainerRef.current.scrollHeight,
        behavior: 'auto'
      });
      // Po počiatočnom posunutí resetujeme počet neprečítaných správ v rodičovskom komponente.
      if (onScrollStateChange) {
        onScrollStateChange();
      }
    }
  }, []); // Prázdne pole závislostí zabezpečí, že sa spustí len raz pri mountovaní.

  // Handler pre udalosť posúvania (scroll) na kontajneri správ.
  const handleScroll = () => {
    // Ak je definovaný callback onScrollStateChange a ref je pripojený.
    if (onScrollStateChange && chatMessagesContainerRef.current) {
      // Skontrolujeme, či používateľ posunul chat úplne dole.
      // Používame rovnakú toleranciu ako v isScrolledToBottom.
      const tolerance = 1;
      if (chatMessagesContainerRef.current.scrollHeight - chatMessagesContainerRef.current.scrollTop <= chatMessagesContainerRef.current.clientHeight + tolerance) {
        // Ak áno, zavoláme callback na resetovanie počtu neprečítaných správ v rodičovskom komponente.
        onScrollStateChange();
      }
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header-row">
        <h3>Chat</h3>
        {onCloseChat && (
          <button onClick={onCloseChat} className="close-chat-button">
            {/* Jednoduchá ikona X pre zatvorenie */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="close-chat-icon">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>
      {/* Priradenie ref k scrollable divu a pridanie onScroll event listenera */}
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
        {/* Upravené tlačidlo s ikonou */}
        <button onClick={handleSendChatMessage} disabled={myPlayerIndex === null} className="send-chat-button">
          {/* Ikonka papierového lietadla (SVG) */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="send-chat-icon">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

export default ChatWindow;
