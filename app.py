# Copyright (c) 2026 Ducknovis
# Licensed under the MIT License. See LICENSE file in the project root for full license information.
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import json
from pathlib import Path
import multiprocessing
import logging

app = Flask(__name__)
CORS(app)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
app.logger.disabled = True
log.disabled = True

PORT = 3667
ENGINE_PATH = os.path.join(os.path.dirname(__file__), 'Windows', 'ShashChess40-x86-64.exe')

def analyze_position(fen, limit=4):
    try:

        startupinfo = None
        creation_flags = 0

        if os.name == 'nt':  

            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE
            creation_flags = subprocess.CREATE_NO_WINDOW

        engine = subprocess.Popen(
            [ENGINE_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            startupinfo=startupinfo,
            creationflags=creation_flags
        )

        moves = []
        best_score = None

        engine.stdin.write('uci\n')
        engine.stdin.flush()

        uci_ready = False
        position_set = False

        while True:
            line = engine.stdout.readline().strip()

            if not line:
                continue

            if 'uciok' in line and not uci_ready:
                threads = multiprocessing.cpu_count()
                engine.stdin.write(f'setoption name Threads value {threads}\n')
                engine.stdin.write('setoption name Hash value 1024\n')
                engine.stdin.write('setoption name Contempt value 20\n')
                engine.stdin.write('setoption name Aggressiveness value 200\n') 
                multi_pv = 1 if limit == 1 else 8
                engine.stdin.write(f'setoption name MultiPV value {multi_pv}\n')
                engine.stdin.write('isready\n')
                engine.stdin.flush()
                uci_ready = True

            if 'readyok' in line and not position_set:
                engine.stdin.write(f'position fen {fen}\n')
                engine.stdin.write('go movetime 1000\n')
                engine.stdin.flush()
                position_set = True

            if line.startswith('info') and 'multipv' in line:
                parts = line.split()

                multipv_idx = None
                score_cp = None
                mate_score = None
                pv_moves = []

                i = 0
                while i < len(parts):
                    if parts[i] == 'multipv':
                        multipv_idx = int(parts[i + 1]) - 1
                        i += 2
                    elif parts[i] == 'score':
                        if i + 2 < len(parts):
                            if parts[i + 1] == 'cp':
                                score_cp = int(parts[i + 2])
                                i += 3
                            elif parts[i + 1] == 'mate':
                                mate_score = int(parts[i + 2])
                                i += 3
                            else:
                                i += 1
                        else:
                            i += 1
                    elif parts[i] == 'pv':
                        pv_moves = parts[i + 1:]
                        break
                    else:
                        i += 1
                # i love femboi
                if multipv_idx is not None and pv_moves:
                    if mate_score is not None:
                        final_score = 10000 if mate_score > 0 else -10000
                        score_pawns = f'M{mate_score}'
                    elif score_cp is not None:
                        final_score = score_cp
                        score_pawns = f'{score_cp / 100:.2f}'
                    else:
                        continue

                    if multipv_idx == 0:
                        best_score = final_score

                    while len(moves) <= multipv_idx:
                        moves.append(None)

                    moves[multipv_idx] = {
                        'move': pv_moves[0],
                        'pv': pv_moves,
                        'scoreCP': final_score,
                        'scorePawns': score_pawns
                    }

            if line.startswith('bestmove'):
                engine.terminate()
                engine.wait(timeout=1)
                break

        valid_moves = [m for m in moves if m and 'scoreCP' in m]

        if best_score is not None:
            filtered = [
                m for m in valid_moves 
                if abs(best_score - m['scoreCP']) <= 50
            ]
        else:
            filtered = valid_moves

        moves_with_quality = []
        for m in filtered:
            diff = abs(best_score - m['scoreCP']) if best_score is not None else 0

            if diff <= 5:
                quality = 'Goodest'   
            elif diff <= 25:
                quality = 'Excellent'
            else:
                quality = 'OK'

            moves_with_quality.append({
                **m,
                'quality': quality
            })

        final_moves = moves_with_quality[:limit]

        return {
            'moves': final_moves,
            'evaluation': best_score,
            'evaluationPawns': best_score / 100 if best_score is not None else 0
        }

    except Exception as e:
        raise Exception(f'Analysis failed: {str(e)}')

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        fen = data.get('fen')
        limit = data.get('limit', 4)

        if not fen:
            return jsonify({
                'error': 'Missing FEN string'
            }), 400

        move_limit = int(limit) if limit else 4
        result = analyze_position(fen, move_limit)

        return jsonify({
            'success': True,
            'fen': fen,
            'bestMoves': result['moves'],
            'evaluation': result['evaluation'],
            'evaluationPawns': result['evaluationPawns']
        })

    except Exception as e:
        return jsonify({
            'error': 'Analysis failed',
            'message': str(e)
        }), 500

import socket
import sys
import time
import threading

if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

if base_dir not in sys.path:
    sys.path.append(base_dir)

import urllib.request

def check_server_health(port):
    try:
        with urllib.request.urlopen(f'http://localhost:{port}/', timeout=0.5) as response:
            return response.status == 200
    except:
        return False

def run_wintr_server():
    from wintrchess.python_server.app import app as wintr_app
    wintr_app.logger.disabled = True
    import logging
    logging.getLogger('werkzeug').disabled = True
    wintr_app.run(host='0.0.0.0', port=3669, debug=False, use_reloader=False)

@app.route('/start-analysis', methods=['POST'])
def start_analysis():
    if check_server_health(3669):
        return jsonify({'success': True, 'message': 'Analysis server is running'})

    try:
        p = multiprocessing.Process(target=run_wintr_server)
        p.daemon = True
        p.start()
        return jsonify({'success': True, 'message': 'Analysis server started'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route("/", methods=["GET"])
def index():
    return """
    <html>
        <head>
            <title>WintrChess Analysis</title>
            <style>
                body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; }
            </style>
        </head>
        <body>
            <iframe src="http://localhost:3669/app/analysis"></iframe>
        </body>
    </html>
    """

if __name__ == '__main__':
    multiprocessing.freeze_support()

    if not check_server_health(3669):
        p = multiprocessing.Process(target=run_wintr_server)
        p.daemon = True
        p.start()

    app.run(host='0.0.0.0', port=PORT, debug=False, use_reloader=False)