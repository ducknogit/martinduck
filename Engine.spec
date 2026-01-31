# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\Admin\\Desktop\\chess\\Windows\\ShashChess40-x86-64.exe', 'Windows'), ('C:\\Users\\Admin\\Desktop\\chess\\wintrchess\\python_server', 'wintrchess\\python_server'), ('C:\\Users\\Admin\\Desktop\\chess\\wintrchess\\client\\dist', 'wintrchess\\client\\dist'), ('C:\\Users\\Admin\\Desktop\\chess\\wintrchess\\client\\public', 'wintrchess\\client\\public'), ('C:\\Users\\Admin\\Desktop\\chess\\wintrchess\\__init__.py', 'wintrchess')],
    hiddenimports=['flask', 'flask_cors', 'chess'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Engine',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
