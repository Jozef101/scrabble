import React from 'react';
import { useDrag } from 'react-dnd';
import '../styles/Letter.css'; // Importujeme CSS pre Letter

function Letter({ id, letter, value, source }) {
  // useDrag hook robí z tohto komponentu "draggable"
  const [{ isDragging }, drag] = useDrag({
    type: 'LETTER', // Typ tejto draggable položky
    item: {
      letterData: { id, letter, value }, // Dáta, ktoré sa prenášajú
      source: source, // Informácie o pôvodnom mieste (stojanček alebo doska)
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(), // Sleduje, či je položka práve ťahaná
    }),
  });

  // Štýl pre skrytie ťahaného písmena (voliteľné, react-dnd duplikuje vizuál)
  const opacity = isDragging ? 0 : 1;

  return (
    <div
      ref={drag} // Pripojíme ref na DOM element, aby ho react-dnd mohol spravovať
      className="letter"
      style={{ opacity }}
    >
      <span className="letter-char">{letter}</span>
      <span className="letter-value">{value}</span>
    </div>
  );
}

export default Letter;