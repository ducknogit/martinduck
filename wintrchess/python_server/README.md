# Wintrchess Python server (local-only)

Serve a minimal analysis UI at `http://localhost:3669` and run ShashChess 40 as
the backend engine. Everything stays inside `wintrchess/python_server`; the main
project sources remain untouched.

## Prerequisites
- Python 3.10+
- `Windows/ShashChess40-x86-64.exe` present one level above `wintrchess`
  (path: `../Windows/ShashChess40-x86-64.exe`)

## Setup
```bash
cd wintrchess/python_server
python -m venv .venv
.venv\\Scripts\\activate  # or source .venv/bin/activate
pip install -r requirements.txt
```

Build client bundles once (needed for UI JS):
```bash
cd ..\\client
npm install
npx webpack --mode production
cd ..\\python_server
```

## Run
```bash
python app.py
```
Open http://localhost:3669 and paste a PGN. Adjust MultiPV / move time as
needed. The API endpoint is `POST /api/analyze` with JSON:
```json
{ "pgn": "<pgn string>", "multipv": 3, "movetimeMs": 1500, "ply": 40 }
```

## Notes
- Uses all CPU cores (Threads option) and 1024MB hash by default.
- Only analysis is exposed; no auth/database endpoints are used.
- Static assets are served locally; ads/externals are omitted.
