// node .re/screenwalk.js <dir> <start-up draws> — rebuilds a whole session from its SCRDUMP screens alone.
// Each character is searched for by walking forward from where the previous one left the generator, then the
// screen is compared cell by cell (spinner and clock excepted). Reports the draws between characters, so the
// draws spent on the exit screen and the error screens can be checked.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'heroes-js', 'js');
const context = { console, structuredClone };
context.window = context;
vm.createContext(context);
['data', 'original', 'traits', 'rng', 'generator', 'render', 'screen'].forEach((file) => {
	vm.runInContext(fs.readFileSync(path.join(root, `${file}.js`), 'utf8'), context, { filename: `${file}.js` });
});
const H = context.Heroes;

const [dir, startDraws] = [process.argv[2], Number(process.argv[3])];
const raw = fs.readFileSync(path.join(dir, 'HEROES.DAT'));
const rec = (n) => raw.readFloatLE((n - 1) * 4);
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => rec(from + i));
const settings = {
	...H.DEFAULT_SETTINGS, noLevelLimits: rec(1) === 1, classFocus: rec(2), breed: rec(3), rerollBelow: rec(4),
	method: rec(5), alignLimit: rec(6), names: rec(7) === 1, female: rec(8), breeds: rec(9), xpMin: rec(10),
	xpMax: rec(13), races: range(16, 24), social: range(26, 32), traits: rec(34) !== 0, output: rec(35),
};
const clr = fs.readFileSync(path.join(dir, 'HEROES.CLR'));
const colors = [0, 1, 2].map((i) => clr.readInt16LE(i * 2));

// The last dump showing each character number, in order.
const screens = new Map();
fs.readdirSync(dir).filter((f) => /^S\d+\.SCR$/.test(f)).sort().forEach((f) => {
	const b = fs.readFileSync(path.join(dir, f));
	const m = /Character # (\d+)/.exec(b.filter((_, i) => i % 2 === 0).toString('latin1'));
	if (m) screens.set(Number(m[1]), { f, b });
});

const same = (cells, b) => cells.every((line, r) => line.every(([ch, attr], c) => {
	if (r === 23 && c >= 3 && c <= 12) return true;
	const i = (r * 80 + c) * 2;
	return ch.charCodeAt(0) === b[i] && attr === b[i + 1];
}));

let state = H.createState(settings);
const clock = { getSeconds: () => startDraws, getMinutes: () => 1 };
let previous = 0;
let wasBurst = false;
for (const [number, { f, b }] of screens) {
	// Characters between two dumps were rolled in Burst mode, one pass of the key-wait loop apart.
	const burst = b.filter((_, i) => i % 2 === 0).toString('latin1').slice(21 * 80, 22 * 80).includes('Burst');
	let found = -1;
	// Autotype presses keys 8 s after start-up, then 0.8 s apart, and a burst goes one pass at a time: try the
	// gaps nearest to those first, since two walks a few hundred draws apart can fall in step.
	const guess = previous === 0 ? 0 : previous === 1 ? 75400 : burst && wasBurst ? 1 : 7257;
	wasBurst = burst;
	for (let step = 0; step < 600000 && found < 0; step++) {
		const idle = guess + (step % 2 ? (step + 1) / 2 : -step / 2);
		if (idle < 0) continue;
		const trial = structuredClone(state);
		let c = H.nextCharacter(settings, trial, previous + 1, { idle, clock });
		for (let n = previous + 2; n <= number; n++) c = H.nextCharacter(settings, trial, n, { idle: 1 });
		if (same(H.renderScreen(c, { colors, names: settings.names, output: settings.output, burst }), b)) {
			found = idle;
			state = trial;
		}
	}
	previous = number;
	console.log(`#${number} ${f}: ${found < 0 ? 'not found' : `${found} draws after the previous character`}`);
	if (found < 0) break;
	// The exit screen's letter, had Esc been pressed next with no idle passes.
	const letter = String.fromCharCode(64 + Math.floor((H.rndNext(state.rnd) / 0x1000000) * 26) + 1);
	console.log(`   end state ${state.rnd.toString(16)}, an immediate Esc would ask for \`${letter}'`);
}
