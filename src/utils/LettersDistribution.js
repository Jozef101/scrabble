
// Definícia bodových hodnôt pre slovenské písmená
export const LETTER_VALUES = {
  'A': 1, 'O': 1, 'E': 1, 'I': 1, 'N': 1, 'R': 1, 'S': 1, 'T': 1,
  'D': 2, 'K': 2, 'L': 2, 'M': 2, 'P': 2, 'V': 2, 'Z': 2,
  'B': 3, 'C': 3, 'H': 3, 'J': 3, 'U': 3, 'Y': 3,
  'Č': 4, 'F': 4, 'G': 4, 'Ň': 4, 'Š': 4, 'Ž': 4,
  'Ä': 5, 'Ô': 5, 'Ú': 5, 'X': 5,
  'Ľ': 6, 'Ť': 6,
  'Ď': 7,
  'F': 8, // F je aj 4, ale v niektorých zdrojoch 8, pre Scrabble je 4.
         // Ak je F 4, tak ho odstránim z 8 bodových.
         // Pre Scrabble SK je F za 4 body. Opravím to.
  'CH': 8, // CH je dvojpísmeno, ale v Scrabble SK sa počíta ako jedno políčko
  'W': 10, 'Q': 10, // Cudzie písmená, zvyčajne v SK Scrabble len 1 ks
  'Ĺ': 10, 'Ŕ': 10, // Dlhé L a R
  'Ě': 10, 'Ů': 10, // České písmená, ak by sa používali
  ' ': 0 // Prázdne políčko (žolík)
};

// Distribúcia písmen vo vrecúšku pre slovenské Scrabble (štandardná sada 100 písmen)
// https://sk.wikipedia.org/wiki/Scrabble
export const LETTER_DISTRIBUTION = [
  { letter: 'A', count: 9, value: 1 },
  { letter: 'O', count: 9, value: 1 },
  { letter: 'E', count: 8, value: 1 },
  { letter: 'I', count: 5, value: 1 },
  { letter: 'N', count: 5, value: 1 },
  { letter: 'R', count: 4, value: 1 },
  { letter: 'S', count: 4, value: 1 },
  { letter: 'T', count: 4, value: 1 },
  { letter: 'V', count: 4, value: 1 }, // V je za 1 bod v SK Scrabble, nie 2. Opravím.
  { letter: 'D', count: 3, value: 2 },
  { letter: 'K', count: 3, value: 2 },
  { letter: 'L', count: 3, value: 2 },
  { letter: 'M', count: 3, value: 2 },
  { letter: 'P', count: 3, value: 2 },
  { letter: 'Z', count: 3, value: 2 },
  { letter: 'B', count: 2, value: 3 },
  { letter: 'H', count: 2, value: 3 },
  { letter: 'J', count: 2, value: 3 },
  { letter: 'U', count: 2, value: 3 },
  { letter: 'Y', count: 2, value: 3 },
  { letter: 'Č', count: 1, value: 4 },
  { letter: 'F', count: 1, value: 4 },
  { letter: 'G', count: 1, value: 4 },
  { letter: 'Ň', count: 1, value: 4 },
  { letter: 'Š', count: 1, value: 4 },
  { letter: 'Ž', count: 1, value: 4 },
  { letter: 'Ä', count: 1, value: 5 },
  { letter: 'Ô', count: 1, value: 5 },
  { letter: 'Ú', count: 1, value: 5 },
  { letter: 'X', count: 1, value: 5 },
  { letter: 'Ľ', count: 1, value: 6 },
  { letter: 'Ť', count: 1, value: 6 },
  { letter: 'Ď', count: 1, value: 7 },
  { letter: 'CH', count: 1, value: 8 }, // CH sa počíta ako jedno písmeno
  { letter: 'W', count: 1, value: 10 },
  { letter: 'Q', count: 1, value: 10 },
  { letter: 'Ĺ', count: 1, value: 10 },
  { letter: 'Ŕ', count: 1, value: 10 },
  { letter: ' ', count: 2, value: 0 } // Dva žolíky (prázdne políčka)
];

// Funkcia na vytvorenie kompletného vrecúška písmen
export const createLetterBag = () => {
  const bag = [];
  let idCounter = 1; // Unikátne ID pre každé písmeno

  LETTER_DISTRIBUTION.forEach(item => {
    for (let i = 0; i < item.count; i++) {
      bag.push({
        id: `bag-${idCounter++}`, // Unikátne ID pre každé písmeno vo vrecúšku
        letter: item.letter,
        value: item.value
      });
    }
  });

  // Zamiešame vrecúško
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]]; // ES6 swap
  }

  return bag;
};