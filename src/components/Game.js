// src/components/Game.jsx
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Importujeme useParams pre získanie parametrov z URL

const Game = ({ socket, gameId, setGameId, playerName, playerRole, waitingForSecondPlayer, setWaitingForSecondPlayer, opponentName, setOpponentName, setPlayerTurn, playerTurn, board, setBoard, currentWord, setCurrentWord, score, setScore, playerLetters, setPlayerLetters, isDragging, setIsDragging, draggedLetter, setDraggedLetter, dragStartPos, setDragStartPos, dragCurrentPos, setDragCurrentPos, message, setMessage, showMessage, setShowMessage, handleDragStart, handleDrag, handleDragEnd, handleDrop, handlePlaceLetter, handleRemoveLetter, handleSubmitWord, handleSkipTurn, handleExchangeLetters, handleShuffleLetters }) => {
  const { gameId: urlGameId } = useParams(); // Získame gameId z URL

  // Ak sa gameId v stave App líši od gameId v URL, aktualizujeme stav
  // Toto je dôležité pre priame načítanie URL hry
  useEffect(() => {
    if (urlGameId && urlGameId !== gameId) {
      setGameId(urlGameId);
      // Pri priamom načítaní URL hry sa musíme pokúsiť pripojiť k hre
      // Ak nemáme meno hráča v stave (napr. pri prvom načítaní),
      // mali by sme presmerovať na lobby alebo požiadať o meno.
      // Pre zjednodušenie to zatiaľ nebudeme riešiť, predpokladáme, že meno je nastavené.
      // V reálnej aplikácii by ste tu mohli použiť localStorage pre meno.
      if (playerName) { // Ak už máme meno hráča (napr. z predchádzajúcej session)
        socket.emit('joinGame', urlGameId);
        console.log(`Klient: Pripojujem sa k hre z URL s ID: ${urlGameId}`);
      } else {
        // Ak nemáme meno hráča, presmerujeme na lobby
        // navigate('/'); // Potrebovali by sme tu importovať useNavigate a použiť ho
        console.log("Klient: Meno hráča nie je nastavené, presmerovanie na lobby by bolo vhodné.");
        // Pre účely tohto príkladu to necháme tak, ale v produkcii by to bola chyba.
      }
    }
  }, [urlGameId, gameId, setGameId, playerName, socket]);

  // Zvyšok vášho existujúceho herného UI a logiky
  // Predpokladám, že tu máte celý kód pre zobrazenie hracej plochy, písmen, tlačidiel atď.
  // Tento kód by mal byť presunutý z App.js sem.

  if (!gameId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Chyba: ID hry chýba.</h2>
          <p className="text-gray-600">Prosím, vráťte sa do lobby a vytvorte alebo sa pripojte k hre.</p>
          {/* Tu by ste mohli pridať tlačidlo na návrat do lobby */}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      {/* Tu sa bude nachádzať celý váš herný UI */}
      <h1 className="text-4xl font-extrabold text-indigo-700 mb-6">Skrebl Hra</h1>
      <div className="text-lg font-semibold text-gray-700 mb-4">
        ID Hry: <span className="text-indigo-600">{gameId}</span>
      </div>
      <div className="text-lg font-semibold text-gray-700 mb-4">
        Vaše meno: <span className="text-indigo-600">{playerName}</span>
      </div>
      {playerRole && (
        <div className="text-lg font-semibold text-gray-700 mb-4">
          Vaša rola: <span className="text-indigo-600">{playerRole === 'host' ? 'Hostiteľ' : 'Hosť'}</span>
        </div>
      )}

      {waitingForSecondPlayer && (
        <div className="text-xl text-red-600 font-bold mb-4 animate-pulse">
          Čaká sa na druhého hráča...
        </div>
      )}

      {!waitingForSecondPlayer && opponentName && (
        <div className="text-xl text-green-600 font-bold mb-4">
          Hra začala! Hráte proti: {opponentName}
        </div>
      )}

      {!waitingForSecondPlayer && (
        <>
          <div className="text-xl font-bold mb-4">
            {playerTurn === socket.id ? (
              <span className="text-green-700">Je váš ťah!</span>
            ) : (
              <span className="text-red-700">Čakáte na ťah súpera.</span>
            )}
          </div>

          {/* Zobrazenie hracej plochy */}
          <div className="grid grid-cols-15 gap-0.5 bg-gray-300 p-1 rounded-lg shadow-inner">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`w-8 h-8 flex items-center justify-center border border-gray-400 text-xs font-bold ${
                      cell.special === 'TW' ? 'bg-red-300' :
                      cell.special === 'DW' ? 'bg-pink-300' :
                      cell.special === 'TL' ? 'bg-blue-300' :
                      cell.special === 'DL' ? 'bg-green-300' :
                      cell.special === 'STAR' ? 'bg-yellow-300' :
                      'bg-gray-200'
                    }`}
                    onDragOver={(e) => e.preventDefault()} // Umožňuje drop
                    onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                  >
                    {cell.letter ? (
                      <div
                        className="bg-yellow-200 border border-yellow-500 rounded-sm w-7 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => handleDragStart(e, cell.letter, rowIndex, colIndex)}
                      >
                        {cell.letter.char}
                        {cell.letter.value > 0 && <span className="text-xs ml-0.5">{cell.letter.value}</span>}
                      </div>
                    ) : (
                      cell.special && <span className="text-[0.6rem] text-gray-600">{cell.special}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Zobrazenie písmen hráča */}
          <div className="flex justify-center mt-6 p-4 bg-gray-200 rounded-lg shadow-md">
            {playerLetters.map((letter, index) => (
              <div
                key={index}
                className="bg-purple-200 border border-purple-500 rounded-md w-10 h-10 flex items-center justify-center text-lg font-bold mx-1 cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={(e) => handleDragStart(e, letter, 'rack', index)}
              >
                {letter.char}
                {letter.value > 0 && <span className="text-sm ml-0.5">{letter.value}</span>}
              </div>
            ))}
          </div>

          {/* Tlačidlá akcií */}
          <div className="mt-6 flex space-x-4">
            <button
              onClick={handleSubmitWord}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Potvrdiť slovo
            </button>
            <button
              onClick={handleRemoveLetter}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Odstrániť písmeno
            </button>
            <button
              onClick={handleSkipTurn}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Preskočiť ťah
            </button>
            <button
              onClick={handleExchangeLetters}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Vymeniť písmená
            </button>
            <button
              onClick={handleShuffleLetters}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Zamiešať písmená
            </button>
          </div>

          {/* Správy a skóre */}
          {showMessage && (
            <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg shadow-md">
              {message}
            </div>
          )}

          <div className="mt-6 text-2xl font-bold text-gray-800">
            Skóre: <span className="text-green-600">{score}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default Game;
