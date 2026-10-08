"""Annotated disassembly of the compiled QuickBASIC module in an unpacked HEROES image."""
import collections
import json
import struct
import sys

from capstone import CS_ARCH_X86, CS_MODE_16, Cs

IMAGE = sys.argv[1] if len(sys.argv) > 1 else 'heroes.bin'
CODE_END = int(sys.argv[2], 16) if len(sys.argv) > 2 else 0xE3B0
DS = int(sys.argv[3], 16) * 16 if len(sys.argv) > 3 else 0x20E70
NAMES = json.load(open('names.json')) if len(sys.argv) > 4 else {}

img = open(IMAGE, 'rb').read()


def fix_fpu(code):
    """Rewrite Microsoft FP-emulator interrupts (INT 34h-3Dh) into real x87 opcodes."""
    b = bytearray(code)
    i = 0
    while i < len(b) - 1:
        if b[i] == 0xCD and 0x34 <= b[i + 1] <= 0x3B:
            b[i], b[i + 1] = 0x9B, 0xD8 + b[i + 1] - 0x34
            i += 2
        elif b[i] == 0xCD and b[i + 1] == 0x3D:
            b[i], b[i + 1] = 0x9B, 0x90
            i += 2
        else:
            i += 1
    return bytes(b)


def ds_string(off):
    if off + 4 > 0x10000 or DS + off + 4 > len(img):
        return None
    ln, ptr = struct.unpack('<HH', img[DS + off:DS + off + 4])
    if 0 < ln < 200 and ptr == off + 4:
        s = img[DS + ptr:DS + ptr + ln]
        if all(32 <= c < 127 for c in s):
            return s.decode()
    return None


def ds_float(off):
    if DS + off + 4 > len(img):
        return None
    v, = struct.unpack('<f', img[DS + off:DS + off + 4])
    return v


md = Cs(CS_ARCH_X86, CS_MODE_16)
md.skipdata = True
code = fix_fpu(img[:CODE_END])
calls = collections.Counter()
lines = []
for ins in md.disasm(code, 0):
    note = ''
    op = ins.op_str
    if ins.mnemonic == 'lcall':
        calls[op] += 1
        name = NAMES.get(op.split(', ')[1]) if ', ' in op else None
        note = name or ''
    if ins.mnemonic == 'mov' and op.startswith('ax, 0x'):
        s = ds_string(int(op.split(', ')[1], 16))
        if s is not None:
            note = repr(s)
    if 'dword ptr [0x' in op and ins.mnemonic.startswith('f'):
        off = int(op.split('[0x')[1].split(']')[0], 16)
        v = ds_float(off)
        if v is not None and v != 0 and abs(v) < 1e10 and (abs(v) > 1e-4) and ins.mnemonic in ('fld', 'fadd', 'fsub', 'fmul', 'fdiv', 'fcomp', 'fcom', 'fsubr', 'fdivr'):
            note = 'const? %g' % v
    lines.append('%05x: %-20s %-7s %s%s' % (ins.address, ins.bytes.hex(), ins.mnemonic, op, ('   ; ' + note) if note else ''))

open(IMAGE + '.asm', 'w').write('\n'.join(lines))
print(len(lines), 'instructions')
for t, c in calls.most_common(80):
    print('%5d %s %s' % (c, t, NAMES.get(t.split(', ')[1], '') if ', ' in t else ''))
