(function () {
    'use strict';

    const API_URL = 'http://localhost:3667/analyze';

    const isGamePage = window.location.pathname.includes('/play') ||
        window.location.pathname.includes('/game');
    if (!isGamePage) {
        return;
    }


    let isMinimized = false;
    let isMaximized = false;
    let windowState = { x: null, y: null, width: 320, height: 150 };
    let mainInterval = null;
    let lastProcessedFen = null;
    let isGameOver = false;

    function loadUIState() {
        const saved = localStorage.getItem('martinDuckUIState');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) { }
        }
        return null;
    }

    function saveUIState() {
        localStorage.setItem('martinDuckUIState', JSON.stringify(windowState));
    }

    function createTitleButton(text) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `background: transparent; border: none; color: #b8b6b3; font-size: 18px; width: 24px; height: 24px; cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; padding: 0; line-height: 1;`;
        btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.1)';
        btn.onmouseout = () => btn.style.background = 'transparent';
        return btn;
    }

    function toggleMinimize() {
        const content = document.getElementById('martin-duck-content');
        const mainWindow = document.getElementById('martin-duck-window');
        if (!content || !mainWindow) return;

        isMinimized = !isMinimized;
        content.style.display = isMinimized ? 'none' : 'flex';
        mainWindow.style.height = isMinimized ? 'auto' : (windowState.height + 'px');
    }

    function closeWindow() {
        const mainWindow = document.getElementById('martin-duck-window');
        if (mainWindow) mainWindow.style.display = 'none';
        localStorage.setItem('martinDuckWindowClosed', 'true');
    }

    function makeDraggable(handle, element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            const newTop = element.offsetTop - pos2;
            const newLeft = element.offsetLeft - pos1;
            element.style.top = newTop + 'px';
            element.style.left = newLeft + 'px';
            windowState.y = newTop + 'px';
            windowState.x = newLeft + 'px';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            saveUIState();
        }
    }

    function makeResizable(element) {
        const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        corners.forEach(corner => {
            const resizer = document.createElement('div');
            resizer.className = `resizer-${corner}`;
            const positions = {
                'top-left': { top: '0', left: '0', cursor: 'nwse-resize' },
                'top-right': { top: '0', right: '0', cursor: 'nesw-resize' },
                'bottom-left': { bottom: '0', left: '0', cursor: 'nesw-resize' },
                'bottom-right': { bottom: '0', right: '0', cursor: 'nwse-resize' }
            };
            resizer.style.cssText = `position: absolute; width: 12px; height: 12px; ${positions[corner].top ? `top: ${positions[corner].top};` : ''} ${positions[corner].bottom ? `bottom: ${positions[corner].bottom};` : ''} ${positions[corner].left ? `left: ${positions[corner].left};` : ''} ${positions[corner].right ? `right: ${positions[corner].right};` : ''} cursor: ${positions[corner].cursor}; z-index: 10;`;

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = element.offsetWidth;
                const startHeight = element.offsetHeight;
                const startLeft = element.offsetLeft;
                const startTop = element.offsetTop;

                function resize(e) {
                    const deltaX = e.clientX - startX;
                    const deltaY = e.clientY - startY;
                    if (corner.includes('right')) element.style.width = Math.max(250, startWidth + deltaX) + 'px';
                    if (corner.includes('left')) {
                        const newWidth = Math.max(250, startWidth - deltaX);
                        if (newWidth >= 250) {
                            element.style.width = newWidth + 'px';
                            element.style.left = (startLeft + deltaX) + 'px';
                        }
                    }
                    if (corner.includes('bottom')) element.style.height = Math.max(120, startHeight + deltaY) + 'px';
                    if (corner.includes('top')) {
                        const newHeight = Math.max(120, startHeight - deltaY);
                        if (newHeight >= 120) {
                            element.style.height = newHeight + 'px';
                            element.style.top = (startTop + deltaY) + 'px';
                        }
                    }
                    windowState.width = element.offsetWidth;
                    windowState.height = element.offsetHeight;
                }

                function stopResize() {
                    document.removeEventListener('mousemove', resize);
                    document.removeEventListener('mouseup', stopResize);
                    saveUIState();
                }
                document.addEventListener('mousemove', resize);
                document.addEventListener('mouseup', stopResize);
            });
            element.appendChild(resizer);
        });
    }

    function checkGameOver() {
        const gameOverModal = document.querySelector('.game-over-modal, .game-result-component, .modal-game-over');
        if (gameOverModal) return true;
        const board = document.querySelector('.board, wc-chess-board, chess-board');
        if (board && (board.classList.contains('disabled') || board.classList.contains('game-over'))) return true;
        return false;
    }

    function getFEN() {
        if (window.game && window.game.getFEN) return window.game.getFEN();
        if (window.chessboard && window.chessboard.getFEN) return window.chessboard.getFEN();
        try {
            const board = document.querySelector('.board, wc-chess-board, chess-board');
            if (board) {
                if (board.game && board.game.getFEN) return board.game.getFEN();
                if (board.state && board.state.fen) return board.state.fen;
                if (typeof board.getFEN === 'function') return board.getFEN();
                if (board.fen) return board.fen;
                if (board.position) return board.position;
                const fenAttr = board.getAttribute('data-fen') || board.getAttribute('fen') || board.dataset.fen;
                if (fenAttr) return fenAttr;
                if (board.shadowRoot) {
                    const shadowFen = findFENInShadowDOM(board.shadowRoot);
                    if (shadowFen) return shadowFen;
                }
                const fen = parseBoardToFEN(board);
                if (fen) return fen;
            }
        } catch (e) { }
        return null;
    }

    function getPlayerColor() {
        try {
            const board = document.querySelector('.board, wc-chess-board, chess-board');
            if (!board) return 'white';
            try {
                const playerBottom = document.querySelector('.player-component.player-bottom, .player-bottom');
                if (playerBottom && playerBottom.textContent?.toLowerCase().includes('you')) { }
            } catch (e) { }
            if (board.game) {
                if (typeof board.game.getPlayingAs === 'function') {
                    const color = board.game.getPlayingAs();
                    if (color === 1) return 'white';
                    if (color === 2) return 'black';
                }
                if (board.game.playerColor) return board.game.playerColor;
            }
            const isFlipped = board.classList.contains('flipped') || board.className.includes('flipped') || getComputedStyle(board).transform.includes('rotate(180');
            const orientation = board.getAttribute('orientation') || board.getAttribute('data-orientation');
            if (orientation) return orientation;
            return isFlipped ? 'black' : 'white';
        } catch (e) { return 'white'; }
    }

    function triggerBoardUpdate(board) {
        try {
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('scroll'));
            if (board.game) {
                if (typeof board.game.markDirty === 'function') board.game.markDirty();
                if (typeof board.game.draw === 'function') board.game.draw();
            }
        } catch (error) { }
    }

    function handlePromotion(piece) {
        setTimeout(() => {
            const promotionWindow = document.querySelector('.promotion-window, .promotion-area, .promotion-menu');
            if (promotionWindow) {
                const pieceChar = piece.toLowerCase();
                const targetPiece = promotionWindow.querySelector(`.${pieceChar}, [data-piece="${pieceChar}"], .promotion-${pieceChar}, .piece.${pieceChar}, [class*="${pieceChar}"]`);
                if (targetPiece) {
                    targetPiece.click();
                    const rect = targetPiece.getBoundingClientRect();
                    const commonOptions = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
                    targetPiece.dispatchEvent(new PointerEvent('pointerdown', commonOptions));
                    targetPiece.dispatchEvent(new MouseEvent('mousedown', commonOptions));
                    targetPiece.dispatchEvent(new PointerEvent('pointerup', { ...commonOptions, buttons: 0 }));
                    targetPiece.dispatchEvent(new MouseEvent('mouseup', { ...commonOptions, buttons: 0 }));
                    targetPiece.dispatchEvent(new MouseEvent('click', { ...commonOptions, buttons: 0 }));
                } else {
                    const firstPiece = promotionWindow.querySelector('.piece');
                    if (firstPiece) firstPiece.click();
                }
            } else {
                const globalPiece = document.querySelector(`.promotion-piece.${piece.toLowerCase()}`);
                if (globalPiece) globalPiece.click();
            }
        }, 500);
    }

    function squareToPixel(square, size, isFlipped = false) {
        const file = square.charCodeAt(0) - 97;
        const rank = parseInt(square[1]) - 1;
        const sq = size / 8;
        let x, y;
        if (isFlipped) {
            x = (7 - file) * sq + sq / 2;
            y = rank * sq + sq / 2;
        } else {
            x = file * sq + sq / 2;
            y = (7 - rank) * sq + sq / 2;
        }
        return { x, y };
    }

    function executePixelClick(board, from, to, promotion = null) {
        try {
            const rect = board.getBoundingClientRect();
            const size = rect.width;
            const isFlipped = board.classList.contains('flipped') || board.className.includes('flipped') || getComputedStyle(board).transform.includes('rotate(180');
            const fromPixel = squareToPixel(from, size, isFlipped);
            const toPixel = squareToPixel(to, size, isFlipped);
            const fromX = rect.left + fromPixel.x;
            const fromY = rect.top + fromPixel.y;
            const toX = rect.left + toPixel.x;
            const toY = rect.top + toPixel.y;
            const targetFrom = document.elementFromPoint(fromX, fromY);
            if (!targetFrom) return false;

            const commonOptions = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1, pressure: 0.5, pointerId: 1, pointerType: 'mouse', isPrimary: true };

            targetFrom.dispatchEvent(new PointerEvent('pointerdown', { ...commonOptions, clientX: fromX, clientY: fromY }));
            targetFrom.dispatchEvent(new MouseEvent('mousedown', { ...commonOptions, clientX: fromX, clientY: fromY }));
            targetFrom.dispatchEvent(new PointerEvent('pointerup', { ...commonOptions, clientX: fromX, clientY: fromY, buttons: 0 }));
            targetFrom.dispatchEvent(new MouseEvent('mouseup', { ...commonOptions, clientX: fromX, clientY: fromY, buttons: 0 }));
            targetFrom.dispatchEvent(new MouseEvent('click', { ...commonOptions, clientX: fromX, clientY: fromY, buttons: 0 }));

            setTimeout(() => {
                const targetTo = document.elementFromPoint(toX, toY);
                if (targetTo) {
                    targetTo.dispatchEvent(new PointerEvent('pointerdown', { ...commonOptions, clientX: toX, clientY: toY }));
                    targetTo.dispatchEvent(new MouseEvent('mousedown', { ...commonOptions, clientX: toX, clientY: toY }));
                    targetTo.dispatchEvent(new PointerEvent('pointerup', { ...commonOptions, clientX: toX, clientY: toY, buttons: 0 }));
                    targetTo.dispatchEvent(new MouseEvent('mouseup', { ...commonOptions, clientX: toX, clientY: toY, buttons: 0 }));
                    targetTo.dispatchEvent(new MouseEvent('click', { ...commonOptions, clientX: toX, clientY: toY, buttons: 0 }));
                    if (promotion) setTimeout(() => handlePromotion(promotion), 300);
                }
            }, 150);
            return true;
        } catch (error) { return false; }
    }

    function executeMove(from, to, promotion = null) {
        try {
            const board = document.querySelector('.board, wc-chess-board, chess-board');
            if (!board) return false;
            const result = executePixelClick(board, from, to, promotion);
            if (result) {
                return true;
            }
            return false;
        } catch (error) { return false; }
    }

    function drawArrows(moves) {
        const board = document.querySelector('.board, wc-chess-board, chess-board');
        if (!board) return;
        const oldSvg = document.getElementById('arrows-svg');
        if (oldSvg) oldSvg.remove();
        const rect = board.getBoundingClientRect();
        const size = rect.width;
        const isFlipped = board.classList.contains('flipped') || board.className.includes('flipped') || getComputedStyle(board).transform.includes('rotate(180');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'arrows-svg';
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.style.cssText = `position: absolute; top: 0; left: 0; pointer-events: none; z-index: 999;`;
        if (getComputedStyle(board).position === 'static') board.style.position = 'relative';
        const colors = { 'Goodest': '#15781B', 'Excellent': '#7fa650', 'OK': '#999' };
        moves.forEach((move) => {
            const m = move.move;
            if (!m || m.length < 4) return;
            const from = m.substring(0, 2);
            const to = m.substring(2, 4);
            const color = colors[move.quality] || '#888';
            const p1 = squareToPixel(from, size, isFlipped);
            const p2 = squareToPixel(to, size, isFlipped);
            const squareSize = size / 8;
            const isCastling = ['e1g1', 'e1c1', 'e8g8', 'e8c8'].includes(from + to);
            if (isCastling) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${p1.x},${p1.y} L ${p2.x},${p1.y} L ${p2.x},${p2.y}`);
                path.setAttribute('stroke', color);
                path.setAttribute('stroke-width', size / 24);
                path.setAttribute('fill', 'none');
                path.setAttribute('opacity', '0.9');
                svg.appendChild(path);
            } else {
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const headSize = squareSize * 0.6;
                const shortenLen = headSize * 0.75;
                const lineEndX = p2.x - Math.cos(angle) * shortenLen;
                const lineEndY = p2.y - Math.sin(angle) * shortenLen;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', p1.x);
                line.setAttribute('y1', p1.y);
                line.setAttribute('x2', lineEndX);
                line.setAttribute('y2', lineEndY);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', size / 24);
                line.setAttribute('opacity', '0.9');
                line.setAttribute('stroke-linecap', 'round');
                svg.appendChild(line);
            }
            const headSize = squareSize * 0.6;
            const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const tipX = p2.x;
            const tipY = p2.y;
            const baseX = tipX - Math.cos(angle) * headSize;
            const baseY = tipY - Math.sin(angle) * headSize;
            const side1X = baseX - Math.sin(angle) * headSize * 0.5;
            const side1Y = baseY + Math.cos(angle) * headSize * 0.5;
            const side2X = baseX + Math.sin(angle) * headSize * 0.5;
            const side2Y = baseY - Math.cos(angle) * headSize * 0.5;
            triangle.setAttribute('points', `${tipX},${tipY} ${side1X},${side1Y} ${side2X},${side2Y}`);
            triangle.setAttribute('fill', color);
            triangle.setAttribute('opacity', '0.9');
            svg.appendChild(triangle);
        });
        board.appendChild(svg);
    }

    function showMoveList(moves) {
        const container = document.getElementById('martin-duck-moves');
        if (!container) return;
        const qualityColors = { 'Goodest': '#15781B', 'Excellent': '#7fa650', 'OK': '#999' };
        let html = '<div style="font-weight:600;margin-bottom:6px;font-size:12px;color:#aaa">Best Moves:</div>';
        moves.forEach((m) => {
            const color = qualityColors[m.quality];
            html += `
                <div style="margin:4px 0;padding:4px;background:rgba(255,255,255,0.05);border-radius:3px;border-left:3px solid ${color};display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-weight:bold;color:#fff">${m.move}</div>
                    <div style="color:${color};font-size:11px">${m.quality}</div>
                    <div style="color:#888;font-size:11px">${m.scorePawns}</div>
                </div>`;
        });
        container.innerHTML = html;
        container.style.display = 'block';
        if (mainWindow.offsetHeight < 300 && !isMinimized) mainWindow.style.height = 'auto';
    }

    function findFENInShadowDOM(shadowRoot) {
        try {
            const allElements = shadowRoot.querySelectorAll('*');
            for (let el of allElements) {
                if (el.getAttribute && (el.getAttribute('data-fen') || el.getAttribute('fen'))) {
                    return el.getAttribute('data-fen') || el.getAttribute('fen');
                }
            }
        } catch (e) { }
        return null;
    }

    function findFENInFiber(fiber, depth = 0) {
        if (depth > 20 || !fiber) return null;
        try {
            if (fiber.memoizedProps) {
                if (fiber.memoizedProps.fen) return fiber.memoizedProps.fen;
                if (fiber.memoizedProps.position) return fiber.memoizedProps.position;
            }
            if (fiber.memoizedState) {
                if (typeof fiber.memoizedState === 'string' && fiber.memoizedState.includes('/')) return fiber.memoizedState;
                if (fiber.memoizedState.fen) return fiber.memoizedState.fen;
            }
            if (fiber.child) {
                const childResult = findFENInFiber(fiber.child, depth + 1);
                if (childResult) return childResult;
            }
            if (fiber.sibling) {
                const siblingResult = findFENInFiber(fiber.sibling, depth + 1);
                if (siblingResult) return siblingResult;
            }
        } catch (e) { }
        return null;
    }

    function parseBoardToFEN(board) {
        try {
            const squares = board.querySelectorAll('.square, [class*="square"]');
            if (squares.length !== 64) return null;
            let fen = '';
            let empty = 0;
            for (let rank = 7; rank >= 0; rank--) {
                for (let file = 0; file < 8; file++) {
                    const squareIndex = rank * 8 + file;
                    const square = squares[squareIndex];
                    const piece = square.querySelector('.piece, [class*="piece"]');
                    if (piece) {
                        if (empty > 0) { fen += empty; empty = 0; }
                        const pieceClass = piece.className;
                        const fenChar = pieceClassToFEN(pieceClass);
                        if (fenChar) fen += fenChar; else empty++;
                    } else {
                        empty++;
                    }
                }
                if (empty > 0) { fen += empty; empty = 0; }
                if (rank > 0) fen += '/';
            }
            fen += ' w KQkq - 0 1';
            return fen.match(/^[1-8pnbrqkPNBRQK\/]+/) ? fen : null;
        } catch (e) { return null; }
    }

    function pieceClassToFEN(className) {
        const map = {
            'wp': 'P', 'wn': 'N', 'wb': 'B', 'wr': 'R', 'wq': 'Q', 'wk': 'K',
            'bp': 'p', 'bn': 'n', 'bb': 'b', 'br': 'r', 'bq': 'q', 'bk': 'k'
        };
        for (let key in map) {
            if (className.includes(key)) return map[key];
        }
        return null;
    }

    async function analyze() {
        const originalText = document.querySelector('#martin-duck-content button').textContent;
        const btn = document.querySelector('#martin-duck-content button');
        try {
            btn.textContent = '...';
            btn.disabled = true;
            const fen = getFEN();
            if (!fen) {
                alert('Error: Cannot detect position.');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen, limit: 4 })
            });
            if (!response.ok) throw new Error(`API returned ${response.status}`);
            const data = await response.json();
            if (data.success && data.bestMoves && data.bestMoves.length > 0) {
                drawArrows(data.bestMoves);
                showMoveList(data.bestMoves);
                btn.textContent = 'OK';
                setTimeout(() => { btn.textContent = originalText; }, 1500);
            } else {
                alert('No good moves found!');
                btn.textContent = originalText;
            }
        } catch (error) {
            alert('Error: ' + error.message);
            btn.textContent = 'X';
            setTimeout(() => { btn.textContent = originalText; }, 2000);
        } finally {
            btn.disabled = false;
        }
    }

    function startAutoLoop() {
        isGameOver = false;
        if (mainInterval) clearInterval(mainInterval);

        mainInterval = setInterval(async () => {
            const isAutoMove = document.getElementById('auto-move-checkbox')?.checked;
            const isAutoCheck = document.getElementById('auto-check-checkbox')?.checked;

            if (!isAutoMove && !isAutoCheck) {
                clearInterval(mainInterval);
                mainInterval = null;
                return;
            }

            if (checkGameOver()) return;
            const fen = getFEN();
            if (!fen) return;

            const playerColor = getPlayerColor();
            const fenParts = fen.split(' ');
            const turnColor = fenParts[1];
            const isMyTurn = (playerColor === 'white' && turnColor === 'w') ||
                (playerColor === 'black' && turnColor === 'b');

            if (!isMyTurn) {
                if (Math.random() > 0.8) {
                    const board = document.querySelector('.board, wc-chess-board, chess-board');
                    if (board) triggerBoardUpdate(board);
                }
                return;
            }

            if (fen === lastProcessedFen) {

                if (!window.lastAttemptTime) window.lastAttemptTime = Date.now();

                if (Date.now() - window.lastAttemptTime > 3500) {
                    window.lastAttemptTime = Date.now(); 
                    lastProcessedFen = null; 

                }
                return;
            }

            window.lastAttemptTime = Date.now(); 

            const delay = Math.floor(Math.random() * 800) + 500;
            const currentFenForDelay = fen;

            setTimeout(async () => {
                try {
                    if (getFEN() !== currentFenForDelay) return;
                    const oldSvg = document.getElementById('arrows-svg');
                    if (oldSvg) oldSvg.remove();

                    const limit = isAutoMove ? 1 : 4;
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fen, limit })
                    });

                    if (!response.ok) return;
                    const data = await response.json();

                    if (data.success && data.bestMoves && data.bestMoves.length > 0) {
                        let movesToProcess = data.bestMoves;
                        if (isAutoMove) movesToProcess = [data.bestMoves[0]];

                        if (isAutoCheck) {
                            drawArrows(movesToProcess);
                            showMoveList(movesToProcess);
                        }

                        if (isAutoMove) {
                            const bestMove = movesToProcess[0].move;
                            if (bestMove && bestMove.length >= 4) {
                                const from = bestMove.substring(0, 2);
                                const to = bestMove.substring(2, 4);
                                const promotion = bestMove.length === 5 ? bestMove[4] : null;
                                
                                if (executeMove(from, to, promotion)) {

                                }
                            }
                        } else {

                            lastProcessedFen = fen;
                        }
                    }
                } catch (error) {
                    
                }
            }, delay);
            lastProcessedFen = fen;
        }, 1000);
    }

    const savedState = loadUIState();
    const initTop = savedState?.y || '80px';
    const initLeft = savedState?.x || null;
    const initWidth = savedState?.width || 320;
    const initHeight = savedState?.height || 250;

    const mainWindow = document.createElement('div');
    mainWindow.id = 'martin-duck-window';
    mainWindow.style.cssText = `position: fixed; top: ${initTop}; ${initLeft ? `left: ${initLeft};` : 'right: 20px;'} width: ${initWidth}px; height: ${initHeight}px; background: #312e2b; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #fff; overflow: hidden;`;

    const titleBar = document.createElement('div');
    titleBar.style.cssText = `background: #262421; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; user-select: none; border-bottom: 1px solid rgba(255,255,255,0.1);`;

    const titleText = document.createElement('div');
    titleText.textContent = 'Martin Duck';
    titleText.style.cssText = `font-weight: 600; font-size: 13px; color: #b8b6b3;`;

    const titleButtons = document.createElement('div');
    titleButtons.style.cssText = `display: flex; gap: 6px;`;

    const minBtn = createTitleButton('−');
    minBtn.onclick = toggleMinimize;

    const closeBtn = createTitleButton('×');
    closeBtn.onclick = closeWindow;

    titleButtons.appendChild(minBtn);
    titleButtons.appendChild(closeBtn);
    titleBar.appendChild(titleText);
    titleBar.appendChild(titleButtons);

    const content = document.createElement('div');
    content.id = 'martin-duck-content';
    content.style.cssText = `padding: 16px; display: flex; flex-direction: column; gap: 12px;`;

    const checkBtn = document.createElement('button');
    checkBtn.textContent = 'Check';
    checkBtn.style.cssText = `background: #81b64c; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; transition: background 0.2s;`;
    checkBtn.onmouseover = () => checkBtn.style.background = '#709e3f';
    checkBtn.onmouseout = () => checkBtn.style.background = '#81b64c';
    checkBtn.onclick = analyze;

    const analysisBtn = document.createElement('button');
    analysisBtn.textContent = 'Analysis';
    analysisBtn.style.cssText = `background: #b58863; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; transition: background 0.2s;`;
    analysisBtn.onmouseover = () => analysisBtn.style.background = '#a07855';
    analysisBtn.onmouseout = () => analysisBtn.style.background = '#b58863';
    analysisBtn.onclick = async () => {
        try {
            await fetch('http://localhost:3667/start-analysis', { method: 'POST' });
            window.open('http://localhost:3667', '_blank');
        } catch (e) {
            alert('Cannot connect to backend (localhost:3667)');
        }
    };

    const autoMoveContainer = document.createElement('div');
    autoMoveContainer.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;`;
    const autoMoveCheckbox = document.createElement('input');
    autoMoveCheckbox.type = 'checkbox';
    autoMoveCheckbox.id = 'auto-move-checkbox';
    autoMoveCheckbox.style.cssText = `width: 18px; height: 18px; cursor: pointer;`;

    function showAutoMoveWarningDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999999; display: flex; align-items: center; justify-content: center;`;
        const dialog = document.createElement('div');
        dialog.style.cssText = `background: #312e2b; padding: 24px; border-radius: 8px; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);`;
        const title = document.createElement('h3');
        title.textContent = 'Important !!!';
        title.style.cssText = `margin: 0 0 16px 0; color: #ff6b6b; font-size: 18px;`;
        const message = document.createElement('div');
        message.innerHTML = `<p style="margin: 0 0 12px 0; color: #b8b6b3; line-height: 1.5;">This is a <strong style="color: #ff6b6b;">DANGEROUS</strong> feature.</p>`;
        const okBtn = document.createElement('button');
        okBtn.textContent = 'Ok, i know';
        okBtn.style.cssText = `background: #81b64c; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 16px; font-size: 14px;`;
        okBtn.onclick = () => { overlay.remove(); showConfirmDialog(); };
        dialog.appendChild(title); dialog.appendChild(message); dialog.appendChild(okBtn); overlay.appendChild(dialog); document.body.appendChild(overlay);
    }

    function showConfirmDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999999; display: flex; align-items: center; justify-content: center;`;
        const dialog = document.createElement('div');
        dialog.style.cssText = `background: #312e2b; padding: 24px; border-radius: 8px; max-width: 300px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);`;
        const title = document.createElement('h3');
        title.textContent = 'Are u sure ?';
        title.style.cssText = `margin: 0 0 20px 0; color: #fff; font-size: 18px; text-align: center;`;
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = `display: flex; gap: 12px;`;
        const yesBtn = document.createElement('button');
        yesBtn.textContent = 'Yes';
        yesBtn.style.cssText = `flex: 1; background: #81b64c; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;`;
        yesBtn.onclick = () => { localStorage.setItem('martinDuckAutoMoveWarning', 'accepted'); overlay.remove(); autoMoveCheckbox.checked = true; startAutoLoop(); };
        const maybeBtn = document.createElement('button');
        maybeBtn.textContent = 'Maybe';
        maybeBtn.style.cssText = `flex: 1; background: #b58863; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;`;
        maybeBtn.onclick = yesBtn.onclick;
        btnContainer.appendChild(yesBtn); btnContainer.appendChild(maybeBtn); dialog.appendChild(title); dialog.appendChild(btnContainer); overlay.appendChild(dialog); document.body.appendChild(overlay);
    }

    autoMoveCheckbox.onchange = (e) => {
        if (e.target.checked) {
            if (localStorage.getItem('martinDuckAutoMoveWarning') === 'accepted') startAutoLoop();
            else { e.target.checked = false; showAutoMoveWarningDialog(); }
        } else {
            if (!document.getElementById('auto-check-checkbox').checked && mainInterval) { clearInterval(mainInterval); mainInterval = null; }
        }
    };

    const autoMoveLabel = document.createElement('label');
    autoMoveLabel.htmlFor = 'auto-move-checkbox';
    autoMoveLabel.textContent = 'AutoMove';
    autoMoveLabel.style.cssText = `cursor: pointer; font-size: 14px; user-select: none;`;
    autoMoveContainer.appendChild(autoMoveCheckbox);
    autoMoveContainer.appendChild(autoMoveLabel);

    const autoCheckContainer = document.createElement('div');
    autoCheckContainer.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;`;
    const autoCheckCheckbox = document.createElement('input');
    autoCheckCheckbox.type = 'checkbox';
    autoCheckCheckbox.id = 'auto-check-checkbox';
    autoCheckCheckbox.style.cssText = `width: 18px; height: 18px; cursor: pointer;`;

    function showAutoCheckWarningDialog1() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999999; display: flex; align-items: center; justify-content: center;`;
        const dialog = document.createElement('div');
        dialog.style.cssText = `background: #312e2b; padding: 24px; border-radius: 8px; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);`;
        const title = document.createElement('h3');
        title.textContent = 'Important !!!';
        title.style.cssText = `margin: 0 0 16px 0; color: #ff6b6b; font-size: 18px;`;
        const message = document.createElement('div');
        message.innerHTML = `<p style="margin: 0 0 12px 0; color: #b8b6b3; line-height: 1.5;">This is a <strong style="color: #ff6b6b;">DISTRACTIVE</strong> function.</p>`;
        const okBtn = document.createElement('button');
        okBtn.textContent = 'Ok, i know';
        okBtn.style.cssText = `background: #81b64c; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 16px; font-size: 14px;`;
        okBtn.onclick = () => { localStorage.setItem('martinDuckAutoCheckWarningStep1', 'true'); overlay.remove(); showAutoCheckConfirmDialog(); };
        dialog.appendChild(title); dialog.appendChild(message); dialog.appendChild(okBtn); overlay.appendChild(dialog); document.body.appendChild(overlay);
    }

    function showAutoCheckConfirmDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999999; display: flex; align-items: center; justify-content: center;`;
        const dialog = document.createElement('div');
        dialog.style.cssText = `background: #312e2b; padding: 24px; border-radius: 8px; max-width: 300px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);`;
        const title = document.createElement('h3');
        title.textContent = 'Are u sure ?';
        title.style.cssText = `margin: 0 0 20px 0; color: #fff; font-size: 18px; text-align: center;`;
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = `display: flex; gap: 12px;`;
        const yesBtn = document.createElement('button');
        yesBtn.textContent = 'Yes';
        yesBtn.style.cssText = `flex: 1; background: #81b64c; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;`;
        yesBtn.onclick = () => { localStorage.setItem('martinDuckAutoCheckWarningStep2', 'true'); overlay.remove(); autoCheckCheckbox.checked = true; startAutoLoop(); };
        const maybeBtn = document.createElement('button');
        maybeBtn.textContent = 'Maybe';
        maybeBtn.style.cssText = `flex: 1; background: #b58863; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;`;
        maybeBtn.onclick = yesBtn.onclick;
        btnContainer.appendChild(yesBtn); btnContainer.appendChild(maybeBtn); dialog.appendChild(title); dialog.appendChild(btnContainer); overlay.appendChild(dialog); document.body.appendChild(overlay);
    }

    autoCheckCheckbox.onchange = (e) => {
        if (e.target.checked) {
            const step1 = localStorage.getItem('martinDuckAutoCheckWarningStep1');
            const step2 = localStorage.getItem('martinDuckAutoCheckWarningStep2');
            if (step1 && step2) startAutoLoop();
            else { e.target.checked = false; if (!step1) showAutoCheckWarningDialog1(); else showAutoCheckConfirmDialog(); }
        } else {
            if (!document.getElementById('auto-move-checkbox').checked && mainInterval) { clearInterval(mainInterval); mainInterval = null; }
        }
    };

    const autoCheckLabel = document.createElement('label');
    autoCheckLabel.htmlFor = 'auto-check-checkbox';
    autoCheckLabel.textContent = 'AutoCheck';
    autoCheckLabel.style.cssText = `cursor: pointer; font-size: 14px; user-select: none;`;
    autoCheckContainer.appendChild(autoCheckCheckbox);
    autoCheckContainer.appendChild(autoCheckLabel);

    const moveListContainer = document.createElement('div');
    moveListContainer.id = 'martin-duck-moves';
    moveListContainer.style.cssText = `margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 120px; overflow-y: auto; display: none;`;

    content.appendChild(checkBtn);
    content.appendChild(analysisBtn);
    content.appendChild(autoMoveContainer);
    content.appendChild(autoCheckContainer);
    content.appendChild(moveListContainer);

    mainWindow.appendChild(titleBar);
    mainWindow.appendChild(content);
    document.body.appendChild(mainWindow);

    makeDraggable(titleBar, mainWindow);
    makeResizable(mainWindow);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            if (mainWindow.style.display !== 'none') checkBtn.click();
        }
    });

    if (localStorage.getItem('martinDuckWindowClosed') === 'true') {
        mainWindow.style.display = 'none';
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F5') localStorage.removeItem('martinDuckWindowClosed');
        });
    }

})();