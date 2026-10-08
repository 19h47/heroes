// node .re/match.js <dir> [data set number] — replays .HRO files written by the real Heroes.exe in one session.
// The first RND of a character draws its experience points, so the printed X.P. narrows the RND state the
// character started from down to a handful of values; each one is replayed through heroes-js and the
// rendered sheet is compared line by line with the original (the date line excepted).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'heroes-js', 'js');
const context = { console };
context.window = context;
vm.createContext(context);
['data', 'original', 'traits', 'rng', 'generator', 'render', 'screen'].forEach((file) => {
	vm.runInContext(fs.readFileSync(path.join(root, `${file}.js`), 'utf8'), context, { filename: `${file}.js` });
});
const H = context.Heroes;

const dir = process.argv[2];
// Same records as .re/export_js.py: single-precision values, one per 4 bytes.
const readDat = (file) => {
	const raw = fs.readFileSync(file);
	const rec = (n) => raw.readFloatLE((n - 1) * 4);
	const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => rec(from + i));
	return {
		...H.DEFAULT_SETTINGS,
		label: path.basename(file),
		noLevelLimits: rec(1) === 1,
		classFocus: rec(2),
		breed: rec(3),
		rerollBelow: rec(4),
		method: rec(5),
		alignLimit: rec(6),
		names: rec(7) === 1,
		female: rec(8),
		breeds: rec(9),
		xpMin: rec(10),
		xpMax: rec(13),
		races: range(16, 24),
		social: range(26, 32),
		traits: rec(34) !== 0,
		output: rec(35),
	};
};
// Optional second argument: the number of a shipped data set (HEROESn.DAT) or a .DAT file, otherwise HEROES.DAT.
const choice = process.argv[3];
const settings = !choice ? H.DEFAULT_SETTINGS : /\.dat$/i.test(choice) ? readDat(choice) : H.PRESETS[Number(choice) - 1];

const MUL = 0xfd43fdn;
const ADD = 0xc39ec3n;
const MOD = 0x1000000n;
const inverse = (() => {
	let [a, m, x0, x1] = [MUL, MOD, 0n, 1n];
	let [r0, r1] = [m, a];
	while (r1 !== 0n) {
		const q = r0 / r1;
		[r0, r1] = [r1, r0 - q * r1];
		[x0, x1] = [x1, x0 - q * x1];
	}
	return ((x0 % MOD) + MOD) % MOD;
})();
const previous = (state) => Number((((BigInt(state) - ADD) % MOD + MOD) * inverse) % MOD);

// A printer capture (LPT1.PRN) holds the sheets back to back, each one opening with CHR$(146).
const printed = fs.existsSync(path.join(dir, 'LPT1.PRN'))
	? fs.readFileSync(path.join(dir, 'LPT1.PRN'), 'latin1').split(/(?=\x92 +(?:\[ Non-Player|Player _))/).filter((t) => t)
	: [];
const sheets = [...fs.readdirSync(dir).filter((f) => /\.(hro|htm)$/i.test(f)), ...printed.map((_, i) => `LPT1.PRN:${i}`)]
	.map((f) => {
		const prn = f.startsWith('LPT1.PRN:');
		const raw = prn ? printed[Number(f.slice(9))] : fs.readFileSync(path.join(dir, f), 'latin1');
		const text = raw.replace(/\r\n$/, '');
		const number = /Character #\s*(\d+)/.exec(text);
		const xp = /X\.P\.: ([\d,]+)/.exec(text);
		// Printouts of spellcasters stop at the spell table (error 52), without number or date.
		if (!xp || (!number && !prn)) return null;
		// The sheet is rendered again with the time stamp the original printed, so whole files are compared.
		const [, mm, dd, yyyy, h, m, s] = /(\d\d)-(\d\d)-(\d{4}), (\d\d):(\d\d):(\d\d)/.exec(text) || [];
		return {
			file: f,
			prn,
			html: /\.htm$/i.test(f),
			date: mm ? new Date(yyyy, mm - 1, dd, h, m, s) : new Date(),
			lines: text.split('\r\n'),
			number: number ? Number(number[1]) : 0,
			xp: Number(xp[1].replace(/,/g, '')),
		};
	})
	.filter((sheet) => sheet);
let printedNumber = 0;
sheets.forEach((sheet) => {
	if (sheet.prn && !sheet.number) sheet.number = printedNumber + 1;
	printedNumber = sheet.number;
});
sheets.sort((a, b) => a.number - b.number);

const candidates = (xp) => {
	const range = settings.xpMax - settings.xpMin + 1;
	const n = xp - settings.xpMin;
	const out = [];
	for (let k = Math.ceil((n * 2 ** 24) / range) - 1; k <= Math.ceil(((n + 1) * 2 ** 24) / range); k++) {
		if (k >= 0 && k < 2 ** 24 && Math.floor((k / 2 ** 24) * range) === n) out.push(previous(k));
	}
	return out;
};

const compare = (a, b) => {
	const diffs = [];
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		if (a[i] !== b[i]) diffs.push(i);
	}
	return diffs;
};

// Tracks the RND state left by the last draw, so that a session can be followed from one character to the next.
let last = H.RND_START;
const createRng = H.createRng;
H.createRng = (seed) => {
	const rng = createRng(seed);
	last = rng.state;
	return {
		random: () => {
			const value = rng.random();
			last = rng.state;
			return value;
		},
		get state() {
			return rng.state;
		},
	};
};

let state = H.createState(settings);
let exact = 0;
const rolled = new Map();
sheets.forEach((sheet) => {
	let best = null;
	const from = last;
	const tryState = (seed) => {
		const trial = { ...state, pool: state.pool.map((t) => ({ ...t })), lines: [...state.lines] };
		const c = H.generate(settings, seed, sheet.number, trial);
		const end = last;
		const render = sheet.prn ? H.renderPrint : sheet.html ? (ch, date) => H.exportHtml([ch], date) : H.renderText;
		const lines = render(c, sheet.date).replace(/\r\n$/, '').split('\r\n');
		const diffs = compare(sheet.lines, lines);
		const name = sheet.prn ? sheet.file : sheet.html ? H.htmlFileName(c) : H.hroFileName(c);
		if (name.toUpperCase() !== sheet.file.toUpperCase()) diffs.push(-1);
		if (!best || diffs.length < best.diffs.length) best = { seed, diffs, lines, name, trial, end, c };
		return !diffs.length;
	};
	const forced = process.env.SEED ? [Number.parseInt(process.env.SEED, 16)] : null;
	const states = forced || candidates(sheet.xp);
	if (states.length <= 1000) states.forEach(tryState);
	else {
		// X.P. without spread: walk forward from where the previous character left the generator, since the
		// key-wait loop only draws RND(1) in between (about 7,300 draws per key press at 0.8 s).
		let seed = from;
		for (let i = 0; i < 400000 && !tryState(seed); i++) seed = H.rndNext(seed);
	}
	if (!best) {
		console.log(`#${sheet.number} ${sheet.file}: no RND state gives X.P. ${sheet.xp}`);
		return;
	}
	if (sheet.number === 1) {
		// The first character follows the trait loading after one stir and seconds × minutes draws of TIME$.
		let seed = from;
		let draws = 0;
		while (seed !== best.seed && draws < 4000) {
			seed = H.rndNext(seed);
			draws++;
		}
		const time = /^\d\d-\d\d-\d{4}, (\d\d):(\d\d):(\d\d)/m.exec(sheet.lines.join('\n'));
		console.log(`#1 starts ${draws < 4000 ? draws - settings.breed - 2 : '?'} draws after start-up; printed at ${time ? time.slice(1).join(':') : '?'}`);
	}
	state = best.trial;
	last = best.end;
	rolled.set(sheet.number, best.c);
	if (!best.diffs.length) exact++;
	console.log(`#${sheet.number} ${sheet.file}: seed 0x${best.seed.toString(16)} -> ${best.diffs.length ? `${best.diffs.length} line(s) differ` : 'identical'}`);
	best.diffs.slice(0, 12).forEach((i) => {
		if (i < 0) return console.log(`   file name: ${sheet.file} vs ${best.name}`);
		console.log(`   original: ${JSON.stringify(sheet.lines[i])}`);
		console.log(`   js      : ${JSON.stringify(best.lines[i])}`);
	});
});
console.log(`${exact}/${sheets.length} sheets identical.`);

// Screens grabbed by SCRDUMP.COM: the last dump showing each character is compared cell by cell (code and
// colour), except the spinner and the clock of the key-wait loop.
const dumps = fs.readdirSync(dir).filter((f) => /^S\d{4}\.SCR$/i.test(f)).sort();
if (dumps.length) {
	const clr = fs.readFileSync(path.join(dir, 'HEROES.CLR'));
	const colors = [0, 2, 4].map((i) => clr.readInt16LE(i));
	const shown = new Map();
	dumps.forEach((f) => {
		const raw = fs.readFileSync(path.join(dir, f));
		const row = (r) => raw.subarray((r - 1) * 160, r * 160).filter((_, i) => i % 2 === 0).toString('latin1');
		const number = /Character # (\d+)/.exec(row(24));
		if (number) shown.set(Number(number[1]), { f, raw });
	});
	let same = 0;
	let compared = 0;
	[...shown].sort((a, b) => a[0] - b[0]).forEach(([number, { f, raw }]) => {
		const c = rolled.get(number);
		if (!c) return;
		compared++;
		const cells = H.renderScreen(c, { colors, names: settings.names, output: settings.output });
		const bad = [];
		cells.forEach((line, r) => line.forEach(([ch, attr], col) => {
			if (r === 23 && (col === 3 || (col >= 5 && col <= 12))) return;
			const i = (r * 80 + col) * 2;
			if (raw[i] !== ch.charCodeAt(0) || raw[i + 1] !== attr) bad.push([r + 1, col + 1]);
		}));
		if (!bad.length) {
			same++;
			return;
		}
		const rows = [...new Set(bad.map(([r]) => r))];
		console.log(`screen #${number} ${f}: ${bad.length} cell(s) differ on row(s) ${rows.join(', ')}`);
		const js = H.screenText(cells).split('\n');
		rows.slice(0, 4).forEach((r) => {
			const original = [...raw.subarray((r - 1) * 160, r * 160)].filter((_, i) => i % 2 === 0).map((b) => String.fromCharCode(b)).join('');
			console.log(`   original: ${JSON.stringify(original.replace(/ +$/, ''))}`);
			console.log(`   js      : ${JSON.stringify((js[r - 1] || '').replace(/ +$/, ''))}`);
		});
	});
	console.log(`${same}/${compared} screens identical.`);
}
