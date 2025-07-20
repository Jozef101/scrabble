// src/components/Letter.js
import React from 'react';
import { useDrag } from 'react-dnd';
import '../styles/Letter.css';

// Pridávame nový prop `onRightClick`, `selectedLetter` a `onTapLetter`
function Letter({ id, letter, value, assignedLetter, source, isDraggable = true, isVisible = true, onRightClick, selectedLetter, onTapLetter }) {
    // Určíme originalRackIndex, ak zdrojom je rack
    const originalRackIndex = source.type === 'rack' ? source.index : undefined;

    const [{ isDragging }, drag] = useDrag({
        type: 'LETTER',
        // Pridávame originalRackIndex do item.letterData
        item: { letterData: { id, letter, value, assignedLetter, originalRackIndex }, source },
        canDrag: isDraggable, // isDraggable stále kontroluje, či sa dá ťahať
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    // Ak písmeno nie je viditeľné, renderujeme len skrytý vizuálny zástupca.
    // Toto sa použije pre súperov rack.
    if (!isVisible) {
        return (
            <div
                className="letter-tile hidden-letter-tile"
                // ref={drag} sa tu neaplikuje, pretože ho nechceme spraviť ťahateľným
            >
                {/* Tu sa nezobrazí žiadny text ani hodnota */}
            </div>
        );
    }

    // Ak je písmeno žolík, zobrazíme priradené písmeno, inak pôvodné písmeno
    const displayLetter = letter === '' ? (assignedLetter || '') : letter;
    const isJoker = letter === ''; // Kontrola, či je to žolík

    const dragClass = isDragging ? 'dragging' : '';
    const jokerClass = isJoker ? 'joker-tile' : ''; // Trieda pre žolíka

    // Dynamická trieda pre farbu písmena žolíka
    const jokerAssignedColorClass = isJoker && assignedLetter ? 'joker-assigned-color' : '';

    // Nová funkcia pre spracovanie pravého kliknutia
    const handleContextMenu = (e) => {
        e.preventDefault(); // Zabráni zobrazeniu predvoleného kontextového menu prehliadača
        if (onRightClick) {
            // Posielame všetky potrebné dáta pre identifikáciu písmena a jeho zdroja
            // letterData tu už bude obsahovať originalRackIndex z useDrag item
            onRightClick({ id, letter, value, assignedLetter, originalRackIndex }, source);
        }
    };

    // NOVÉ: Kontrola, či je toto písmeno aktuálne vybrané pre tap-to-move
    const isSelected = selectedLetter && selectedLetter.letterData.id === id;
    const selectedClass = isSelected ? 'selected-letter-tile' : '';

    return (
        <div
            ref={drag} // ref={drag} sa aplikuje len, ak je isVisible true (tzn. nie je to skrytý kameň)
            className={`letter-tile ${dragClass} ${jokerClass} ${selectedClass}`} // Pridávame selectedClass
            style={{ opacity: isDragging ? 0.5 : 1 }}
            onContextMenu={handleContextMenu} // Pridávame event listener pre pravé tlačidlo myši
            onClick={(e) => { // KĽÚČOVÁ ZMENA: Pridávame 'e' a e.stopPropagation()
                e.stopPropagation(); // Zastaví šírenie udalosti kliknutia na rodičovské elementy
                console.log('Letter clicked:', { id, letter, source }); // DEBUG LOG
                console.log('onTapLetter prop in Letter.js:', onTapLetter); // NEW DEBUG LOG
                if (onTapLetter) {
                    onTapLetter({ id, letter, value, assignedLetter, originalRackIndex }, source);
                }
            }} // NOVÉ: Handler pre ťuknutie
        >
            <span className={`main-letter ${jokerAssignedColorClass}`}>{displayLetter}</span>
            <span className="letter-value">{value}</span>
        </div>
    );
}

export default Letter;
