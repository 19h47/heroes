// node .re/idlerate.js <dir> <seconds between keys> — passes of the key-wait loop between the characters of a
// capture made with the default data set: the RND state walks forward from each character to the next one's
// seed, less the breed+2 stir draws of nextCharacter.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const context = { console };
context.window = context;
vm.createContext(context);
['data', 'original', 'traits', 'rng', 'generator', 'render'].forEach((file) => {
	vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'heroes-js', 'js', `${file}.js`), 'utf8'), context);
});
const H = context.Heroes;

const [dir, interval = 0.8] = process.argv.slice(2);
// match.js fails on the last file, which DOSBox leaves truncated; its seeds are still printed.
let out;
try {
	out = execSync(`node "${path.join(__dirname, 'match.js')}" "${dir}"`, { encoding: 'utf8' });
} catch (error) {
	out = error.stdout;
}
const seeds = [...out.matchAll(/seed 0x([0-9a-f]+)/g)].map((m) => parseInt(m[1], 16));
const settings = H.DEFAULT_SETTINGS;
const state = H.createState(settings);
const noon = new Date(2000, 0, 1, 12, 0, 0);
const passes = seeds.map((seed, i) => {
	let x = state.rnd;
	let n = 1;
	while (H.rndNext(x) !== seed && n < H.RND_PERIOD) {
		x = H.rndNext(x);
		n++;
	}
	const idle = n - settings.breed - 2;
	H.nextCharacter(settings, state, i + 1, { idle, clock: noon });
	return idle;
});
// #1 is made of the start-up clock draws and #2 of the wait before autotype's first key; the others follow
// the 0.8 s waits.
const gaps = passes.slice(2);
const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
console.log(`${dir}: passes ${gaps.join(' ')} -> ${Math.round(mean / interval)} passes/s`);
