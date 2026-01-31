const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const linesEl = document.getElementById("lines");
const pgnEl = document.getElementById("pgn");
const multipvEl = document.getElementById("multipv");
const movetimeEl = document.getElementById("movetime");
const plyEl = document.getElementById("ply");

let board = null;
const BoardCtor = window.ChessBoard || window.Chessboard;
const pieceBase = "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/";
const pieceTheme = (piece) => `${pieceBase}${piece.toLowerCase()}.png`;

if (BoardCtor) {
  board = BoardCtor("board", {
    draggable: false,
    position: "start",
    pieceTheme
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setProgress(percent) {
  progressBar.style.width = `${percent}%`;
}

function renderLines(fen, lines) {
  linesEl.innerHTML = "";
  const chess = new Chess(fen);

  lines.forEach((line) => {
    const lineDiv = document.createElement("div");
    lineDiv.className = "line";

    let scoreText = "";
    if (line.evaluation.type === "mate") {
      scoreText = `#${line.evaluation.value}`;
    } else if (line.evaluation.value !== null) {
      scoreText = (line.evaluation.value / 100).toFixed(2);
    }

    const pvSan = [];
    chess.reset();
    chess.load(fen);
    for (const move of line.pv || []) {
      try {
        const played = chess.move(move, { sloppy: true });
        if (!played) break;
        pvSan.push(played.san);
      } catch {
        break;
      }
    }

    lineDiv.innerHTML = `
      <div><strong>${line.index}</strong> · depth ${line.depth ?? "?"}</div>
      <div class="${line.evaluation.type === "mate" ? "mate" : "score"}">${scoreText}</div>
      <div>${pvSan.join(" ")}</div>
    `;

    linesEl.appendChild(lineDiv);
  });
}

async function analyze() {
  const pgn = pgnEl.value.trim();
  if (!pgn) {
    alert("Paste PGN first.");
    return;
  }

  setStatus("Parsing PGN…");
  setProgress(5);

  try {
    const payload = {
      pgn,
      multipv: multipvEl.value,
      movetimeMs: movetimeEl.value,
    };
    if (plyEl.value) payload.ply = Number(plyEl.value);

    setStatus("Analyzing with engine…");
    setProgress(15);

    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error || "analysis failed");
    }

    if (board) {
      board.position(data.fen);
    }
    const lines = data.lines || [];
    renderLines(data.fen, lines);
    setProgress(100);
    setStatus(lines.length ? "Done" : "Done (no lines returned, try higher movetime)");
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
    setProgress(0);
  }
}

document.getElementById("analyze").addEventListener("click", analyze);
