# python3 .re/scr2html.py <dir> [first [last]] — turns the Snnnn.SCR text-mode dumps of SCRDUMP.COM into
# <dir>/screens.html (VGA colours, CP437) and prints each screen as plain text.
import html
import pathlib
import sys

PALETTE = ['#000', '#00a', '#0a0', '#0aa', '#a00', '#a0a', '#a50', '#aaa',
           '#555', '#55f', '#5f5', '#5ff', '#f55', '#f5f', '#ff5', '#fff']

folder = pathlib.Path(sys.argv[1])
files = sorted(folder.glob('S[0-9][0-9][0-9][0-9].SCR'))
first = int(sys.argv[2]) if len(sys.argv) > 2 else 0
last = int(sys.argv[3]) if len(sys.argv) > 3 else len(files) - 1
files = [f for f in files if first <= int(f.stem[1:]) <= last]


def char(code):
    return bytes([code]).decode('cp437') if code >= 32 else ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼'[code]


pages = []
for f in files:
    data = f.read_bytes()
    rows, text = [], []
    for y in range(25):
        cells, line = [], ''
        for x in range(80):
            code, attr = data[(y * 80 + x) * 2], data[(y * 80 + x) * 2 + 1]
            ch = char(code)
            line += ch
            cells.append(f'<span style="color:{PALETTE[attr & 15]};background:{PALETTE[(attr >> 4) & 7]}">{html.escape(ch)}</span>')
        rows.append(''.join(cells))
        text.append(line.rstrip())
    print(f'--- {f.name}')
    print('\n'.join(text).rstrip())
    pages.append(f'<h2>{f.name}</h2><pre class="scr">' + '\n'.join(rows) + '</pre>')

(folder / 'screens.html').write_text(
    '<!doctype html><meta charset="utf-8"><title>Heroes.exe screens</title><style>'
    'body{background:#222;color:#ccc;font-family:sans-serif}'
    '.scr{font:16px/1 "Menlo","Consolas",monospace;display:inline-block;background:#000;padding:4px;margin:0 0 16px}'
    '</style>' + ''.join(pages), encoding='utf-8')
