// src/hooks/useGameLogic.js
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  drawLetters,
  getPlacedLettersDuringCurrentTurn,
  isStraightLine,
  getAllWordsInTurn,
  // areLettersContiguous, // ODSTRÁNENÉ: Používalo sa pre kontrolu novo položených písmen, ale je príliš reštriktívne pre krížové slová
  isConnected,
  calculateWordScore,
  calculateFinalScores,
  getFullWordLetters,
  arePlacedLettersContiguousOnBoard,
  isWordContiguousOnBoard, // Používame pre kontrolu súvislosti celého slova
} from '../utils/gameLogic';
import { RACK_SIZE } from '../utils/constants';
import { moveLetter as importedMoveLetter } from '../utils/moveLetterLogic';
import { sendPlayerAction } from '../utils/socketHandlers';

function useGameLogic(socket, gameId, myPlayerIndex, slovakWordsArray) {
  const [gameState, setGameState] = useState({
    letterBag: [],
    playerRacks: Array(2).fill(null).map(() => Array(RACK_SIZE).fill(null)),
    board: Array(15).fill(null).map(() => Array(15).fill(null)),
    boardAtStartOfTurn: Array(15).fill(null).map(() => Array(15).fill(null)),
    isFirstTurn: true,
    playerScores: [0, 0],
    currentPlayerIndex: 0,
    exchangeZoneLetters: [],
    hasPlacedOnBoardThisTurn: false,
    hasMovedToExchangeZoneThisTurn: false,
    consecutivePasses: 0,
    isGameOver: false,
    isBagEmpty: false,
    hasInitialGameStateReceived: false,
    highlihtedLetters: [],
  });

  const [showLetterSelectionModal, setShowLetterSelectionModal] = useState(false);
  const [jokerTileCoords, setJokerTileCoords] = useState(null);

  const validWordsSet = useRef(new Set(slovakWordsArray.map(word => word.toUpperCase())));

  // Effect pre aktualizáciu stavu hry zo servera
  useEffect(() => {
    if (!socket) return;
    const handleGameStateUpdate = (newGameState) => {
      console.log('useGameLogic: Received gameStateUpdate:', newGameState);
      console.log('useGameLogic: Received highlightedLetters:', newGameState.highlightedLetters);
      setGameState(newGameState);
    };
    socket.on('gameStateUpdate', handleGameStateUpdate);
    return () => {
      socket.off('gameStateUpdate', handleGameStateUpdate);
    };
  }, [socket]);

  // Memoizovaná funkcia moveLetter
  const moveLetter = useCallback((letterData, source, target) => {
    importedMoveLetter({
      gameState,
      setGameState,
      myPlayerIndex,
      setJokerTileCoords,
      setShowLetterSelectionModal,
      socket,
      gameIdToJoin: gameId,
    })(letterData, source, target);
  }, [gameState, setGameState, myPlayerIndex, setJokerTileCoords, setShowLetterSelectionModal, socket, gameId]);


  const assignLetterToJoker = useCallback((selectedLetter) => {
    if (jokerTileCoords) {
      sendPlayerAction(socket, gameId, 'assignJoker', {
        x: jokerTileCoords.x,
        y: jokerTileCoords.y,
        assignedLetter: selectedLetter,
      });
    }
    setShowLetterSelectionModal(false);
    setJokerTileCoords(null);
  }, [jokerTileCoords, socket, gameId]);

  const confirmTurn = useCallback(() => {
    if (gameState.isGameOver || myPlayerIndex === null || gameState.currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno!");
      return;
    }

    const actualPlacedLetters = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn);

    if (actualPlacedLetters.length === 0) {
      alert("Najprv polož aspoň jedno písmeno na dosku!");
      return;
    }

    if (gameState.hasMovedToExchangeZoneThisTurn) {
      alert("Nemôžeš potvrdiť ťah na doske, ak si už presunul(a) písmeno do výmennej zóny v tomto ťahu!");
      return;
    }

    if (!isStraightLine(actualPlacedLetters)) {
      alert("Písmená musia byť v jednom rade alebo stĺpci!");
      return;
    }

    // ODSTRÁNENÁ KONTROLA: Táto kontrola je príliš reštriktívna pre krížové slová,
    // kde novo položené písmená nemusia byť súvislé medzi sebou, ak sú premostené existujúcimi.
    // if (!areLettersContiguous(actualPlacedLetters)) {
    //     alert("Položené písmená musia tvoriť súvislý blok bez medzier medzi sebou!");
    //     return;
    // }

    // Táto kontrola zabezpečuje, že medzi novo položenými písmenami nie sú prázdne medzery.
    // Ak napr. položíte 'P' a 'S' a medzi nimi je prázdne políčko, bude to neplatné.
    // Táto kontrola je stále dôležitá pre priame umiestnenie viacerých písmen.
    if (actualPlacedLetters.length > 1 && !arePlacedLettersContiguousOnBoard(actualPlacedLetters, gameState.board)) {
        alert("Položené písmená nesmú mať prázdnu medzeru na doske v rámci slova!");
        return;
    }

    const allFormedWords = getAllWordsInTurn(actualPlacedLetters, gameState.board);

    if (allFormedWords.length === 0) {
      alert("Nezistilo sa žiadne platné slovo. Skontroluj umiestnenie.");
      return;
    }

    // KĽÚČOVÁ ZMENA: Používame novú funkciu isWordContiguousOnBoard pre kontrolu súvislosti celého slova.
    // Táto funkcia umožňuje, aby existujúce písmená na doske premostili medzery.
    for (const wordObj of allFormedWords) {
      if (!isWordContiguousOnBoard(wordObj.letters, gameState.board)) {
        alert(`Slovo "${wordObj.wordString}" nie je súvislé (žiadne diery)!`);
        return;
      }
    }

    const mainWordLettersForConnectionCheck = getFullWordLetters(actualPlacedLetters, gameState.board);
    if (!isConnected(actualPlacedLetters, gameState.board, gameState.isFirstTurn, mainWordLettersForConnectionCheck)) {
      if (gameState.isFirstTurn) {
        alert("Prvý ťah musí pokrývať stredové políčko (hviezdičku)!");
      } else {
        alert("Položené písmená sa musia spájať s existujúcimi písmenami na doske (alebo použiť existujúce písmeno ako súčasť slova)!");
      }
      return;
    }

    for (const letter of actualPlacedLetters) {
      if (gameState.boardAtStartOfTurn[letter.x][letter.y] !== null) {
        alert("Nemôžeš položiť písmeno na už obsadené políčko!");
        return;
      }
    }

    if (actualPlacedLetters.length === 1 && allFormedWords[0].wordString.length === 1 && !gameState.isFirstTurn) {
      alert("Musíš vytvoriť slovo spojením s existujúcimi písmenami.");
      return;
    }

    // KĽÚČOVÁ ZMENA: Ak je slovo dlhšie ako 5 písmen, je automaticky platné.
    const invalidWords = allFormedWords.filter(wordObj => {
      const wordString = wordObj.wordString.toUpperCase();
      // Ak je dĺžka slova väčšia ako 5, považujeme ho za platné (nie je neplatné slovníkom)
      if (wordString.length > 5) {
        return false; // Toto slovo NIE JE neplatné podľa slovníka
      }
      // Inak skontrolujeme, či sa slovo nachádza v slovníku
      return !validWordsSet.current.has(wordString);
    });

    if (invalidWords.length > 0) {
      alert(`Neplatné slovo(á) nájdené: ${invalidWords.map(w => w.wordString).join(', ')}. Skontroluj slovník alebo dĺžku slova.`);
      return;
    }

    let turnScore = 0;
    allFormedWords.forEach(wordObj => {
      turnScore += calculateWordScore(wordObj.letters, gameState.boardAtStartOfTurn);
    });

    if (actualPlacedLetters.length === 7) {
      turnScore += 50;
      alert("BINGO! +50 bodov!");
    }

    let newScores = [...gameState.playerScores];
    newScores[gameState.currentPlayerIndex] += turnScore;

    alert(`Ťah je platný! Získal si ${turnScore} bodov. Vytvorené slová: ${allFormedWords.map(w => w.wordString).join(', ')}`);

    const newBoardAtStartOfTurn = gameState.board.map(row => [...row]);

    const numToDraw = actualPlacedLetters.length;
    const { drawnLetters: newLetters, remainingBag: updatedBagAfterTurn, bagEmpty: currentBagEmpty } = drawLetters(gameState.letterBag, numToDraw);

    let tempRack = [...gameState.playerRacks[gameState.currentPlayerIndex]];
    let newRackForCurrentPlayer = [];

    tempRack.forEach(letter => {
      const isLetterPlaced = actualPlacedLetters.some(placed => placed.letterData.id === letter?.id);
      if (letter !== null && !isLetterPlaced) {
        newRackForCurrentPlayer.push(letter);
      }
    });

    newLetters.forEach(letter => {
      if (newRackForCurrentPlayer.length < RACK_SIZE) {
        newRackForCurrentPlayer.push(letter);
      }
    });

    while (newRackForCurrentPlayer.length < RACK_SIZE) {
      newRackForCurrentPlayer.push(null);
    }
    newRackForCurrentPlayer = newRackForCurrentPlayer.slice(0, RACK_SIZE);

    const finalRackAfterPlay = newRackForCurrentPlayer.filter(l => l !== null);
    const newHighlightedLetters = actualPlacedLetters.map(letter => ({ x: letter.x, y: letter.y }));

    let updatedGameState;
    if (currentBagEmpty && finalRackAfterPlay.length === 0) {
      const finalScores = calculateFinalScores(gameState.currentPlayerIndex, newRackForCurrentPlayer, gameState.playerScores, gameState.playerRacks);
      updatedGameState = {
        ...gameState,
        letterBag: updatedBagAfterTurn,
        playerRacks: gameState.playerRacks.map((rack, idx) => idx === gameState.currentPlayerIndex ? newRackForCurrentPlayer : rack),
        board: gameState.board,
        boardAtStartOfTurn: newBoardAtStartOfTurn,
        isFirstTurn: false,
        playerScores: finalScores,
        currentPlayerIndex: gameState.currentPlayerIndex,
        exchangeZoneLetters: [],
        hasPlacedOnBoardThisTurn: false,
        hasMovedToExchangeZoneThisTurn: false,
        consecutivePasses: 0,
        isGameOver: true,
        isBagEmpty: currentBagEmpty,
        highlightedLetters: newHighlightedLetters, // Reset highlighted letters at the end of the game
      };
      alert(`Hra skončila! Konečné skóre: Hráč 1: ${finalScores[0]}, Hráč 2: ${finalScores[1]}`);
    } else {
      updatedGameState = {
        ...gameState,
        letterBag: updatedBagAfterTurn,
        playerRacks: gameState.playerRacks.map((rack, idx) => idx === gameState.currentPlayerIndex ? newRackForCurrentPlayer : rack),
        board: gameState.board,
        boardAtStartOfTurn: newBoardAtStartOfTurn,
        isFirstTurn: false,
        playerScores: newScores,
        currentPlayerIndex: (gameState.currentPlayerIndex === 0 ? 1 : 0),
        exchangeZoneLetters: [],
        hasPlacedOnBoardThisTurn: false,
        hasMovedToExchangeZoneThisTurn: false,
        consecutivePasses: 0,
        isGameOver: false,
        isBagEmpty: currentBagEmpty,
        highlightedLetters: newHighlightedLetters, // Aktualizujeme zvýraznené písmená
      };
    }
    sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
  }, [gameState, myPlayerIndex, socket, gameId, validWordsSet]);

  const handleExchangeLetters = useCallback(() => {
    if (gameState.isGameOver || myPlayerIndex === null || gameState.currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno, aby si mohol(a) vymeniť písmená!");
      return;
    }

    if (gameState.exchangeZoneLetters.length === 0) {
      alert("Najprv presuň písmená do výmennej zóny!");
      return;
    }
    if (gameState.hasPlacedOnBoardThisTurn) {
      alert("Nemôžeš vymeniť písmená, ak si už položil(a) písmeno na dosku v tomto ťahu!");
      return;
    }

    if (gameState.letterBag.length < gameState.exchangeZoneLetters.length) {
      alert(`Vo vrecúšku nie je dostatok písmen na výmenu (potrebných je ${gameState.exchangeZoneLetters.length}, k dispozícii ${gameState.letterBag.length})!`);
      return;
    }

    const numToDraw = gameState.exchangeZoneLetters.length;
    const { drawnLetters: newLettersForRack, remainingBag: bagAfterDraw, bagEmpty: currentBagEmpty } = drawLetters(gameState.letterBag, numToDraw);

    let updatedBag = [...bagAfterDraw, ...gameState.exchangeZoneLetters];

    for (let i = updatedBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [updatedBag[i], updatedBag[j]] = [updatedBag[j], updatedBag[i]];
    }

    let newRack = [...gameState.playerRacks[gameState.currentPlayerIndex]];
    let lettersToKeepInRack = newRack.filter(letter =>
      letter !== null && !gameState.exchangeZoneLetters.some(exchanged => exchanged.id === letter.id)
    );

    newLettersForRack.forEach(newLetter => {
      if (lettersToKeepInRack.length < RACK_SIZE) {
        lettersToKeepInRack.push(newLetter);
      }
    });

    while (lettersToKeepInRack.length < RACK_SIZE) {
      lettersToKeepInRack.push(null);
    }
    newRack = lettersToKeepInRack.slice(0, RACK_SIZE);


    const updatedGameState = {
      ...gameState,
      letterBag: updatedBag,
      playerRacks: gameState.playerRacks.map((rack, idx) => idx === gameState.currentPlayerIndex ? newRack : rack),
      board: gameState.board,
      boardAtStartOfTurn: gameState.boardAtStartOfTurn,
      isFirstTurn: gameState.isFirstTurn,
      playerScores: gameState.playerScores,
      currentPlayerIndex: (gameState.currentPlayerIndex === 0 ? 1 : 0),
      exchangeZoneLetters: [],
      hasPlacedOnBoardThisTurn: false,
      hasMovedToExchangeZoneThisTurn: false,
      consecutivePasses: 0,
      isGameOver: false,
      isBagEmpty: currentBagEmpty,
        highlightedLetters: [], // Vyčistíme zvýraznené písmená pri výmene
    };
    sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
  }, [gameState, myPlayerIndex, socket, gameId]);

  const handlePassTurn = useCallback(() => {
    if (gameState.isGameOver || myPlayerIndex === null || gameState.currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno, aby si mohol(a) prejsť ťah!");
      return;
    }

    if (gameState.hasPlacedOnBoardThisTurn) {
      alert("Nemôžeš prejsť ťah, ak máš položené písmená na doske. Buď ich potvrď, alebo vráť na stojan.");
      return;
    }
    if (gameState.hasMovedToExchangeZoneThisTurn) {
      alert("Nemôžeš prejsť ťah, ak máš písmená vo výmennej zóne. Buď ich vymeň, alebo vráť na stojan.");
      return;
    }

    const newConsecutivePasses = gameState.consecutivePasses + 1;

    let updatedPlayerScores = [...gameState.playerScores];
    let isGameOverCondition = (newConsecutivePasses >= 4);

    if (isGameOverCondition) {
      updatedPlayerScores = calculateFinalScores(null, [], gameState.playerScores, gameState.playerRacks);
      alert("Hra skončila! Obaja hráči pasovali dvakrát po sebe. Konečné skóre bolo upravené o zostávajúce písmená.");
    } else {
      alert("Ťah bol prenesený na ďalšieho hráča.");
    }

    const updatedGameState = {
      ...gameState,
      playerScores: updatedPlayerScores,
      currentPlayerIndex: (gameState.currentPlayerIndex === 0 ? 1 : 0),
      hasPlacedOnBoardThisTurn: false,
      hasMovedToExchangeZoneThisTurn: false,
      consecutivePasses: newConsecutivePasses,
      isGameOver: isGameOverCondition,
      highlightedLetters: [], // Vyčistíme zvýraznené písmená pri prechode ťahu
    };
    sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
  }, [gameState, myPlayerIndex, socket, gameId]);

  return {
    gameState,
    setGameState,
    showLetterSelectionModal,
    setShowLetterSelectionModal,
    jokerTileCoords,
    setJokerTileCoords,
    moveLetter,
    assignLetterToJoker,
    confirmTurn,
    handleExchangeLetters,
    handlePassTurn,
  };
}

export default useGameLogic;
