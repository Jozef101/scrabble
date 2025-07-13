// Hodnoty písmen v Scrabble
export const LETTER_VALUES = {
  'A': 1, 'Á': 4, 'Ä': 10, 'B': 4, 'C': 4, 'Č': 5, 'D': 2, 'Ď': 8, 'E': 1, 'É': 7,
  'F': 8, 'G': 8, 'H': 4, 'I': 1, 'Í': 5, 'J': 3, 'K': 2, 'L': 2, 'Ľ': 7, 'Ĺ': 10,
  'M': 2, 'N': 1, 'Ň': 8, 'O': 1, 'Ô': 8, 'Ó': 10, 'P': 2, 'Q': 10, 'R': 1, 'Ŕ': 10,
  'S': 1, 'Š': 5, 'T': 1, 'Ť': 7, 'U': 3, 'Ú': 7, 'V': 1, 'W': 5, 'X': 10, 'Y': 4, 'Ý': 5,
  'Z': 4, 'Ž': 5, '': 0 // Hodnota žolíka (prázdne písmeno) je 0
};

// Distribúcia písmen vo vrecúšku Scrabble (pre slovenskú verziu, ak je to možné, inak anglická)
// Predpokladajme pre zjednodušenie anglickú distribúciu s pridaným žolíkom pre testovanie
// Ak máte konkrétnu slovenskú distribúciu, môžete ju sem doplniť.
const LETTER_DISTRIBUTION = [
  // Písmeno: Počet kusov
  { letter: 'A', count: 9 },
  { letter: 'Á', count: 1 },
  { letter: 'Ä', count: 1 },
  { letter: 'B', count: 2 },
  { letter: 'C', count: 1 },
  { letter: 'Č', count: 1 },
  { letter: 'D', count: 3 },
  { letter: 'Ď', count: 1 },
  { letter: 'E', count: 8 },
  { letter: 'É', count: 1 },
  { letter: 'F', count: 1 },
  { letter: 'G', count: 1 },
  { letter: 'H', count: 1 },
  { letter: 'I', count: 5 },
  { letter: 'Í', count: 1 },
  { letter: 'J', count: 2 },
  { letter: 'K', count: 3 },
  { letter: 'L', count: 3 },
  { letter: 'Ľ', count: 1 },
  { letter: 'Ĺ', count: 1 },
  { letter: 'M', count: 4 },
  { letter: 'N', count: 5 },
  { letter: 'Ň', count: 1 },
  { letter: 'O', count: 9 },
  { letter: 'Ô', count: 1 },
  { letter: 'Ó', count: 1 },
  { letter: 'P', count: 3 },
  // { letter: 'Q', count: 1 },
  { letter: 'R', count: 4 },
  { letter: 'Ŕ', count: 1 },
  { letter: 'S', count: 4 },
  { letter: 'Š', count: 1 },
  { letter: 'T', count: 4 },
  { letter: 'Ť', count: 1 },
  { letter: 'U', count: 2 },
  { letter: 'Ú', count: 1 },
  { letter: 'V', count: 4 },
  // { letter: 'W', count: 2 },
  { letter: 'X', count: 1 },
  { letter: 'Y', count: 1 },
  { letter: 'Ý', count: 1 },
  { letter: 'Z', count: 1 },
  { letter: 'Ž', count: 1 },
  { letter: '', count: 2 } // Dva žolíky (blank tiles)
];

// Funkcia na vytvorenie vrecúška s písmenami
export const createLetterBag = () => {
  const bag = [];
  let idCounter = 0; // Unikátne ID pre každé písmeno

  LETTER_DISTRIBUTION.forEach(item => {
    for (let i = 0; i < item.count; i++) {
      bag.push({
        id: `letter-${idCounter++}`, // Unikátne ID
        letter: item.letter,
        value: LETTER_VALUES[item.letter]
      });
    }
  });

  // Zamiešame vrecúško
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  return bag;
};
