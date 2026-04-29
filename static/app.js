const boardNode = document.getElementById("board");
const messageNode = document.getElementById("message");
const logNode = document.getElementById("log");
const newGameBtn = document.getElementById("new-game-btn");

const resultBanner = document.getElementById("result-banner");
const resultTitle = document.getElementById("result-title");
const resultSubtitle = document.getElementById("result-subtitle");
const resultMeme = document.getElementById("result-meme");

const statsNodes = {
  games: document.getElementById("games"),
  xWins: document.getElementById("x-wins"),
  oWins: document.getElementById("o-wins"),
  draws: document.getElementById("draws"),
  streak: document.getElementById("streak"),
};

const MEMES = {
  x: ["/static/memes/win_1.svg", "/static/memes/win_2.svg"],
  o: ["/static/memes/lose_1.svg", "/static/memes/lose_2.svg"],
  draw: ["/static/memes/draw_1.svg", "/static/memes/draw_2.svg"],
};

let board = Array(9).fill("");
let gameOver = false;
let resultRecorded = false;

function renderBoard() {
  boardNode.querySelectorAll(".cell").forEach((cell, index) => {
    const value = board[index];
    cell.textContent = value;
    cell.classList.toggle("x", value === "X");
    cell.classList.toggle("o", value === "O");
    cell.disabled = gameOver || value !== "";
  });
}

function setMessage(text) {
  messageNode.textContent = text;
}

function hideResultBanner() {
  resultBanner.hidden = true;
  resultMeme.removeAttribute("src");
}

function pickMeme(resultCode) {
  const list = MEMES[resultCode] ?? MEMES.draw;
  return list[Math.floor(Math.random() * list.length)];
}

function showResultBanner(resultCode, message) {
  if (resultCode === "x") {
    resultTitle.textContent = "Wygrałaś! 🎉";
    resultSubtitle.textContent = "Piękna robota. Bot prosi o rewanż.";
  } else if (resultCode === "o") {
    resultTitle.textContent = "Bot wygrał 😅";
    resultSubtitle.textContent = "Spokojnie, to była tylko runda testowa.";
  } else {
    resultTitle.textContent = "Remis 🤝";
    resultSubtitle.textContent = "Bardzo wyrównany mecz!";
  }

  resultMeme.src = pickMeme(resultCode);
  resultMeme.alt = `Meme po wyniku: ${resultCode}`;
  resultBanner.hidden = false;
  setMessage(message);
}

function log(text) {
  if (logNode.children.length === 1 && logNode.firstElementChild.textContent.includes("Start gry")) {
    logNode.innerHTML = "";
  }
  const item = document.createElement("li");
  item.textContent = text;
  logNode.prepend(item);

  while (logNode.children.length > 10) {
    logNode.removeChild(logNode.lastChild);
  }
}

function resultCodeFromResponse(data) {
  if (data.winner === "X") {
    return "x";
  }
  if (data.winner === "O") {
    return "o";
  }
  return "draw";
}

async function recordResult(resultCode) {
  if (resultRecorded) {
    return;
  }
  resultRecorded = true;

  const response = await fetch("/api/record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: resultCode }),
  });
  const data = await response.json();
  if (!data.stats) {
    return;
  }

  statsNodes.games.textContent = data.stats.games;
  statsNodes.xWins.textContent = data.stats.x_wins;
  statsNodes.oWins.textContent = data.stats.o_wins;
  statsNodes.draws.textContent = data.stats.draws;
  statsNodes.streak.textContent = data.stats.player_streak;
}

async function playMove(index) {
  if (gameOver || board[index] !== "") {
    return;
  }

  const response = await fetch("/api/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board, index }),
  });
  const data = await response.json();

  if (!response.ok) {
    setMessage(data.error || "Ups, coś poszło nie tak.");
    return;
  }

  board = data.board;
  gameOver = data.game_over;
  setMessage(data.message);
  renderBoard();

  log(`Ty: pole ${index + 1}`);
  if (typeof data.bot_index === "number") {
    log(`Bot: pole ${data.bot_index + 1}`);
  }

  if (gameOver) {
    const code = resultCodeFromResponse(data);
    await recordResult(code);
    showResultBanner(code, data.message);
    if (code === "x") {
      log("Koniec: wygrana gracza X.");
    } else if (code === "o") {
      log("Koniec: wygrana bota O.");
    } else {
      log("Koniec: remis.");
    }
  }
}

async function newGame() {
  const response = await fetch("/api/new", { method: "POST" });
  const data = await response.json();

  board = data.board;
  gameOver = false;
  resultRecorded = false;
  hideResultBanner();
  setMessage(data.message || "Nowa rozgrywka.");
  log("Nowa gra uruchomiona.");
  renderBoard();
}

boardNode.querySelectorAll(".cell").forEach((cell) => {
  cell.addEventListener("click", () => {
    const index = Number(cell.dataset.index);
    playMove(index);
  });
});

newGameBtn.addEventListener("click", newGame);

hideResultBanner();
renderBoard();
