// src/components/Tile.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Letter from './Letter';
import { getBonusType, BONUS_TYPES } from '../utils/boardUtils';
import '../styles/Tile.css';

// Tile teraz prijíma aj myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot
function Tile({ x, y, letter, moveLetter, boardAtStartOfTurn, myPlayerIndex, currentPlayerIndex, selectedLetter, onTapLetter, onTapSlot }) {
  const bonusType = getBonusType(x, y);

  // isDraggable logika pre písmená na doske
  // Písmeno je ťahateľné, len ak:
  // 1. Je aktuálne na ťahu hráč (currentPlayerIndex === myPlayerIndex)
  // 2. A písmeno nebolo na doske na začiatku ťahu (tzn. bolo položené v tomto ťahu)
  const canTileBeDragged = letter !== null && (boardAtStartOfTurn[x][y] === null) && (myPlayerIndex === currentPlayerIndex);

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'LETTER',
    canDrop: (item) => {
      // Môžeš dropnúť na políčko, ak je prázdne
      if (letter === null) return true;
      
      // Ak políčko nie je prázdne, môžeš naň položiť písmeno len ak presúvaš
      // to ISTÉ písmeno Z TOHTO ISTÉHO POLÍČKA (napr. na zmenu žolíka alebo vrátenie na rack)
      // A len ak je to tvoj ťah
      const isDroppingSameLetterFromSameSpot = item.source.type === 'board' && item.source.x === x && item.source.y === y;
      
      // Ak sa pokúšaš dropnúť písmeno z racku na obsadené políčko, ktoré nie je tvoje pôvodné, nie je to povolené.
      if (item.source.type === 'rack' && letter !== null) return false;

      // Ak sa pokúšaš dropnúť na obsadené políčko, ktoré NIE JE tvoje pôvodné, nie je to povolené.
      if (letter !== null && !isDroppingSameLetterFromSameSpot) return false;

      // Písmeno môžeš položiť na dosku len počas svojho ťahu
      if (myPlayerIndex !== currentPlayerIndex) return false;

      // Inak je drop povolený, ak spĺňa podmienky vyššie
      return true;
    },
    drop: (item, monitor) => {
      // Ak drop nebol spracovaný inou drop zónou (napr. ExchangeZone alebo iným RackSlotom)
      if (!monitor.didDrop()) {
        if (letter !== null && !(item.source.type === 'board' && item.source.x === x && item.source.y === y)) {
          console.log("Políčko už je obsadené, nemôžeš tam položiť písmeno.");
          return;
        }

        // Vždy zavoláme moveLetter. Logika pre zobrazenie modálneho okna žolíka
        // je v App.js funkcii moveLetter.
        moveLetter(
          item.letterData,
          item.source,
          { type: 'board', x, y } // 'target' je tu správne definovaný ako objekt
        );
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const dropHighlightClass = isOver && canDrop ? 'tile-highlight-can-drop' : (isOver ? 'tile-highlight' : '');
  const hasLetterClass = letter ? 'tile-has-letter' : '';
  const bonusClass = bonusType ? `tile-bonus-${bonusType.toLowerCase()}` : '';
  const startSquareClass = bonusType === BONUS_TYPES.START_SQUARE ? 'tile-start-square' : '';
  // Trieda pre "zamknuté" písmená na doske, ktoré nie sú novopoložené a nedajú sa ťahať
  const lockedClass = !canTileBeDragged && letter !== null ? 'tile-locked' : '';

  // Funkcia, ktorá sa zavolá pri pravom kliknutí na písmeno
  const handleLetterRightClick = (letterData, source) => {
    // Kontrolujeme, či je to písmeno, ktoré bolo položené v tomto ťahu
    // a či je to môj ťah
    if (canTileBeDragged) { // canTileBeDragged už zahŕňa kontrolu novopoloženého písmena a aktuálneho ťahu
      // Zavoláme moveLetter, aby sa písmeno presunulo z dosky na rack
      moveLetter(letterData, source, { type: 'rack', playerIndex: myPlayerIndex });
    } else {
      console.log("Písmeno nie je novopoložené alebo nie je tvoj ťah, nedá sa vrátiť.");
    }
  };

  // NOVÉ: Handler pre ťuknutie na políčko
  const handleTileClick = () => {
    if (onTapSlot && letter === null) { // Ak je políčko prázdne, voláme onTapSlot
      onTapSlot({ type: 'board', x, y });
    }
    // Ak políčko obsahuje písmeno, kliknutie sa spracuje v komponente Letter
  };

  return (
    <div
      ref={drop}
      className={`tile ${dropHighlightClass} ${hasLetterClass} ${bonusClass} ${startSquareClass} ${lockedClass}`}
      onClick={handleTileClick} // NOVÉ: onClick handler
    >
      {letter && (
        <Letter
          id={letter.id}
          letter={letter.letter}
          value={letter.value}
          assignedLetter={letter.assignedLetter}
          source={{ type: 'board', x, y }}
          isDraggable={canTileBeDragged} // Posielame vypočítanú hodnotu
          isVisible={true} // Písmená na doske sú VŽDY viditeľné
          onRightClick={handleLetterRightClick} // Posielame handler na pravé kliknutie
          selectedLetter={selectedLetter} // NOVÉ: Posielame vybrané písmeno
          onTapLetter={onTapLetter}     // NOVÉ: Posielame handler pre ťuknutie na písmeno
        />
      )}
      {!letter && bonusType && (
        <span className="bonus-text">
          {bonusType === BONUS_TYPES.START_SQUARE ? '★' : bonusType.replace(/_/g, ' ')}
        </span>
      )}
    </div>
  );
}

export default Tile;
