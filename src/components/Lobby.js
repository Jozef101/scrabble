// src/components/Lobby.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Importujeme useNavigate pre programovú navigáciu

const Lobby = ({ socket, setGameId, setPlayerName, setPlayerRole }) => {
  const [inputGameId, setInputGameId] = useState('');
  const [inputPlayerName, setInputPlayerName] = useState('');

  const navigate = useNavigate(); // Hook pre navigáciu

  const handleCreateGame = () => {
    if (inputPlayerName.trim() === '') {
      alert('Prosím, zadajte svoje meno.'); // Použite vlastný modal namiesto alert() v produkcii
      return;
    }
    const newGameId = Math.random().toString(36).substring(2, 9); // Jednoduché generovanie ID
    setGameId(newGameId); // Uložíme ID hry do stavu App
    setPlayerName(inputPlayerName);
    setPlayerRole('host'); // Host je prvý hráč, ktorý vytvorí hru
    socket.emit('createGame', newGameId); // Informujeme server o vytvorení hry
    console.log(`Klient: Vytváram hru s ID: ${newGameId}`);
    navigate(`/game/${newGameId}`); // Navigujeme na URL hry
  };

  const handleJoinGame = () => {
    if (inputGameId.trim() === '' || inputPlayerName.trim() === '') {
      alert('Prosím, zadajte ID hry a svoje meno.'); // Použite vlastný modal namiesto alert() v produkcii
      return;
    }
    setGameId(inputGameId); // Uložíme ID hry do stavu App
    setPlayerName(inputPlayerName);
    setPlayerRole('guest'); // Hosť je druhý hráč, ktorý sa pripojí
    socket.emit('joinGame', inputGameId); // Informujeme server o pripojení k hre
    console.log(`Klient: Pripojujem sa k hre s ID: ${inputGameId}`);
    navigate(`/game/${inputGameId}`); // Navigujeme na URL hry
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Skrebl Lobby</h1>

        <div className="mb-4">
          <label htmlFor="playerName" className="block text-gray-700 text-sm font-bold mb-2">
            Vaše meno:
          </label>
          <input
            type="text"
            id="playerName"
            value={inputPlayerName}
            onChange={(e) => setInputPlayerName(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Zadajte svoje meno"
          />
        </div>

        <div className="mb-6">
          <button
            onClick={handleCreateGame}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full w-full focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105"
          >
            Vytvoriť novú hru
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <hr className="w-full border-gray-300" />
          <span className="px-3 text-gray-500">ALEBO</span>
          <hr className="w-full border-gray-300" />
        </div>

        <div className="mb-4">
          <label htmlFor="gameId" className="block text-gray-700 text-sm font-bold mb-2">
            ID hry:
          </label>
          <input
            type="text"
            id="gameId"
            value={inputGameId}
            onChange={(e) => setInputGameId(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Zadajte ID hry"
          />
        </div>

        <div>
          <button
            onClick={handleJoinGame}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full w-full focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105"
          >
            Pripojiť sa k existujúcej hre
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
