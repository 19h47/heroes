// HEROES.CP, the control panel (.re/cp.bin.bas): one key changes one value of HEROES.DAT, three editors
// (X.P. range, racial and social population) and the data set labeling box. Esc saves HEROES.DAT and chains
// back to HEROES.EXE. A data set is a settings object of heroes-js; `slots` holds HEROES1.DAT to HEROES12.DAT.
window.Heroes = window.Heroes || {};

(() => {
	const H = Heroes;
	const f = Math.fround;
	// DATA D0285: F and B step through these amounts; D2f65: the bases Spacebar steps the social curve through.
	const AMOUNTS = [0, 10, 25, 33, 50, 67, 75, 90, 100, 0];
	const CURVES = [0, 1, 1.5, 1.8, 2.3, 2.55, 0];
	const AMOUNT_NAMES = { 0: 'None          ', 10: 'Some          ', 25: 'One Quarter   ', 33: 'One Third     ', 50: 'One Half      ', 67: 'Two Thirds    ', 75: 'Three Quarters', 90: 'Most          ', 100: 'All           ' };
	const METHOD_NAMES = ['Best 3 of 4d6', 'Best 3 of 6d6', 'Linear 5-18  ', 'Linear 10-18 '];
	const ALIGN_NAMES = ['Limit To GOOD Characters    ', 'No Limitation               ', 'Limit To EVIL Characters    ', 'Limit to NON-EVIL characters'];
	const FOCUS_NAMES = 'Strength    IntelligenceWisdom      Dexterity   ';

	// PRINT USING "###", "##" and "########,".
	const using = (n, width) => String(Math.round(n)).padStart(width);
	const usingComma = (n) => Math.round(n).toLocaleString('en-US').padStart(9);
	const xp = (mant, exp) => f(f(10 ** exp) * mant);

	// Records 1, 7 and 34 are numbers in HEROES.DAT and booleans in heroes-js.
	const toPanel = (settings) => ({
		...structuredClone(settings),
		noLevelLimits: settings.noLevelLimits ? 1 : 0,
		names: settings.names ? 1 : 0,
		traits: settings.traits ? 1 : 0,
	});
	const toSettings = (d) => ({ ...structuredClone(d), noLevelLimits: d.noLevelLimits === 1, names: d.names === 1, traits: d.traits !== 0 });

	H.createPanel = ({ settings, slots, colors, beep = () => {} }) => {
		const d = toPanel(settings);
		const c = [...colors];
		const s = H.page();
		// 'main', 'xp', 'race', 'social' or 'label', with the selected row and the label being typed.
		let mode = 'main';
		let sel = 1;
		let curve = 0;
		let typed = '';

		const key = (k) => {
			s.color(c[0], c[2]);
			s.print(` ${k} `);
			s.color(c[0], c[1]);
		};
		const value = (v) => {
			s.color(c[2], c[1]);
			s.print(v);
			s.print(' ');
			s.color(c[0], c[1]);
		};
		const prompt = (lines) => {
			s.color(c[1], c[2]);
			lines.forEach((line, i) => {
				s.locate(22 + i, 3);
				s.print(line);
				s.tab(49);
			});
			s.color(c[0], c[1]);
		};

		const drawMethod = () => {
			s.locate(14, 4);
			if (d.method > 4) d.method = 1;
			key('C');
			s.print(' Character Generation Method:', true);
			s.locate(15, 8);
			value(METHOD_NAMES[d.method - 1] ?? '');
		};
		const drawBreeds = () => {
			s.locate(13, 40);
			if (d.breeds === 2) d.breeds = 0;
			key('B');
			s.print(' Breeds & Sub-Races: ');
			value(AMOUNT_NAMES[d.breeds] ?? '');
		};
		const drawFemale = () => {
			s.locate(4, 4);
			if (d.female > 100) d.female = 0;
			key('F');
			s.print(' Amount Of Female', true);
			s.locate(5, 8);
			s.print(' Characters: ');
			value(AMOUNT_NAMES[d.female] ?? '');
		};
		const drawAlign = () => {
			s.locate(7, 4);
			if (d.alignLimit > 4) d.alignLimit = 1;
			key('G');
			s.print(' Good / Evil Limitation:', true);
			s.locate(8, 8);
			value(ALIGN_NAMES[d.alignLimit - 1] ?? '');
		};
		const drawLabel = () => {
			s.locate(17, 28);
			key('D');
			s.print(' Data Set Label:', true);
			s.locate(18, 32);
			value(d.label);
			s.locate(19, 32);
			s.print('            ');
		};
		const yesNo = (row, k, text, yes) => {
			s.locate(row, 4);
			key(k);
			s.print(text);
			value(yes ? 'Yes' : 'No ');
		};
		const drawNames = () => {
			if (d.names > 1) d.names = 0;
			yesNo(2, 'N', ' Create Names? ', d.names !== 0);
		};
		const drawTraits = () => {
			if (d.traits > 1) d.traits = 0;
			yesNo(19, 'T', ' Use Traits? ', d.traits !== 0);
		};
		const drawReroll = () => {
			if (d.rerollBelow === 3) d.rerollBelow = 1;
			yesNo(17, '1', " Reroll 1's? ", d.rerollBelow !== 1);
		};
		const drawXp = () => {
			d.xpMin = xp(d.xpMinMant, d.xpMinExp);
			d.xpMax = xp(d.xpMaxMant, d.xpMaxExp);
			s.locate(10, 4);
			key('X');
			s.print(' Experience Point Range ...', true);
			[[11, 'Minimum: ', d.xpMin], [12, 'Maximum: ', d.xpMax]].forEach(([row, text, n]) => {
				s.locate(row, 8);
				s.print(text);
				s.color(c[2], c[1]);
				s.print(`${usingComma(n)} X.P.`, true);
				s.color(c[0], c[1]);
			});
			s.color(0, c[0]);
		};
		const list = (row, k, title, names, values) => {
			s.locate(row, 40);
			key(k);
			s.print(title, true);
			names.forEach((name, i) => {
				s.locate(row + 1 + i, 50);
				s.color(c[2], c[1]);
				s.print(`${using(values[i], 3)} ${name}`, true);
				s.color(c[0], c[1]);
			});
		};
		const drawRaces = () => list(2, 'R', ' Racial Population ...', H.RACE_GROUPS, d.races);
		const drawSocial = () => list(15, 'S', ' Social Population ...', H.SOCIAL, d.social);
		const drawSuper = () => {
			if (d.noLevelLimits > 1) d.noLevelLimits = 0;
			s.locate(21, 63);
			s.color(c[2], c[1]);
			s.print(d.noLevelLimits ? '! Superheroes' : '             ', true);
		};
		const drawFocus = () => {
			if (d.classFocus > 4) d.classFocus = 0;
			s.locate(22, 63);
			s.color(c[2], c[1]);
			s.print(d.classFocus > 0 ? `@ ${FOCUS_NAMES.substr(d.classFocus * 12 - 12, 12)}` : ' '.repeat(14), true);
		};
		const drawBreed = () => {
			s.locate(20, 65);
			if (d.breed > 20) d.breed = 0;
			if (d.breed > 0) key(String(d.breed));
			s.print('     ', true);
		};
		const drawOutput = () => {
			if (d.output > 3) d.output = 1;
			s.locate(23, 63);
			s.color(c[2], c[1]);
			s.print(['           ', '$ .HRO File', '$ .HTM File'][d.output - 1] ?? '');
		};
		const drawMenu = () => prompt([
			' \xfe CONTROL PANEL  Press N, F, G, X, C, 1,',
			'   T, D, R, B, or S to Change A Control Value',
			' \xfe Press ESC When Done ',
		]);
		const menu = () => {
			// CONTROL PANEL is in the text colour on the frame colour.
			drawMenu();
			s.locate(22, 6);
			s.color(c[0], c[2]);
			s.print('CONTROL PANEL ');
			s.color(c[0], c[1]);
		};

		const full = () => {
			H.frame(s, c);
			drawMethod();
			drawReroll();
			drawFemale();
			drawAlign();
			drawXp();
			drawRaces();
			drawSocial();
			drawNames();
			drawBreeds();
			drawTraits();
			drawLabel();
			menu();
			if (d.noLevelLimits > 0) drawSuper();
			if (d.classFocus > 0) drawFocus();
			if (d.breed > 0) drawBreed();
			if (d.output > 1) drawOutput();
		};

		// After a change the data set no longer matches its label.
		const changed = (draw) => {
			draw();
			d.label = '--NONE--';
			drawLabel();
		};
		const nextAmount = (v) => {
			const i = AMOUNTS.indexOf(v);
			return i < 0 ? 0 : AMOUNTS[i + 1];
		};

		// ------------------------------------------------------------ Editors

		const xpPrompt = () => prompt([
			' \xfe X.P. Home=LowerMin, PgUp=RaiseMin, Left=0 ',
			'         End=LowerMax, PgDn=RaiseMax, Rt=5mil ',
			' \xfe Press RETURN When Done ',
		]);
		const xpKey = (k) => {
			if (k === '7') {
				d.xpMinMant -= 0.25;
				if (d.xpMinMant < 1) { d.xpMinMant = 9.75; d.xpMinExp--; }
				if (d.xpMinExp < 2) { d.xpMinExp = 0; d.xpMinMant = 0; }
			} else if (k === '6') {
				[d.xpMinMant, d.xpMinExp, d.xpMaxMant, d.xpMaxExp] = [5, 6, 5, 6];
			} else if (k === '5') {
				[d.xpMinMant, d.xpMinExp, d.xpMaxMant, d.xpMaxExp] = [0, 0, 5, 6];
			} else if (k === '4') {
				[d.xpMinMant, d.xpMinExp, d.xpMaxMant, d.xpMaxExp] = [0, 0, 0, 0];
			} else if (k === '1') {
				d.xpMaxMant -= 0.25;
				if (d.xpMaxMant < 1) { d.xpMaxMant = 9.75; d.xpMaxExp--; }
				if (d.xpMaxExp < 2) { d.xpMaxExp = 0; d.xpMaxMant = 0; }
				if (xp(d.xpMaxMant, d.xpMaxExp) < xp(d.xpMinMant, d.xpMinExp)) [d.xpMinMant, d.xpMinExp] = [d.xpMaxMant, d.xpMaxExp];
			} else if (k === '9') {
				d.xpMinMant += 0.25;
				if (d.xpMinExp === 0) { d.xpMinMant = 1; d.xpMinExp = 2; }
				if (d.xpMinMant === 10) { d.xpMinMant = 1; d.xpMinExp++; }
				if (d.xpMinExp === 6 && d.xpMinMant > 5) d.xpMinMant = 5;
				if (xp(d.xpMinMant, d.xpMinExp) > xp(d.xpMaxMant, d.xpMaxExp)) [d.xpMaxMant, d.xpMaxExp] = [d.xpMinMant, d.xpMinExp];
			} else if (k === '3') {
				d.xpMaxMant += 0.25;
				if (d.xpMaxExp === 0) { d.xpMaxMant = 1; d.xpMaxExp = 2; }
				if (d.xpMaxMant === 10) { d.xpMaxMant = 1; d.xpMaxExp++; }
				if (d.xpMaxExp === 6 && d.xpMaxMant > 5) d.xpMaxMant = 5;
			} else if (k === '\r') {
				mode = 'main';
				drawXp();
				changed(() => {});
				menu();
				return;
			}
			drawXp();
		};

		// Racial (9 rows from row 3) and social (7 rows from row 16) population.
		const population = () => (mode === 'race'
			? { values: d.races, top: 2, count: 9, draw: drawRaces, checked: 9 }
			: { values: d.social, top: 15, count: 7, draw: drawSocial, checked: 6 });
		const showSelected = (on) => {
			const { values, top } = population();
			s.locate(sel + top, 50);
			s.color(...(on ? [c[1], c[0]] : [c[2], c[1]]));
			s.print(using(values[sel - 1], 3));
		};
		const populationPrompt = (title, last) => {
			prompt([
				` \xfe ${title} HOLISTICS: Up & Down Arrows Select`,
				'   Right+1 PageUp+10 Left-1 Home-10 *Equalize',
				last,
			]);
			s.color(0, c[0]);
			sel = 1;
			showSelected(true);
		};
		const populationKey = (k) => {
			const { values, count, draw, checked } = population();
			const v = sel - 1;
			if (k === '2' || k === '8') {
				showSelected(false);
				sel += k === '2' ? 1 : -1;
				if (sel > count) sel = 1;
				if (sel < 1) sel = count;
			} else if (k === '4') {
				values[v]--;
				if (values[v] < 0) values[v] = 99;
			} else if (k === '6') {
				values[v]++;
				if (values[v] > 99) values[v] = 0;
			} else if (k === '7') {
				values[v] -= 10;
				if (values[v] < 0) values[v] = 90;
			} else if (k === '9') {
				values[v] += 10;
				if (values[v] > 99) values[v] = 0;
			} else if (k === '*') {
				values.fill(values[v]);
				if (values[v] === 0) values[v] = 1;
				draw();
			} else if (k === ' ' && mode === 'social') {
				curve = CURVES[CURVES.indexOf(curve) + 1] ?? 0;
				// QB's ^ is 2^(curve*log2 i): it only hits an integer exactly when that exponent is one, and
				// otherwise lands just under it, so base 1 gives 1 2 2 4 4 5.
				for (let i = 1; i <= 6; i++) {
					const exponent = curve * Math.log2(i);
					values[i - 1] = Math.floor(Number.isInteger(exponent) ? 2 ** exponent : (i ** curve) * (1 - 2 ** -40));
				}
				values[6] = 0;
				draw();
			} else if (k === '\r') {
				if (!values.slice(0, checked).some((n) => n > 0)) values[v] = 1;
				mode = 'main';
				draw();
				changed(() => {});
				menu();
				return;
			}
			showSelected(true);
		};

		// D: the label is typed in letters only, eight at most, and stored with F2 to F12.
		const labelBox = () => {
			s.color(c[1], c[0]);
			s.locate(16, 50);
			s.print('\xda\xc4 Current Data Sets \xc4\xc4\xc4\xc4\xc4\xbf');
			const name = (n) => (slots[n - 1] ? slots[n - 1].label : '').padEnd(8).slice(0, 8);
			for (let i = 1; i <= 6; i++) {
				s.locate(16 + i, 50);
				s.print(`\xb3 ${using(i, 2)} ${name(i)} ${using(i + 6, 2)} ${name(i + 6)} \xb3`, true);
			}
			s.locate(23, 50);
			s.print(`\xc0${'\xc4'.repeat(25)}\xd9`);
			s.color(c[0], c[1]);
		};
		const showTyped = () => {
			s.locate(18, 32);
			s.print(typed);
			s.print('_');
			s.print('        ');
		};
		const labelKey = (k) => {
			if (k.length === 1 && /[a-z]/i.test(k)) {
				if (typed.length < 8) typed += k;
				else beep();
			} else if (k.length > 1 && k[0] === 'F') {
				const n = Number(k.slice(1));
				if (n > 12 || n < 2) {
					beep();
				} else {
					d.label = typed;
					slots[n - 1] = toSettings(d);
					mode = 'main';
					full();
					return { store: n };
				}
			} else if (k === '\b') {
				typed = typed.slice(0, -1);
			} else if (k === '\x1b') {
				mode = 'main';
				full();
				return {};
			}
			showTyped();
			return {};
		};

		// ------------------------------------------------------------ Keys

		// One key as SUB 4166 returns it: a character, "F1" to "F12", "Alt0" to "Alt3", or the digit an arrow,
		// Home, End, PgUp or PgDn stands for. Returns { exit: true } on Esc, { colors } after Alt+digit and
		// { store: n } when a data set was written.
		const press = (k) => {
			if (mode === 'xp') { xpKey(k); return {}; }
			if (mode === 'race' || mode === 'social') { populationKey(k); return {}; }
			if (mode === 'label') return labelKey(k);

			const alt = { Alt1: 0, Alt2: 1, Alt3: 2 }[k];
			if (alt !== undefined) {
				c[alt] = (c[alt] + 1) % 16;
				full();
				return { colors: [...c] };
			}
			if (k === 'Alt0') {
				c.splice(0, 3, ...H.RESET_COLORS);
				full();
				return { colors: [...c] };
			}
			if (k === '\x1b') return { exit: true };
			if (k.length > 1 && k[0] === 'F') {
				const slot = slots[Number(k.slice(1)) - 1];
				if (!slot) {
					beep();
					return {};
				}
				Object.assign(d, toPanel(slot));
				full();
				return {};
			}
			if (k === '!') { d.noLevelLimits++; changed(drawSuper); return {}; }
			if (k === '@') { d.classFocus++; changed(drawFocus); return {}; }
			if (k === '#') { d.breed++; changed(drawBreed); return {}; }
			if (k === '$') {
				if (d.output === 2) d.output = 0;
				d.output++;
				changed(drawOutput);
				return {};
			}
			if (k === '\b') { d.output = 3; changed(drawOutput); return {}; }
			if (k === '1') { d.rerollBelow++; changed(drawReroll); return {}; }
			const u = k.toUpperCase();
			if (u === 'C') { d.method++; changed(drawMethod); }
			else if (u === 'G') { d.alignLimit++; changed(drawAlign); }
			else if (u === 'T') { d.traits++; changed(drawTraits); }
			else if (u === 'N') { d.names++; changed(drawNames); }
			else if (u === 'F') { d.female = nextAmount(d.female); changed(drawFemale); }
			else if (u === 'B') { d.breeds = nextAmount(d.breeds); changed(drawBreeds); }
			else if (u === 'D') {
				mode = 'label';
				prompt([
					' \xfe DATA SET LABELING   Type A Name For ',
					'     This Data Set; Press An F-Key To Store ',
					' \xfe Press ESC to cancel ',
				]);
				labelBox();
				typed = d.label;
				showTyped();
			} else if (u === 'X') { mode = 'xp'; xpPrompt(); drawXp(); }
			else if (u === 'R') { mode = 'race'; populationPrompt('RACIAL', ' \xfe Press RETURN When Done'); }
			else if (u === 'S') { mode = 'social'; populationPrompt('SOCIAL', ' \xfe Press RETURN When Done (Spacebar = Curve)'); }
			return {};
		};

		full();
		return {
			cells: s.cells,
			press,
			settings: () => toSettings(d),
		};
	};
})();
