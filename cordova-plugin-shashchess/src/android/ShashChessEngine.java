package com.chess.martinduck.shashchess;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.Context;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.List;
import java.nio.file.Files;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class ShashChessEngine extends CordovaPlugin {

    private static final String ENGINE_NAME = "shashchess40";
    private static final int MOVE_TIME_MS = 900;
    private static final int HTTP_PORT = 3667;

    private SimpleHttpServer httpServer;
    private SimpleHttpServer httpServerAnalysis;
    private final StringBuilder srvLog = new StringBuilder();
    private File logFile;
    private String lastStartError = null;
    private final ExecutorService engineExecutor = Executors.newCachedThreadPool();

    private interface EngineHandler {
        JSONObject handle(String fen, int limit) throws Exception;
    }

    @Override
    protected void pluginInitialize() {
        File dir = new File(cordova.getContext().getFilesDir(), "shashchess");
        if (!dir.exists()) dir.mkdirs();
        logFile = new File(dir, "backend.log");
        startHttpServer();
    }

    private synchronized boolean startHttpServer() {
        if (httpServer != null) return true;
        try {
            log("startHttpServer");
            // quick check port available
            try (java.net.ServerSocket ss = new java.net.ServerSocket(HTTP_PORT, 0, java.net.InetAddress.getByName("127.0.0.1"))) {
                // ok
            }
            httpServer = new SimpleHttpServer(HTTP_PORT, this::runEngineSync, logFile, srvLog);
            httpServer.start();
            // secondary port 3669 dùng chung handler để phục vụ UI phân tích
            httpServerAnalysis = new SimpleHttpServer(3669, this::runEngineSync, logFile, srvLog);
            httpServerAnalysis.start();
            lastStartError = null;
            log("servers started");
            return true;
        } catch (Exception e) {
            lastStartError = e.getMessage();
            log("server start error: " + lastStartError);
            httpServer = null;
            httpServerAnalysis = null;
            return false;
        }
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        log("execute action=" + action);
        if ("start".equals(action)) {
            boolean ok = startHttpServer();
            if (ok) callbackContext.success("started");
            else callbackContext.error("start failed: " + (lastStartError == null ? "unknown" : lastStartError));
            return true;
        }
        if (!"analyze".equals(action)) {
            callbackContext.error("unknown action: " + action);
            return true;
        }
        String fen = args.getString(0);
        int limit = args.optInt(1, 4);
        cordova.getThreadPool().execute(() -> runEngine(fen, limit, callbackContext));
        return true;
    }

    /**
     * Synchronous engine run used by the embedded HTTP server.
     */
    private JSONObject runEngineSync(String fen, int limit) throws IOException, JSONException {
        File engineFile = ensureEngineBinary();
        Process process = null;
        try {
            ProcessBuilder pb = new ProcessBuilder(engineFile.getAbsolutePath());
            pb.redirectErrorStream(true);
            process = pb.start();

            BufferedWriter stdin = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));
            BufferedReader stdout = new BufferedReader(new InputStreamReader(process.getInputStream()));

            send(stdin, "uci");
            String line;
            boolean uciok = false;
            while ((line = stdout.readLine()) != null) {
                if (line.contains("uciok")) { uciok = true; break; }
            }
            if (!uciok) throw new IOException("uciok not received");

            int threads = Runtime.getRuntime().availableProcessors();
            send(stdin, "setoption name Threads value " + threads);
            send(stdin, "setoption name Hash value 128");
            send(stdin, "setoption name Contempt value 20");
            send(stdin, "setoption name Aggressiveness value 200");
            int multiPV = limit == 1 ? 1 : 8;
            send(stdin, "setoption name MultiPV value " + multiPV);
            send(stdin, "isready");
            while ((line = stdout.readLine()) != null) {
                if (line.contains("readyok")) break;
            }

            send(stdin, "position fen " + fen);
            send(stdin, "go movetime " + MOVE_TIME_MS);

            List<MoveInfo> moves = new ArrayList<>();
            Integer bestScore = null;

            while ((line = stdout.readLine()) != null) {
                if (line.startsWith("info") && line.contains("multipv")) {
                    MoveInfo info = parseInfo(line);
                    if (info != null) {
                        if (info.multipv == 1 && info.scoreCp != null) bestScore = info.scoreCp;
                        ensureSize(moves, info.multipv);
                        moves.set(info.multipv - 1, info);
                    }
                }
                if (line.startsWith("bestmove")) break;
            }

            List<MoveInfo> valid = new ArrayList<>();
            for (MoveInfo m : moves) if (m != null && m.scoreCp != null) valid.add(m);
            List<MoveInfo> filtered = new ArrayList<>();
            if (bestScore != null) {
                for (MoveInfo m : valid) {
                    if (Math.abs(bestScore - m.scoreCp) <= 50) filtered.add(m);
                }
            } else {
                filtered = valid;
            }

            JSONArray bestMoves = new JSONArray();
            int count = Math.min(limit, filtered.size());
            for (int i = 0; i < count; i++) {
                MoveInfo mi = filtered.get(i);
                JSONObject obj = new JSONObject();
                obj.put("move", mi.move);
                obj.put("pv", new JSONArray(mi.pv));
                obj.put("scoreCP", mi.scoreCp);
                obj.put("scorePawns", mi.scorePawns);
                obj.put("quality", quality(bestScore, mi.scoreCp));
                bestMoves.put(obj);
            }

            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("bestMoves", bestMoves);
            result.put("evaluation", bestScore);
            result.put("evaluationPawns", bestScore != null ? bestScore / 100.0 : 0);
            return result;

        } finally {
            if (process != null) process.destroy();
        }
    }

    private void runEngine(String fen, int limit, CallbackContext cb) {
        File engineFile;
        try {
            engineFile = ensureEngineBinary();
        } catch (IOException e) {
            cb.error("engine copy failed: " + e.getMessage());
            return;
        }

        try {
            JSONObject result = runEngineSync(fen, limit);
            cb.success(result);
        } catch (Exception e) {
            cb.error("engine error: " + e.getMessage());
        }
    }

    private void send(BufferedWriter w, String cmd) throws IOException {
        w.write(cmd);
        w.write('\n');
        w.flush();
    }

    private MoveInfo parseInfo(String line) {
        String[] parts = line.trim().split(" ");
        Integer multipv = null;
        Integer scoreCp = null;
        Integer mate = null;
        List<String> pv = new ArrayList<>();
        for (int i = 0; i < parts.length; i++) {
            switch (parts[i]) {
                case "multipv":
                    if (i + 1 < parts.length) multipv = parseInt(parts[++i]);
                    break;
                case "score":
                    if (i + 2 < parts.length) {
                        if ("cp".equals(parts[i + 1])) { scoreCp = parseInt(parts[i + 2]); i += 2; }
                        else if ("mate".equals(parts[i + 1])) { mate = parseInt(parts[i + 2]); i += 2; }
                    }
                    break;
                case "pv":
                    for (int j = i + 1; j < parts.length; j++) pv.add(parts[j]);
                    i = parts.length;
                    break;
                default:
                    break;
            }
        }
        if (multipv == null || pv.isEmpty()) return null;
        MoveInfo info = new MoveInfo();
        info.multipv = multipv;
        if (mate != null) { info.scoreCp = mate > 0 ? 10000 : -10000; info.scorePawns = "M" + mate; }
        else if (scoreCp != null) { info.scoreCp = scoreCp; info.scorePawns = String.format("%.2f", scoreCp / 100.0); }
        info.pv = pv;
        info.move = pv.get(0);
        return info;
    }

    private String quality(Integer best, Integer cp) {
        if (best == null || cp == null) return "OK";
        int diff = Math.abs(best - cp);
        if (diff <= 5) return "Goodest";
        if (diff <= 25) return "Excellent";
        return "OK";
    }

    private void ensureSize(List<MoveInfo> list, int size) {
        while (list.size() < size) list.add(null);
    }

    private int parseInt(String s) {
        try { return Integer.parseInt(s); } catch (Exception e) { return 0; }
    }

    private File ensureEngineBinary() throws IOException {
        Context ctx = cordova.getContext();

        // 1) Prefer nativeLibraryDir (mounted executable) to avoid noexec on filesDir.
        File nativeDir = new File(cordova.getActivity().getApplicationInfo().nativeLibraryDir);
        File nativeBin = new File(nativeDir, "lib" + ENGINE_NAME + ".so");
        if (nativeBin.exists()) {
            nativeBin.setExecutable(true);
            if (nativeBin.canExecute()) return nativeBin;
        }

        // 2) Fallback: copy from assets to internal storage.
        File targetDir = new File(ctx.getFilesDir(), "shashchess");
        if (!targetDir.exists()) targetDir.mkdirs();
        File target = new File(targetDir, ENGINE_NAME);
        if (target.exists() && target.canExecute()) return target;

        String assetPath = "www/engine/shashchess/" + ENGINE_NAME;
        try (InputStream is = ctx.getAssets().open(assetPath);
             FileOutputStream fos = new FileOutputStream(target)) {
            byte[] buf = new byte[8192];
            int len;
            while ((len = is.read(buf)) != -1) fos.write(buf, 0, len);
        }
        target.setExecutable(true);
        return target;
    }

    private static class MoveInfo {
        int multipv;
        Integer scoreCp;
        String scorePawns;
        String move;
        List<String> pv;
    }

    /**
     * Very small HTTP server to expose /analyze and /start-analysis on localhost.
     */
    private class SimpleHttpServer extends Thread {

        private final int port;
        private final EngineHandler handler;
        private volatile boolean running = true;
        private final File logFileRef;
        private final StringBuilder srvLogRef;

        SimpleHttpServer(int port, EngineHandler handler, File logFile, StringBuilder srvLog) {
            this.port = port;
            this.handler = handler;
            this.logFileRef = logFile;
            this.srvLogRef = srvLog;
            setName("shash-http-" + port);
            setDaemon(true);
        }

        @Override
        public void run() {
            try (java.net.ServerSocket server = new java.net.ServerSocket(port, 0, java.net.InetAddress.getByName("0.0.0.0"))) {
                while (running) {
                    try {
                        java.net.Socket socket = server.accept();
                        socket.setSoTimeout(10000);
                        handleClient(socket);
                    } catch (Exception ignored) {
                    }
                }
            } catch (IOException e) {
                // cannot start server
            }
        }

        private void handleClient(java.net.Socket socket) {
            try (socket;
                 BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                 BufferedWriter out = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream()))) {

                // Read request line
                String requestLine = in.readLine();
                if (requestLine == null || requestLine.isEmpty()) return;
                String[] parts = requestLine.split(" ");
                if (parts.length < 2) return;
                String method = parts[0];
                String path = parts[1];

                int contentLength = 0;
                String line;
                while ((line = in.readLine()) != null && !line.isEmpty()) {
                    if (line.toLowerCase().startsWith("content-length:")) {
                        try { contentLength = Integer.parseInt(line.split(":")[1].trim()); } catch (Exception ignored) {}
                    }
                }

                String body = "";
                if (contentLength > 0) {
                    char[] buf = new char[contentLength];
                    int read = in.read(buf);
                    if (read > 0) body = new String(buf, 0, read);
                }

                if ("OPTIONS".equalsIgnoreCase(method)) {
                    write(out, "text/plain", statusText(204), "");
                } else if ("GET".equalsIgnoreCase(method) && ("/".equals(path) || "/ping".equals(path))) {
                    String html = "<html><body><h3>MartinDuck analysis service</h3></body></html>";
                    write(out, "text/html", statusText(200), html);
                } else if ("GET".equalsIgnoreCase(method) && "/log".equals(path)) {
                    String bodyText = "";
                    try {
                        if (logFileRef != null && logFileRef.exists()) {
                            byte[] data = java.nio.file.Files.readAllBytes(logFileRef.toPath());
                            bodyText = new String(data);
                        } else {
                            bodyText = srvLogRef.toString();
                        }
                    } catch (Exception e) {
                        bodyText = srvLogRef.toString();
                    }
                    write(out, "text/plain", statusText(200), bodyText);
                } else if ("GET".equalsIgnoreCase(method) && "/selftest".equals(path)) {
                    String fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
                    JSONObject res = runWithTimeout(fen, 1, 4000);
                    writeJson(out, 200, res.toString());
                } else if (("POST".equalsIgnoreCase(method)) && ("/analyze".equals(path) || "/api/analyze".equals(path))) {
                    JSONObject req = new JSONObject(body.isEmpty() ? "{}" : body);
                    String fen = req.optString("fen", "");
                    int limit = req.has("multipv") ? req.optInt("multipv", 4) : req.optInt("limit", 4);
                    JSONObject res = runWithTimeout(fen, limit, 5000);
                    writeJson(out, 200, res.toString());
                } else if ("POST".equalsIgnoreCase(method) && "/start-analysis".equals(path)) {
                    writeJson(out, 200, "{\"ok\":true}");
                } else if ("GET".equalsIgnoreCase(method) && "/app/analysis".equals(path)) {
                    if (!serveAsset(socket.getOutputStream(), "wintrchess/public/apps/features/analysis.html")) {
                        String page = analysisHtml();
                        write(out, "text/html", statusText(200), page);
                    }
                } else if (path.startsWith("/client-log")) {
                    writeJson(out, 200, "{\"ok\":true}");
                } else if (serveWintrStatic(path, socket.getOutputStream())) {
                    // handled static
                } else {
                    writeJson(out, 404, "{\"error\":\"not found\"}");
                }
            } catch (Exception e) {
                log("client error: " + e.getMessage());
                try {
                    BufferedWriter out = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream()));
                    write(out, "text/plain", statusText(500), "error");
                } catch (Exception ignored) {}
            }
        }

        private void writeJson(BufferedWriter out, int status, String json) throws IOException {
            write(out, "application/json", statusText(status), json);
        }

        private void write(BufferedWriter out, String contentType, String statusText, String body) throws IOException {
            byte[] bytes = body.getBytes();
            out.write("HTTP/1.1 " + statusText + "\r\n");
            out.write("Content-Type: " + contentType + "\r\n");
            out.write("Access-Control-Allow-Origin: *\r\n");
            out.write("Access-Control-Allow-Headers: Content-Type\r\n");
            out.write("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
            out.write("Content-Length: " + bytes.length + "\r\n");
            out.write("\r\n");
            out.write(body);
            out.flush();
        }

        private void writeBytes(java.io.OutputStream os, String contentType, String statusText, byte[] data) throws IOException {
            String headers = "HTTP/1.1 " + statusText + "\r\n"
                    + "Content-Type: " + contentType + "\r\n"
                    + "Access-Control-Allow-Origin: *\r\n"
                    + "Access-Control-Allow-Headers: Content-Type\r\n"
                    + "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                    + "Content-Length: " + data.length + "\r\n"
                    + "\r\n";
            os.write(headers.getBytes());
            os.write(data);
            os.flush();
        }

        private JSONObject runWithTimeout(String fen, int limit, long timeoutMs) {
            try {
                Callable<JSONObject> job = () -> handler.handle(fen, limit);
                Future<JSONObject> future = engineExecutor.submit(job);
                return future.get(timeoutMs, TimeUnit.MILLISECONDS);
            } catch (TimeoutException te) {
                JSONObject err = new JSONObject();
                try { err.put("success", false); err.put("error", "engine timeout"); } catch (Exception ignored) {}
                return err;
            } catch (Exception e) {
                JSONObject err = new JSONObject();
                try { err.put("success", false); err.put("error", e.getMessage()); } catch (Exception ignored) {}
                return err;
            }
        }

        private String statusText(int code) {
            switch (code) {
                case 200: return "200 OK";
                case 404: return "404 Not Found";
                default: return code + " OK";
            }
        }

        private String analysisHtml() {
            return "<!doctype html><html><head><meta charset='utf-8'><title>MartinDuck Analysis</title>"
                + "<style>body{font-family:Segoe UI,Arial,sans-serif;background:#1e1e1e;color:#eee;padding:16px;}"
                + "textarea, input, button{font:14px Segoe UI,Arial;border-radius:6px;border:1px solid #444;background:#2b2b2b;color:#fff;padding:8px;}"
                + "button{cursor:pointer;background:#6fb64a;border:none;}"
                + "#out{white-space:pre;font-family:Consolas,monospace;background:#111;padding:12px;border-radius:8px;border:1px solid #333;}"
                + "</style></head><body>"
                + "<h2>MartinDuck Analysis</h2>"
                + "<label>FEN</label><br><textarea id='fen' rows='3' style='width:100%'></textarea><br>"
                + "<label>Moves</label><input id='mpv' type='number' min='1' max='8' value='3' style='width:80px;margin-left:8px;'>"
                + "<button id='btn'>Analyze</button>"
                + "<pre id='out'></pre>"
                + "<script>const out=document.getElementById('out');const btn=document.getElementById('btn');btn.onclick=async()=>{out.textContent='Running...';try{const fen=document.getElementById('fen').value.trim();const limit=parseInt(document.getElementById('mpv').value||'3',10);const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fen:fen,limit:limit})});const t=await r.text();out.textContent=t;}catch(e){out.textContent='Error '+e.message;}};</script>"
                + "</body></html>";
        }

        private boolean serveAsset(java.io.OutputStream os, String assetPath) {
            try (InputStream is = cordova.getContext().getAssets().open("www/" + assetPath)) {
                byte[] data = is.readAllBytes();
                // chỉnh analysis.html để responsive trên mobile
                if (assetPath.endsWith("analysis.html")) {
                    String html = new String(data);
                    String inject = ""
                        + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no\">"
                        + "<style>html,body{width:100%;max-width:100%;overflow-x:hidden;margin:0;padding:0;}"
                        + ".root,#root,#app,.analysis-page{max-width:100%;overflow-x:hidden;}"
                        + "canvas,svg,img,video{max-width:100% !important;height:auto !important;}"
                        + ".board,.board-container,.board-wrapper{max-width:100vw !important;overflow:hidden;}"
                        + "</style>"
                        + "<script>(function(){"
                        + "function fit(){"
                        + " const vw=Math.min(window.innerWidth||document.documentElement.clientWidth||360, (window.screen&&window.screen.width)||9999);"
                        + " document.documentElement.style.setProperty('--vw',vw+'px');"
                        + " const boards=document.querySelectorAll('.board,.board-container,.board-wrapper,#board,#board-container');"
                        + " boards.forEach(el=>{el.style.width=vw+'px'; el.style.maxWidth=vw+'px'; el.style.overflow='hidden'; el.style.margin='0 auto';});"
                        + " document.querySelectorAll('canvas').forEach(c=>{"
                        + "   const rawW=c.width||c.getBoundingClientRect().width||vw;"
                        + "   if(rawW>0){"
                        + "     const scale=vw/rawW;"
                        + "     c.style.transform='scale('+scale+')';"
                        + "     c.style.transformOrigin='top left';"
                        + "   }"
                        + "   c.style.width=rawW+'px';"
                        + "   c.style.maxWidth=vw+'px';"
                        + "   c.style.height='auto';"
                        + "   if(c.parentElement){c.parentElement.style.width=vw+'px'; c.parentElement.style.maxWidth=vw+'px'; c.parentElement.style.overflow='hidden';}"
                        + " });"
                        + "}"
                        + "window.addEventListener('load', () => {fit(); setTimeout(fit,300); setTimeout(fit,1000);});"
                        + "window.addEventListener('resize', fit);"
                        + "})();</script>"
                        ;
                    html = html.replaceFirst("</head>", inject + "</head>");
                    data = html.getBytes();
                }
                writeBytes(os, contentType(assetPath), statusText(200), data);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        private boolean serveWintrStatic(String path, java.io.OutputStream os) {
            if (path.startsWith("/")) path = path.substring(1);
            // prefer dist
            if (serveAsset(os, "wintrchess/dist/" + path)) return true;
            if (serveAsset(os, "wintrchess/public/" + path)) return true;
            return false;
        }

        private String contentType(String path) {
            if (path.endsWith(".js")) return "application/javascript";
            if (path.endsWith(".css")) return "text/css";
            if (path.endsWith(".json")) return "application/json";
            if (path.endsWith(".html")) return "text/html";
            if (path.endsWith(".svg")) return "image/svg+xml";
            if (path.endsWith(".png")) return "image/png";
            if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
            if (path.endsWith(".gif")) return "image/gif";
            if (path.endsWith(".woff2")) return "font/woff2";
            if (path.endsWith(".woff")) return "font/woff";
            if (path.endsWith(".ttf")) return "font/ttf";
            return "application/octet-stream";
        }
    }

    private void log(String msg) {
        try {
            long ts = System.currentTimeMillis();
            String line = ts + " " + msg + "\n";
            srvLog.append(line);
            if (logFile != null) {
                try (FileOutputStream fos = new FileOutputStream(logFile, true)) {
                    fos.write(line.getBytes());
                } catch (IOException ignored) { }
            }
        } catch (Exception ignored) { }
    }
}
