// node .re/cpmatch.js <dir> <key>... — replays control panel keys (as SUB 4166 returns them: n, 9, \r, F3,
// \x1b…) through heroes-js/js/panel.js, starting from the dir's HEROES.DAT, HEROESn.DAT and HEROES.CLR, and
// looks for each expected screen, in order, among the SCRDUMP dumps of a capture that typed the same keys.
// Afterwards the HEROES.DAT and HEROESn.DAT files the original wrote are compared with the panel's data sets.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'heroes-js', 'js');
const context = { console, structuredClone };
context.window = context;
vm.createContext(context);
['data', 'original', 'screen', 'panel'].forEach((file) => {
	vm.runInContext(fs.readFileSync(path.join(root, `${file}.js`), 'utf8'), context, { filename: `${file}.js` });
});
const H = context.Heroes;

const [dir, ...keys] = process.argv.slice(2);
const unescape = (k) => k.replace(/\\r/g, '\r').replace(/\\x1b/g, '\x1b').replace(/\\b/g, '\b').replace(/^space$/, ' ');

const readDat = (file) => {
	if (!fs.existsSync(file) || fs.statSync(file).size < 148) return null;
	const raw = fs.readFileSync(file);
	if (raw.toString('latin1', 128, 132) !== 'OKAY') return null;
	const rec = (n) => raw.readFloatLE((n - 1) * 4);
	const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => rec(from + i));
	return {
		label: raw.toString('latin1', 140, 148).replace(/^ +/, ''),
		noLevelLimits: rec(1) === 1, classFocus: rec(2), breed: rec(3), rerollBelow: rec(4), method: rec(5),
		alignLimit: rec(6), names: rec(7) === 1, female: rec(8), breeds: rec(9), xpMin: rec(10), xpMinMant: rec(11),
		xpMinExp: rec(12), xpMax: rec(13), xpMaxMant: rec(14), xpMaxExp: rec(15), races: range(16, 24),
		social: range(26, 32), traits: rec(34) !== 0, output: rec(35),
	};
};

// The panel starts from the files as they were before the session: the shipped ones, HEROES.DAT patched by
// capture.sh like the one in the dir.
const shipped = path.join(__dirname, '..', 'original');
const start = readDat(path.join(dir, 'start.DAT')) || readDat(path.join(dir, 'HEROES.DAT'));
const slots = Array.from({ length: 12 }, (_, i) => readDat(path.join(shipped, `HEROES${i + 1}.DAT`)));
const clr = fs.readFileSync(path.join(dir, 'HEROES.CLR'));
const colors = [0, 1, 2].map((i) => clr.readInt16LE(i * 2));

const dumps = fs.readdirSync(dir).filter((f) => /^S\d+\.SCR$/.test(f)).sort()
	.map((f) => ({ f, b: fs.readFileSync(path.join(dir, f)) }));
const differs = (cells, b) => {
	const rows = new Set();
	cells.forEach((line, r) => line.forEach(([ch, attr], c) => {
		const i = (r * 80 + c) * 2;
		if (ch.charCodeAt(0) !== b[i] || attr !== b[i + 1]) rows.add(r + 1);
	}));
	return [...rows];
};

const panel = H.createPanel({ settings: start, slots, colors });
let at = 0;
let ok = 0;
const steps = [['(start)', null], ...keys.map((k) => [k, unescape(k)])];
for (const [name, k] of steps) {
	if (k !== null) panel.press(k);
	let found = -1;
	for (let i = at; i < dumps.length && found < 0; i++) if (!differs(panel.cells, dumps[i].b).length) found = i;
	if (found < 0) {
		// Closest dump from here on, to show what differs.
		let best = null;
		for (let i = at; i < dumps.length; i++) {
			const rows = differs(panel.cells, dumps[i].b);
			if (!best || rows.length < best.rows.length) best = { i, rows };
		}
		console.log(`${name}: no identical screen; closest ${best && dumps[best.i].f}, rows ${best && best.rows.join(' ')}`);
		if (best) {
			best.rows.slice(0, 4).forEach((r) => {
				const o = [...Array(80)].map((_, c) => String.fromCharCode(dumps[best.i].b[((r - 1) * 80 + c) * 2])).join('');
				console.log(`   ${r} original: ${JSON.stringify(Buffer.from(o, 'latin1').toString('latin1'))}`);
				console.log(`   ${r} js      : ${JSON.stringify(panel.cells[r - 1].map(([ch]) => ch).join(''))}`);
			});
		}
	} else {
		ok++;
		at = found;
	}
}
console.log(`${ok}/${steps.length} panel screens identical.`);

// Data sets written by the original against the panel's.
const strip = (s) => s && JSON.stringify({ ...s, label: s.label.trimEnd() });
const written = [['HEROES.DAT', panel.settings()], ...slots.map((s, i) => [`HEROES${i + 1}.DAT`, s])];
written.forEach(([file, js]) => {
	const original = readDat(path.join(dir, file));
	if (strip(original) !== strip(js)) console.log(`${file} differs:\n   original ${strip(original)}\n   js       ${strip(js)}`);
});
