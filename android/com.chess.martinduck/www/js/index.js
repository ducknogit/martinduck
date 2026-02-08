/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

function addLog(msg) {
    // nhẹ nhất có thể: chỉ console cho debug cục bộ
    try { console.log(msg); } catch (_) { }
}

async function onDeviceReady() {
    addLog('Device ready cordova-' + cordova.platformId + '@' + cordova.version);
    // preload content.js trong context local (file://) để tránh CSP của chess.com

    let cachedContentJs = null;
    try {
        cachedContentJs = await fetch('content.js').then(r => r.text());
        addLog('Preloaded content.js');
    } catch (e) {
        addLog('Preload content.js fail: ' + e.message);
    }

    // kiểm tra backend trước khi mở chess.com (không chặn mở nếu lỗi)
    const chessUrl = 'https://www.chess.com/play';
    try { await ensureBackendReady(); } catch (e) { addLog('ensureBackendReady fail: ' + e); }

    const opts = [
        'location=no',
        'zoom=no',
        'hardwareback=no',
        'hideurlbar=yes',
        'clearsessioncache=yes',
        'clearcache=yes',
        'useWideViewPort=yes',
        'footer=no'
    ].join(',');
    let browser = null;
    try { browser = cordova.InAppBrowser.open(chessUrl, '_blank', opts); }
    catch (e) { addLog('IAB open fail: ' + e.message); }
    addLog('Open InAppBrowser ' + chessUrl);


    browser.addEventListener('loadstop', async () => {
        if (!cachedContentJs) return;
        browser.executeScript({ code: cachedContentJs }, () => addLog('content.js injected'));
    });

    browser.addEventListener('loaderror', (e) => addLog(`loaderror ${e.url} code ${e.code}`));
    browser.addEventListener('exit', () => { addLog('InAppBrowser exit'); try { navigator.app.exitApp(); } catch (_) { } });

    // Handle hardware back button - do nothing
    document.addEventListener('backbutton', (e) => {
        e.preventDefault();
        addLog('Back button: disabled');
    }, false);

    // bridge phân tích: nhận từ IAB và fetch từ host (đã được mixed content)
    const pendingHost = {};
    browser.addEventListener('message', async (event) => {
        const d = event.data;
        if (!d || d.md !== 'analyze') return;
        const { id, fen, limit } = d;
        addLog(`Host fetch analyze id=${id}`);
        const started = Date.now();
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 12000); // dư sức cho engine 900ms
            const res = await fetch('http://127.0.0.1:3667/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen, limit }),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            const text = await res.text();
            let json = {};
            try { json = JSON.parse(text); } catch (_) { throw new Error('invalid json: ' + text); }
            browser.postMessage({ md: 'analyzeResult', id, ok: true, result: json });
            addLog(`Host fetch ok id=${id} in ${Date.now() - started}ms`);
        } catch (e) {
            browser.postMessage({ md: 'analyzeResult', id, ok: false, error: e.message });
            addLog(`Host fetch error id=${id}: ${e.message}`);
        }
    });


    // fallback: display ready in host page (not visible once InAppBrowser is open)
    const devReady = document.getElementById('deviceready');
    if (devReady) devReady.classList.add('ready');
}

async function ensureBackendReady() {
    // gọi plugin để chắc chắn server native bật
    try {
        await new Promise((resolve, reject) => {
            cordova.exec((ok) => { addLog('Plugin start: ' + ok); resolve(ok); },
                (err) => { addLog('Plugin start error: ' + err); reject(err); },
                "ShashEngine", "start", []);
        });
    } catch (e) {
        addLog('Plugin start fail: ' + e);
    }

    const targets = [
        { url: 'http://127.0.0.1:3667/', name: 'engine' },
        { url: 'http://127.0.0.1:3669/', name: 'analysis' },
    ];
    for (const t of targets) {
        let ok = false;
        for (let i = 1; i <= 5 && !ok; i++) {
            addLog(`Check ${t.name} (${i}/5): ${t.url}`);
            try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 1200);
                const res = await fetch(t.url, { method: 'GET', signal: ctrl.signal });
                clearTimeout(timer);
                if (res.ok) { ok = true; addLog(`${t.name} OK`); break; }
                addLog(`${t.name} status ${res.status}`);
            } catch (e) {
                addLog(`${t.name} fail: ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 400));
        }
        if (!ok) {
            addLog(`STOP: ${t.name} không sẵn sàng, thử lại sau.`);
            // gửi log backend nếu có
            try {
                const txt = await fetch('http://127.0.0.1:3667/log').then(r => r.text());
                addLog('backend log:\n' + txt);
            } catch (e) {
                addLog('cannot fetch backend log: ' + e.message);
            }
            await readBackendFileLog();
            throw new Error(t.name + ' not ready');
        }
    }
}

async function readBackendFileLog() {
    if (!window.resolveLocalFileSystemURL || !cordova?.file?.dataDirectory) return;
    return new Promise((resolve) => {
        const path = cordova.file.dataDirectory + 'shashchess/backend.log';
        window.resolveLocalFileSystemURL(path, (fe) => {
            fe.file((file) => {
                const reader = new FileReader();
                reader.onloadend = function () {
                    addLog('backend file log:\n' + this.result);
                    resolve();
                };
                reader.readAsText(file);
            }, () => resolve());
        }, () => resolve());
    });
}
