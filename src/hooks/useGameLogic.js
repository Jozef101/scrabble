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
import { moveLetter as importedMoveLetter, applyMoveLetter } from '../utils/moveLetterLogic';
import { sendPlayerAction } from '../utils/socketHandlers';
import { useToastContext } from '../App';

// Prijímame slovník ako parameter slovakWordsSet
function useGameLogic(socket, gameId, myPlayerIndex, slovakWordsSet, gameState, setGameState) { // ZMENA V PARAMETROCH
  const addToast = useToastContext();
  const [showLetterSelectionModal, setShowLetterSelectionModal] = useState(false);
  const [jokerTileCoords, setJokerTileCoords] = useState(null);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Kľúčová zmena: slovník sa už nealokuje, ale použije sa prijatý parameter
  const validWordsSet = useRef(slovakWordsSet);

  useEffect(() => {
    if (!socket) return;

    // Listener pre plnú aktualizáciu stavu (zostáva pre akcie ako confirmTurn, pass, atď.)
    const handleGameStateUpdate = (newGameState) => {
      // console.log('useGameLogic: Received full gameStateUpdate');
      setGameState(newGameState);
      setIsActionInProgress(false);
    };

    // NOVÝ LISTENER: Pre malé, rýchle akcie presunu písmena
    const handleMoveLetterAction = (action) => {
      
      // Akciu aplikujeme iba vtedy, ak prišla od iného hráča.
      // Naše vlastné pohyby sú už aplikované lokálne ("optimisticky").
      // Server nám do akcie pridá 'playerIndex', aby sme to vedeli rozlíšiť.
      if (action.playerIndex !== myPlayerIndex) {
        setGameState(prevState => applyMoveLetter(prevState, action));
      }
    };

    socket.on('gameStateUpdate', handleGameStateUpdate);
    socket.on('moveLetter', handleMoveLetterAction); // Pridali sme nový listener

    return () => {
      socket.off('gameStateUpdate', handleGameStateUpdate);
      socket.off('moveLetter', handleMoveLetterAction); // Nezabudneme ho pri odpojení odstrániť
    };
  }, [socket, setGameState, myPlayerIndex]);

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
    setIsActionInProgress(false);
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
      addToast("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      setIsActionInProgress(false);
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      addToast("Všetkým žolíkom na doske musí byť priradené písmeno!");
      setIsActionInProgress(false);
      return;
    }

    const actualPlacedLetters = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn);

    if (actualPlacedLetters.length === 0) {
      addToast("Najprv polož aspoň jedno písmeno na dosku!");
      setIsActionInProgress(false);
      return;
    }

    if (gameState.hasMovedToExchangeZoneThisTurn) {
      addToast("Nemôžeš potvrdiť ťah na doske, ak si už presunul(a) písmeno do výmennej zóny v tomto ťahu!");
      setIsActionInProgress(false);
      return;
    }

    if (!isStraightLine(actualPlacedLetters)) {
      addToast("Písmená musia byť v jednom rade alebo stĺpci!");
      setIsActionInProgress(false);
      return;
    }

    if (actualPlacedLetters.length > 1 && !arePlacedLettersContiguousOnBoard(actualPlacedLetters, gameState.board)) {
        addToast("Položené písmená nesmú mať prázdnu medzeru na doske v rámci slova!");
        setIsActionInProgress(false);
        return;
    }

    const allFormedWords = getAllWordsInTurn(actualPlacedLetters, gameState.board);

    if (allFormedWords.length === 0) {
      addToast("Nezistilo sa žiadne platné slovo. Skontroluj umiestnenie.");
      setIsActionInProgress(false);
      return;
    }

    for (const wordObj of allFormedWords) {
      if (!isWordContiguousOnBoard(wordObj.letters, gameState.board)) {
        addToast(`Slovo "${wordObj.wordString}" nie je súvislé (žiadne diery)!`);
        setIsActionInProgress(false);
        return;
      }
    }

    const mainWordLettersForConnectionCheck = getFullWordLetters(actualPlacedLetters, gameState.board);
    if (!isConnected(actualPlacedLetters, gameState.board, gameState.isFirstTurn, mainWordLettersForConnectionCheck)) {
      if (gameState.isFirstTurn) {
        addToast("Prvý ťah musí pokrývať stredové políčko (hviezdičku)!");
      } else {
        addToast("Položené písmená sa musia spájať s existujúcimi písmenami na doske (alebo použiť existujúce písmeno ako súčasť slova)!");
      }
      setIsActionInProgress(false);
      return;
    }

    for (const letter of actualPlacedLetters) {
      if (gameState.boardAtStartOfTurn[letter.x][letter.y] !== null) {
        addToast("Nemôžeš položiť písmeno na už obsadené políčko!");
        setIsActionInProgress(false);
        return;
      }
    }

    if (actualPlacedLetters.length === 1 && allFormedWords[0].wordString.length === 1 && !gameState.isFirstTurn) {
      addToast("Musíš vytvoriť slovo spojením s existujúcimi písmenami.");
      setIsActionInProgress(false);
      return;
    }

    const strictlyInvalidWords = [];
    const unverifiedWords = [];

    allFormedWords.forEach(wordObj => {
        const wordString = wordObj.wordString.toUpperCase();

        // Pravidlá pre krátke slová (musia byť v slovníku)
        if (wordString.length <= 5) {
            if (!validWordsSet.current.has(wordString)) {
                strictlyInvalidWords.push(wordString);
            }
        } 
        // Pravidlá pre dlhé slová (môžu, ale nemusia byť v slovníku)
        else {
            if (!validWordsSet.current.has(wordString)) {
                unverifiedWords.push(wordString);
            }
        }
    });

    // Ak sme našli krátke neplatné slovo, ťah je neplatný a končíme.
    if (strictlyInvalidWords.length > 0) {
        addToast(`Neplatné slovo(á): ${strictlyInvalidWords.join(', ')}. Tieto slová sa musia nachádzať v slovníku.`, 'error');
        setIsActionInProgress(false);
        return;
    }
    let turnScore = 0;
      allFormedWords.forEach(wordObj => {
        turnScore += calculateWordScore(wordObj.letters, gameState.boardAtStartOfTurn);
      });

      if (actualPlacedLetters.length === 7) {
        turnScore += 50;
        addToast("BINGO! +50 bodov!");
      }

    // Ak sme našli dlhé, neoverené slová, iba zobrazíme varovanie, ale pokračujeme.
    if (unverifiedWords.length > 0) {
      // Ak existujú neoverené slová, pošleme ťah na schválenie súperovi
      addToast(`Slová "${unverifiedWords.join(', ')}" neboli v slovníku. Súper musí ťah schváliť.`, 'info');
      sendPlayerAction(socket, gameId, 'submitTurnForApproval', {
        placedLetters: actualPlacedLetters,
        unverifiedWords: unverifiedWords,
        turnScore: turnScore,
        allFormedWords: allFormedWords.map(w => w.wordString)
      });
      return;
    } else {
      let newScores = [...gameState.playerScores];
      newScores[gameState.currentPlayerIndex] += turnScore;
      addToast(`Ťah je platný! Získal si ${turnScore} bodov. Vytvorené slová: ${allFormedWords.map(w => w.wordString).join(', ')}`);

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
        // Hra skončila, vypočítame finálne skóre a všetky detaily
        const finalScoresData = calculateFinalScores(gameState.currentPlayerIndex, newScores, gameState.playerRacks, gameState.players);

        const turnDetails = {
          actionType: 'placeLetters',
          placedLetters: actualPlacedLetters.map(l => ({
            x: l.x,
            y: l.y,
            letterData: l.letterData
          })),
          newWords: allFormedWords.map(w => w.wordString),
          score: turnScore,
          turnNumber: (gameState.turnNumber || 0) + 1,
          playerIndex: myPlayerIndex,
          timestamp: Date.now(),
          exchangedLetters: null,
          rackBeforeTurn: gameState.playerRacks[myPlayerIndex],
          lettersDrawn: newLetters,
          boardBeforeTurn: JSON.stringify(gameState.boardAtStartOfTurn),
          boardAfterTurn: JSON.stringify(gameState.board), // Doska sa už v tomto bode nemení
          letterBagBeforeTurn: gameState.letterBag,
          letterBagAfterTurn: updatedBagAfterTurn,
        };
        sendPlayerAction(socket, gameId, 'turnSubmitted', turnDetails);

        // Pošleme JEDNU akciu so všetkými detailmi
        sendPlayerAction(socket, gameId, 'gameOver', {
            ...finalScoresData, // Tu sú: finalScores, deductions, bonus, winnerId, loserId, winnerIndex
            initialScores: newScores, // Pošleme skóre pred úpravami
            finishingPlayerIndex: gameState.currentPlayerIndex,
            reason: 'standard_end'
        });

        // Zmažeme starú 'updateGameState' akciu, aby sme neposielali dáta duplicitne
        // sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
        return; // DÔLEŽITÉ: Ukončíme funkciu tu
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
          turnNumber: (gameState.turnNumber || 0) + 1,
        };
      }
      // --- ÚPRAVA: Uložíme log ťahu s novými informáciami. ---
      const turnDetails = {
        actionType: 'placeLetters',
        placedLetters: actualPlacedLetters.map(l => ({
            x: l.x,
            y: l.y,
            letterData: l.letterData
        })) ,
        newWords: allFormedWords.map(w => w.wordString),
        score: turnScore,
        turnNumber: (gameState.turnNumber || 0) + 1,
        playerIndex: myPlayerIndex,
        timestamp: Date.now(),
        exchangedLetters: null,
        // PRIDANÉ:
        rackBeforeTurn: gameState.playerRacks[myPlayerIndex],
        lettersDrawn: newLetters,
        boardBeforeTurn: JSON.stringify(gameState.boardAtStartOfTurn), // Uložíme stav dosky pred ťahom
        boardAfterTurn: JSON.stringify(updatedGameState.board),
        letterBagBeforeTurn: gameState.letterBag,
        letterBagAfterTurn: updatedBagAfterTurn,
        // Uložíme stav dosky po ťahu
      };
      sendPlayerAction(socket, gameId, 'turnSubmitted', turnDetails);
      // ----------------------------

      sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
    }
  }, [gameState, myPlayerIndex, socket, gameId, validWordsSet, isActionInProgress]);

  const handleExchangeLetters = useCallback(() => {
    if (isActionInProgress) {
      console.log("Akcia už prebieha, počkajte prosím.");
      return;
    }
    setIsActionInProgress(true);

    if (gameState.isGameOver || myPlayerIndex === null || gameState.currentPlayerIndex !== myPlayerIndex) {
      addToast("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      setIsActionInProgress(false);
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      addToast("Všetkým žolíkom na doske musí byť priradené písmeno, aby si mohol(a) vymeniť písmená!");
      setIsActionInProgress(false);
      return;
    }

    if (gameState.exchangeZoneLetters.length === 0) {
      addToast("Najprv presuň písmená do výmennej zóny!");
      setIsActionInProgress(false);
      return;
    }
    if (gameState.hasPlacedOnBoardThisTurn) {
      addToast("Nemôžeš vymeniť písmená, ak si už položil(a) písmeno na dosku v tomto ťahu!");
      setIsActionInProgress(false);
      return;
    }

    if (gameState.letterBag.length < gameState.exchangeZoneLetters.length) {
      addToast(`Vo vrecúšku nie je dostatok písmen na výmenu (potrebných je ${gameState.exchangeZoneLetters.length}, k dispozícii ${gameState.letterBag.length})!`);
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
      turnNumber: (gameState.turnNumber || 0) + 1,
    };

    // --- ÚPRAVA: Uložíme log výmeny s novými informáciami. ---
    const exchangeDetails = {
        actionType: 'exchange',
        placedLetters: null,
        newWords: null,
        score: 0,
        exchangedLetters: gameState.exchangeZoneLetters.map(l => ({ id: l.id, letter: l.letter })),
        turnNumber: (gameState.turnNumber || 0) + 1,
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
      addToast("Hra skončila, nie si pripojený alebo nie je tvoj ťah!");
      setIsActionInProgress(false);
      return;
    }

    const placedJokersWithoutAssignment = getPlacedLettersDuringCurrentTurn(gameState.board, gameState.boardAtStartOfTurn)
      .filter(l => l.letterData.letter === '' && l.letterData.assignedLetter === null);

    if (placedJokersWithoutAssignment.length > 0) {
      addToast("Všetkým žolíkom na doske musí byť priradené písmeno, aby si mohol(a) prejsť ťah!");
      setIsActionInProgress(false);
      return;
    }

    if (gameState.hasPlacedOnBoardThisTurn) {
      addToast("Nemôžeš prejsť ťah, ak máš položené písmená na doske. Buď ich potvrď, alebo vráť na stojan.");
      setIsActionInProgress(false);
      return;
    }
    if (gameState.hasMovedToExchangeZoneThisTurn) {
      addToast("Nemôžeš prejsť ťah, ak máš písmená vo výmennej zóne. Buď ich vymeň, alebo vráť na stojan.");
      setIsActionInProgress(false);
      return;
    }

    const newConsecutivePasses = gameState.consecutivePasses + 1;

    let updatedPlayerScores = [...gameState.playerScores];
    let isGameOverCondition = (newConsecutivePasses >= 6);

    if (isGameOverCondition) {
        // Hra skončila pasovaním, vypočítame finálne skóre a detaily
        const finalScoresData = calculateFinalScores(null, gameState.playerScores, gameState.playerRacks, gameState.players);

        sendPlayerAction(socket, gameId, 'gameOver', {
            ...finalScoresData, // Tu sú: finalScores, deductions, bonus, winnerId, loserId, winnerIndex
            initialScores: gameState.playerScores,
            finishingPlayerIndex: null, // Nikto aktívne nedohral
            reason: 'pass_end'
        });

        // Zmažeme starú 'updateGameState' akciu
        // sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);
        return; // DÔLEŽITÉ: Ukončíme funkciu tu
    } else {
      addToast("Ťah bol prenesený na ďalšieho hráča.");
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
      turnNumber: (gameState.turnNumber || 0) + 1,
    };

    // --- ÚPRAVA: Uložíme log pasovania s novými informáciami. ---
    const passDetails = {
        actionType: 'pass',
        placedLetters: null,
        newWords: null,
        score: 0,
        turnNumber: (gameState.turnNumber || 0) + 1,
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

   const handleSurrender = useCallback(() => {
    if (isActionInProgress) {
      console.log("Akcia už prebieha, počkajte prosím.");
      return;
    }
    if (gameState.isGameOver || myPlayerIndex === null) {
      addToast("Hra už skončila alebo nie si platným hráčom.");
      return;
    }

    console.log(`Hráč ${myPlayerIndex + 1} vzdáva hru.`);
    setIsActionInProgress(true);
    
    // Pošleme na server akciu 'surrender' s indexom hráča, ktorý sa vzdal
    sendPlayerAction(socket, gameId, 'surrender', {
      surrenderingPlayerIndex: myPlayerIndex,
    });

  }, [gameState.isGameOver, myPlayerIndex, socket, gameId, isActionInProgress]);

  const handleDrawForTurn = useCallback(() => {
    if (isActionInProgress) {
        console.log("Akcia už prebieha, počkajte prosím.");
        return;
    }
    sendPlayerAction(socket, gameId, 'drawForTurn', {});
  }, [socket, gameId, isActionInProgress]);

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
    handleSurrender,
    handleDrawForTurn,
    isActionInProgress,
    setIsActionInProgress,
  };
}

export default useGameLogic;