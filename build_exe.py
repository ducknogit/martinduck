# Copyright (c) 2026 Ducknovis
# Licensed under the MIT License. See LICENSE file in the project root for full license information.
import PyInstaller.__main__
import os
import shutil
base_dir = os.path.dirname(os.path.abspath(__file__))
datas = []
engine_src = os.path.join(base_dir, 'Windows', 'ShashChess40-x86-64.exe')
datas.append((engine_src, 'Windows'))
py_server_src = os.path.join(base_dir, 'wintrchess', 'python_server')
datas.append((py_server_src, os.path.join('wintrchess', 'python_server')))
client_dist_src = os.path.join(base_dir, 'wintrchess', 'client', 'dist')
datas.append((client_dist_src, os.path.join('wintrchess', 'client', 'dist')))
client_public_src = os.path.join(base_dir, 'wintrchess', 'client', 'public')
datas.append((client_public_src, os.path.join('wintrchess', 'client', 'public')))
init_src = os.path.join(base_dir, 'wintrchess', '__init__.py')
datas.append((init_src, 'wintrchess'))
add_data_args = []
for src, dst in datas:
    add_data_args.append(f'--add-data={src}{os.pathsep}{dst}')
args = [
    'app.py',
    '--name=Engine',
    '--onefile',
    '--noconsole',
    '--clean',
    '--noconfirm',
    *add_data_args,
    '--hidden-import=flask',
    '--hidden-import=flask_cors',
    '--hidden-import=chess',
    '--exclude-module=tkinter',
]

PyInstaller.__main__.run(args)
