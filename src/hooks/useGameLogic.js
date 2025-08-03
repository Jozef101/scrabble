// src/hooks/useGameLogic.js
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  drawLetters,
  getPlacedLettersDuringCurrentTurn,
  isStraightLine,
  getAllWordsInTurn,
  isConnected,
  calculateWordScore,
  calculateFinalScores,
  getFullWordLetters,
  arePlacedLettersContiguousOnBoard,
  isWordContiguousOnBoard,
} from '../utils/gameLogic';
import { RACK_SIZE } from '../utils/constants';
import { moveLetter as importedMoveLetter } from '../utils/moveLetterLogic';
import { sendPlayerAction } from '../utils/socketHandlers';

function useGameLogic(socket, gameId, myPlayerIndex, slovakWordsArray, gameState, setGameState) {

  const [showLetterSelectionModal, setShowLetterSelectionModal] = useState(false);
  const [jokerTileCoords, setJokerTileCoords] = useState(null);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const validWordsSet = useRef(new Set(slovakWordsArray.map(word => word.toUpperCase())));

  useEffect(() => {
    if (!socket) return;
    const handleGameStateUpdate = (newGameState) => {
      console.log('useGameLogic: Received gameStateUpdate:', newGameState);
      console.log('useGameLogic: Received highlightedLetters:', newGameState.highlightedLetters);
      setGameState(newGameState);
      setIsActionInProgress(false);
    };
    socket.on('gameStateUpdate', handleGameStateUpdate);
    return () => {
      socket.off('gameStateUpdate', handleGameStateUpdate);
    };
  }, [socket, setGameState]);

  const moveLetter = useCallback((letterData, source, target) => {
    if (isActionInProgress) {
      console.log("Akcia už prebieha, počkajte prosím.");
      return;
    }
    setIsActionInProgress(true);
    importedMoveLetter({
      gameState,
      setGameState,
      myPlayerIndex,
      setJokerTileCoords,
      setShowLetterSelectionModal,
      socket,
      gameIdToJoin: gameId,
    })(letterData, source, target);
  }, [gameState, setGameState, myPlayerIndex, setJokerTileCoords, setShowLetterSelectionModal, socket, gameId, isActionInProgress]);

  const assignLetterToJoker = useCallback((selectedLetter) => {
    if (isActionInProgress) {
      console.log("Akcia už prebieha, počkajte prosím.");
      return;
    }
    setIsActionInProgress(true);
    if (jokerTileCoords) {
      sendPlayerAction(socket, gameId, 'assignJoker', {
        x: jokerTileCoords.x,
        y: jokerTileCoords.y,
        assignedLetter: selectedLetter,
      });
    }
    setShowLetterSelectionModal(false);
    setJokerTileCoords(null);
  }, [jokerTileCoords, socket, gameId, isActionInProgress]);

  const confirmTurn = useCallback(() => {
    if (isActionInProgress) {
      console.log("Akcia už prebieha, počkajte prosím.");
      return;
    }
    setIsActionInProgress(true);

    if (gameState.isGameOver || myPlayerIndex === null || gameState.currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      setIsActionInProgress(false);
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno!");
      setIsActionInProgress(false);
      return;
    }

    const actualPlacedLetters = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn);

    if (actualPlacedLetters.length === 0) {
      alert("Najprv polož aspoň jedno písmeno na dosku!");
      setIsActionInProgress(false);
      return;
    }

    if (gameState.hasMovedToExchangeZoneThisTurn) {
      alert("Nemôžeš potvrdiť ťah na doske, ak si už presunul(a) písmeno do výmennej zóny v tomto ťahu!");
      setIsActionInProgress(false);
      return;
    }

    if (!isStraightLine(actualPlacedLetters)) {
      alert("Písmená musia byť v jednom rade alebo stĺpci!");
      setIsActionInProgress(false);
      return;
    }

    if (actualPlacedLetters.length > 1 && !arePlacedLettersContiguousOnBoard(actualPlacedLetters, gameState.board)) {
        alert("Položené písmená nesmú mať prázdnu medzeru na doske v rámci slova!");
        setIsActionInProgress(false);
        return;
    }

    const allFormedWords = getAllWordsInTurn(actualPlacedLetters, gameState.board);

    if (allFormedWords.length === 0) {
      alert("Nezistilo sa žiadne platné slovo. Skontroluj umiestnenie.");
      setIsActionInProgress(false);
      return;
    }

    for (const wordObj of allFormedWords) {
      if (!isWordContiguousOnBoard(wordObj.letters, gameState.board)) {
        alert(`Slovo "${wordObj.wordString}" nie je súvislé (žiadne diery)!`);
        setIsActionInProgress(false);
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
      setIsActionInProgress(false);
      return;
    }

    for (const letter of actualPlacedLetters) {
      if (gameState.boardAtStartOfTurn[letter.x][letter.y] !== null) {
        alert("Nemôžeš položiť písmeno na už obsadené políčko!");
        setIsActionInProgress(false);
        return;
      }
    }

    if (actualPlacedLetters.length === 1 && allFormedWords[0].wordString.length === 1 && !gameState.isFirstTurn) {
      alert("Musíš vytvoriť slovo spojením s existujúcimi písmenami.");
      setIsActionInProgress(false);
      return;
    }

    const invalidWords = allFormedWords.filter(wordObj => {
      const wordString = wordObj.wordString.toUpperCase();
      if (wordString.length > 5) {
        return false;
      }
      return !validWordsSet.current.has(wordString);
    });

    if (invalidWords.length > 0) {
      alert(`Neplatné slovo(á) nájdené: ${invalidWords.map(w => w.wordString).join(', ')}. Skontroluj slovník alebo dĺžku slova.`);
      setIsActionInProgress(false);
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
        highlightedLetters: newHighlightedLetters,
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
        highlightedLetters: newHighlightedLetters,
      };
    }
    
    // --- ÚPRAVA: Uložíme log ťahu s novými informáciami. ---
    const turnDetails = {
        actionType: 'placeLetters',
        placedLetters: actualPlacedLetters.map(l => ({
            x: l.x,
            y: l.y,
            letterData: l.letterData
        })),
        newWords: allFormedWords.map(w => w.wordString),
        score: turnScore,
        turnNumber: gameState.turnNumber + 1,
        playerIndex: myPlayerIndex,
        timestamp: Date.now(),
        exchangedLetters: null,
        // PRIDANÉ:
        rackBeforeTurn: gameState.playerRacks[myPlayerIndex],
        lettersDrawn: newLetters,
    };
    sendPlayerAction(socket, gameId, 'turnSubmitted', turnDetails);
    // ----------------------------

    sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
  }, [gameState, myPlayerIndex, socket, gameId, validWordsSet]);

  const handleExchangeLetters = useCallback(() => {
    if (isActionInProgress) {
      console.log("Akcia už prebieha, počkajte prosím.");
      return;
    }
    setIsActionInProgress(true);

    if (gameState.isGameOver || myPlayerIndex === null || gameState.currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      setIsActionInProgress(false);
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno, aby si mohol(a) vymeniť písmená!");
      setIsActionInProgress(false);
      return;
    }

    if (gameState.exchangeZoneLetters.length === 0) {
      alert("Najprv presuň písmená do výmennej zóny!");
      setIsActionInProgress(false);
      return;
    }
    if (gameState.hasPlacedOnBoardThisTurn) {
      alert("Nemôžeš vymeniť písmená, ak si už položil(a) písmeno na dosku v tomto ťahu!");
      setIsActionInProgress(false);
      return;
    }

    if (gameState.letterBag.length < gameState.exchangeZoneLetters.length) {
      alert(`Vo vrecúšku nie je dostatok písmen na výmenu (potrebných je ${gameState.exchangeZoneLetters.length}, k dispozícii ${gameState.letterBag.length})!`);
      setIsActionInProgress(false);
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
      highlightedLetters: [],
    };

    // --- ÚPRAVA: Uložíme log výmeny s novými informáciami. ---
    const exchangeDetails = {
        actionType: 'exchange',
        placedLetters: null,
        newWords: null,
        score: 0,
        exchangedLetters: gameState.exchangeZoneLetters.map(l => ({ id: l.id, letter: l.letter })),
        turnNumber: gameState.turnNumber + 1,
        playerIndex: myPlayerIndex,
        timestamp: Date.now(),
        // PRIDANÉ:
        rackBeforeTurn: gameState.playerRacks[myPlayerIndex],
        lettersDrawn: newLettersForRack,
    };
    sendPlayerAction(socket, gameId, 'turnSubmitted', exchangeDetails);
    // -------------------------------

    sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
  }, [gameState, myPlayerIndex, socket, gameId, isActionInProgress]);

  const handlePassTurn = useCallback(() => {
    if (isActionInProgress) {
      console.log("Akcia už prebieha, počkajte prosím.");
      return;
    }
    setIsActionInProgress(true);

    if (gameState.isGameOver || myPlayerIndex === null || gameState.currentPlayerIndex !== myPlayerIndex) {
      alert("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      setIsActionInProgress(false);
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      alert("Všetkým žolíkom na doske musí byť priradené písmeno, aby si mohol(a) prejsť ťah!");
      setIsActionInProgress(false);
      return;
    }

    if (gameState.hasPlacedOnBoardThisTurn) {
      alert("Nemôžeš prejsť ťah, ak máš položené písmená na doske. Buď ich potvrď, alebo vráť na stojan.");
      setIsActionInProgress(false);
      return;
    }
    if (gameState.hasMovedToExchangeZoneThisTurn) {
      alert("Nemôžeš prejsť ťah, ak máš písmená vo výmennej zóne. Buď ich vymeň, alebo vráť na stojan.");
      setIsActionInProgress(false);
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
      highlightedLetters: [],
    };

    // --- ÚPRAVA: Uložíme log pasovania s novými informáciami. ---
    const passDetails = {
        actionType: 'pass',
        placedLetters: null,
        newWords: null,
        score: 0,
        turnNumber: gameState.turnNumber + 1,
        playerIndex: myPlayerIndex,
        timestamp: Date.now(),
        exchangedLetters: null,
        // PRIDANÉ:
        rackBeforeTurn: gameState.playerRacks[myPlayerIndex],
        lettersDrawn: [], // pri pasovaní sa nič nevyberá
    };
    sendPlayerAction(socket, gameId, 'turnSubmitted', passDetails);
    // ---------------------------------

    sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
  }, [gameState, myPlayerIndex, socket, gameId, isActionInProgress]);

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
    isActionInProgress,
  };
}

export default useGameLogic;