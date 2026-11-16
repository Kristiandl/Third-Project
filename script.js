const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

const STORAGE_KEYS = {
  rows: "wordle-rows", // localStorage: fuldførte rækker
  secretWord: "wordle-word", // sessionStorage: ordet der skal gættes
};

let secretWord = "";
let wordList = [];
let currentRow = 0;
let currentTile = 0;
let gameOver = false;
let stats = { wins: 0, losses: 0 };

function init() {
  // Hent statistik, hent/vælg ord, genskab evt. rækker, sæt event listeners
  setupEventListeners();
  loadStats();

  loadWordList()
    .then(() => {
      secretWord = loadSecretWord();

      if (!secretWord || !wordList.includes(secretWord)) {
        secretWord = pickRandomWord();
        saveSecretWord(secretWord);
      }

      restoreRows();
      updateStatsUI();
    })
    .catch((error) => {
      console.error("Kunne ikke starte spillet.", error)
      document.getElementById("message").textContent =
        "Spillet kunne ikke startes. Prøv at genindlæse siden."
    })
}

function startNewGame() {
  // Nulstil bræt, tastatur, række/felt-tællere og gameOver
  // Vælg nyt ord og gem det i sessionStorage
  // Ryd gemte rækker i localStorage
  const rows = document.querySelectorAll("#board .row");

  rows.forEach((row) => {
    row.classList.remove("shake");
    row.querySelectorAll(".tile").forEach((tile) => {
      tile.textContent = "";
      tile.classList.remove("filled", "correct", "present", "absent", "flip");
    });
  });

  document.querySelectorAll("#keyboard .key").forEach((key) => {
    key.classList.remove("correct", "present", "absent");
  });

  currentRow = 0;
  currentTile = 0;
  gameOver = false;

  secretWord = pickRandomWord();
  saveSecretWord(secretWord);
  localStorage.removeItem(STORAGE_KEYS.rows);
  showMessage("");
  updateStatsUI();
}

// Lytter på fysisk tastatur, skærmtastatur og "Nyt spil"-knap
function setupEventListeners() {
  // Fysisk tastatur
  document.addEventListener("keydown", (event) => {
    handleKeyPress(event.key);
  });

  const newGameButton = document.getElementById("new-game");
  if (newGameButton) {
    newGameButton.addEventListener("click", startNewGame);
  }

  // Onscreen keyboard
  const keys = document.querySelectorAll(".key");

  keys.forEach((key) => {
    key.addEventListener("click", () => {
      handleKeyPress(key.dataset.key);
    });
  });
}

// Hent win/loss fra localStorage og gem i stats
function loadStats() {
  stats.wins = Number(localStorage.getItem("wins")) || 0;
  stats.losses = Number(localStorage.getItem("losses")) || 0;
  updateStatsUI();
}

// Gem win/loss i localStorage
function saveStats() {
  localStorage.setItem("wins", stats.wins);
  localStorage.setItem("losses", stats.losses);
}

// Udregn win-rate i procent ud fra stats
function calculateWinRate() {
  const total = stats.wins + stats.losses;
  if (total === 0) return 0;
  return Math.round((stats.wins / total) * 100);
}

// Opdater #wins, #losses og #winrate i DOM
function updateStatsUI() {
  document.getElementById("wins").textContent = stats.wins;
  document.getElementById("losses").textContent = stats.losses;
  document.getElementById("winrate").textContent = calculateWinRate();
}

// Hent ordbogen med gyldige ord fra filen
function loadWordList() {
  return fetch("5-letter-words.txt")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.text()
    })
    .then((text) => {
      wordList = text
        .split(/\r?\n/)
        .map((word) => word.trim().toUpperCase())
        .filter((word) => word.length === WORD_LENGTH)

      if (wordList.length === 0) {
        throw new Error("Ordlisten indeholder ingen gyldige ord.")
      }

      return wordList
    })
}

// Vælg et tilfældigt ord fra ordlisten
function pickRandomWord() {
  if (wordList.length === 0) {
    throw new Error("Ordlisten er ikke indlæst.")
  }

  const randomIndex = Math.floor(Math.random() * wordList.length)
  return wordList[randomIndex]
}

// Gem ordet i sessionStorage
function saveSecretWord(word) {
  sessionStorage.setItem(STORAGE_KEYS.secretWord, word);
}

// Hent ordet fra sessionStorage (hvis det findes)
function loadSecretWord() {
  return sessionStorage.getItem(STORAGE_KEYS.secretWord);
}

// Samlet indgang for alle input (fysisk tast og skærmtast)
// Skal sende videre til addLetter, removeLetter eller submitGuess
function handleKeyPress(key) {
  if (gameOver) {
    return;
  }

  key = key.toUpperCase();

  if (key === "ENTER") {
    submitGuess();
    return;
  }

  if (key === "BACKSPACE") {
    removeLetter();
    return;
  }

  if (/^[A-ZÆØÅ]$/.test(key)) {
    addLetter(key);
  }
}

// Vis bogstav i det aktive felt og gør næste felt (til højre) aktivt
function addLetter(letter) {
  if (currentTile >= WORD_LENGTH) {
    return;
  }

  const tile = getTileElement(currentRow, currentTile);

  tile.textContent = letter;
  tile.classList.add("filled");

  currentTile++;
}

// Slet seneste bogstav og flyt aktivt felt et skridt tilbage
function removeLetter() {
  if (currentTile <= 0) {
    return;
  }

  currentTile--;

  const tile = getTileElement(currentRow, currentTile);

  tile.textContent = "";
  tile.classList.remove("filled");
}

// Hjælpefunktioner til at finde elementer i DOM
function getCurrentRowElement() {
  const rows = document.querySelectorAll("#board .row");
  return rows[currentRow];
}

function getTileElement(rowIndex, tileIndex) {
  const rows = document.querySelectorAll("#board .row");
  return rows[rowIndex].children[tileIndex];
}

function getKeyElement(letter) {
  return document.querySelector(
        `#keyboard .key[data-key="${letter}"]`
    );
}

// Kaldes ved Enter: tjek at rækken er fuld, ordet er gyldigt, og vurdér gættet
function submitGuess() {
  // Kontrollér om alle felter er udfyldt
  if (!isRowComplete()) {
    showMessage("Du skal udfylde alle 5 felter!");
    shakeRow();
    return;
  }

  // Hent spillerens gæt
  const guess = getCurrentGuess();

  // Kontrollér om ordet er gyldigt
  if (!isValidWord(guess)) {
    showMessage("Det er ikke et gyldigt ord!");
    shakeRow();
    return;
  }

  // Sammenlign gættet med det hemmelige ord
  const result = evaluateGuess(guess);

  // Farv felterne
  colorRow(result);

  // Opdater tastaturets farver
  updateKeyboard(guess, result);

  // Gem rækken
  saveRow(guess, result);

  // Kontrollér om spilleren har vundet
  if (checkWin(guess)) {
    endGame(true);
    showMessage("Tillykke! Du har gættet ordet!");
    return;
  }

  // Kontrollér om spilleren har brugt alle forsøg
  if (checkLoss()) {
    endGame(false);
    showMessage(`Du tabte! Ordet var ${secretWord.toUpperCase()}`);
    return;
  }

  // Gå videre til næste række
  nextRow();

  showMessage("");
}

// Er alle 5 felter i den aktive række udfyldt?
function isRowComplete() {
  const row = getCurrentRowElement();
  const tiles = row.querySelectorAll(".tile");

  return Array.from(tiles).every((tile) => tile.textContent.trim() !== "");
}
// Læs ordet i den aktive række som en streng
function getCurrentGuess() {
  const row = getCurrentRowElement();
  let guess = "";

  for (const tile of row.children) {
    guess += tile.textContent;
  }

  return guess;
}

// Findes ordet i ordbogen?
function isValidWord(word) {
  return wordList.includes(word);
}

// Sammenlign gæt med secretWord
// Returnér en liste med "correct" / "present" / "absent" for hvert bogstav
function evaluateGuess(guess) {
  const resultOfGuessTiles = [];
  const remainingLetters = [];

  // Correct letter in the correct place
  for (let i = 0; i < WORD_LENGTH; i++) {
    resultOfGuessTiles.push("absent");
    remainingLetters.push(secretWord[i]);

    if (guess[i] === secretWord[i]) {
      resultOfGuessTiles[i] = "correct";
      remainingLetters[i] = null;
    }
  }

  // Correct letter in the wrong place
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (resultOfGuessTiles[i] !== "correct") {
      for (let j = 0; j < WORD_LENGTH; j++) {
        if (guess[i] === remainingLetters[j]) {
          resultOfGuessTiles[i] = "present";
          remainingLetters[j] = null;
          break;
        }
      }
    }
  }

  return resultOfGuessTiles;
}

// Er gættet lig med secretWord?
function checkWin(guess) {
  return guess === secretWord;
}

// Vis tekst i #message (fx "Ikke et gyldigt ord", "Du vandt!")
function showMessage(text) {
  const message = document.querySelector("#message");
  message.textContent = text;
}

// Farv felterne i den aktive række efter resultatet fra evaluateGuess
function colorRow(result) {
  const row = getCurrentRowElement();
  const tiles = row.querySelectorAll(".tile");

  tiles.forEach((tile, index) => {
    tile.classList.remove("correct", "present", "absent");
    tile.classList.add(result[index]);
    tile.classList.add("flip");
  });
}

// Markér brugte bogstaver på tastaturet: grå (forkert), grøn eller gul
// Husk: en tast der allerede er grøn må ikke nedgraderes til gul
function updateKeyboard(guess, result) {
  for (let i = 0; i < guess.length; i++) {

        const letter = guess[i];
        const status = result[i];
        const key = getKeyElement(letter);

        if (!key) continue;

        // Grøn må aldrig overskrives
        if (key.classList.contains("correct")) continue;

        // Gul må ikke ændres til grå
        if (key.classList.contains("present")
            && status === "absent") continue;

        key.classList.remove("correct", "present", "absent");
        key.classList.add(status);
    }
}

// Gem den fuldførte række i localStorage
function saveRow(guess, result) {
  const savedRows = JSON.parse(localStorage.getItem(STORAGE_KEYS.rows) || "[]");
  savedRows.push({ guess, result });
  localStorage.setItem(STORAGE_KEYS.rows, JSON.stringify(savedRows));
}

// Genskab tidligere rækker fra localStorage (hvis siden genindlæses)
function restoreRows() {
  const savedRows = JSON.parse(localStorage.getItem(STORAGE_KEYS.rows) || "[]");

  if (!Array.isArray(savedRows) || savedRows.length === 0) {
    currentRow = 0;
    currentTile = 0;
    gameOver = false;
    return;
  }

  savedRows.forEach((rowState, rowIndex) => {
    const row = document.querySelectorAll("#board .row")[rowIndex];
    if (!row) return;

    rowState.guess.split("").forEach((letter, tileIndex) => {
      const tile = row.children[tileIndex];
      if (!tile) return;

      tile.textContent = letter;
      tile.classList.add("filled");
      tile.classList.add(rowState.result[tileIndex]);
    });

    updateKeyboard(rowState.guess, rowState.result);
  });

  currentRow = savedRows.length;
  currentTile = 0;
  gameOver = savedRows.length >= MAX_ATTEMPTS;
}

// Var det sidste forsøg (6. række) uden at have vundet?
function checkLoss() {
  return currentRow >= MAX_ATTEMPTS - 1;
}

// Gør næste række aktiv og nulstil aktivt felt
function nextRow() {
  currentRow += 1;
  currentTile = 0;
}

// Afslut spil: opdater stats, gem, vis besked
// won = true (vundet) eller false (tabt)
function endGame(won) {
  gameOver = true;

  if (won) {
    stats.wins += 1;
  } else {
    stats.losses += 1;
  }

  saveStats();
  updateStatsUI();
}

// Ryst aktiv række (klassen .shake) ved ugyldigt ord eller for få bogstaver
function shakeRow() {
  const row = getCurrentRowElement();
  row.classList.remove("shake");
  void row.offsetWidth;
  row.classList.add("shake");
}

// ---------- Start spillet ---------- //
init();
