// src/utils/gameLogic.js

// Importy potrebné pre hernú logiku
import { LETTER_VALUES } from './LettersDistribution'; // Predpokladáme, že tento súbor existuje
import { bonusSquares, BONUS_TYPES } from './boardUtils'; // Predpokladáme, že tento súbor existuje

/**
 * Vytvorí a zamieša vrecúško s písmenami podľa slovenskej distribúcie.
 * @returns {Array<Object>} Pole objektov písmen, každé s id, letter a value.
 */
export function createLetterBag() {
    const bag = [];
    let idCounter = 0;
    const LETTER_DISTRIBUTION = [
        { letter: 'A', count: 9 }, { letter: 'Á', count: 1 }, { letter: 'Ä', count: 1 },
        { letter: 'B', count: 2 }, { letter: 'C', count: 1 }, { letter: 'Č', count: 1 },
        { letter: 'D', count: 3 }, { letter: 'Ď', count: 1 }, { letter: 'E', count: 8 },
        { letter: 'É', count: 1 }, { letter: 'F', count: 1 }, { letter: 'G', count: 1 },
        { letter: 'H', count: 1 }, { letter: 'I', count: 5 }, { letter: 'Í', count: 1 },
        { letter: 'J', count: 2 }, { letter: 'K', count: 3 }, { letter: 'L', count: 3 },
        { letter: 'Ľ', count: 1 }, { letter: 'Ĺ', count: 1 }, { letter: 'M', count: 4 },
        { letter: 'N', count: 5 }, { letter: 'Ň', count: 1 }, { letter: 'O', count: 9 },
        { letter: 'Ô', count: 1 }, { letter: 'Ó', count: 1 }, { letter: 'P', count: 3 },
        { letter: 'R', count: 4 }, { letter: 'Ŕ', count: 1 }, { letter: 'S', count: 4 },
        { letter: 'Š', count: 1 }, { letter: 'T', count: 4 }, { letter: 'Ť', count: 1 },
        { letter: 'U', count: 2 }, { letter: 'Ú', count: 1 }, { letter: 'V', count: 4 },
        { letter: 'X', count: 1 }, { letter: 'Y', count: 1 }, { letter: 'Ý', count: 1 },
        { letter: 'Z', count: 1 }, { letter: 'Ž', count: 1 },
        { letter: '', count: 2 } // Dva žolíky (blank tiles)
    ];

    LETTER_DISTRIBUTION.forEach(item => {
        for (let i = 0; i < item.count; i++) {
            bag.push({ id: `letter-${idCounter++}`, letter: item.letter, value: LETTER_VALUES[item.letter] });
        }
    });
    // Zamiešanie vrecúška
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

/**
 * Potiahne zadaný počet písmen z vrecúška.
 * @param {Array<Object>} currentBag Aktuálny stav vrecúška s písmenami.
 * @param {number} numToDraw Počet písmen, ktoré sa majú potiahnuť.
 * @returns {{drawnLetters: Array<Object>, remainingBag: Array<Object>, bagEmpty: boolean}} Potiahnuté písmená, zostávajúce vrecúško a či je vrecúško prázdne.
 */
export function drawLetters(currentBag, numToDraw) {
    const drawn = [];
    const tempBag = [...currentBag];
    let bagEmpty = false;

    for (let i = 0; i < numToDraw; i++) {
        if (tempBag.length > 0) {
            drawn.push(tempBag.pop());
        } else {
            console.warn("Vrecúško je prázdne, nedá sa ťahať viac písmen.");
            bagEmpty = true;
            break;
        }
    }
    return { drawnLetters: drawn, remainingBag: tempBag, bagEmpty: bagEmpty };
}

/**
 * Získa písmená, ktoré boli položené na dosku počas aktuálneho ťahu.
 * @param {Array<Array<Object|null>>} currentBoardState Aktuálny stav hracej dosky.
 * @param {Array<Array<Object|null>>} initialBoardState Stav hracej dosky na začiatku ťahu.
 * @returns {Array<Object>} Pole objektov položených písmen s ich súradnicami a dátami.
 */
export function getPlacedLettersDuringCurrentTurn(currentBoardState, initialBoardState) {
    const placed = [];
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            if (currentBoardState[r][c] && !initialBoardState[r][c]) {
                placed.push({ x: r, y: c, letterData: currentBoardState[r][c] });
            }
        }
    }
    return placed;
}

/**
 * Skontroluje, či sú písmená položené v jednom rade alebo stĺpci.
 * @param {Array<Object>} letters Pole objektov písmen s ich súradnicami.
 * @returns {boolean} True, ak sú písmená v priamke, inak False.
 */
export function isStraightLine(letters) {
    if (letters.length <= 1) return true;
    const firstX = letters[0].x;
    const firstY = letters[0].y;
    let isRow = true;
    let isCol = true;
    for (let i = 1; i < letters.length; i++) {
        if (letters[i].x !== firstX) isRow = false;
        if (letters[i].y !== firstY) isCol = false;
    }
    return isRow || isCol;
}

/**
 * Získa sekvenciu písmen v danom smere z hracej dosky.
 * Používa sa na nájdenie celého slova, vrátane už existujúcich písmen.
 * @param {number} startCoordX Počiatočná X súradnica.
 * @param {number} startCoordY Počiatočná Y súradnica.
 * @param {Array<Array<Object|null>>} boardState Aktuálny stav hracej dosky.
 * @param {number} dx Zmena X súradnice pre smer (0 pre horizontálne, 1 pre vertikálne).
 * @param {number} dy Zmena Y súradnice pre smer (1 pre horizontálne, 0 pre vertikálne).
 * @returns {Array<Object>} Pole objektov písmen tvoriacich slovo.
 */
export function getSequenceInDirection(startCoordX, startCoordY, boardState, dx, dy) {
    let letters = [];
    
    let scanX = startCoordX;
    let scanY = startCoordY;
    // Nájdenie začiatku slova (posunieme sa dozadu, kým nenarazíme na prázdne políčko alebo okraj)
    while (scanX >= 0 && scanX < 15 && scanY >= 0 && scanY < 15 && boardState[scanX][scanY]) {
        scanX -= dx;
        scanY -= dy;
    }
    // Skutočný začiatok slova je o jeden krok dopredu
    let wordStartX = scanX + dx;
    let wordStartY = scanY + dy;

    // Zbieranie písmen slova (posunieme sa dopredu, kým nenarazíme na prázdne políčko alebo okraj)
    while (wordStartX >= 0 && wordStartX < 15 && wordStartY >= 0 && wordStartY < 15 && boardState[wordStartX][wordStartY]) {
        letters.push({ x: wordStartX, y: wordStartY, letterData: boardState[wordStartX][wordStartY] });
        wordStartX += dx;
        wordStartY += dy;
    }
    return letters;
}

/**
 * Získa všetky písmená hlavného slova, ktoré bolo vytvorené položením nových písmen.
 * @param {Array<Object>} currentPlacedLetters Pole novo položených písmen.
 * @param {Array<Array<Object|null>>} currentBoard Aktuálny stav hracej dosky.
 * @returns {Array<Object>} Pole objektov písmen tvoriacich hlavné slovo.
 */
export function getFullWordLetters(currentPlacedLetters, currentBoard) {
    if (currentPlacedLetters.length === 0) return [];

    const sortedPlaced = [...currentPlacedLetters].sort((a, b) => {
        if (a.x === b.x) return a.y - b.y;
        return a.x - b.x;
    });

    const firstPlaced = sortedPlaced[0];
    let mainWord = [];

    let isHorizontal = false;
    // Určenie orientácie slova (horizontálne alebo vertikálne)
    if (sortedPlaced.length > 1 && sortedPlaced[0].x === sortedPlaced[1].x) {
        isHorizontal = true;
    } else if (sortedPlaced.length === 1) {
        // Ak je položené len jedno písmeno, skontrolujeme susedov na určenie orientácie
        const x = firstPlaced.x;
        const y = firstPlaced.y;
        const hasHorizontalNeighbor = (y > 0 && currentBoard[x][y - 1] !== null) || (y < 14 && currentBoard[x][y + 1] !== null);
        const hasVerticalNeighbor = (x > 0 && currentBoard[x - 1][y] !== null) || (x < 14 && currentBoard[x + 1][y] !== null);

        if (hasHorizontalNeighbor && !hasVerticalNeighbor) {
            isHorizontal = true;
        } else if (!hasHorizontalNeighbor && hasVerticalNeighbor) {
            isHorizontal = false;
        } else if (hasHorizontalNeighbor && hasVerticalNeighbor) {
            // Ak má horizontálnych aj vertikálnych susedov, predpokladáme horizontálne ako hlavné
            isHorizontal = true;
        } else {
            return [firstPlaced]; // Ak nemá žiadnych susedov, vrátime len to jedno písmeno
        }
    }

    // Získanie celého slova na základe určenej orientácie
    if (isHorizontal) {
        mainWord = getSequenceInDirection(firstPlaced.x, firstPlaced.y, currentBoard, 0, 1);
    } else {
        mainWord = getSequenceInDirection(firstPlaced.x, firstPlaced.y, currentBoard, 1, 0);
    }

    return mainWord;
}

/**
 * Skontroluje, či sú písmená v slove súvislé (žiadne medzery).
 * @param {Array<Object>} allWordLetters Pole objektov písmen tvoriacich slovo.
 * @returns {boolean} True, ak sú písmená súvislé, inak False.
 */
export function areLettersContiguous(allWordLetters) {
    if (allWordLetters.length <= 1) return true;
    for (let i = 0; i < allWordLetters.length - 1; i++) {
        const current = allWordLetters[i];
        const next = allWordLetters[i + 1];
        if (current.x === next.x) { // Horizontálne
            if (next.y - current.y !== 1) { return false; }
        } else if (current.y === next.y) { // Vertikálne
            if (next.x - current.x !== 1) { return false; }
        } else { // Nie sú v rade ani stĺpci
            return false;
        }
    }
    return true;
}

/**
 * NOVÁ FUNKCIA: Skontroluje, či slovo vytvorené z daných písmen je súvislé na doske.
 * Táto funkcia umožňuje, aby existujúce písmená na doske premostili medzery
 * medzi písmenami v danom zozname (napr. A_B je validné, ak _ je obsadené existujúcim písmenom).
 * @param {Array<object>} letters Zoznam písmen tvoriacich slovo (môže obsahovať novo položené aj existujúce).
 * @param {Array<Array<object|null>>} board Aktuálny stav dosky.
 * @returns {boolean} True, ak je slovo súvislé na doske, inak False.
 */
export const isWordContiguousOnBoard = (letters, board) => {
    if (letters.length <= 1) return true;

    // Zabezpečíme, že sú v priamke (horizontálne alebo vertikálne)
    const isHorizontal = letters.every(l => l.x === letters[0].x);
    const isVertical = letters.every(l => l.y === letters[0].y);

    if (!isHorizontal && !isVertical) {
        return false; // Nie sú v priamke
    }

    // Zoradíme písmená podľa ich pozície
    const sortedLetters = [...letters].sort((a, b) => {
        if (isHorizontal) return a.y - b.y;
        return a.x - b.x;
    });

    const fixedCoord = isHorizontal ? sortedLetters[0].x : sortedLetters[0].y;
    const startCoord = isHorizontal ? sortedLetters[0].y : sortedLetters[0].x;
    const endCoord = isHorizontal ? sortedLetters[sortedLetters.length - 1].y : sortedLetters[sortedLetters.length - 1].x;

    // Skontrolujeme, či sú všetky políčka v rozsahu slova obsadené nejakým písmenom (novým alebo existujúcim)
    for (let i = startCoord; i <= endCoord; i++) {
        let boardLetter = null;
        if (isHorizontal) {
            boardLetter = board[fixedCoord][i];
        } else {
            boardLetter = board[i][fixedCoord];
        }

        if (boardLetter === null) {
            return false; // Našla sa prázdna diera v rámci slova
        }
    }
    return true;
};


/**
 * Skontroluje, či novo položené písmená (a prípadné existujúce medzi nimi)
 * tvoria súvislý blok bez prázdnych medzier na hracej doske.
 * Táto funkcia rieši problém, kde `isStraightLine` len kontroluje, či sú písmená v riadku/stĺpci,
 * ale nie či sú súvislé na doske.
 * @param {Array<Object>} placedLetters Pole novo položených písmen s ich súradnicami.
 * @param {Array<Array<Object|null>>} boardState Aktuálny stav hracej dosky.
 * @returns {boolean} True, ak novo položené písmená tvoria súvislý blok, inak False.
 */
export function arePlacedLettersContiguousOnBoard(placedLetters, boardState) {
    if (placedLetters.length <= 1) {
        return true; // Jedno písmeno alebo žiadne písmená sú vždy súvislé samé so sebou.
    }

    // Predpokladáme, že isStraightLine už prešla, takže všetky písmená sú v jednom riadku alebo stĺpci.
    const isHorizontal = placedLetters.every(l => l.x === placedLetters[0].x);

    let minCoord, maxCoord;
    if (isHorizontal) {
        // Nájdenie minimálnej a maximálnej Y-súradnice medzi položenými písmenami
        minCoord = Math.min(...placedLetters.map(l => l.y));
        maxCoord = Math.max(...placedLetters.map(l => l.y));
        const row = placedLetters[0].x; // Všetky písmená sú v rovnakom riadku

        // Prejdeme všetky políčka v rozsahu od minCoord do maxCoord
        for (let y = minCoord; y <= maxCoord; y++) {
            // Skontrolujeme, či je políčko prázdne (null)
            // A zároveň, či na tomto políčku NIE JE jedno z novo položených písmen.
            // Ak je políčko prázdne a nie je to políčko, na ktoré sme práve položili písmeno,
            // znamená to medzeru.
            const isCellOccupiedByPlacedLetter = placedLetters.some(pl => pl.x === row && pl.y === y);
            if (boardState[row][y] === null && !isCellOccupiedByPlacedLetter) {
                return false; // Nájdená prázdna medzera v rozsahu novo položených písmen
            }
        }
    } else { // Vertikálne
        // Nájdenie minimálnej a maximálnej X-súradnice medzi položenými písmenami
        minCoord = Math.min(...placedLetters.map(l => l.x));
        maxCoord = Math.max(...placedLetters.map(l => l.x));
        const col = placedLetters[0].y; // Všetky písmená sú v rovnakom stĺpci

        // Prejdeme všetky políčka v rozsahu od minCoord do maxCoord
        for (let x = minCoord; x <= maxCoord; x++) {
            const isCellOccupiedByPlacedLetter = placedLetters.some(pl => pl.x === x && pl.y === col);
            if (boardState[x][col] === null && !isCellOccupiedByPlacedLetter) {
                return false; // Nájdená prázdna medzera v rozsahu novo položených písmen
            }
        }
    }
    return true;
}


/**
 * Skontroluje, či sú novo položené písmená pripojené k existujúcim písmenám na doske.
 * V prípade prvého ťahu skontroluje, či pokrývajú stredové políčko.
 * @param {Array<Object>} currentPlacedLetters Pole novo položených písmen.
 * @param {Array<Array<Object|null>>} currentBoard Aktuálny stav hracej dosky.
 * @param {boolean} isFirstTurn Indikátor, či ide o prvý ťah v hre.
 * @param {Array<Object>} allWordLetters Všetky písmená tvoriace hlavné slovo (vrátane existujúcich).
 * @returns {boolean} True, ak sú písmená pripojené/pokrývajú stred, inak False.
 */
export function isConnected(currentPlacedLetters, currentBoard, isFirstTurn, allWordLetters) {
    if (currentPlacedLetters.length === 0) return false;

    if (isFirstTurn) {
        const centerSquare = { x: 7, y: 7 };
        const coversCenter = currentPlacedLetters.some(
            (l) => l.x === centerSquare.x && l.y === centerSquare.y
        );
        if (!coversCenter) { return false; }
    } else {
        // Skontroluje, či hlavné slovo obsahuje už existujúce písmeno z dosky
        const hasExistingLetterInLine = allWordLetters.some(l => 
            !currentPlacedLetters.some(pl => pl.x === l.x && pl.y === l.y)
        );
        
        // Skontroluje, či aspoň jedno novo položené písmeno susedí s existujúcim písmenom na doske
        const touchesExistingNeighbor = currentPlacedLetters.some(pl => {
            const neighbors = [
                [pl.x - 1, pl.y], [pl.x + 1, pl.y], [pl.x, pl.y - 1], [pl.x, pl.y + 1]
            ];
            return neighbors.some(([nx, ny]) =>
                nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && currentBoard[nx][ny] &&
                !currentPlacedLetters.some(l => l.x === nx && l.y === ny) // Sused nie je novo položené písmeno
            );
        });

        if (!hasExistingLetterInLine && !touchesExistingNeighbor) {
            return false;
        }
    }
    return true;
}

/**
 * Získa všetky platné slová vytvorené v danom ťahu.
 * @param {Array<Object>} actualPlacedLetters Pole novo položených písmen.
 * @param {Array<Array<Object|null>>} currentBoard Aktuálny stav hracej dosky.
 * @returns {Array<Object>} Pole objektov slov (wordString, letters).
 */
export function getAllWordsInTurn(actualPlacedLetters, currentBoard) {
    const formedWordObjects = [];
    // removed: const addedWordStrings = new Set(); // Už nepotrebné, ak počítame duplicitné slová

    const addWordIfValid = (wordLetters) => { // Premenované pre jasnosť
        // Slovo musí mať aspoň 2 písmená, aby bolo považované za platné Scrabble slovo
        if (wordLetters.length > 1) {
            const wordString = wordLetters.map(l => (l.letterData.letter === '' ? l.letterData.assignedLetter : l.letterData.letter)).join('');
            // Nie je potrebné kontrolovať addedWordStrings, pretože chceme započítať všetky vytvorené slová
            formedWordObjects.push({ wordString, letters: wordLetters });
        }
    };

    // Získanie hlavného slova
    const mainWord = getFullWordLetters(actualPlacedLetters, currentBoard);
    // Skontrolujeme, či mainWord obsahuje aspoň jedno novo položené písmeno
    const mainWordContainsNewLetter = mainWord.some(letter => 
        actualPlacedLetters.some(pLetter => pLetter.x === letter.x && pLetter.y === letter.y)
    );
    if (mainWordContainsNewLetter) { // Pridáme hlavné slovo, len ak bolo novovytvorené položeným písmenom
        addWordIfValid(mainWord);
    }
    

    // Získanie krížových slov pre každé novo položené písmeno
    actualPlacedLetters.forEach(pLetter => {
        const { x, y } = pLetter;

        // Horizontálne krížové slovo (ak existuje a nie je totožné s hlavným slovom, pokiaľ ide o pozíciu)
        const horizontalCrossWord = getSequenceInDirection(x, y, currentBoard, 0, 1);
        if (horizontalCrossWord.length > 1) { // Krížové slovo musí mať viac ako 1 písmeno
            addWordIfValid(horizontalCrossWord);
        }

        // Vertikálne krížové slovo (ak existuje a nie je totožné s hlavným slovom, pokiaľ ide o pozíciu)
        const verticalCrossWord = getSequenceInDirection(x, y, currentBoard, 1, 0);
        if (verticalCrossWord.length > 1) { // Krížové slovo musí mať viac ako 1 písmeno
            addWordIfValid(verticalCrossWord);
        }
    });

    // Filtrujeme potenciálne duplicitné slová, ktoré sú však na rovnakom mieste a v rovnakom smere.
    // Napr. ak je "EX" horizontálne hlavné slovo, a zároveň sa generuje ako horizontálne krížové slovo z E alebo X.
    // Aby sme predišli zdvojeniu, budeme porovnávať nielen reťazec, ale aj súradnice všetkých písmen v slove.
    const uniqueWordObjects = [];
    const addedWordPositions = new Set(); // Set pre ukladanie unikátnych identifikátorov (napr. "wordString_x1y1_x2y2...")

    formedWordObjects.forEach(wordObj => {
        // Vytvoríme unikátny identifikátor pre slovo na základe jeho písmen a ich súradníc
        // Sortovanie zabezpečí, že poradie písmen pri rekonštrukcii stringu je konzistentné
        const sortedLetters = [...wordObj.letters].sort((a, b) => {
            if (a.x === b.x) return a.y - b.y;
            return a.x - b.x;
        });
        const identifier = sortedLetters.map(l => `${l.x},${l.y}`).join('_');
        
        if (!addedWordPositions.has(identifier)) {
            addedWordPositions.add(identifier);
            uniqueWordObjects.push(wordObj);
        }
    });

    return uniqueWordObjects;
}

/**
 * Vypočíta skóre pre dané slovo, berúc do úvahy bonusové políčka.
 * @param {Array<Object>} wordLetters Pole objektov písmen tvoriacich slovo.
 * @param {Array<Array<Object|null>>} boardStateAtStartOfTurn Stav hracej dosky na začiatku ťahu (pre určenie nových písmen).
 * @returns {number} Celkové skóre slova.
 */
export function calculateWordScore(wordLetters, boardStateAtStartOfTurn) {
    let wordScore = 0;
    let wordMultiplier = 1;

    wordLetters.forEach(letterObj => {
        const { x, y, letterData } = letterObj;
        const bonusType = bonusSquares[`${x},${y}`];
        // Hodnota žolíka (letter === '') je vždy 0, bez ohľadu na assignedLetter
        let letterValue = (letterData.letter === '') ? 0 : (LETTER_VALUES[letterData.letter] || 0);

        const isNewLetter = boardStateAtStartOfTurn[x][y] === null; // Je to novo položené písmeno v tomto ťahu?

        if (isNewLetter) {
            if (bonusType === BONUS_TYPES.DOUBLE_LETTER) {
                letterValue *= 2;
            } else if (bonusType === BONUS_TYPES.TRIPLE_LETTER) {
                letterValue *= 3;
            } else if (bonusType === BONUS_TYPES.DOUBLE_WORD || bonusType === BONUS_TYPES.START_SQUARE) {
                wordMultiplier *= 2;
            } else if (bonusType === BONUS_TYPES.TRIPLE_WORD) {
                wordMultiplier *= 3;
            }
        }
        wordScore += letterValue;
    });

    wordScore *= wordMultiplier;
    return wordScore;
}

/**
 * Vypočíta body za písmená zostávajúce na racku hráča.
 * @param {Array<Object|null>} rack Rack hráča.
 * @returns {number} Celkový počet bodov za písmená na racku.
 */
export function getRackPoints(rack) {
    return rack.reduce((sum, letter) => {
        if (!letter) return sum;
        // Hodnota žolíka na racku je 0
        return sum + (letter.letter === '' ? 0 : (LETTER_VALUES[letter.letter] || 0));
    }, 0);
}

/**
 * Vypočíta konečné skóre na konci hry.
 * @param {number} endingPlayerIndex Index hráča, ktorý ukončil hru.
 * @param {Array<Object|null>} finalRackLetters Rack hráča, ktorý ukončil hru (mal by byť prázdny, ak ukončil hru).
 * @param {Array<number>} playerScores Aktuálne skóre hráčov.
 * @param {Array<Array<Object|null>>} playerRacks Racky všetkých hráčov.
 * @returns {Array<number>} Konečné skóre hráčov.
 */
export function calculateFinalScores(endingPlayerIndex, finalRackLetters, playerScores, playerRacks) {
    let finalScores = [...playerScores];

    for (let i = 0; i < playerScores.length; i++) {
        const rack = (i === endingPlayerIndex) ? finalRackLetters : playerRacks[i];
        const pointsOnRack = getRackPoints(rack);
        
        finalScores[i] -= pointsOnRack;
    }

    return finalScores;
}
