// node test/smoke.js [count] — generates characters for every shipped data set and checks invariants.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const context = { window: {}, console, structuredClone };
context.window = context;
vm.createContext(context);
['data', 'original', 'traits', 'rng', 'generator', 'render', 'screen', 'panel'].forEach((file) => {
	vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), context, { filename: `${file}.js` });
});
const H = context.Heroes;

const PER_SET = Number(process.argv[2]) || 5000;
const date = new Date(1993, 5, 1, 12, 0, 0);
const failures = [];
const tally = { races: {}, classes: {}, rare: 0, alignmentOverrides: 0 };

H.PRESETS.forEach((settings) => {
	const state = H.createState(settings);
	for (let i = 0; i < PER_SET; i++) {
		const seed = (i * 2654435761) >>> 0;
		try {
			const c = H.generate(settings, seed, i + 1, state);
			const text = H.renderText(c, date);
			const html = H.exportHtml([c], date);
			const problems = [];
			if (/\b(NaN|undefined|null)\b|\[object/.test(text + html)) problems.push('bad token in output');
			if (c.stats.some((s) => !Number.isInteger(s) || s < 3 || s > 25)) problems.push(`stats ${c.stats}`);
			[...c.mask].forEach((letter, p) => {
				if (letter !== '-' && !(c.levels[p] >= 1)) problems.push(`level ${c.mask} ${c.levels}`);
			});
			if (![c.ac, c.thac0, c.hp, ...c.saves].every(Number.isFinite)) problems.push('combat');
			if (c.xp < Math.min(settings.xpMin, settings.xpMax) || c.xp > Math.max(settings.xpMin, settings.xpMax)) problems.push(`xp ${c.xp}`);
			if (text.split('\r\n').some((l) => l.length > 80)) problems.push('line wider than 80 columns');
			const cells = H.renderScreen(c, { names: settings.names, output: settings.output });
			if (cells.some((line, r) => r > 0 && r < 23 && line[79][0] !== '\xba')) problems.push('screen text over the frame');
			if (/\b(NaN|undefined|null)\b/.test(H.screenText(cells) + H.renderPrint(c, date))) problems.push('bad token on screen or printout');
			if ((settings.alignLimit === 1 && c.good !== 1) || (settings.alignLimit === 3 && c.good !== 3)) tally.alignmentOverrides++;
			if (problems.length) failures.push({ set: settings.label, seed, problems });
			if (c.rare) tally.rare++;
			if (settings.label === 'Default') {
				tally.races[c.raceName] = (tally.races[c.raceName] || 0) + 1;
				tally.classes[c.classLabel] = (tally.classes[c.classLabel] || 0) + 1;
			}
		} catch (error) {
			failures.push({ set: settings.label, seed, problems: [error.stack] });
		}
	}
});

// Every key of the control panel on every shipped data set: the screen stays inside its frame and the data set
// it hands back still generates characters.
const PANEL_KEYS = ['N', 'F', 'G', 'X', '7', '9', '1', '3', '4', '6', '5', '9', '\r', 'C', '1', 'T', 'B', 'R', '2', '8', '6', '4', '9', '7', '*', '\r',
	'S', ' ', ' ', '6', '\r', '!', '@', '#', '$', '\b', 'D', '\b', 'A', 'B', 'F1', 'F5', 'F3', 'Alt1', 'Alt0', 'R', '\r', 'F2'];
H.PRESETS.forEach((settings) => {
	const panel = H.createPanel({ settings, slots: structuredClone(H.PRESETS), colors: H.DEFAULT_COLORS });
	PANEL_KEYS.forEach((k) => {
		panel.press(k);
		const text = H.screenText(panel.cells);
		if (/\b(NaN|undefined|null)\b/.test(text) || panel.cells.length !== 25 || panel.cells.some((line) => line.length !== 80)) {
			failures.push({ set: settings.label, problems: [`panel after ${JSON.stringify(k)}`] });
		}
	});
	try {
		H.generate(panel.settings(), 1, 1, H.createState(panel.settings()));
	} catch (error) {
		failures.push({ set: settings.label, problems: [`panel settings: ${error.message}`] });
	}
});

const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}: ${v}`).join(', ');
console.log(`Generated ${PER_SET * H.PRESETS.length} characters (${tally.rare} rare, ${tally.alignmentOverrides} alignment overridden by class).`);
console.log(`Default races  -> ${top(tally.races)}`);
console.log(`Default classes -> ${top(tally.classes)}`);
console.log(failures.length ? `FAILURES: ${failures.length}\n${JSON.stringify(failures.slice(0, 5), null, 1)}` : 'All invariants hold.');
process.exitCode = failures.length ? 1 : 0;
