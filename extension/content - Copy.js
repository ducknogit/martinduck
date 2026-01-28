(function() {
    'use strict';

    const API_URL = 'http://localhost:3667/analyze';
    
    // Check if on game page
    const isGamePage = window.location.pathname.includes('/play') || 
                       window.location.pathname.includes('/game');
    
    console.log('🦆 Martin Duck: Checking page...', window.location.pathname);
    console.log('🦆 Is game page?', isGamePage);
    
    if (!isGamePage) {
        console.log('🦆 Not a game page, exiting');
        return;
    }

    console.log('🦆 Creating UI...');

    // State
    let isMinimized = false;
    let isMaximized = false;
    let windowState = {
        x: null,
        y: null,
        width: 320,
        height: 150
    };

    // Load saved UI state
    function loadUIState() {
        const saved = localStorage.getItem('martinDuckUIState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                windowState = state;
                console.log('🦆 Loaded UI state:', state);
                return state;
            } catch (e) {
                console.log('🦆 Failed to load UI state');
            }
        }
        return null;
    }

    // Save UI state
    function saveUIState() {
        localStorage.setItem('martinDuckUIState', JSON.stringify(windowState));
        console.log('🦆 Saved UI state:', windowState);
    }

    const savedState = loadUIState();

    // Analysis function (Moved up to avoid ReferenceError)
    async function analyze() {
        console.log('🦆 Analyze clicked!');
        const originalText = checkBtn.textContent;
        
        try {
            checkBtn.textContent = '...';
            checkBtn.disabled = true;

            const fen = getFEN();
            
            console.log('🦆 FEN detected:', fen);
            
            if (!fen) {
                alert('Error: Cannot detect position.\n\nPlease:\n1. Make sure game is loaded\n2. Try making a move first\n3. Try again');
                checkBtn.textContent = originalText;
                checkBtn.disabled = false;
                return;
            }

            const playerColor = getPlayerColor();
            const fenParts = fen.split(' ');
            const turnColor = fenParts[1];
            
            console.log('🦆 Player color:', playerColor, 'Turn:', turnColor);
            
            if (playerColor && turnColor) {
                if ((playerColor === 'white' && turnColor !== 'w') || 
                    (playerColor === 'black' && turnColor !== 'b')) {
                    alert('Not your turn!\n\nWait for opponent to move.');
                    checkBtn.textContent = originalText;
                    checkBtn.disabled = false;
                    return;
                }
            }

            // Default limit for manual check is 4 (show suggestions)
            const limit = 4;
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen, limit })
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();

            console.log('🦆 API response:', data);

            if (data.success && data.bestMoves && data.bestMoves.length > 0) {
                drawArrows(data.bestMoves);
                showMoveList(data.bestMoves);
                checkBtn.textContent = 'OK';
                setTimeout(() => { checkBtn.textContent = originalText; }, 1500);
            } else {
                alert('No good moves found in this position!');
                checkBtn.textContent = originalText;
            }

        } catch (error) {
            alert('Error: ' + error.message + '\n\nPls run start.bat');
            checkBtn.textContent = 'X';
            setTimeout(() => { checkBtn.textContent = originalText; }, 2000);
        } finally {
            checkBtn.disabled = false;
        }
    }

    // Create main window
    const mainWindow = document.createElement('div');
    mainWindow.id = 'martin-duck-window';
    
    // Apply saved state or defaults
    const initTop = savedState?.y || '80px';
    const initLeft = savedState?.x || null;
    const initWidth = savedState?.width || 320;
    const initHeight = savedState?.height || 150;
    
    mainWindow.style.cssText = `
        position: fixed;
        top: ${initTop};
        ${initLeft ? `left: ${initLeft};` : 'right: 20px;'}
        width: ${initWidth}px;
        height: ${initHeight}px;
        background: #312e2b;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #fff;
        overflow: hidden;
    `;
    
    // Update windowState with current values
    if (savedState) {
        windowState = savedState;
    }

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        background: #262421;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
        border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    const titleText = document.createElement('div');
    titleText.textContent = 'Martin Duck';
    titleText.style.cssText = `
        font-weight: 600;
        font-size: 13px;
        color: #b8b6b3;
    `;

    const titleButtons = document.createElement('div');
    titleButtons.style.cssText = `
        display: flex;
        gap: 6px;
    `;

    // Minimize button
    const minBtn = createTitleButton('−');
    minBtn.onclick = toggleMinimize;

    // Close button
    const closeBtn = createTitleButton('×');
    closeBtn.onclick = closeWindow;

    titleButtons.appendChild(minBtn);
    titleButtons.appendChild(closeBtn);
    titleBar.appendChild(titleText);
    titleBar.appendChild(titleButtons);

    // Content area
    const content = document.createElement('div');
    content.id = 'martin-duck-content';
    content.style.cssText = `
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    `;

    // Check button
    const checkBtn = document.createElement('button');
    checkBtn.textContent = 'Check';
    checkBtn.style.cssText = `
        background: #81b64c;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    checkBtn.onmouseover = () => checkBtn.style.background = '#709e3f';
    checkBtn.onmouseout = () => checkBtn.style.background = '#81b64c';
    
    // Assign onclick safely
    try {
        if (typeof analyze === 'function') {
            checkBtn.onclick = analyze;
        } else {
            console.error('🦆 Error: analyze function not found');
            // Fallback: define it if missing (should not happen with correct hoisting)
            checkBtn.onclick = () => alert('Please reload the page. Extension updating...');
        }
    } catch (e) {
        console.error('🦆 Error assigning click handler:', e);
    }

    // AutoMove section
    const autoMoveContainer = document.createElement('div');
    autoMoveContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: rgba(255,255,255,0.03);
        border-radius: 4px;
    `;

    const autoMoveCheckbox = document.createElement('input');
    autoMoveCheckbox.type = 'checkbox';
    autoMoveCheckbox.id = 'auto-move-checkbox';
    autoMoveCheckbox.style.cssText = `
        width: 18px;
        height: 18px;
        cursor: pointer;
    `;
    autoMoveCheckbox.onchange = handleAutoMoveToggle;

    const autoMoveLabel = document.createElement('label');
    autoMoveLabel.htmlFor = 'auto-move-checkbox';
    autoMoveLabel.textContent = 'AutoMove';
    autoMoveLabel.style.cssText = `
        cursor: pointer;
        font-size: 14px;
        user-select: none;
    `;

    autoMoveContainer.appendChild(autoMoveCheckbox);
    autoMoveContainer.appendChild(autoMoveLabel);

    // AutoCheck section
    const autoCheckContainer = document.createElement('div');
    autoCheckContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: rgba(255,255,255,0.03);
        border-radius: 4px;
    `;

    const autoCheckCheckbox = document.createElement('input');
    autoCheckCheckbox.type = 'checkbox';
    autoCheckCheckbox.id = 'auto-check-checkbox';
    autoCheckCheckbox.style.cssText = `
        width: 18px;
        height: 18px;
        cursor: pointer;
    `;
    autoCheckCheckbox.onchange = handleAutoCheckToggle;

    const autoCheckLabel = document.createElement('label');
    autoCheckLabel.htmlFor = 'auto-check-checkbox';
    autoCheckLabel.textContent = 'AutoCheck';
    autoCheckLabel.style.cssText = `
        cursor: pointer;
        font-size: 14px;
        user-select: none;
    `;

    autoCheckContainer.appendChild(autoCheckCheckbox);
    autoCheckContainer.appendChild(autoCheckLabel);

    // Move list container (inside main window)
    const moveListContainer = document.createElement('div');
    moveListContainer.id = 'martin-duck-moves';
    moveListContainer.style.cssText = `
        margin-top: 8px;
        padding: 8px;
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        max-height: 120px;
        overflow-y: auto;
        display: none; /* Hidden by default */
    `;

    content.appendChild(checkBtn);
    content.appendChild(autoCheckContainer);
    content.appendChild(autoMoveContainer);
    content.appendChild(moveListContainer); // Add to main window

    mainWindow.appendChild(titleBar);
    mainWindow.appendChild(content);
    document.body.appendChild(mainWindow);

    console.log('🦆 UI added to body!');

    // Make draggable
    makeDraggable(titleBar, mainWindow);
    
    // Make resizable from corners
    makeResizable(mainWindow);

    // Helper functions
    function createTitleButton(text) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            background: transparent;
            border: none;
            color: #b8b6b3;
            font-size: 18px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            padding: 0;
            line-height: 1;
        `;
        btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.1)';
        btn.onmouseout = () => btn.style.background = 'transparent';
        return btn;
    }

    function toggleMinimize() {
        isMinimized = !isMinimized;
        content.style.display = isMinimized ? 'none' : 'flex';
        mainWindow.style.height = isMinimized ? 'auto' : windowState.height + 'px';
    }

    function closeWindow() {
        mainWindow.style.display = 'none';
        localStorage.setItem('martinDuckWindowClosed', 'true');
    }

    // Restore window on page load (F5 or manual reload clears the closed state)
    window.addEventListener('load', () => {
        localStorage.removeItem('martinDuckWindowClosed');
    });

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
            element.style.right = 'auto';
            
            // Update state
            windowState.y = newTop + 'px';
            windowState.x = newLeft + 'px';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            saveUIState();
        }
    }

    // Make resizable from 4 corners
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
            
            resizer.style.cssText = `
                position: absolute;
                width: 12px;
                height: 12px;
                ${positions[corner].top ? `top: ${positions[corner].top};` : ''}
                ${positions[corner].bottom ? `bottom: ${positions[corner].bottom};` : ''}
                ${positions[corner].left ? `left: ${positions[corner].left};` : ''}
                ${positions[corner].right ? `right: ${positions[corner].right};` : ''}
                cursor: ${positions[corner].cursor};
                z-index: 10;
            `;
            
            resizer.addEventListener('mousedown', initResize);
            
            function initResize(e) {
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
                    
                    if (corner.includes('right')) {
                        element.style.width = Math.max(250, startWidth + deltaX) + 'px';
                    }
                    if (corner.includes('left')) {
                        const newWidth = Math.max(250, startWidth - deltaX);
                        if (newWidth >= 250) {
                            element.style.width = newWidth + 'px';
                            element.style.left = (startLeft + deltaX) + 'px';
                        }
                    }
                    if (corner.includes('bottom')) {
                        element.style.height = Math.max(120, startHeight + deltaY) + 'px';
                    }
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
            }
            
            element.appendChild(resizer);
        });
    }

    function handleAutoMoveToggle(e) {
        const isFirstTime = !localStorage.getItem('martinDuckAutoMoveWarning');
        
        if (isFirstTime && e.target.checked) {
            e.target.checked = false;
            showAutoMoveWarningDialog();
        }
    }

    function handleAutoCheckToggle(e) {
        const step1Done = localStorage.getItem('martinDuckAutoCheckWarningStep1');
        const step2Done = localStorage.getItem('martinDuckAutoCheckWarningStep2');
        
        if (!step1Done && e.target.checked) {
            e.target.checked = false;
            showAutoCheckWarningDialog1();
        } else if (step1Done && !step2Done && e.target.checked) {
            e.target.checked = false;
            showAutoCheckConfirmDialog();
        }
    }

    function showAutoCheckWarningDialog1() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #312e2b;
            padding: 24px;
            border-radius: 8px;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Important !!!';
        title.style.cssText = `
            margin: 0 0 16px 0;
            color: #ff6b6b;
            font-size: 18px;
        `;

        const message = document.createElement('div');
        message.innerHTML = `
            <p style="margin: 0 0 12px 0; color: #b8b6b3; line-height: 1.5;">
                This is a <strong style="color: #ff6b6b;">DISTRACTIVE</strong> function; focusing too much on the arrows constantly will easily lead to carelessness and result in being banned for following too many moves like a bot.
            </p>
            <p style="margin: 0; color: #b8b6b3; line-height: 1.5;">
                Đây là 1 chức năng <strong style="color: #ff6b6b;">GÂY PHÂN TÂM</strong>, việc bạn chăm chú quá vào mũi tên liên tục sẽ dễ dàng lơ là cẩn thận và sẽ dẫn đến bị cấm vì theo quá nhiều nước như bot
            </p>
        `;

        const okBtn = document.createElement('button');
        okBtn.textContent = 'Ok, i know';
        okBtn.style.cssText = `
            background: #81b64c;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 16px;
            font-size: 14px;
        `;
        okBtn.onmouseover = () => okBtn.style.background = '#709e3f';
        okBtn.onmouseout = () => okBtn.style.background = '#81b64c';
        okBtn.onclick = () => {
            localStorage.setItem('martinDuckAutoCheckWarningStep1', 'true');
            overlay.remove();
            showAutoCheckConfirmDialog();
        };

        dialog.appendChild(title);
        dialog.appendChild(message);
        dialog.appendChild(okBtn);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function showAutoCheckConfirmDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #312e2b;
            padding: 24px;
            border-radius: 8px;
            max-width: 300px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Are u sure ?';
        title.style.cssText = `
            margin: 0 0 20px 0;
            color: #fff;
            font-size: 18px;
            text-align: center;
        `;

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = `
            display: flex;
            gap: 12px;
        `;

        const yesBtn = document.createElement('button');
        yesBtn.textContent = 'Yes';
        yesBtn.style.cssText = `
            flex: 1;
            background: #81b64c;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        `;
        yesBtn.onmouseover = () => yesBtn.style.background = '#709e3f';
        yesBtn.onmouseout = () => yesBtn.style.background = '#81b64c';
        yesBtn.onclick = () => enableAutoCheck(overlay);

        const maybeBtn = document.createElement('button');
        maybeBtn.textContent = 'Maybe';
        maybeBtn.style.cssText = `
            flex: 1;
            background: #b58863;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        `;
        maybeBtn.onmouseover = () => maybeBtn.style.background = '#a07756';
        maybeBtn.onmouseout = () => maybeBtn.style.background = '#b58863';
        maybeBtn.onclick = () => enableAutoCheck(overlay);

        btnContainer.appendChild(yesBtn);
        btnContainer.appendChild(maybeBtn);
        dialog.appendChild(title);
        dialog.appendChild(btnContainer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function enableAutoCheck(overlay) {
        localStorage.setItem('martinDuckAutoCheckWarningStep2', 'true');
        overlay.remove();
        autoCheckCheckbox.checked = true;
        startAutoLoop();
    }

    function showAutoMoveWarningDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #312e2b;
            padding: 24px;
            border-radius: 8px;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Important !!!';
        title.style.cssText = `
            margin: 0 0 16px 0;
            color: #ff6b6b;
            font-size: 18px;
        `;

        const message = document.createElement('div');
        message.innerHTML = `
            <p style="margin: 0 0 12px 0; color: #b8b6b3; line-height: 1.5;">
                This is a <strong style="color: #ff6b6b;">DANGEROUS</strong> feature that is not recommended to be enabled when playing against strangers or ranked matches. 
                It should only be used with bots or friendly matches with friends.
            </p>
            <p style="margin: 0; color: #b8b6b3; line-height: 1.5;">
                Đây là 1 chức năng <strong style="color: #ff6b6b;">NGUY HIỂM</strong> không khuyến khích bật khi sử dụng với đối thủ là người lạ hay xếp hạng, 
                chỉ nên xài với Bot hoặc bạn bè giao hữu vui vẻ
            </p>
        `;

        const okBtn = document.createElement('button');
        okBtn.textContent = 'Ok, i know';
        okBtn.style.cssText = `
            background: #81b64c;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 16px;
            font-size: 14px;
        `;
        okBtn.onmouseover = () => okBtn.style.background = '#709e3f';
        okBtn.onmouseout = () => okBtn.style.background = '#81b64c';
        okBtn.onclick = () => {
            overlay.remove();
            showConfirmDialog();
        };

        dialog.appendChild(title);
        dialog.appendChild(message);
        dialog.appendChild(okBtn);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function showConfirmDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #312e2b;
            padding: 24px;
            border-radius: 8px;
            max-width: 300px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Are u sure ?';
        title.style.cssText = `
            margin: 0 0 20px 0;
            color: #fff;
            font-size: 18px;
            text-align: center;
        `;

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = `
            display: flex;
            gap: 12px;
        `;

        const yesBtn = document.createElement('button');
        yesBtn.textContent = 'Yes';
        yesBtn.style.cssText = `
            flex: 1;
            background: #81b64c;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        `;
        yesBtn.onmouseover = () => yesBtn.style.background = '#709e3f';
        yesBtn.onmouseout = () => yesBtn.style.background = '#81b64c';
        yesBtn.onclick = () => enableAutoMove(overlay);

        const maybeBtn = document.createElement('button');
        maybeBtn.textContent = 'Maybe';
        maybeBtn.style.cssText = `
            flex: 1;
            background: #b58863;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        `;
        maybeBtn.onmouseover = () => maybeBtn.style.background = '#a07756';
        maybeBtn.onmouseout = () => maybeBtn.style.background = '#b58863';
        maybeBtn.onclick = () => enableAutoMove(overlay);

        btnContainer.appendChild(yesBtn);
        btnContainer.appendChild(maybeBtn);
        dialog.appendChild(title);
        dialog.appendChild(btnContainer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function enableAutoMove(overlay) {
        localStorage.setItem('martinDuckAutoMoveWarning', 'accepted');
        overlay.remove();
        autoMoveCheckbox.checked = true;
        startAutoLoop();
    }

    // Unified Auto Loop
    let mainInterval = null;
    let lastProcessedFen = null;
    let isGameOver = false;

    function startAutoLoop() {
        console.log('🦆 AutoLoop: Starting...');
        isGameOver = false;
        
        if (mainInterval) clearInterval(mainInterval);

        mainInterval = setInterval(async () => {
            const isAutoMove = autoMoveCheckbox.checked;
            const isAutoCheck = autoCheckCheckbox.checked;

            if (!isAutoMove && !isAutoCheck) {
                console.log('🦆 AutoLoop: Stopped (both unchecked)');
                clearInterval(mainInterval);
                mainInterval = null;
                return;
            }

            // Check for game over
            if (checkGameOver()) {
                return;
            }

            const fen = getFEN();
            if (!fen) return;

            const playerColor = getPlayerColor();
            const fenParts = fen.split(' ');
            const turnColor = fenParts[1];

            // Check if it's player's turn
            const isMyTurn = (playerColor === 'white' && turnColor === 'w') || 
                            (playerColor === 'black' && turnColor === 'b');

            if (!isMyTurn) {
                if (Math.random() > 0.8) { 
                    const board = document.querySelector('.board, wc-chess-board, chess-board');
                    if (board) triggerBoardUpdate(board);
                }
                return;
            }

            // It IS my turn.
            if (fen === lastProcessedFen) {
                return;
            }

            // Human-like Delay
            const delay = Math.floor(Math.random() * 800) + 500; // 500-1300ms
            const currentFenForDelay = fen;
            
            setTimeout(async () => {
                try {
                    // Double check FEN
                    if (getFEN() !== currentFenForDelay) return;
                    
                    console.log('🦆 AutoLoop: My turn! Analyzing...');
                    
                    // Clear old arrows ONLY when starting new analysis for MY turn
                    const oldSvg = document.getElementById('arrows-svg');
                    if (oldSvg) oldSvg.remove();

                    // Send limit based on mode
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
                        
                        // Explicitly filter on frontend too just in case backend ignores limit
                        if (isAutoMove) {
                            movesToProcess = [data.bestMoves[0]];
                        }

                        // 1. Handle AutoCheck (Visuals)
                        if (isAutoCheck) {
                            drawArrows(movesToProcess);
                            showMoveList(movesToProcess);
                        }
    
                        // 2. Handle AutoMove (Action)
                        if (isAutoMove) {
                            const bestMove = movesToProcess[0].move;
                            if (bestMove && bestMove.length >= 4) {
                                const from = bestMove.substring(0, 2);
                                const to = bestMove.substring(2, 4);
                                const promotion = bestMove.length === 5 ? bestMove[4] : null;
                                
                                console.log('🦆 AutoMove: Executing', from, '→', to);
                                
                                if (executeMove(from, to, promotion)) {
                                    lastProcessedFen = fen; 
                                }
                            }
                        } else {
                            // Only AutoCheck
                            lastProcessedFen = fen;
                        }
                    }
                } catch (error) {
                    console.log('🦆 AutoLoop: Error:', error);
                }
            }, delay);
            
            // Mark as processing immediately to prevent overlapping timeouts
            lastProcessedFen = fen;

        }, 1000); 
    }

    // Event Listeners for Toggles
    autoMoveCheckbox.addEventListener('change', () => {
        if (autoMoveCheckbox.checked) {
            if (localStorage.getItem('martinDuckAutoMoveWarning') === 'accepted') {
                startAutoLoop();
            }
        } else {
            // Check if AutoCheck is also off
            if (!autoCheckCheckbox.checked) {
                if (mainInterval) {
                    clearInterval(mainInterval);
                    mainInterval = null;
                }
            }
        }
    });

    autoCheckCheckbox.addEventListener('change', () => {
        if (autoCheckCheckbox.checked) {
            const step1 = localStorage.getItem('martinDuckAutoCheckWarningStep1');
            const step2 = localStorage.getItem('martinDuckAutoCheckWarningStep2');
            if (step1 && step2) {
                startAutoLoop();
            }
        } else {
            // Check if AutoMove is also off
            if (!autoMoveCheckbox.checked) {
                if (mainInterval) {
                    clearInterval(mainInterval);
                    mainInterval = null;
                }
            }
        }
    });

    function executeMove(from, to, promotion = null) {
        try {
            console.log('🦆 executeMove: Starting', from, '→', to, promotion ? `(promo: ${promotion})` : '');
            
            const board = document.querySelector('.board, wc-chess-board, chess-board');
            if (!board) {
                console.log('🦆 executeMove: Board not found');
                return false;
            }

            // PURE PIXEL CLICK STRATEGY
            // No API calls to avoid double-move glitch
            console.log('🦆 executeMove: Using pure pixel-click method...');
            const result = executePixelClick(board, from, to, promotion);
            
            if (result) {
                console.log('🦆 executeMove: Pixel interaction sequence initiated');
                return true;
            }

            console.log('🦆 executeMove: Failed to initiate pixel interaction');
            return false;
        } catch (error) {
            console.log('🦆 executeMove: Exception:', error);
            return false;
        }
    }

    function executePixelClick(board, from, to, promotion = null) {
        try {
            const rect = board.getBoundingClientRect();
            const size = rect.width;
            
            const isFlipped = board.classList.contains('flipped') || 
                             board.className.includes('flipped') ||
                             getComputedStyle(board).transform.includes('rotate(180');
            
            const fromPixel = squareToPixel(from, size, isFlipped);
            const toPixel = squareToPixel(to, size, isFlipped);
            
            const fromX = rect.left + fromPixel.x;
            const fromY = rect.top + fromPixel.y;
            const toX = rect.left + toPixel.x;
            const toY = rect.top + toPixel.y;
            
            console.log(`🦆 interaction: ${from}→${to}`);
            
            // CLEAN CLICK SEQUENCE
            // Using minimal events to avoid double firing and glitches
            
            const commonOptions = {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0,
                buttons: 1,
                pressure: 0.5,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
            };

            // 1. Pick up piece
            const targetFrom = document.elementFromPoint(fromX, fromY);
            if (!targetFrom) return false;

            // Simple click on source
            targetFrom.dispatchEvent(new PointerEvent('pointerdown', { ...commonOptions, clientX: fromX, clientY: fromY }));
            targetFrom.dispatchEvent(new MouseEvent('mousedown', { ...commonOptions, clientX: fromX, clientY: fromY }));
            targetFrom.dispatchEvent(new PointerEvent('pointerup', { ...commonOptions, clientX: fromX, clientY: fromY, buttons: 0 }));
            targetFrom.dispatchEvent(new MouseEvent('mouseup', { ...commonOptions, clientX: fromX, clientY: fromY, buttons: 0 }));
            targetFrom.dispatchEvent(new MouseEvent('click', { ...commonOptions, clientX: fromX, clientY: fromY, buttons: 0 }));
            
            // 2. Click on destination after delay
            setTimeout(() => {
                const targetTo = document.elementFromPoint(toX, toY);
                if (targetTo) {
                    targetTo.dispatchEvent(new PointerEvent('pointerdown', { ...commonOptions, clientX: toX, clientY: toY }));
                    targetTo.dispatchEvent(new MouseEvent('mousedown', { ...commonOptions, clientX: toX, clientY: toY }));
                    targetTo.dispatchEvent(new PointerEvent('pointerup', { ...commonOptions, clientX: toX, clientY: toY, buttons: 0 }));
                    targetTo.dispatchEvent(new MouseEvent('mouseup', { ...commonOptions, clientX: toX, clientY: toY, buttons: 0 }));
                    targetTo.dispatchEvent(new MouseEvent('click', { ...commonOptions, clientX: toX, clientY: toY, buttons: 0 }));

                    if (promotion) {
                        setTimeout(() => handlePromotion(promotion), 300);
                    }
                    
                    // Trigger update just in case - needed for opponents turn
                    setTimeout(() => triggerBoardUpdate(board), 500);
                }
            }, 150);
            
            return true;
        } catch (error) {
            return false;
        }
    }

    function triggerBoardUpdate(board) {
        try {
            // Method 1: Dispatch generic window events (resize, scroll) - usually forces React re-render
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('scroll'));

            // Method 2: Chess.com specific - Try to dirty the component internal state if accessible
            if (board.game) {
                if (typeof board.game.markDirty === 'function') board.game.markDirty();
                if (typeof board.game.draw === 'function') board.game.draw();
            }

        } catch (error) {
            // Ignore errors
        }
    }

    function getPlayerColor() {
        try {
            const board = document.querySelector('.board, wc-chess-board, chess-board');
            if (!board) return null;

            try {
                const playerBottom = document.querySelector('.player-component.player-bottom, .player-bottom, [class*="player"][class*="bottom"]');
                const playerTop = document.querySelector('.player-component.player-top, .player-top, [class*="player"][class*="top"]');

                if (playerBottom || playerTop) {
                    if (playerBottom) {
                        const isYou = playerBottom.textContent?.toLowerCase().includes('you') ||
                                     playerBottom.className?.includes('user-tagline-username') ||
                                     playerBottom.querySelector('.user-tagline-username');

                        if (isYou) {
                        }
                    }
                }
            } catch (e) {
            }

            if (board.game) {
                if (typeof board.game.getPlayingAs === 'function') {
                    const color = board.game.getPlayingAs();
                    if (color === 1) return 'white';
                    if (color === 2) return 'black';
                }

                if (typeof board.game.getPlayerColor === 'function') {
                    const color = board.game.getPlayerColor();
                    return color;
                }

                if (board.game.playerColor) {
                    return board.game.playerColor;
                }

                if (board.game.myColor) {
                    return board.game.myColor;
                }
            }

            const isFlipped = board.classList.contains('flipped') || 
                            board.className.includes('flipped') ||
                            getComputedStyle(board).transform.includes('rotate(180');

            const orientation = board.getAttribute('orientation') || 
                              board.getAttribute('data-orientation');

            if (orientation) {
                if (orientation === 'black') return 'black';
                if (orientation === 'white') return 'white';
            }

            try {
                const coords = board.querySelectorAll('.coordinate, [class*="coordinate"]');
                if (coords.length > 0) {
                    const bottomCoord = Array.from(coords).find(c => 
                        c.textContent === '1' || c.textContent === '8'
                    );
                    if (bottomCoord) {
                        const isAtBottom = bottomCoord.getBoundingClientRect().bottom > 
                                         board.getBoundingClientRect().top + board.getBoundingClientRect().height / 2;
                        if (isAtBottom) {
                            const color = bottomCoord.textContent === '1' ? 'white' : 'black';
                            return color;
                        }
                    }
                }
            } catch (e) {
            }

            return isFlipped ? 'black' : 'white';

        } catch (e) {
            return 'white';
        }
    }

    function drawArrows(moves) {
        const board = document.querySelector('.board, wc-chess-board, chess-board');
        if (!board) {
            return;
        }

        const oldSvg = document.getElementById('arrows-svg');
        if (oldSvg) oldSvg.remove();

        const rect = board.getBoundingClientRect();
        const size = rect.width;

        const isFlipped = board.classList.contains('flipped') || 
                         board.className.includes('flipped') ||
                         getComputedStyle(board).transform.includes('rotate(180');

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'arrows-svg';
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 999;
        `;

        if (getComputedStyle(board).position === 'static') {
            board.style.position = 'relative';
        }

        const colors = {
            'Goodest': '#15781B',
            'Excellent': '#7fa650',
            'OK': '#999'
        };

        moves.forEach((move) => {
            const m = move.move;
            if (!m || m.length < 4) return;

            const from = m.substring(0, 2);
            const to = m.substring(2, 4);
            const color = colors[move.quality] || '#888';

            const p1 = squareToPixel(from, size, isFlipped);
            const p2 = squareToPixel(to, size, isFlipped);

            const squareSize = size / 8;
            const isCastling = isCastlingMove(from, to);

            if (isCastling) {
                const cornerX = p2.x;
                const cornerY = p1.y;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${p1.x},${p1.y} L ${cornerX},${cornerY} L ${p2.x},${p2.y}`);
                path.setAttribute('stroke', color);
                path.setAttribute('stroke-width', size / 24);
                path.setAttribute('fill', 'none');
                path.setAttribute('opacity', '0.9');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(path);

                const headSize = squareSize * 0.6;
                const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

                const angle = Math.atan2(p2.y - cornerY, p2.x - cornerX);

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
            } else {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const angle = Math.atan2(dy, dx);

                const startX = p1.x + Math.cos(angle) * squareSize * 0.15;
                const startY = p1.y + Math.sin(angle) * squareSize * 0.15;
                const endX = p2.x - Math.cos(angle) * squareSize * 0.5;
                const endY = p2.y - Math.sin(angle) * squareSize * 0.5;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', startX);
                line.setAttribute('y1', startY);
                line.setAttribute('x2', endX);
                line.setAttribute('y2', endY);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', size / 24);
                line.setAttribute('opacity', '0.9');
                line.setAttribute('stroke-linecap', 'round');
                svg.appendChild(line);

                const headSize = squareSize * 0.6;
                const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

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
            }
        });

        board.appendChild(svg);
    }

    function isCastlingMove(from, to) {
        const castlingMoves = ['e1g1', 'e1c1', 'e8g8', 'e8c8'];
        return castlingMoves.includes(from + to);
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

    function showMoveList(moves) {
        const container = document.getElementById('martin-duck-moves');
        if (!container) return;

        const qualityColors = {
            'Goodest': '#15781B',
            'Excellent': '#7fa650',
            'OK': '#999'
        };

        let html = '<div style="font-weight:600;margin-bottom:6px;font-size:12px;color:#aaa">Best Moves:</div>';

        moves.forEach((m, i) => {
            const color = qualityColors[m.quality];
            html += `
                <div style="margin:4px 0;padding:4px;background:rgba(255,255,255,0.05);border-radius:3px;border-left:3px solid ${color};display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-weight:bold;color:#fff">${m.move}</div>
                    <div style="color:${color};font-size:11px">${m.quality}</div>
                    <div style="color:#888;font-size:11px">${m.scorePawns}</div>
                </div>
            `;
        });

        container.innerHTML = html;
        container.style.display = 'block';
        
        if (mainWindow.offsetHeight < 300 && !isMinimized) {
            mainWindow.style.height = 'auto';
        }
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
                        if (empty > 0) {
                            fen += empty;
                            empty = 0;
                        }
                        const pieceClass = piece.className;
                        const fenChar = pieceClassToFEN(pieceClass);
                        if (fenChar) fen += fenChar;
                        else empty++;
                    } else {
                        empty++;
                    }
                }
                if (empty > 0) {
                    fen += empty;
                    empty = 0;
                }
                if (rank > 0) fen += '/';
            }

            fen += ' w KQkq - 0 1';

            return fen.match(/^[1-8pnbrqkPNBRQK\/]+/) ? fen : null;
        } catch (e) {
            return null;
        }
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

    function findFENInShadowDOM(shadowRoot) {
        try {
            const allElements = shadowRoot.querySelectorAll('*');
            for (let el of allElements) {
                if (el.getAttribute && (el.getAttribute('data-fen') || el.getAttribute('fen'))) {
                    return el.getAttribute('data-fen') || el.getAttribute('fen');
                }
            }
        } catch (e) {
        }
        return null;
    }

    function findFENInFiber(fiber, depth = 0) {
        if (depth > 20) return null;
        if (!fiber) return null;

        try {
            if (fiber.memoizedProps) {
                if (fiber.memoizedProps.fen) return fiber.memoizedProps.fen;
                if (fiber.memoizedProps.position) return fiber.memoizedProps.position;
            }

            if (fiber.memoizedState) {
                if (typeof fiber.memoizedState === 'string' && fiber.memoizedState.includes('/')) {
                    return fiber.memoizedState;
                }
                if (fiber.memoizedState.fen) return fiber.memoizedState.fen;
                if (fiber.memoizedState.position) return fiber.memoizedState.position;
            }

            if (fiber.child) {
                const childResult = findFENInFiber(fiber.child, depth + 1);
                if (childResult) return childResult;
            }

            if (fiber.sibling) {
                const siblingResult = findFENInFiber(fiber.sibling, depth + 1);
                if (siblingResult) return siblingResult;
            }
        } catch (e) {
        }

        return null;
    }

    console.log('🦆 Martin Duck Extension loaded!');
    console.log('UI created:', mainWindow);
    console.log('Is game page:', isGamePage);

})();