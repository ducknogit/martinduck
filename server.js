const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3667;

app.use(cors());
app.use(express.json());

const ENGINE_PATH = path.join(__dirname, 'Windows', 'ShashChess40-x86-64.exe');

function analyzePosition(fen) {
  return new Promise((resolve, reject) => {
    const engine = spawn(ENGINE_PATH);
    const moves = [];
    let bestScore = null;

    const timeout = setTimeout(() => {
      engine.kill();
      reject(new Error('Engine timeout'));
    }, 5000);

    engine.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');

      lines.forEach((line) => {
        line = line.trim();
        if (!line) return;

        if (line.includes('uciok')) {
          const threads = os.cpus().length;
          engine.stdin.write(`setoption name Threads value ${threads}\n`);
          engine.stdin.write(`setoption name Hash value 1024\n`);

          engine.stdin.write(`setoption name Contempt value 20\n`); 

          engine.stdin.write(`setoption name Aggressiveness value 200\n`); 

          engine.stdin.write(`setoption name MultiPV value 8\n`);
          engine.stdin.write('isready\n');
        }

        if (line.includes('readyok')) {
          engine.stdin.write(`position fen ${fen}\n`);
          engine.stdin.write('go movetime 1000\n');
        }

        if (line.startsWith('info') && line.includes('multipv')) {
          const multipvMatch = line.match(/multipv (\d+)/);
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          const pvMatch = line.match(/\spv\s+(.+)$/);

          if (multipvMatch && pvMatch) {
            const pvIndex = parseInt(multipvMatch[1]) - 1;
            const pvMoves = pvMatch[1].trim().split(' ');

            let scoreCP;
            if (mateMatch) {
              scoreCP = parseInt(mateMatch[1]) > 0 ? 10000 : -10000;
            } else if (scoreMatch) {
              scoreCP = parseInt(scoreMatch[1]);
            }

            if (pvIndex === 0) bestScore = scoreCP;

            moves[pvIndex] = {
              move: pvMoves[0],
              pv: pvMoves,
              scoreCP: scoreCP,
              scorePawns: mateMatch ? `M${mateMatch[1]}` : (scoreCP / 100).toFixed(2)
            };
          }
        }

        if (line.startsWith('bestmove')) {
          clearTimeout(timeout);
          engine.kill();

          const validMoves = moves.filter(m => m && m.scoreCP !== undefined);
          const filtered = validMoves.filter(m => {
            const diff = Math.abs(bestScore - m.scoreCP);
            return diff <= 50;
          });

          const withQuality = filtered.map(m => {
            const diff = Math.abs(bestScore - m.scoreCP);
            let quality;
            if (diff <= 5) quality = 'Goodest';      

            else if (diff <= 25) quality = 'Excellent'; 

            else quality = 'OK';                        

            return { ...m, quality };
          });

          const finalMoves = withQuality.slice(0, 4);

          resolve({
            moves: finalMoves,
            evaluation: bestScore,
            evaluationPawns: bestScore / 100
          });
        }
      });
    });

    engine.stderr.on('data', (data) => {

    });

    engine.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    engine.stdin.write('uci\n');
  });
}

app.post('/analyze', async (req, res) => {
  try {
    const { fen } = req.body;

    if (!fen) {
      return res.status(400).json({ 
        error: 'Missing FEN string' 
      });
    }

    const result = await analyzePosition(fen);

    res.json({
      success: true,
      fen: fen,
      bestMoves: result.moves,
      evaluation: result.evaluation,
      evaluationPawns: result.evaluationPawns
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Analysis failed',
      message: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    engine: 'ShashChess 40',
    threads: os.cpus().length
  });
});

app.listen(PORT, () => {
  console.clear();
  console.log('\n');
  console.log('  __       __                        __      __           ');
  console.log(' /  \\     /  |                      /  |    /  |          ');
  console.log(' $$  \\   /$$ |  ______    ______   _$$ |_   $$/  _______  ');
  console.log(' $$$  \\ /$$$ | /      \\  /      \\ / $$   |  /  |/       \\ ');
  console.log(' $$$$  /$$$$ | $$$$$$  |/$$$$$$  |$$$$$$/   $$ |$$$$$$$  |');
  console.log(' $$ $$ $$/$$ | /    $$ |$$ |  $$/   $$ | __ $$ |$$ |  $$ |');
  console.log(' $$ |$$$/ $$ |/$$$$$$$ |$$ |        $$ |/  |$$ |$$ |  $$ |');
  console.log(' $$ | $/  $$ |$$    $$ |$$ |        $$  $$/ $$ |$$ |  $$ |');
  console.log(' $$/      $$/  $$$$$$$/ $$/          $$$$/  $$/ $$/   $$/ ');
  console.log('                                                          ');
  console.log('  _______                       __                        ');
  console.log(' /       \\                     /  |                       ');
  console.log(' $$$$$$$  | __    __   _______ $$ |   __                  ');
  console.log(' $$ |  $$ |/  |  /  | /       |$$ |  /  |                 ');
  console.log(' $$ |  $$ |$$ |  $$ |/$$$$$$$/ $$ |_/$$/                  ');
  console.log(' $$ |  $$ |$$ |  $$ |$$ |      $$   $$<                   ');
  console.log(' $$ |__$$ |$$ \\__$$ |$$ \\_____ $$$$$$  \\                  ');
  console.log(' $$    $$/ $$    $$/ $$       |$$ | $$  |                 ');
  console.log(' $$$$$$$/   $$$$$$/   $$$$$$$/ $$/   $$/                  ');
  console.log('\n                    With ShashChess 40 Engine');
  console.log('                           Running !!\n');

  console.log(`Threads: ${os.cpus().length} cores | Hash: 1024 MB | Speed: 1s`);
  console.log(`Quality: Goodest ≤5cp | Excellent ≤25cp | OK ≤50cp\n`);
});

