// src/hooks/useSocketConnection.js
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SERVER_URL } from '../utils/constants';
import { setupSocketListeners } from '../utils/socketHandlers';

function useSocketConnection(gameId, userId) {
  const [socket, setSocket] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Nepripojený');
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [waitingForSecondPlayer, setWaitingForSecondPlayer] = useState(true);

  const hasJoinedGameRef = useRef(false);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    const handleConnect = () => {
      setConnectionStatus('Pripojený');
      console.log('useSocketConnection: Socket connected. Now checking userId and gameId to emit joinGame.');
      if (userId && gameId && !hasJoinedGameRef.current) {
        console.log(`useSocketConnection: Emitting joinGame for ID: ${gameId}, User ID: ${userId}`);
        newSocket.emit('joinGame', { gameId: gameId, userId: userId });
        hasJoinedGameRef.current = true;
      } else if (!userId) {
        console.warn('useSocketConnection: Socket connected, but userId is not available yet. Cannot emit joinGame.');
      }
    };

    newSocket.on('connect', handleConnect);

    newSocket.on('disconnect', () => {
      setConnectionStatus('Odpojený');
      console.log('useSocketConnection: Odpojený od servera Socket.IO.');
      // Reset relevant states on disconnect
      setMyPlayerIndex(null);
    //   setChatMessages([]);
      hasJoinedGameRef.current = false;
      setWaitingForSecondPlayer(true);
    });

    // setupSocketListeners je teraz primárne pre nastavenie všetkých poslucháčov
    // vrátane prijímania správ chatu a aktualizácie stavu hry.
    setupSocketListeners(
      newSocket,
      setConnectionStatus,
      setMyPlayerIndex,
      // Pass a no-op function for setGameState here, as it's handled by useGameLogic
      () => {},
      setChatMessages, // setChatMessages sa odovzdáva sem, aby ho setupSocketListeners mohol použiť
      setWaitingForSecondPlayer
    );

    newSocket.on('gameReset', (message) => {
      alert(message);
      // Reset states relevant to game start
      setMyPlayerIndex(null);
      hasJoinedGameRef.current = false;
      setWaitingForSecondPlayer(true);
    });

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect');
      newSocket.off('gameReset');
      newSocket.off('waitingForPlayers');
      newSocket.off('gameStarted');
      newSocket.disconnect();
      hasJoinedGameRef.current = false;
    };
  }, [gameId, userId]);

  // ODSTRÁNENÝ DUPLICITNÝ useEffect PRE CHAT MESSAGES
  // Logika prijímania správ chatu je teraz plne spravovaná funkciou setupSocketListeners
  // v súbore src/utils/socketHandlers.js.
  // useEffect(() => {
  //   if (!socket) return;
  //   const handleReceiveChatMessage = (message) => {
  //     setChatMessages((prevMessages) => [...prevMessages, message]);
  //   };
  //   socket.on('receiveChatMessage', handleReceiveChatMessage);
  //   return () => {
  //     socket.off('receiveChatMessage', handleReceiveChatMessage);
  //   };
  // }, [socket]);


  return {
    socket,
    myPlayerIndex,
    connectionStatus,
    chatMessages,
    setChatMessages,
    newChatMessage,
    setNewChatMessage,
    waitingForSecondPlayer,
  };
}

export default useSocketConnection;
