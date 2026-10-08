"""Lift QuickBASIC-compiled 8086/x87 code (from an unpacked HEROES image) into readable pseudo-BASIC."""
import re
import struct
import sys

from capstone import CS_ARCH_X86, CS_MODE_16, Cs
from capstone.x86 import X86_OP_IMM

IMAGE, DS = sys.argv[1], int(sys.argv[3], 16) * 16
CODE_START, CODE_END = [int(x, 16) for x in sys.argv[2].split(':')] if ':' in sys.argv[2] else (0, int(sys.argv[2], 16))
OUT = IMAGE + ('' if CODE_START == 0 else '.%x' % CODE_START)
img = open(IMAGE, 'rb').read()

RT = {
    '1ccd:77c': ('CINT', 'f1'), '1ccd:7ef': ('INT', 'fint'), '1ccd:7c3': ('FCMP', 'fcmp'),
    '1ccd:768': ('VALF', 'retf'), '1ccd:78d': ('CLNG', 'f1'), '1ccd:829': ('FN829', 'f3'),
    '1687:4ddc': ('LET$', 'assign'), '1687:4e52': ('STRCMP', 'scmp'), '1687:4e15': ('CONCAT', 'ret'),
    '1687:4e91': ('CHR$', 'ret'), '1687:4f88': ('MID$', 'ret'), '1687:4f71': ('RIGHT$', 'ret'),
    '1687:4f64': ('LEFT$', 'ret'), '1687:4ecb': ('ASC', 'ret'), '1687:4ebb': ('LEN', 'ret'),
    '1687:5692': ('STR$', 'ret'), '1687:5096': ('LTRIM$?', 'ret'), '1687:5055': ('UCASE$', 'ret'),
    '1687:5019': ('STRING$?', 'ret'), '1687:60ec': ('FN60EC', 'ret'), '1687:60a2': ('FN60A2', 'ret'),
    '1687:63d4': ('RND', 'retptr'), '1687:1a31': ('INKEY$', 'ret'), '1687:5753': ('CVS', 'retptr'),
    '1687:5732': ('FN5732', 'ret'), '1687:576e': ('FN576E', 'ret'), '1687:532f': ('ERR', 'ret'),
    '1687:4cec': ('READ', 'stmt'), '1687:4ce6': ('READ$', 'stmt'), '1687:4cb7': ('RESTORE', 'stmt'),
    '1687:49d3': ('PRINT;', 'stmt'), '1687:49d8': ('PRINT', 'stmt'), '1687:49b5': ('PRINT#;', 'stmt'),
    '1687:4854': ('PRINTN;', 'stmt'), '1687:485c': ('PRINTN', 'stmt'), '1687:4b0c': ('PRINTN.', 'stmt'),
    '1687:5da5': ('PRINT USING', 'stmt'), '1687:6010': ('GOSUB', 'gosub'), '1687:6033': ('RETURN?', 'stmt'),
    '1687:54d8': ('LOCATE', 'stmt'), '1687:54ac': ('COLOR', 'stmt'), '1687:554b': ('CURSOR', 'stmt'),
    '1687:55da': ('SCREEN?', 'stmt'), '1687:527e': ('ON ERROR GOTO', 'stmt'), '1687:5fdc': ('FN5FDC', 'stmt'),
    '1687:1aca': ('CHAIN', 'stmt'), '1687:162a': ('OPEN', 'stmt'), '1687:56b0': ('CLOSE?', 'stmt'),
    '1687:56e4': ('LINE INPUT#', 'stmt'), '1687:49': ('CHANNEL', 'stmt'), '1687:6b': ('CHANNEL2', 'stmt'),
    '1687:5230': ('FN5230', 'stmt'), '1687:4da1': ('GET/PUT?', 'stmt'), '1687:3ea9': ('FN3EA9', 'stmt'),
    '1687:5204': ('FN5204', 'stmt'), '1687:5452': ('SUBEXIT', 'stmt'), '1687:547d': ('SUBENTRY', 'stmt'),
    '1687:5420': ('DEFFN', 'stmt'), '1687:542e': ('ENDFN', 'stmt'), '1687:1c26': ('CLEAR?', 'stmt'),
    '1687:32cb': ('FN32CB', 'stmt'), '1687:173d': ('FN173D', 'stmt'), '1687:52fb': ('FN52FB', 'stmt'),
    '1687:6062': ('ONGOTO', 'stmt'), '1687:605b': ('ONGOSUB', 'stmt'), '1687:3e92': ('FN3E92', 'stmt'),
}


def ds_word(off):
    return struct.unpack('<H', img[DS + off:DS + off + 2])[0]


def ds_string(off):
    if DS + off + 4 > len(img):
        return None
    ln, ptr = struct.unpack('<HH', img[DS + off:DS + off + 4])
    if 0 < ln < 250 and ptr == off + 4:
        s = img[DS + ptr:DS + ptr + ln]
        return '"' + ''.join(chr(c) if 32 <= c < 127 and c != 34 else '{%d}' % c for c in s) + '"'
    return None


CONSTS = {}
ONGO = {}


def parse_data():
    """DATA records are stored as <code address word><text>\\0, in source order."""
    seg = img[DS:]
    best = []
    p = 0
    while p < len(seg) - 4:
        p += 1
        if seg[p - 1] != 0 or seg[p + 2] != 0x20:
            continue
        recs, q = [], p
        while q + 3 < len(seg) and seg[q + 2] == 0x20:
            end = seg.find(b'\0', q + 2)
            txt = seg[q + 2:end]
            if end < 0 or not all(32 <= c < 127 for c in txt):
                break
            recs.append((struct.unpack('<H', seg[q:q + 2])[0], txt.decode().strip()))
            q = end + 1
        if len(recs) > len(best):
            best = recs
        if len(recs) > 1:
            p = q
    return best


DATA = parse_data()


def data_after(addr):
    for hdr, txt in DATA:
        if hdr == addr:
            return 'D%04x' % hdr
    for hdr, txt in DATA:
        if hdr > addr:
            return 'D%04x' % hdr
    return '?%x' % addr


def const_or_var(off, kind='dword'):
    if kind == 'dword':
        v = struct.unpack('<f', img[DS + off:DS + off + 4])[0]
        # Constants live in the constant pool (>= 0x22b0); variables below are zeroed at load time.
        if off >= 0x22b0 and v == v:
            return ('%g' % v) if abs(v) < 1e7 else repr(v)
    return 'v%04x' % off


def fix_fpu(code):
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


def mem(op):
    m = re.search(r'\[(.*?)\]', op)
    return m.group(1) if m else None


NEG = {'=': '<>', '<>': '=', '<=': '>', '>': '<=', '<': '>=', '>=': '<'}
REL = {'je': '=', 'jne': '<>', 'jbe': '<=', 'jb': '<', 'ja': '>', 'jae': '>=', 'jle': '<=', 'jl': '<',
       'jg': '>', 'jge': '>=', 'jz': '=', 'jnz': '<>'}


class Lifter:
    def __init__(self, bool_skips):
        self.out = []
        self.bool_skips = bool_skips
        self.forinit = {}
        self.pending_for = None
        self.reset()

    def reset(self):
        self.fs = []
        self.args = []
        self.reg = {}
        self.cmp = None
        self.pending_long = False

    def emit(self, addr, text):
        self.out.append('%05x  %s' % (addr, text))

    def val(self, r):
        return self.reg.get(r, '?' + r)

    def memexpr(self, m):
        if re.fullmatch(r'0x[0-9a-f]+', m):
            return const_or_var(int(m, 16))
        if m in ('si', 'bx', 'di'):
            return self.reg.get('ptr_' + m, '*' + m)
        m4 = re.fullmatch(r'(si|bx|di) \+ 0x([0-9a-f]+)', m)
        if m4 and self.reg.get('shl_' + m4.group(1)) == 2:
            return self.element(int(m4.group(2), 16), self.reg.get(m4.group(1), '?'))
        if m == 'bp - 0xc' and 'loc_c' in self.reg:
            return self.reg['loc_c']
        m2 = re.fullmatch(r'bp ([+-]) 0x([0-9a-f]+)', m)
        if m2:
            return ('arg%x' if m2.group(1) == '+' else 'loc%x') % int(m2.group(2), 16)
        m3 = re.fullmatch(r'bx \+ 0x([0-9a-f]+)', m)
        if m3:
            return '%s+%s' % (self.reg.get('ptr_bx', '*bx'), m3.group(1))
        return '[' + m + ']'

    def element(self, base, idx):
        return 'a%04x(%s)' % (base, idx)

    def step(self, ins, labels):
        a, mn, op = ins.address, ins.mnemonic, ins.op_str
        ops = [o.strip() for o in op.split(',')] if op else []
        if a in labels:
            self.out.append('L%05x:' % a)
            carry = self.fs[-1] if self.fs else None
            self.reset()
            if a in self.forinit:
                self.fs = [('@FOR', self.forinit[a], carry)]
                self.for_label = 'L%05x' % a
        if mn in ('wait', 'nop'):
            return
        if mn == 'dec' and getattr(self, 'skip_dec', False):
            self.skip_dec = False
            return
        if mn == 'fld':
            if 'st(' in op:
                self.fs.append(self.fs[-1 - int(op[3])] if self.fs else '?st')
            else:
                self.fs.append(self.memexpr(mem(op)))
            return
        if mn == 'fild':
            self.fs.append('int:' + self.memexpr(mem(op)))
            return
        if mn in ('fadd', 'fsub', 'fmul', 'fdiv', 'fsubr', 'fdivr', 'fcom', 'fcomp') and '[' in op:
            rhs = self.memexpr(mem(op))
            top = self.fs.pop() if self.fs else '?'
            sym = {'fadd': '+', 'fsub': '-', 'fmul': '*', 'fdiv': '/'}.get(mn)
            if sym:
                self.fs.append('(%s %s %s)' % (top, sym, rhs))
            elif mn == 'fsubr':
                self.fs.append('(%s - %s)' % (rhs, top))
            elif mn == 'fdivr':
                self.fs.append('(%s / %s)' % (rhs, top))
            else:
                self.cmp = (top, rhs, 'fcom')
                if mn == 'fcom':
                    self.fs.append(top)
            return
        if mn in ('faddp', 'fsubp', 'fmulp', 'fdivp', 'fsubrp', 'fdivrp', 'fadd', 'fsub', 'fmul', 'fdiv', 'fsubr', 'fdivr'):
            b = self.fs.pop() if self.fs else '?'
            c = self.fs.pop() if self.fs else '?'
            base = mn.rstrip('p')
            # x87 "fsubp st(1)" computes st1 - st0 in MASM/Intel naming used by capstone.
            if base == 'fadd':
                self.fs.append('(%s + %s)' % (c, b))
            elif base == 'fmul':
                self.fs.append('(%s * %s)' % (c, b))
            elif base == 'fsub':
                self.fs.append('(%s - %s)' % (c, b))
            elif base == 'fsubr':
                self.fs.append('(%s - %s)' % (b, c))
            elif base == 'fdiv':
                self.fs.append('(%s / %s)' % (c, b))
            elif base == 'fdivr':
                self.fs.append('(%s / %s)' % (b, c))
            return
        if mn == 'fchs':
            self.fs.append('-' + (self.fs.pop() if self.fs else '?'))
            return
        if mn == 'fabs':
            self.fs.append('ABS(%s)' % (self.fs.pop() if self.fs else '?'))
            return
        if mn == 'fxch':
            if len(self.fs) >= 2:
                self.fs[-1], self.fs[-2] = self.fs[-2], self.fs[-1]
            return
        if mn in ('fstp', 'fst', 'fistp', 'fist'):
            v = self.fs[-1] if self.fs else '?'
            if mn in ('fstp', 'fistp') and self.fs:
                self.fs.pop()
            if 'st(' in op:
                return
            dst = self.memexpr(mem(op))
            if isinstance(v, tuple):
                self.pending_for = (dst, v[1], v[2])
                return
            if dst == 'v1e9a':
                self.reg['fnarg'] = v
                return
            self.emit(a, '%s = %s' % (dst, v))
            return
        if mn == 'call' and op in ('0x33', '0x10033'):
            self.fs.append('FNR(%s)' % self.reg.get('fnarg', '?'))
            return
        if mn == 'mov' and len(ops) == 2:
            dst, src = ops
            if dst in ('ax', 'bx', 'cx', 'dx', 'si', 'di'):
                self.reg.pop('shl_' + dst, None)
                if src.startswith('0x') or src.isdigit():
                    n = int(src, 16) if src.startswith('0x') else int(src)
                    s = ds_string(n)
                    self.reg[dst] = s if s else ('@v%04x' % n if 0x1000 <= n < 0x2400 else str(n))
                    self.reg['imm_' + dst] = n
                elif src in self.reg or src in ('ax', 'bx', 'si', 'di', 'dx', 'cx'):
                    self.reg[dst] = self.reg.get(src, '?' + src)
                    if src == 'ax' and 'ptr_ax' in self.reg:
                        self.reg['ptr_' + dst] = self.reg['ptr_ax']
                    if src == 'ax' and self.reg.get('elem'):
                        self.reg['ptr_' + dst] = self.reg['elem']
                elif '[' in src:
                    self.reg[dst] = self.memexpr(mem(src)) + '%'
                else:
                    self.reg[dst] = '?' + src
                return
            if '[' in dst:
                if mem(dst) == 'bp - 0xc' and src in self.reg:
                    self.reg['loc_c'] = self.reg[src]
                    return
                self.emit(a, '%s%% = %s' % (self.memexpr(mem(dst)), self.reg.get(src, src)))
                return
        if mn == 'xor' and ops[0] == ops[1]:
            self.reg[ops[0]] = '0'
            return
        if mn == 'lea':
            self.reg[ops[0]] = '@' + self.memexpr(mem(ops[1]))
            return
        if mn == 'shl' and ops[0] == 'ax':
            self.reg['shl'] = self.reg.get('shl', 0) + 1
            return
        if mn == 'shl' and ops[0] in ('si', 'bx', 'di'):
            self.reg['shl_' + ops[0]] = self.reg.get('shl_' + ops[0], 0) + 1
            return
        if mn in ('and', 'or') and len(ops) == 2 and ops[0] in ('ax', 'cx') and ops[0] != ops[1]:
            rhs = self.memexpr(mem(ops[1])) if '[' in ops[1] else self.reg.get(ops[1], '?' + ops[1])
            self.reg[ops[0]] = '(%s %s %s)' % (rhs, mn.upper(), self.reg.get(ops[0], '?'))
            return
        if mn == 'and' and len(ops) == 2 and ops[0] == ops[1]:
            self.cmp = ('BOOL', self.reg.get(ops[0], '?'), 'b')
            return
        if mn == 'add' and ops[0] == 'ax' and ops[1].startswith('0x'):
            base = int(ops[1], 16)
            if self.reg.get('shl'):
                el = self.element(base, self.reg.get('ax'))
                self.reg['ax'] = '@' + el
                self.reg['elem'] = el
                self.reg['shl'] = 0
            else:
                self.reg['ax'] = '(%s + %d)' % (self.reg.get('ax'), base if base < 0x8000 else base - 0x10000)
            return
        if mn == 'push':
            if op in ('ds', 'cs', 'es', 'ss'):
                return
            if op in self.reg or op in ('ax', 'bx', 'dx', 'si', 'di', 'cx'):
                v = self.reg.get(op, '?' + op)
                if op == 'dx' and self.pending_long:
                    return
                if op == 'ax' and self.pending_long:
                    self.pending_long = False
                self.args.append(v)
                return
            if '[' in op:
                m = mem(op)
                if re.fullmatch(r'0x[0-9a-f]+', m):
                    n = int(m, 16)
                    if self.args and self.args[-1] == 'hi:%04x' % (n + 2):
                        self.args[-1] = const_or_var(n)
                    else:
                        self.args.append('hi:%04x' % n)
                    return
                self.args.append(self.memexpr(m))
                return
        if mn == 'cdq' or mn == 'cwd':
            self.pending_long = True
            return
        if mn == 'pop' and op == 'es':
            return
        if mn == 'lcall' and '[' not in op:
            seg, off = [int(x, 16) for x in ops]
            key = '%x:%x' % (seg, off)
            name, kind = RT.get(key, ('CALL_' + key, 'stmt'))
            args = self.args
            self.args = []
            if seg in (0, 0xe3b) and key not in RT:
                self.emit(a, 'CALL SUB_%x_%04x(%s)' % (seg, off, ', '.join(args)))
                self.fs = []
                return
            if kind == 'f1':
                self.reg['ax'] = '%s(%s)' % (name, self.fs.pop() if self.fs else '?')
                self.args = args
                self.reg['shl'] = 0
            elif kind == 'fint':
                self.fs.append('INT(%s)' % (self.fs.pop() if self.fs else '?'))
                self.args = args
            elif kind == 'fcmp':
                t = self.fs.pop() if self.fs else '?'
                s = self.fs.pop() if self.fs else '?'
                self.cmp = (t, s, 'f')
                self.args = args
            elif kind == 'f3':
                x = [self.fs.pop() if self.fs else '?' for _ in range(3)][::-1]
                self.fs.append('%s(%s)' % (name, ', '.join(x)))
                self.args = args
            elif kind == 'assign':
                self.emit(a, '%s = %s' % (args[-1].lstrip('@') if args else '?', args[0] if args else '?'))
            elif kind == 'scmp':
                self.cmp = (args[0] if args else '?', args[1] if len(args) > 1 else '?', 's')
            elif kind == 'ret':
                self.reg['ax'] = '%s(%s)' % (name, ', '.join(args))
            elif kind == 'retptr':
                self.reg['ax'] = '%s(%s)' % (name, ', '.join(args))
                self.reg['ptr_ax'] = self.reg['ax']
            elif kind == 'retf':
                self.fs.append(self.reg.get('ax', '?'))
            elif kind == 'gosub':
                self.emit(a, 'GOSUB L%05x' % self.reg.get('imm_ax', 0))
            elif a in ONGO:
                self.emit(a, 'ON %s %s %s' % (self.reg.get('bx', '?'), 'GOSUB' if 'GOSUB' in name else 'GOTO',
                                              ', '.join('L%05x' % t for t in ONGO[a])))
            elif name == 'RESTORE':
                n = self.reg.get('imm_ax', 0)
                self.emit(a, 'RESTORE %s' % data_after(n))
            else:
                self.emit(a, '%s %s' % (name, ', '.join(args)))
            return
        if mn == 'cmp':
            self.cmp = (self.reg.get(ops[0], ops[0]) if '[' not in ops[0] else self.memexpr(mem(ops[0])), ops[1], 'i')
            return
        if mn == 'or' and ops[0] == ops[1]:
            self.cmp = (self.reg.get(ops[0], ops[0]), '0', 'i')
            return
        if mn == 'jmp':
            if op.startswith('0x'):
                t = int(op, 16)
                if self.fs and t > a:
                    self.forinit[t] = self.fs[-1]
                    self.emit(a, '@FORAT L%05x' % t)
                    return
                self.emit(a, 'GOTO L%05x' % t)
            else:
                self.emit(a, 'JMP ' + op)
            return
        if mn.startswith('j') and op.startswith('0x'):
            rel = REL.get(mn, mn)
            if a in self.bool_skips:
                r = self.bool_skips[a]
                if self.cmp and self.cmp[2] != 'b':
                    x, y, _ = self.cmp
                    self.reg[r] = '(%s %s %s)' % (x, NEG.get(rel, '!' + rel), y)
                else:
                    self.reg[r] = '(NOT ?)'
                self.skip_dec = True
                return
            if self.pending_for and self.cmp and self.cmp[2] == 'f':
                var, init, step = self.pending_for
                self.pending_for = None
                limit = self.cmp[1]
                st = ''
                if not (isinstance(step, str) and step == '(%s + 1)' % var):
                    st = ' STEP ' + str(step)
                tag = '@FORAT ' + self.for_label
                for i in range(len(self.out) - 1, -1, -1):
                    if self.out[i].endswith(tag):
                        self.out[i] = self.out[i].split()[0] + '  FOR %s = %s TO %s%s' % (var, init, limit, st)
                        break
                self.emit(a, 'NEXT %s' % var)
                return
            if self.cmp and self.cmp[2] == 'b':
                self.emit(a, 'IF %s%s GOTO L%05x' % ('' if rel in ('<>', 'jne') else 'NOT ', self.cmp[1], int(op, 16)))
                return
            if self.cmp:
                x, y, k = self.cmp
                # For FCMP the runtime compares st(0) (last pushed) with st(1).
                self.emit(a, 'IF %s %s %s GOTO L%05x' % (x, rel, y, int(op, 16)))
            else:
                self.emit(a, 'IF ?flags %s GOTO L%05x' % (rel, int(op, 16)))
            return
        if mn in ('retf', 'ret'):
            self.emit(a, 'RET ' + op)
            return
        if mn in ('push', 'pop', 'inc', 'dec', 'add', 'sub', 'and', 'or', 'mov'):
            self.emit(a, '; asm %s %s' % (mn, op))
            return
        self.emit(a, '; asm %s %s' % (mn, op))


def main():
    md = Cs(CS_ARCH_X86, CS_MODE_16)
    md.detail = True
    md.skipdata = True
    code = fix_fpu(img[CODE_START:CODE_END])
    CODE_LEN = CODE_END - CODE_START
    insns = []
    pc = 0
    while pc < CODE_LEN:
        restart = False
        for ins in md.disasm(code[pc:CODE_LEN], pc):
            insns.append(ins)
            if ins.mnemonic == 'lcall' and ins.op_str in ('0x1687, 0x6062', '0x1687, 0x605b'):
                n = code[ins.address + 5]
                ONGO[ins.address] = [struct.unpack('<H', code[ins.address + 6 + 2 * k:ins.address + 8 + 2 * k])[0]
                                     for k in range(n)]
                pc = ins.address + 6 + 2 * n
                restart = True
                break
        if not restart:
            break
    labels = set()
    bool_skips = {}
    for i, ins in enumerate(insns[:-1]):
        nxt = insns[i + 1]
        if (ins.mnemonic.startswith('j') and ins.mnemonic != 'jmp' and ins.op_str.startswith('0x')
                and nxt.mnemonic == 'dec' and int(ins.op_str, 16) == nxt.address + nxt.size):
            bool_skips[ins.address] = nxt.op_str
    for ins in insns:
        if ins.mnemonic.startswith('j') and ins.op_str.startswith('0x') and ins.address not in bool_skips:
            labels.add(int(ins.op_str, 16))
    for tbl in ONGO.values():
        labels.update(tbl)
    # GOSUB targets
    for i, ins in enumerate(insns):
        if ins.mnemonic == 'lcall' and ins.op_str == '0x1687, 0x6010':
            prev = insns[i - 1]
            if prev.op_str.startswith('ax, 0x'):
                labels.add(int(prev.op_str.split(', ')[1], 16))
    lf = Lifter(bool_skips)
    for ins in insns:
        lf.step(ins, labels)
    text = '\n'.join(lf.out)
    names = {}
    if len(sys.argv) > 4:
        for line in open(sys.argv[4]):
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                names[k.strip()] = v.strip()
    if names:
        text = re.sub(r'\b[va]([0-9a-f]{4})\b', lambda m: names.get(m.group(0), m.group(0)), text)
    open(OUT + '.bas', 'w').write(text)
    open(IMAGE + '.data', 'w').write('\n'.join('D%04x  %s' % r for r in DATA))
    print(len(DATA), 'DATA records ->', IMAGE + '.data')
    print(len(lf.out), 'lines ->', OUT + '.bas')


main()
