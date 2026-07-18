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
import { useToastContext } from '../App';

// Prijímame slovník ako parameter slovakWordsSet
function useGameLogic(socket, gameId, myPlayerIndex, slovakWordsSet, gameState, setGameState) { // ZMENA V PARAMETROCH
  const addToast = useToastContext();
  const [showLetterSelectionModal, setShowLetterSelectionModal] = useState(false);
  const [jokerTileCoords, setJokerTileCoords] = useState(null);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [pendingBingo, setPendingBingo] = useState(false);
  const prevGameStatusRef = useRef(gameState.gameStatus);
  const prevTurnInfoRef = useRef();

  // Kľúčová zmena: slovník sa už nealokuje, ale použije sa prijatý parameter
  const validWordsSet = useRef(slovakWordsSet);

  useEffect(() => {
    if (!socket) return;

    // Samotné setGameState pre túto udalosť rieši výhradne
    // setupSocketListeners (src/utils/socketHandlers.js) — registruje sa tam
    // synchrónne hneď pri vytvorení socketu, takže nemôže vzniknúť medzera,
    // v ktorej by prvá správa po pripojení nemala kto spracovať. Tu si už len
    // odomkneme UI po dokončení akcie.
    const handleGameStateUpdate = () => {
      setIsActionInProgress(false);
    };

    const handleTimeUpdate = ({ playerTimes }) => {
        setGameState((prevState) => ({
            ...prevState,
            playerTimes: playerTimes,
        }));
    };

    socket.on('gameStateUpdate', handleGameStateUpdate);
    // socket.on('moveLetter', handleMoveLetterAction); // Pridali sme nový listener

    socket.on('timeUpdate', handleTimeUpdate);

    return () => {
        socket.off('gameStateUpdate', handleGameStateUpdate);
        socket.off('timeUpdate', handleTimeUpdate);

        // socket.off('moveLetter', handleMoveLetterAction); // Nezabudneme ho pri odpojení odstrániť
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
        // addToast("BINGO! +50 bodov!");
        setPendingBingo(true);
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

      const isGameEndingByEmptyRack = currentBagEmpty && finalRackAfterPlay.length === 0;

      const updatedGameState = {
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

      // Jednotná schéma pre turnLogs (rovnaká pre placeLetters/pass/exchange,
      // naprieč priamym aj schvaľovacím tokom — pozri socketHandler.js).
      // Board/bag snapshoty sa už neukladajú — sú redundantné voči
      // placedLetters/exchangedLetters a dajú sa z nich (spolu s rackBeforeTurn
      // a lettersDrawn) kedykoľvek spätne dopočítať.
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
        rackBeforeTurn: gameState.playerRacks[myPlayerIndex],
        lettersDrawn: newLetters,
      };
      sendPlayerAction(socket, gameId, 'turnSubmitted', turnDetails);
      // ----------------------------

      // DÔLEŽITÉ: 'updateGameState' musí ísť na server VŽDY, aj keď sa hra týmto
      // ťahom končí — server si podľa neho autoritatívne prepočíta rack/bag/dosku
      // a len z toho vie neskôr overiť, že 'gameOver' je oprávnený (pozri
      // socketHandler.js, case 'gameOver'). Predtým sa pri konci hry táto akcia
      // preskakovala, čím sa server o finálnom stave dozvedel len z klientovho
      // (nedôveryhodného) 'gameOver' payloadu.
      sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);

      if (isGameEndingByEmptyRack) {
        const finalScoresData = calculateFinalScores(gameState.currentPlayerIndex, newScores, gameState.playerRacks, gameState.players);
        sendPlayerAction(socket, gameId, 'gameOver', {
            ...finalScoresData,
            initialScores: newScores,
            finishingPlayerIndex: gameState.currentPlayerIndex,
            reason: 'standard_end'
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (!isGameOverCondition) {
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

    // DÔLEŽITÉ: 'updateGameState' ide na server VŽDY, aj pri ukončujúcom pasovaní —
    // server si z neho autoritatívne prepočíta consecutivePasses a len z toho
    // vie neskôr overiť, že nasledujúce 'gameOver' je oprávnené.
    sendPlayerAction(socket, gameId, 'updateGameState', updatedGameState);

    if (isGameOverCondition) {
        // Hra skončila pasovaním, vypočítame finálne skóre a detaily
        const finalScoresData = calculateFinalScores(null, gameState.playerScores, gameState.playerRacks, gameState.players);

        sendPlayerAction(socket, gameId, 'gameOver', {
            ...finalScoresData, // Tu sú: finalScores, deductions, bonus, winnerId, loserId, winnerIndex
            initialScores: gameState.playerScores,
            finishingPlayerIndex: null, // Nikto aktívne nedohral
            reason: 'pass_end'
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.isGameOver, myPlayerIndex, socket, gameId, isActionInProgress]);

  const handleDrawForTurn = useCallback(() => {
    if (isActionInProgress) {
        console.log("Akcia už prebieha, počkajte prosím.");
        return;
    }
    sendPlayerAction(socket, gameId, 'drawForTurn', {});
  }, [socket, gameId, isActionInProgress]);

  useEffect(() => {
    if (prevGameStatusRef.current === 'AWAITING_WORD_VALIDATION' && gameState.gameStatus === 'in_progress') {
      // Ak si pamätáme, že sme mali BINGO, a už nie sme na ťahu (náš ťah bol teda úspešne schválený), zobrazíme notifikáciu.
      if (pendingBingo && myPlayerIndex !== gameState.currentPlayerIndex) {
        addToast("BINGO! +50 bodov!");
        setPendingBingo(false); // Vynulujeme pre ďalší ťah
      }
    }
    // Na konci vždy aktualizujeme referenciu na aktuálny stav pre ďalšie porovnanie.
    prevGameStatusRef.current = gameState.gameStatus;
  
  }, [gameState.gameStatus, gameState.currentPlayerIndex, pendingBingo, myPlayerIndex, addToast]);

  useEffect(() => {
    // Tento efekt spracuje VŽDY NOVÚ informáciu o poslednom dokončenom ťahu
    if (gameState.lastTurnInfo && gameState.lastTurnInfo !== prevTurnInfoRef.current) {
      const { playerIndex, opponentIndex, score, words, type } = gameState.lastTurnInfo;

      // Notifikácia pre hráča, ktorého ťah bol práve vyhodnotený
      if (playerIndex === myPlayerIndex) {
        if (type === 'approved') {
          addToast(`Súper ťah schválil. Dostávaš ${score} bodov za slovo(á) ${words.join(', ')}`, 'success');
        } else if (type === 'rejected') {
          addToast(`Súper zamietol tvoje slovo(á): "${words.join(', ')}"`, 'error');
        }
      }
      // Notifikácia pre súpera, ktorý práve rozhodol
      else if (opponentIndex === myPlayerIndex) {
        if (type === 'rejected') {
          addToast('Zamietol si súperov ťah.', 'info');
        }
      }

      // Zapamätáme si, že sme túto informáciu už spracovali.
      prevTurnInfoRef.current = gameState.lastTurnInfo;
    }
  }, [gameState.lastTurnInfo, myPlayerIndex, addToast]);

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