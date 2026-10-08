#!/bin/sh
# .re/capture.sh <HEROESn.DAT> <count> <outdir> — runs the real Heroes.exe in DOSBox Staging with the given data
# set (output forced to .HRO, or to OUTPUT=1 printer / OUTPUT=3 HTML) and presses P <count> times; each P writes
# the current character and makes the next. EXTRA is added to the DOSBox configuration and DOSBOX picks another
# emulator, e.g. DOSBox-X for the printer: DOSBOX=…/dosbox-x OUTPUT=1 EXTRA='[parallel]
# parallel1=file append:/abs/path/lpt1.prn'.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DAT="$1"; COUNT="$2"; OUT="$3"
rm -rf "$OUT" && mkdir -p "$OUT"
cp "$ROOT/original/Heroes.exe" "$ROOT/original/HEROES.TRT" "$ROOT/original/HEROES.CP" "$ROOT/original/HEROES.CLR" "$ROOT"/original/HEROES[0-9]*.DAT "$OUT/"
# SCRDUMP=1 loads .re/SCRDUMP.COM first, which saves every new text screen as Snnnn.SCR.
[ -n "${SCRDUMP:-}" ] && cp "$ROOT/.re/SCRDUMP.COM" "$OUT/"
# TILDE=1 makes the copy take "`" for "~" (Burst), which autotype cannot shift; type it as 'grave'.
[ -n "${TILDE:-}" ] && python3 - "$OUT/Heroes.exe" <<'EOF'
import sys
b = bytearray(open(sys.argv[1], 'rb').read())
i = b.index(b'\x01\x00F#~\x00')
b[i + 4] = ord('`')
open(sys.argv[1], 'wb').write(b)
EOF
[ -f "$ROOT/$DAT" ] || DAT="original/$DAT"
python3 - "$ROOT/$DAT" "$OUT/HEROES.DAT" "${OUTPUT:-2}" <<'EOF'
import struct, sys
b = bytearray(open(sys.argv[1], 'rb').read())
b[34 * 4:35 * 4] = struct.pack('<f', float(sys.argv[3]))
open(sys.argv[2], 'wb').write(b)
EOF
# The control panel rewrites HEROES.DAT; keep the data set the session started from.
cp "$OUT/HEROES.DAT" "$OUT/start.DAT"
KEYS="capslock"
i=0; while [ $i -lt "$COUNT" ]; do KEYS="$KEYS ${KEY:-p}"; i=$((i + 1)); done
# SEQ replaces the key presses with an autotype sequence, e.g. SEQ='p p c esc p'.
[ -n "${SEQ:-}" ] && KEYS="capslock $SEQ"
cat > "$OUT/capture.conf" <<EOF
[sdl]
fullscreen = false
[cpu]
cycles = ${CYCLES:-20000}
${EXTRA:-}
[autoexec]
mount c "$OUT"
c:
autotype -w 8 -p 0.8 $KEYS
${SCRDUMP:+SCRDUMP.COM}
HEROES.EXE
EOF
"${DOSBOX:-/Applications/DOSBox Staging.app/Contents/MacOS/dosbox}" -conf "$OUT/capture.conf" > "$OUT/dosbox.log" 2>&1 &
PID=$!
sleep $((12 + COUNT * 8 / 10 + 4))
kill $PID 2>/dev/null || true
ls "$OUT" | grep -ci '\.hro$'
