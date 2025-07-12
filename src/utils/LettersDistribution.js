// Hodnoty písmen v Scrabble
export const LETTER_VALUES = {
  'A': 1, 'B': 3, 'C': 4, 'D': 3, 'E': 1, 'F': 5, 'G': 3, 'H': 3, 'I': 1, 'J': 8,
  'K': 2, 'L': 2, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
  'U': 4, 'V': 4, 'W': 5, 'X': 8, 'Y': 10, 'Z': 10,
  '': 0 // Hodnota žolíka (prázdne písmeno) je 0
};

// Distribúcia písmen vo vrecúšku Scrabble (pre slovenskú verziu, ak je to možné, inak anglická)
// Predpokladajme pre zjednodušenie anglickú distribúciu s pridaným žolíkom pre testovanie
// Ak máte konkrétnu slovenskú distribúciu, môžete ju sem doplniť.
const LETTER_DISTRIBUTION = [
  // Písmeno: Počet kusov
  { letter: 'A', count: 9 },
  { letter: 'B', count: 2 },
  { letter: 'C', count: 2 },
  { letter: 'D', count: 4 },
  { letter: 'E', count: 12 },
  { letter: 'F', count: 2 },
  { letter: 'G', count: 3 },
  { letter: 'H', count: 2 },
  { letter: 'I', count: 9 },
  { letter: 'J', count: 1 },
  { letter: 'K', count: 1 },
  { letter: 'L', count: 4 },
  { letter: 'M', count: 2 },
  { letter: 'N', count: 6 },
  { letter: 'O', count: 8 },
  { letter: 'P', count: 2 },
  { letter: 'Q', count: 1 },
  { letter: 'R', count: 6 },
  { letter: 'S', count: 4 },
  { letter: 'T', count: 6 },
  { letter: 'U', count: 4 },
  { letter: 'V', count: 2 },
  { letter: 'W', count: 2 },
  { letter: 'X', count: 1 },
  { letter: 'Y', count: 2 },
  { letter: 'Z', count: 1 },
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
