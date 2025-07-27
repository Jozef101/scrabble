// src/hooks/useSocketConnection.js
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SERVER_URL } from '../utils/constants'; // Uistite sa, že SERVER_URL je správne nastavená, napr. 'http://localhost:3001'
import { setupSocketListeners } from '../utils/socketHandlers';

function useSocketConnection(gameId, userId, setGameState) {
  const [socket, setSocket] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Pripájam sa...');
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [waitingForSecondPlayer, setWaitingForSecondPlayer] = useState(true); // Predvolene čakáme

  const hasJoinedGameRef = useRef(false); // Používame ref na zabránenie duplicitného joinGame

  useEffect(() => {
    // Ak už socket existuje a je pripojený, alebo ak chýba gameId/userId, nič nerobíme
    if (socket && socket.connected) {
      return;
    }
    if (!gameId || !userId) {
      console.warn('useSocketConnection: Chýba gameId alebo userId, preskakujem pripojenie.');
      setConnectionStatus('Chyba: Chýba ID hry/používateľa');
      return;
    }

    console.log(`useSocketConnection: Inicializujem socket pre gameId: ${gameId}, userId: ${userId}`);
    const newSocket = io(SERVER_URL, {
      query: { gameId, userId },
      transports: ['websocket', 'polling'] // Zabezpečíme fallback na polling
    });

    setSocket(newSocket); // Nastavíme socket do stavu

    // Nastavenie všetkých poslucháčov cez setupSocketListeners
    // Uistite sa, že poradie argumentov je správne podľa setupSocketListeners
    setupSocketListeners(
      newSocket,
      setConnectionStatus,
      setMyPlayerIndex,
      setGameState, // Toto je setGameState z GamePage
      setChatMessages,
      setWaitingForSecondPlayer
    );

    // Pripojenie k hre po úspešnom pripojení socketu
    newSocket.on('connect', () => {
      console.log('useSocketConnection: Socket pripojený.');
      setConnectionStatus('Pripojený');
      if (userId && gameId && !hasJoinedGameRef.current) {
        console.log(`useSocketConnection: Emitting joinGame pre ID: ${gameId}, User ID: ${userId}`);
        newSocket.emit('joinGame', { gameId: gameId, userId: userId });
        hasJoinedGameRef.current = true;
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('useSocketConnection: Socket odpojený, dôvod:', reason);
      setConnectionStatus('Odpojený');
      setMyPlayerIndex(null);
      hasJoinedGameRef.current = false; // Resetujeme pri odpojení
      setWaitingForSecondPlayer(true); // Predpokladáme čakanie po odpojení
    });

    newSocket.on('connect_error', (error) => {
      console.error('useSocketConnection: Chyba pripojenia socketu:', error);
      setConnectionStatus(`Chyba pripojenia: ${error.message}`);
      setMyPlayerIndex(null);
      hasJoinedGameRef.current = false;
      setWaitingForSecondPlayer(true);
    });

    // Clean-up funkcia pri unmountovaní komponentu alebo zmene závislostí
    return () => {
      console.log('useSocketConnection: Čistím socket pripojenie...');
      newSocket.offAny(); // Odstránime všetky poslucháče
      newSocket.disconnect();
      setSocket(null); // Resetujeme stav socketu
      hasJoinedGameRef.current = false; // Resetujeme ref
    };
  }, [gameId, userId, setGameState]); // Závislosti: gameId, userId, setGameState

  return {
    socket,
    myPlayerIndex,
    connectionStatus,
    chatMessages,
    newChatMessage,
    setNewChatMessage,
    waitingForSecondPlayer,
  };
}

export default useSocketConnection;
