// src/hooks/useTapToMove.js
import { useState, useCallback } from 'react';

function useTapToMove(moveLetter, gameState, myPlayerIndex) {
  const [selectedLetter, setSelectedLetter] = useState(null);

  const handleTapLetter = useCallback((letterData, source) => {
    console.log('useTapToMove: handleTapLetter called:', { letterData, source });
    if (gameState.isGameOver || myPlayerIndex === null) {
      console.log("Nemôžeš presúvať písmená (hra skončila, nie si pripojený alebo nie je tvoj ťah).");
      setSelectedLetter(null);
      return;
    }

    if (source.type === 'board' && gameState.boardAtStartOfTurn[source.x][source.y] !== null) {
      console.log("Nemôžeš presunúť zamknuté písmeno z dosky.");
      setSelectedLetter(null);
      return;
    }

    if (source.type === 'rack' && source.playerIndex !== myPlayerIndex) {
      console.log("Nemôžeš presúvať písmená z racku iného hráča.");
      setSelectedLetter(null);
      return;
    }

    if (selectedLetter) {
      if (selectedLetter.letterData.id === letterData.id) {
        setSelectedLetter(null);
        return;
      }

      if (selectedLetter.source.type === 'rack' && source.type === 'rack' && selectedLetter.source.playerIndex === source.playerIndex) {
        moveLetter(selectedLetter.letterData, selectedLetter.source, source);
        setSelectedLetter(null);
        return;
      }

      moveLetter(selectedLetter.letterData, selectedLetter.source, source);
      setSelectedLetter(null);
      return;
    }

    if (source.type === 'rack' && source.playerIndex === myPlayerIndex) {
      setSelectedLetter({ letterData, source });
    } else if (source.type === 'board' && gameState.currentPlayerIndex === myPlayerIndex && gameState.boardAtStartOfTurn[source.x][source.y] === null) {
      console.log('Attempting to select board letter:', { letterData, source, isMyTurn: gameState.currentPlayerIndex === myPlayerIndex });
      setSelectedLetter({ letterData, source });
    } else if (source.type === 'exchangeZone' && gameState.currentPlayerIndex === myPlayerIndex) {
      setSelectedLetter({ letterData, source });
    }
  }, [selectedLetter, moveLetter, gameState, myPlayerIndex]);

  const handleTapSlot = useCallback((target) => {
    if (gameState.isGameOver || myPlayerIndex === null) {
      console.log("Nemôžeš presúvať písmená (hra skončila alebo nie si pripojený alebo nie je tvoj ťah).");
      setSelectedLetter(null);
      return;
    }

    if (target.type === 'board' && gameState.board[target.x][target.y] !== null) {
      console.log("Cieľové políčko na doske je už obsadené, nemôžeš tam položiť písmeno.");
      alert("Cieľové políčko na doske je už obsadené!");
      setSelectedLetter(null);
      return;
    }

    if (selectedLetter) {
      moveLetter(selectedLetter.letterData, selectedLetter.source, target);
      setSelectedLetter(null);
    } else {
      console.log("Ťukol(a) si na prázdny slot, ale nemáš vybrané žiadne písmeno.");
    }
  }, [selectedLetter, moveLetter, gameState, myPlayerIndex]);

  return {
    selectedLetter,
    handleTapLetter,
    handleTapSlot,
    setSelectedLetter,
  };
}

export default useTapToMove;
