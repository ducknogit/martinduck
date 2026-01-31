"""
Lightweight Flask server to host Wintrchess analysis UI and run ShashChess 40
as a backend engine. Listens on http://localhost:3669.

All changes are contained inside wintrchess/python_server to avoid touching
the main project sources.
"""

from __future__ import annotations

import json
import logging
import multiprocessing
import subprocess
from io import StringIO
from pathlib import Path
from typing import Dict, List, Optional

import chess
import chess.pgn
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
ENGINE_PATH = ROOT_DIR.parent / "Windows" / "ShashChess40-x86-64.exe"

PORT = 3669
DEFAULT_MOVETIME_MS = 1500
DEFAULT_MULTIPV = 3

app = Flask(__name__, static_folder=str(BASE_DIR / "static"))
CORS(app)

log = logging.getLogger("werkzeug")
log.setLevel(logging.ERROR)
app.logger.disabled = True
log.disabled = True

def parse_engine_info_line(parts: List[str]) -> Optional[Dict]:
    """
    Extract multipv, score, depth, pv moves from an 'info' line tokens.
    Stockfish prints `multipv` only when MultiPV > 1; default it to 1 so
    single-PV lines are still captured.
    """
    multipv = None
    score_cp = None
    mate = None
    depth = None
    pv_moves: List[str] = []

    i = 0
    while i < len(parts):
        token = parts[i]
        if token == "multipv" and i + 1 < len(parts):
            multipv = int(parts[i + 1])
            i += 2
        elif token == "score" and i + 2 < len(parts):
            if parts[i + 1] == "cp":
                score_cp = int(parts[i + 2])
            elif parts[i + 1] == "mate":
                mate = int(parts[i + 2])
            i += 3
        elif token == "depth" and i + 1 < len(parts):
            depth = int(parts[i + 1])
            i += 2
        elif token == "pv":
            pv_moves = parts[i + 1 :]
            i += 1
        else:
            i += 1

    if multipv is None:
        multipv = 1

    if not pv_moves:
        return None

    return {
        "multipv": multipv,
        "scoreCp": score_cp,
        "mate": mate,
        "depth": depth,
        "pv": pv_moves,
    }

def analyse_fen(fen: str, multipv: int = DEFAULT_MULTIPV, movetime_ms: int = DEFAULT_MOVETIME_MS):
    if not ENGINE_PATH.exists():
        raise FileNotFoundError(f"Engine not found at {ENGINE_PATH}")

    cmd = [str(ENGINE_PATH)]
    engine = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        creationflags=0x08000000  

    )

    threads = multiprocessing.cpu_count()
    lines: Dict[int, Dict] = {}
    bestmove = None

    def send(cmd_str: str):
        engine.stdin.write(cmd_str + "\n")
        engine.stdin.flush()

    try:
        send("uci")
        while True:
            raw = engine.stdout.readline()
            if raw is None or raw == "":
                continue
            line = raw.strip()

            if line == "uciok":
                send(f"setoption name Threads value {threads}")
                send("setoption name Hash value 1024")
                send("setoption name MultiPV value {}".format(max(1, multipv)))
                send("isready")
                continue

            if line == "readyok":
                send(f"position fen {fen}")
                send(f"go movetime {movetime_ms}")
                continue

            if line.startswith("info") and "pv" in line and "multipv" in line:
                parsed = parse_engine_info_line(line.split())
                if parsed:
                    idx = parsed["multipv"]
                    lines[idx] = parsed
                continue

            if line.startswith("bestmove"):
                bestmove = line.split()[1] if len(line.split()) > 1 else None
                break
    finally:
        try:
            engine.terminate()
            engine.wait(timeout=1)
        except Exception:
            pass

    result_lines = []
    for idx in sorted(lines):
        entry = lines[idx]
        if entry.get("mate") is not None:
            eval_type = "mate"
            eval_value = entry["mate"]
        else:
            eval_type = "centipawn"
            eval_value = entry.get("scoreCp")

        result_lines.append(
            {
                "index": idx,
                "evaluation": {"type": eval_type, "value": eval_value},
                "depth": entry.get("depth"),
                "pv": entry.get("pv"),
            }
        )

    return {"fen": fen, "bestmove": bestmove, "lines": result_lines}

def pgn_to_fen(pgn_text: str, ply: Optional[int] = None) -> str:
    """Return FEN at given ply (full-move half-move index), default last."""
    game = chess.pgn.read_game(StringIO(pgn_text))
    if game is None:
        raise ValueError("Cannot parse PGN")

    board = game.board()
    moves = list(game.mainline_moves())

    target = len(moves) if ply is None else min(ply, len(moves))
    for idx, move in enumerate(moves):
        if idx >= target:
            break
        board.push(move)

    if ply is None and board.is_game_over() and len(moves) > 0:
        board.pop()

    return board.fen()

@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    data = request.get_json(force=True, silent=True) or {}
    pgn = data.get("pgn")
    fen = data.get("fen")
    ply = data.get("ply")
    multipv = int(data.get("multipv") or DEFAULT_MULTIPV)
    movetime_ms = int(data.get("movetimeMs") or DEFAULT_MOVETIME_MS)

    try:
        target_fen = fen or pgn_to_fen(pgn, ply)
        result = analyse_fen(target_fen, multipv=multipv, movetime_ms=movetime_ms)
        return jsonify({"success": True, **result})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

@app.route("/", methods=["GET"])
def index():

    return analysis_page()

@app.route("/static/<path:path>")
def static_files(path: str):
    return send_from_directory(app.static_folder, path)

@app.route("/bundles/<path:path>")
def bundle_files(path: str):

    return send_from_directory(ROOT_DIR / "client" / "dist", path)

@app.route("/engines/<path:path>")
def engine_files(path: str):

    return send_from_directory(ROOT_DIR / "client" / "public" / "engines", path)

@app.route("/app/analysis")
def analysis_page():

    return send_from_directory(
        ROOT_DIR / "client" / "public" / "apps" / "features", "analysis.html"
    )

@app.route("/locales/<lang>/<ns>.json")
def locales(lang: str, ns: str):
    path = ROOT_DIR / "client" / "public" / "locales" / lang / f"{ns}.json"
    if path.exists():
        return send_from_directory(path.parent, path.name)
    return app.response_class("{}", mimetype="application/json")

@app.route("/<path:bundle>")
def bundles_root(bundle: str):

    dist_path = ROOT_DIR / "client" / "dist" / bundle
    pub_path = ROOT_DIR / "client" / "public" / bundle
    if dist_path.exists():
        return send_from_directory(dist_path.parent, dist_path.name)
    if pub_path.exists():
        return send_from_directory(pub_path.parent, pub_path.name)
    return ("Not Found", 404)

@app.route("/locales/en/translation.json")
def locales_translation():

    return app.response_class("{}", mimetype="application/json")

@app.route("/api/account/profile")
def stub_profile():
    return jsonify({"user": None})

@app.route("/api/public/announcement")
def stub_announcement():
    return jsonify({"announcements": []})

@app.route("/auth/captcha")
def stub_captcha():
    return jsonify({"token": "dummy"})

@app.route("/client-log", methods=["POST"])
def client_log():
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {"raw": request.data.decode("utf-8", errors="ignore")}

    return jsonify({"ok": True})

@app.route("/public/<path:path>")
def public_assets(path: str):

    return send_from_directory(ROOT_DIR / "client" / "public", path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)

