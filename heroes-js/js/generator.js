// Port of the character generator compiled into Heroes.exe (QuickBASIC), following the lifted code in
// .re/heroes.bin.bas (main module) and .re/heroes.bin.e3b0.bas (abilities, spells and output module).
// DATA/RESTORE/READ are emulated over Heroes.DATA so that the original read sequences, including reads
// that run past the end of a table, behave exactly as in the program.
window.Heroes = window.Heroes || {};

(() => {
	const H = Heroes;
	const CLASS_LETTERS = 'FBPRMICDTA';
	const HENCHMAN_CLASSES = 'FghtrBrbrnPaldnRngr MgUsrIllsnClrc DruidThiefAssn ';
	const ROMAN = 'I   II  III IV  V   VI  VII VIIIIX  ';
	const NO_MODS = [0, 0, 0, 0, 0, 0];
	const BARBARIAN_SKILLS = ['animal handling', 'horsemanship', 'long distance signaling', 'running', 'small paddled craft', 'small rowed craft', 'sound imitation', 'snare building'];

	// QuickBASIC SINGLE: every variable and literal is a 32-bit float, intermediate results are not.
	const f = Math.fround;
	const chunk = (text, index, size) => text.substr(index * size - size, size);
	const fmt = (n) => String(Number(n.toPrecision(7)));
	const str$ = (n) => (n < 0 ? '' : ' ') + fmt(n);
	const digits = (n) => str$(n).slice(1);
	const roll = (source, label, readValue) => {
		source.restore(label);
		const count = source.readNum();
		return { count, pick: (n) => source.readN(n, readValue) };
	};

	// Session state of Heroes.exe. The trait pool is first drawn at start-up, before any key is read, so it
	// always comes from the initial RND state; with traits off at start-up it stays empty.
	H.createState = (settings = H.DEFAULT_SETTINGS) => {
		const rng = H.createRng(H.RND_START);
		return {
			pool: settings.traits && H.TRAITS ? loadTraits(rng.random) : [],
			rnd: rng.state,
			used: 0,
			lines: [],
			shieldBonus: 0,
			blessed: 0,
		};
	};

	// Draws between two characters in the main loop: the key-wait loop takes one RND(1) per pass, SUB bbe1
	// stirs breed + 2 more, and before the first character the program burns seconds × minutes of TIME$.
	H.nextCharacter = (settings, state, number, { idle = 0, clock = new Date() } = {}) => {
		let draws = (idle % H.RND_PERIOD) + settings.breed + 2;
		if (number === 1) draws += clock.getSeconds() * clock.getMinutes();
		for (let i = 0; i < draws; i++) state.rnd = H.rndNext(state.rnd);
		return H.generate(settings, state.rnd, number, state);
	};

	// HEROES.TRT loader (GOSUB a0d0). The closing "9END|" line is dropped from the count.
	const loadTraits = (RND) => H.TRAITS.map(({ mods, options }) => {
		let k = 0;
		while (k < options.length - 1 && !(RND() < f(0.5))) k++;
		const sign = k % 2 ? -1 : 1;
		// The loader reads the six modifiers with GET at an unchanged file position, so every ability
		// receives the first digit of the line (the strength modifier).
		return { text: options[k], mods: mods ? mods.map(() => mods[0] * sign) : NO_MODS };
	});

	H.generate = (settings, seed, number = 1, state = H.createState()) => {
		const s = settings;
		const rng = H.createRng(seed);
		const RND = rng.random;
		const FNR = (x) => Math.floor(RND() * x) + 1;

		let ptr = 0;
		const data = {
			restore: (label) => { ptr = H.DATA.labels[label]; },
			read: () => (ptr < H.DATA.values.length ? H.DATA.values[ptr++] : 0),
			readNum: () => {
				const v = data.read();
				return f(typeof v === 'number' ? v : Number.parseFloat(v) || 0);
			},
			readStr: () => String(data.read()),
			readN: (n, reader = data.read) => {
				let v;
				for (let i = 0; i < n; i++) v = reader();
				return v;
			},
		};
		const { restore, readNum, readStr } = data;

		// ------------------------------------------------------------ Experience and age category

		let xp = s.xpMin + FNR(s.xpMax - s.xpMin + 1) - 1;
		if (s.xpMax === 0) xp = 0;

		restore('D0aab');
		let threshold = 0;
		let ageCat = 0;
		while (((FNR(20) + 90) / (100 * 6e6)) * xp > threshold) {
			threshold = readNum();
			ageCat++;
		}
		if (ageCat === 0) ageCat = 1;
		if (ageCat === 6) ageCat = 5;

		// ------------------------------------------------------------ Name

		const makeWord = (words) => {
			const vowel = 'aaaeeeiiou'[FNR(10) - 1];
			let hadCoda = 0;
			for (;;) {
				let word = '';
				let diphthong = 0;
				const syllables = FNR(4 - words);
				for (let syl = 1; syl <= syllables; syl++) {
					if (RND() < f(0.02) && syl > 1) word += '-';
					let onset = 0;
					if (!(RND() < f(0.2) && syl === 1) && hadCoda !== 1) {
						onset = 1;
						let set = 'bcdffgghjkkllmmnnprssttvwxyzz';
						let size = 1;
						if (RND() < f(0.3)) { set = 'brblchclcrdrfrflgrglkrkhklprphplqushslstspskthtr'; size = 2; }
						if (RND() < f(0.02)) { set = 'strskl'; size = 3; }
						word += chunk(set, FNR(set.length / size), size);
					}
					if (RND() < f(0.9) || diphthong > 0) {
						word += vowel;
					} else if (RND() < f(0.1) && syl > 1) {
						word += 'y';
					} else {
						const set = 'aiauawayeaeeeieueweyiaieoiooouowoy';
						word += chunk(set, FNR(set.length / 2), 2);
						diphthong = syl;
					}
					hadCoda = 0;
					if (RND() < f(0.1) && syl < syllables && onset === 1) continue;
					if (RND() < f(0.3) && syl === syllables) continue;
					hadCoda = 1;
					let set = 'dfgklmnrstxz';
					let size = 1;
					if (RND() < f(0.25)) { set = 'ngshstchskth'; size = 2; }
					if (RND() < f(0.12)) { set = 'ddffggkkllmmnnpprrssttzzntndns'; size = 2; }
					if (RND() < f(0.09)) { set = 'rcrdrfrgrkrlrmrnrsrt'; size = 2; }
					if (RND() < f(0.05)) { set = 'rshrstrchrskrth'; size = 3; }
					word += chunk(set, FNR(set.length / size), size);
				}
				if (word.length >= 4) return word;
			}
		};

		let name = '';
		{
			do {
				let words = FNR(2);
				if (RND() < f(0.1)) words++;
				// The word count is drawn before the names option is tested.
				if (!s.names) break;
				const parts = [];
				for (let w = 1; w <= words; w++) parts.push(makeWord(words));
				const chars = parts.join(' ').split('');
				chars[0] = chars[0].toUpperCase();
				for (let i = 1; i < chars.length; i++) {
					if (chars[i - 1] === ' ') chars[i] = chars[i].toUpperCase();
					if (RND() < f(0.8) && chars[i - 1] === '-') chars[i] = chars[i].toUpperCase();
				}
				name = chars.join('');
			} while (name.length < 5 || name.length > 25);
		}

		// ------------------------------------------------------------ Social class and abilities

		const weighted = (weights) => {
			let r = FNR(weights.reduce((sum, w) => sum + w, 0) || 1);
			let i = 1;
			for (; i <= weights.length; i++) {
				if (weights[i - 1] >= r) break;
				r -= weights[i - 1];
			}
			return i;
		};

		const social = weighted(s.social);
		restore('D02df');
		const socialNames = Array.from({ length: 7 }, () => (readNum(), readStr()));
		let socialName = socialNames[social - 1] ?? '';

		const st = [0, 0, 0, 0, 0, 0];
		const clampStats = () => st.forEach((v, i) => { st[i] = Math.min(25, Math.max(3, v)); });
		if (s.method === 1 || s.method === 2) {
			const dice = s.method === 1 ? 4 : 6;
			for (let i = 0; i < 6; i++) {
				const rolls = Array.from({ length: dice }, () => FNR(6 - s.rerollBelow) + s.rerollBelow).sort((a, b) => b - a);
				st[i] = rolls[0] + rolls[1] + rolls[2];
			}
		} else if (s.method === 3 || s.method === 4) {
			const base = s.method === 3 ? 5 : 10;
			for (let i = 0; i < 6; i++) st[i] = base - 1 + FNR(19 - base);
		}
		const [S, I, W, D, C, CH] = [0, 1, 2, 3, 4, 5];

		// ------------------------------------------------------------ Race, breed and class mask

		let mask = '----';
		const at = (i) => mask[i - 1];
		const put = (i, ch) => { mask = mask.slice(0, i - 1) + ch + mask.slice(i); };
		const oneOf = (...masks) => masks.includes(mask);
		let law = 0;
		let good = 0;
		let height = 0;
		let weight = 0;
		let age = 0;
		let race = 0;

		const rollAge = () => {
			let low = 0;
			for (let i = 0; i < ageCat; i++) low = readNum();
			const high = readNum();
			age = low + FNR(high - low);
		};
		const classMask = () => {
			mask = '----';
			const best = Math.max(st[S], st[I], st[W], st[D]);
			if (s.classFocus > 0) {
				st[s.classFocus - 1] = best + 1;
				put(s.classFocus, 'FMCT'[s.classFocus - 1]);
			}
			for (let i = 1; i <= 4; i++) {
				if (st[i - 1] >= best - FNR(2) + 1) put(i, 'FMCT'[i - 1]);
			}
			if (law === 1) put(4, '-');
			clampStats();
		};
		const breedRoll = () => FNR(100) <= s.breeds;
		const breedIndex = (max) => (s.breed >= 1 && s.breed <= max ? s.breed : FNR(max));
		const rangerRule = () => {
			if (at(1) === 'F' && good === 1 && st[S] > 12 && st[I] > 12 && st[W] > 13 && st[C] > 13) put(1, 'R');
		};
		const druidRule = () => {
			if (mask === '--C-' && s.alignLimit !== 1 && s.alignLimit !== 3 && st[W] > 11 && st[CH] > 14) mask = '--D-';
		};

		// SUB bbe1 of the original stirs the generator: one RND per step of FOR I = 1 TO breed + 2.
		for (let i = 1; i <= s.breed + 2; i++) RND();
		race = weighted(s.races);
		restore('D03d9');
		const raceNames = Array.from({ length: 9 }, () => (readNum(), readStr()));
		let raceName = raceNames[race - 1] ?? '';

		const human = () => {
			restore('D1a2b');
			rollAge();
			law = FNR(3);
			good = FNR(3);
			height = 69;
			weight = 160;
			if (breedRoll()) {
				const breed = s.breed >= 1 && s.breed <= 7 ? s.breed : FNR(7);
				race = [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7][breed - 1];
				[
					() => { raceName = 'Mongol'; law = 3; },
					() => { raceName = 'Nubian'; st[CH] = FNR(3) + 2; },
					() => { raceName = 'Norseman'; st[I] = 19 - FNR(2); },
					() => { raceName = 'Human Quarter-Orc'; st[CH] -= FNR(6); },
					() => { raceName = 'Human Quarter-Dwarf'; st[C] += FNR(2); height = 59; },
					() => { raceName = 'Indian'; st[C] = FNR(6) + 3; st[CH] = 13 + FNR(3); },
					() => { raceName = 'Human Quarter-Elf'; st[I] += 2; st[CH] += 3; },
				][breed - 1]();
			}
			classMask();
			if (s.breed > 18 && at(1) === 'F') {
				[[S, 11], [I, 8], [W, 12], [C, 8], [CH, 16]].forEach(([i, min]) => { if (st[i] < min) st[i] = min; });
				law = 1;
				good = 1;
				mask = 'P---';
			} else if (!(RND() > f(0.5))) {
				if (RND() > f(0.5) && law === 1 && st[S] > 14 && st[W] > 14 && st[D] > 14 && st[C] > 10) mask = 'M---';
				if (mask === 'F---' && law === 1 && good === 1 && st[S] > 11 && st[I] > 8 && st[W] > 12 && st[C] > 8 && st[CH] > 16) mask = 'P---';
				if (mask === 'F---' && good === 1 && st[S] > 12 && st[I] > 12 && st[W] > 13 && st[C] > 13) mask = 'R---';
				if (mask === 'F---' && law > 1 && st[S] > 14 && st[C] > 14 && st[D] > 13 && st[W] < 17) mask = 'B---';
				if (mask === '-M--') mask = '-I--';
				druidRule();
				if (mask === '---T') mask = '---A';
			}
			if ([...mask].filter((ch) => ch !== '-').length === 1) return;
			if (s.classFocus > 0 && at(s.classFocus) !== '-') mask = chunk('F----M----C----T', s.classFocus, 4);
			else if (at(1) !== '-') mask = `${at(1)}---`;
			else if (at(2) !== '-') mask = '-M--';
			else mask = RND() < f(0.5) ? '--C-' : '---T';
		};

		const halfElf = () => {
			restore('D23ff');
			rollAge();
			st[CH] = Math.min(18, Math.max(10, st[CH] + FNR(3)));
			st[I] = Math.min(18, Math.max(10, st[I] + FNR(3)));
			law = FNR(3);
			good = FNR(3);
			height = 60;
			weight = 130;
			if (breedRoll()) { race = 2.1; raceName = 'Three-Quarter-Elf'; }
			classMask();
			if (RND() > f(0.3)) rangerRule();
			if (RND() > f(0.3)) druidRule();
			if (RND() > f(0.3) && mask === '---T') mask = '---A';
			const allowed = 'F---R----M----C---D----T---AF-C-R-C--MC-FM--F--T-M-TFMC-FM-T';
			if (!allowed.match(/.{4}/g).includes(mask)) mask = 'F---';
		};

		const elf = () => {
			restore('D280b');
			rollAge();
			st[D] = Math.max(7, st[D] + FNR(3));
			st[C] = Math.max(6, st[C] - FNR(2));
			st[CH] = Math.max(12, st[CH] + FNR(4));
			law = FNR(2) + 1;
			good = FNR(2);
			height = 55;
			weight = 100;
			if (breedRoll()) {
				[
					() => { restore('D2bf6'); rollAge(); race = 3.1; raceName = 'Drow'; st[I] += FNR(4); law = 3; good = 3; },
					() => { restore('D2c65'); rollAge(); race = 3.2; raceName = 'High Elf'; law = 1; },
					() => { race = 3.3; raceName = 'Mountain Elf'; st[C] += 3; },
					() => {
						race = 3.4;
						raceName = 'White Elf';
						st[I] = 25;
						st[W] = 25;
						law = 1;
						good = 1;
						if (10 ** 6 < xp) {
							name += ' the Elder';
							ageCat = 5;
							age = FNR(5000) + 2000;
						}
					},
					() => { race = 3.5; raceName = 'Sylvan Elf'; st[D] += 2; law = 3; },
					() => { restore('D2dc5'); rollAge(); race = 3.4; raceName = 'Gray Elf'; },
				][breedIndex(6) - 1]();
			}
			if (st[I] > 18 && race !== 3.4) st[I] = 18;
			if (st[D] > 19) st[D] = 19;
			if (st[C] > 18) st[C] = 18;
			if (st[CH] > 18) st[CH] = 18;
			classMask();
			if (RND() < f(0.3) && mask === '---T') mask = '---A';
			put(3, '-');
			if (oneOf('F---', '-M--', '---T', '---A', '--C-')) return;
			if (at(4) === 'A') put(4, 'T');
		};

		const dwarf = () => {
			restore('D2df5');
			rollAge();
			st[C] = Math.min(19, Math.max(12, st[C] + FNR(5)));
			st[CH] = Math.max(3, st[CH] - FNR(3));
			law = 2;
			good = 2;
			if (RND() < f(0.2)) { law = FNR(3); good = FNR(3); }
			if (s.alignLimit === 1) good = 1;
			height = 48;
			weight = 150;
			if (breedRoll()) {
				[
					() => { race = 4.1; raceName = 'Duergar (Gray Dwarf)'; law = FNR(3); good = 3; },
					() => { restore('D318b'); rollAge(); race = 4.2; raceName = 'Mountain Dwarf'; st[C] = 17 + FNR(3); },
					() => { race = 4.3; raceName = 'Black Dwarf'; st[I] = 16 + FNR(3); },
				][breedIndex(3) - 1]();
			}
			classMask();
			put(2, '-');
			if (at(3) !== '-') mask = '--C-';
			if (RND() < f(0.3) && at(4) === 'T') put(4, 'A');
			if (mask === 'F--A') mask = 'F--T';
		};

		const gnome = () => {
			restore('D3227');
			rollAge();
			st[W] = Math.min(18, st[W] + FNR(4));
			law = FNR(3);
			good = FNR(2);
			height = 42;
			weight = 80;
			if (breedRoll()) {
				[
					() => { race = 5.1; raceName = 'Svirfneblin (Deep Gnome)'; },
					() => { race = 5.2; raceName = 'Coast Gnome'; st[CH] += 2 + FNR(2); },
					() => { race = 5.3; raceName = 'High Gnome'; st[I] += 4 + FNR(4); law = 1; },
					() => { race = 5.4; raceName = 'Gnomish Quarterling'; },
				][breedIndex(4) - 1]();
			}
			classMask();
			if (at(2) === 'M') put(2, 'I');
			if (at(3) === 'C') {
				mask = '--C-';
				return;
			}
			const replacement = chunk('FI--F--T-I-T', FNR(3), 4);
			if (oneOf('FI-A', 'FI-T', 'F--A', '-I-A')) mask = replacement;
		};

		const halfling = () => {
			restore('D359d');
			rollAge();
			st[S] = Math.max(6, st[S] - FNR(2));
			st[D] = Math.min(19, st[D] + FNR(5));
			height = 36;
			weight = 60;
			law = FNR(2);
			good = FNR(2);
			if (breedRoll()) {
				[
					() => { race = 6.1; raceName = 'Hairfoot Halfling'; },
					() => { race = 6.2; raceName = 'Stout Halfling'; weight = 65; },
					() => { race = 6.3; raceName = 'Tallfellow Halfling'; height = 48; weight = 70; },
				][breedIndex(3) - 1]();
			}
			classMask();
			put(2, '-');
			if (at(3) === 'C' && st[W] > 11 && st[CH] > 14) mask = '--D-';
			else put(3, '-');
		};

		const monster = () => {
			[
				() => {
					restore('D3ccf');
					raceName = 'Centaur';
					race = 7.1;
					height = 72;
					weight = 300;
					law = FNR(2) + 1;
					good = FNR(2);
					rollAge();
					st[S] = Math.max(10, st[S] + FNR(5));
					classMask();
					mask = RND() < f(0.2) ? 'R---' : 'F---';
					if (FNR(100) < s.breeds) {
						restore('D3da6');
						raceName = `${data.readN(FNR(6), readStr)} ${raceName}`;
					}
				},
				() => {
					restore('D3e91');
					raceName = 'Tabaxi';
					race = 7.2;
					height = 69;
					weight = 150;
					law = 3;
					good = FNR(3);
					rollAge();
					st[D] = Math.max(10, st[D] + FNR(5));
					classMask();
					if (RND() < f(0.3)) return;
					rangerRule();
					druidRule();
					if (at(4) === 'T') {
						put(4, 'A');
						if (s.names) name = `Agent ${name}`;
					}
				},
				() => {
					restore('D4109');
					raceName = 'Brownie';
					race = 7.3;
					height = 20;
					weight = 35;
					rollAge();
					law = 1;
					good = 1;
					st[D] = 18;
					classMask();
					mask = 'FM-T';
					if (RND() < f(0.2)) {
						mask = '--CT';
						if (RND() < f(0.2)) { mask = '-MCA'; good = 3; }
					}
				},
				() => {
					restore('D3b4e');
					raceName = 'Kenku';
					race = 7.4;
					height = 60;
					weight = 100;
					law = 2;
					good = 2;
					rollAge();
					classMask();
					mask = 'F---';
					if (st[I] > 13) {
						mask = 'FM--';
						if (st[I] > st[S]) mask = '-M--';
					}
					if (FNR(100) < s.breeds) raceName = chunk('Black White Supra Juste ', FNR(4), 6) + raceName;
					if (raceName === 'Juste Kenku') mask = '--C-';
				},
				() => {
					restore('D393d');
					raceName = 'Half-Goblin';
					race = 7.5;
					height = 45;
					weight = 100;
					law = 3;
					good = 2;
					rollAge();
					st[I] = FNR(6) + 3;
					st[CH] = FNR(4) + 3;
					if (FNR(100) < s.breeds) {
						const variant = FNR(4);
						raceName = ['Semi-Goblin', 'Goblin Half-Elf', 'Pseudo-Goblin', 'Mutant Half-Goblin'][variant - 1];
						if (variant === 4) {
							st[S] += FNR(6);
							st[I] = 3;
							st[W] = 3;
							st[CH] = 3;
						}
					}
					classMask();
					put(2, '-');
					if (mask === '----') mask = 'F---';
				},
			][breedIndex(5) - 1]();
		};

		const halfOrc = () => {
			restore('D41c3');
			rollAge();
			st[CH] = Math.max(3, st[CH] - FNR(3) - 3);
			st[C] = Math.min(19, Math.max(12, st[C] + FNR(2) + 2));
			st[S] = Math.min(18, Math.max(13, st[S] + FNR(2) + 2));
			law = FNR(2) + 1;
			good = FNR(2) + 1;
			height = 60;
			weight = 145;
			classMask();
			put(2, '-');
			if (RND() < f(0.6) && at(4) === 'T') put(4, 'A');
			if (mask === 'F-CT') mask = chunk('F-C-F--T--CT', FNR(3), 4);
			if (mask === 'F-CA') mask = chunk('F--A--CA', FNR(2), 4);
		};

		const giant = () => {
			[
				() => {
					restore('D4542');
					raceName = 'Quarter-Ogre';
					race = 9.1;
					rollAge();
					st[S] = 16 + FNR(3);
					st[I] = Math.max(3, st[I] - FNR(2));
					height = 75;
					weight = 200;
					law = FNR(3);
					good = FNR(3);
					classMask();
					mask = RND() < f(0.2) ? 'F--T' : 'F---';
				},
				() => {
					restore('D4681');
					raceName = 'Half-Ogre';
					race = 9.2;
					rollAge();
					st[S] = 18 + FNR(3);
					st[I] = Math.max(3, st[I] - FNR(2) - 1);
					height = 90;
					weight = 275;
					law = FNR(2) + 1;
					good = FNR(3);
					classMask();
					mask = 'F---';
				},
				() => {
					restore('D479a');
					raceName = 'Half-Hill-Giant';
					race = 9.3;
					rollAge();
					st[S] = 19 + FNR(3);
					st[I] = Math.max(3, st[I] - FNR(2) - 2);
					law = FNR(2) + 1;
					good = FNR(2) + 1;
					height = 120;
					weight = 325;
					classMask();
					mask = 'F---';
				},
				() => {
					restore('D48b8');
					raceName = 'Half-Mountain-Giant';
					race = 9.4;
					rollAge();
					st[S] = 21 + FNR(4);
					law = 3;
					good = 2;
					height = 150;
					weight = 550;
					classMask();
					mask = 'F---';
				},
			][breedIndex(4) - 1]();
		};

		({ 2: halfElf, 3: elf, 4: dwarf, 5: gnome, 6: halfling, 7: monster, 8: halfOrc, 9: giant }[race] || human)();
		const raceGroup = Math.floor(race);

		if (s.alignLimit === 1) good = 1;
		if (s.alignLimit === 3) good = 3;
		if (s.alignLimit === 4 && good === 3) good = FNR(2);

		let classCount = [...mask].filter((ch) => ch !== '-').length;
		if (classCount === 4) put(FNR(4), '-');
		if (mask === '----') {
			mask = 'F---';
			classCount = 1;
		}
		if (mask === 'F---' && st[S] < 9) st[S] = 9;

		// ------------------------------------------------------------ Traits

		let traitCount = 0;
		let lines = state.lines;
		if (s.traits && H.TRAITS) {
			if (state.pool.length * 0.75 < state.used) {
				state.pool = loadTraits(RND);
				state.used = 0;
			}
			const pool = state.pool;
			const pick = (i) => pool[i] || { text: '', mods: NO_MODS };
			lines = [];
			traitCount = FNR(3) + 1;
			for (let t = 0; t < traitCount; t++) {
				let index;
				let text;
				for (;;) {
					text = 'USED';
					index = FNR(pool.length) - 1;
					while (text === 'USED') {
						index = (index + 1) % Math.max(1, pool.length);
						text = pick(index).text;
						if (text[0] === '^') text = race === 7.4 ? 'USED' : text.slice(1);
					}
					if (text[0] !== '*') break;
					if (RND() < f(0.03)) {
						text = text.slice(1);
						break;
					}
				}
				if (text[0] === '+') text = RND() < f(0.4) ? `Great ${text[1].toLowerCase()}${text.slice(2)}` : text.slice(1);
				lines[t] = text;
				pick(index).mods.forEach((m, i) => { st[i] += m; });
				if (pool[index]) pool[index].text = 'USED';
				state.used++;
			}
			clampStats();
		}

		// ------------------------------------------------------------ Physique, gender and titles

		height = Math.floor(((95 + FNR(10)) * height) / 100);
		weight = Math.floor(((95 + FNR(10)) * weight) / 100);
		for (let i = 0; i < 4; i++) {
			if (lines[i] === 'Underweight') weight = Math.floor(((60 + FNR(15)) * weight) / 100);
			if (lines[i] === 'Overweight') weight = Math.floor(((125 + FNR(15)) * weight) / 100);
			if (lines[i] === 'Tall') height = Math.floor(((125 + FNR(15)) * height) / 100);
			if (lines[i] === 'Short') height = Math.floor(((60 + FNR(15)) * height) / 100);
		}
		const feet = Math.floor(height / 12);
		const physique = `${digits(feet)}'${digits(Math.floor(height - feet * 12 + 0.5))}",${str$(weight)} lbs`;

		let hand = RND() < f(0.2) ? 'Left-Handed' : 'Right-Handed';
		if (st[D] * 3 - 45 > FNR(100)) hand = 'Ambidextrous';

		let female = false;
		if (FNR(100) <= s.female) {
			female = true;
			height = Math.floor(height * f(0.8));
			weight = Math.floor(weight * f(0.8));
			st[S] = st[S] - FNR(2) - 1;
			st[CH] = st[CH] + FNR(2) + 1;
		}
		if (race === 7.3 && s.names) name = (female ? 'Ms. ' : 'Mr. ') + name;
		if (mask === 'P---' && s.names) name = (female ? 'Dame ' : 'Sir ') + name;
		if (social === 1) socialName = female ? 'Lady' : 'Lord';
		for (let i = 0; i < 4; i++) {
			if (!female && lines[i] === 'Beautiful (K+3)') lines[i] = 'Handsome (K+3)';
			if (female && lines[i] === 'Impotent') lines[i] = 'Frigid';
			if (!female && lines[i] === 'Nymphomaniac') lines[i] = 'Satyr';
		}
		if (female && raceName === 'Norseman') raceName = 'Norsewoman';

		// ------------------------------------------------------------ Classes, levels and hit points

		let classLabel = '';
		let levelLabel = '';
		let hp = 0;
		let conBonus = 0;
		let excStr = 0;
		let excText = '';
		let antiPaladin = false;
		const levels = [0, 0, 0, 0];

		const exceptional = () => {
			if (st[S] !== 18) return;
			excStr = FNR(100);
			excText = `(${digits(excStr)})`;
			if (excStr === 100) excText = '(00)';
			if (excStr < 10) excText = `(0${excText.slice(1)}`;
		};
		const raceLimit = (label) => {
			restore(label);
			let cap = 0;
			for (let i = 1; i <= 9; i++) {
				const v = readNum();
				if (raceGroup === i) cap = v;
			}
			return cap;
		};

		for (let p = 1; p <= 4; p++) {
			const letter = at(p);
			if (letter === '-') continue;
			if (classLabel !== '') classLabel += '/';
			let cls;
			if (mask === 'M---') {
				restore('D5c15');
				cls = { cap: 99, die: 4, min: 5, dice: 17, after: 0 };
				classLabel = 'Monk';
			} else {
				switch (CLASS_LETTERS.indexOf(letter) + 1) {
					case 1:
						exceptional();
						cls = { cap: raceLimit('D5822'), die: 10, min: 6, dice: 9, after: 3 };
						classLabel += 'Fighter';
						break;
					case 2:
						exceptional();
						restore('D58ce');
						cls = { cap: 99, die: 12, min: 7, dice: 8, after: 4 };
						law = FNR(2) + 1;
						classLabel = 'Barbarian';
						break;
					case 3:
						exceptional();
						restore('D5991');
						cls = { cap: 99, die: 10, min: 6, dice: 9, after: 3 };
						classLabel = 'Paladin';
						law = 1;
						good = 1;
						if (RND() < f(0.5) && s.alignLimit !== 1 && s.alignLimit !== 4) antiPaladin = true;
						if (s.alignLimit === 3 || s.breed === 19) antiPaladin = true;
						if (antiPaladin) {
							law = 3;
							good = 3;
							classLabel = 'Anti-Paladin';
						}
						break;
					case 4:
						exceptional();
						restore('D5ab1');
						cls = { cap: raceGroup === 2 ? 8 : 99, die: 8, min: 9, dice: 11, after: 2 };
						classLabel += 'Ranger';
						break;
					case 5:
						cls = { cap: raceLimit('D5c82'), die: 4, min: 3, dice: 11, after: 1 };
						classLabel += 'Magic-User';
						break;
					case 6:
						cls = { cap: raceLimit('D5d3a'), die: 4, min: 3, dice: 10, after: 1 };
						classLabel += 'Illusionist';
						break;
					case 7:
						cls = { cap: raceLimit('D5df2'), die: 8, min: 5, dice: 9, after: 2 };
						classLabel += 'Cleric';
						break;
					case 8:
						cls = { cap: raceLimit('D5eaa'), die: 8, min: 5, dice: 14, after: 0 };
						law = 2;
						good = 2;
						classLabel += 'Druid';
						break;
					case 9:
						restore('D5f9b');
						cls = { cap: raceGroup === 8 ? 8 : 99, die: 6, min: 4, dice: 10, after: 2 };
						law = FNR(2) + 1;
						classLabel += 'Thief';
						break;
					case 10:
						cls = { cap: raceLimit('D602c'), die: 6, min: 4, dice: 15, after: 0 };
						law = FNR(2) + 1;
						classLabel += 'Assassin';
						break;
					default:
						throw new Error(`Unknown class letter ${letter}`);
				}
			}

			let xpEach = classCount > 1 ? Math.floor(xp / classCount) : xp;
			if (xpEach === 0) xpEach = 1;
			let threshold = 0;
			while (threshold * 1000 < xpEach) {
				threshold = readNum();
				levels[p - 1]++;
				if (!s.noLevelLimits && levels[p - 1] >= cls.cap) threshold = 6000;
			}
			if (levelLabel !== '') levelLabel += '/';
			levelLabel += digits(levels[p - 1]);
			if (levels[p - 1] > 8 && mask === 'M---' && s.names) name = (female ? 'Mistress ' : 'Master ') + name;

			restore('D6347');
			for (let i = 3; i <= st[C]; i++) conBonus = readNum();
			if (conBonus > 2 && at(1) === '-') conBonus = 2;
			const dice = Math.min(levels[p - 1], cls.dice);
			for (let k = 1; k <= dice; k++) {
				let r = FNR(cls.die);
				if (k === 1 && r < cls.min) r = cls.min;
				if (k === 1 && letter === 'R') r = r + FNR(cls.die) + conBonus;
				if (k === 1 && mask === 'M---') r = r + FNR(cls.die) + conBonus;
				r = Math.floor(r / classCount + 0.5);
				if (r < 1) r = 1;
				hp += r + conBonus;
			}
			if (levels[p - 1] > cls.dice) hp += (levels[p - 1] - cls.dice) * cls.after;
		}
		const [lv1, lv2, lv3, lv4] = levels;

		// ------------------------------------------------------------ Alignment

		let tendency = '';
		if (!(mask === 'M---' || at(1) === 'P' || at(3) === 'D' || RND() < f(0.8))) {
			const lawTendency = RND() < f(0.5) && law === 2 ? 'LC'[FNR(2) - 1] : 'N';
			let goodTendency = '';
			if (RND() < f(0.3)) goodTendency = good === 2 ? 'GE'[FNR(2) - 1] : 'N';
			tendency = ` (${lawTendency}${goodTendency})`;
			if (tendency === ' (NN)') tendency = ' (N)';
		}
		let alignment = ['Lawful ', 'Neutral ', 'Chaotic '][law - 1] + ['Good', 'Neutral', 'Evil'][good - 1];
		if (alignment === 'Neutral Neutral') alignment = 'True Neutral';
		alignment += tendency;
		clampStats();

		// ------------------------------------------------------------ Ability tables

		const tableRow = (label, score, width) => {
			restore(label);
			let row = [];
			for (let i = 3; i <= score; i++) row = Array.from({ length: width }, data.read);
			return row;
		};
		let [toHit, damage, weightAllow, doors, bendBars] = tableRow('D69d7', st[S], 5);
		if (excStr > 0) {
			restore('D6a6c');
			let limit = 0;
			while (excStr > limit) [limit, toHit, damage, weightAllow, doors, bendBars] = Array.from({ length: 6 }, data.read);
		}
		let [languages, knowSpell, minSpells, maxSpells] = tableRow('D6ade', st[I], 4);
		if (at(2) === '-') [knowSpell, minSpells, maxSpells] = [0, 0, 0];
		let [magicAdj, spellBonus, spellFailure] = tableRow('D6b8b', st[W], 3);
		if (at(3) !== 'C') [spellBonus, spellFailure] = ['', 0];
		let [reaction, defense] = tableRow('D6c24', st[D], 2);
		const [systemShock, resurrection, poisonBase] = tableRow('D6c8a', st[C], 3);
		let poisonBonus = poisonBase;
		const [maxHenchmen, loyalty, chaReaction] = tableRow('D6cf2', st[CH], 3);

		// ------------------------------------------------------------ Henchmen

		const henchmen = [];
		let topLevel = Math.min(20, Math.max(1, ...levels));
		let henchmenTotal = 0;
		const henchmanClass = () => {
			let letter = '-';
			while (letter === '-') letter = at(FNR(4));
			let i = CLASS_LETTERS.indexOf(letter) + 1;
			if (RND() < f(0.2)) i = FNR(10);
			if (mask === 'M---') i = FNR(8);
			if (i > 8 && law === 1) i = FNR(8);
			let label = chunk(HENCHMAN_CLASSES, i, 5).trim();
			if (mask !== 'P---' && label === 'Paldn') label = 'Ftr';
			if (classLabel === 'Anti-Paladin' && label === 'Paldn') label = 'AntPal';
			return label;
		};
		const cha5 = st[CH] * 5;
		for (let lvl = topLevel - 1; lvl >= 0; lvl--) {
			let added = 0;
			const ratio = f((7.5 ** 1.5 - social ** 1.5) / 7.5 ** 1.5);
			const growth = f(((topLevel - lvl) / (topLevel + f(0.1))) ** 2);
			const chance = f(cha5 * ratio * growth + (8 - social));
			if (FNR(100) <= chance) {
				let count = Math.floor((chance ** f(1.2) + 5) / 20);
				if (count !== 0) {
					if (henchmenTotal + count > maxHenchmen) count = maxHenchmen - henchmenTotal;
					let label = henchmanClass();
					RND();
					added = 1;
					henchmenTotal += count;
					if (lvl > 1) lvl = lvl - FNR(2) + 1;
					if (lvl === 0) label = count === 1 ? 'Man@Arms' : 'Men@Arm';
					if (count > 1) {
						label += 's';
						if (label === 'Thiefs') label = 'Thvs';
					}
					henchmen.push(`${digits(count)} ${label} Lv${digits(lvl)}`);
				}
			}
			if (henchmenTotal >= maxHenchmen || henchmen.length >= 9) break;
			if (RND() < f(0.7) && added === 1) lvl--;
			if (RND() < f(0.3)) lvl--;
		}

		// ------------------------------------------------------------ Armor

		let armor = '';
		let shield = '';
		let ac = 10;
		let wealth = Math.floor(((8 - social + FNR(10)) * topLevel) / 13);
		if (wealth < 1) wealth = 1;
		let magic = Math.floor(wealth * f(0.4));
		let ring = 0;
		if (wealth > 11) wealth = 11;

		const readArmor = (label, n) => {
			restore(label);
			for (let i = 0; i < n; i++) {
				ac = readNum();
				armor = readStr();
			}
		};
		if (mask === 'M---') {
			magic = 0;
			restore('D79c5');
			for (let i = 0; i < lv1; i++) ac = readNum();
		} else if (raceGroup === 9) {
			magic = 0;
			readArmor('D7a16', Math.floor((5 * wealth) / 12 + 1));
		} else {
			if (raceGroup === 4) magic = 0;
			if (mask === 'B---' && lv1 < 5) magic = 0;
			if (at(2) !== '-') {
				ac = Math.max(1, 12 - Math.floor(wealth * f(0.8)));
				if (ac > 9) {
					ac = 10;
					armor = '';
					magic = 0;
				} else {
					armor = `Bracers-${chunk(ROMAN, ac, 4).trim()}`;
					ring = Math.floor(magic / 2);
					magic = 0;
					if (ring > 0) shield = `+${digits(ring)} Ring of Protection`;
				}
			} else if (at(4) !== '-' || at(3) === 'D') {
				const excess = Math.max(0, wealth - 14);
				magic += excess;
				wealth -= excess;
				if (raceGroup === 4 || raceGroup === 9) magic = 0;
				readArmor('D778e', FNR(3));
				if (wealth + FNR(3) > 10) shield = 'Small Wooden Shield';
			} else {
				let extra = 0;
				if (at(1) !== '-') {
					extra = FNR(10 - social);
					if (wealth + extra > 11) extra = 11 - wealth;
				}
				readArmor('D778e', wealth + extra);
				if (!(FNR(8) > wealth)) {
					restore('D781f');
					for (let i = 0; i < Math.floor((7 * wealth) / 12 + 1); i++) {
						state.shieldBonus = readNum();
						shield = readStr();
					}
				}
			}
		}
		if (magic > 0) armor = `+${digits(magic)} ${armor}`;
		ac = ac - magic - ring;
		if (mask === 'M---') defense = 0;
		ac += defense;
		if (ac > 10) ac = 10;

		// ------------------------------------------------------------ Weapon

		let weapon = '';
		let weaponMagic = Math.floor((7 - social) / (1 + FNR(2)) + topLevel / (3 + FNR(2)));
		if (weaponMagic < 0) weaponMagic = 0;
		if (raceGroup === 4) weaponMagic = 0;
		if (mask === 'B---' && lv1 < 4) weaponMagic = 0;
		if (height < 60) state.shieldBonus = 1;

		const weaponList = () => {
			if (race === 7.1) return 'D8151';
			if (raceGroup === 9) return 'D8143';
			if (mask === 'M---') return 'D80d6';
			const elfFighter = at(1) !== '-' && raceGroup === 3;
			if (RND() < f(0.3) && elfFighter) return 'D80a2';
			const fighterList = () => {
				if (RND() < f(0.3)) return 'D8094';
				if (state.shieldBonus === 1) return ['D80af', 'D80bc'][FNR(2) - 1];
				if (state.shieldBonus === 0) return ['D80a2', 'D80af', 'D80bc', 'D80c9'][FNR(4) - 1];
				return 'D8094';
			};
			if (at(1) !== '-') return fighterList();
			if (at(4) === 'T') return 'D8136';
			if (at(4) === 'A') return fighterList();
			if (at(3) === 'C') return RND() < f(0.3) ? 'D80af' : 'D80e0';
			if (at(3) === 'D') return 'D811c';
			if (at(2) !== '-') return 'D8129';
			return null;
		};
		if (race === 7.3) weapon = 'Brownie Sword';
		else if (race === 7.4) weapon = at(1) === 'F' ? 'Samurai Sword' : 'Quarterstaff';
		else {
			const list = weaponList();
			if (list) {
				const { count, pick } = roll(data, list, readStr);
				weapon = pick(FNR(count));
			}
		}
		if (weapon[0] === '0') {
			weapon = weapon.slice(1);
			weaponMagic = 0;
		}
		if (weapon[0] === '#') {
			weapon = weapon.slice(1);
			const shots = Math.max(2, FNR(20) - (8 - social) + topLevel);
			weapon = `${weapon} (${digits(shots)})`;
		}
		if (weaponMagic > 0) weapon = `+${digits(weaponMagic)} ${weapon}`;

		// ------------------------------------------------------------ Thief tools and religious item

		const quality = (label, t, spread, fallback) => {
			const { count, pick } = roll(data, label, readStr);
			let index = Math.floor(t * count) + FNR(spread);
			if (index > count) index = count - 2 + FNR(fallback);
			return pick(index);
		};

		let tool = '';
		if (at(4) !== '-') {
			const t = Math.min(1, f(((12 - social) * lv4) / 100));
			const { count, pick } = roll(data, 'D83a7', readStr);
			let index = Math.floor(t * count) + FNR(2);
			if (index > count) index = count - 2 + FNR(2);
			tool = pick(index);
			if (!(RND() < f(0.3))) {
				let skipped = '';
				while (skipped !== 'END') skipped = readStr();
				const qCount = readNum();
				let qIndex = Math.floor(t * qCount) + FNR(3);
				if (qIndex > qCount) qIndex = qCount - 2 + FNR(2);
				tool = `${data.readN(qIndex, readStr)} ${tool}`;
			}
		}
		if (tool.endsWith('*')) tool = `Small ${tool.slice(0, -1)}`;

		let relic = '';
		if (at(3) === 'C') {
			const t = Math.min(1, f(((12 - social) * lv3) / 100));
			const { count, pick } = roll(data, 'D8657', readStr);
			let index = Math.floor(t * count) + FNR(4) - 1;
			if (index > count) index = count - 12 + FNR(12);
			relic = pick(index);
			const splice = (i, size, text) => relic.slice(0, i - 1) + text + relic.slice(i - 1 + size);
			let i = 0;
			while (relic.length > i) {
				i++;
				if (relic[i - 1] === '*') {
					let blessing = '';
					state.blessed = 0;
					if (RND() < f(0.6) && good === 1) { blessing = 'Holy '; state.blessed = 1; }
					if (RND() < f(0.3) && good === 1) { blessing = 'Blessed '; state.blessed = 1; }
					if (RND() < f(0.85) && good === 3) { blessing = chunk('Cursed Unholy ', FNR(2), 7); state.blessed = 1; }
					relic = splice(i, 1, blessing);
					i = 1;
				}
				if (relic.substr(i - 1, 2) === 'CC') {
					const { count: n, pick: color } = roll(data, 'D0430', readStr);
					relic = splice(i, 2, color(FNR(n)));
					i = 1;
				}
				if (relic.substr(i - 1, 2) === 'MM') {
					let label = 'D0431';
					if (RND() < f(0.4)) label = 'D0433';
					if (RND() < f(0.3)) label = 'D0432';
					if (relic.endsWith('Bell')) label = 'D0431';
					const { count: n, pick: material } = roll(data, label, readStr);
					let m = Math.floor(((FNR(40) + 60) * n * t) / 100 + 1);
					if (m > n) m = 1 - FNR(3) + n;
					relic = splice(i, 2, material(m));
					i = 1;
				}
			}
			if (!(RND() < f(0.7) || state.blessed === 1)) relic = `${quality('D0434', t, 3, 2)} ${relic}`;
		}

		// ------------------------------------------------------------ Thieving, saves and THAC0

		let thief = [0, 0, 0, 0, 0, 0, 0, 0];
		if (at(4) !== '-' || mask === 'M---') {
			restore('D8e26');
			const lvl = Math.min(17, mask === 'M---' ? lv1 : lv4);
			for (let i = 0; i < lvl; i++) thief = Array.from({ length: 8 }, readNum);
			if (st[D] > 18) {
				thief[0] += st[D] * 5 - 80;
				thief[1] += st[D] * 5 - 75;
				thief[2] += st[D] * 5 - 85;
				const stealth = Number('12151820232530'.substr(st[D] * 2 - 38, 2));
				thief[3] += stealth;
				thief[4] += stealth;
			}
			if (mask === 'M---') {
				thief[0] = 0;
				thief[7] = 0;
			}
		}

		const saves = [99, 99, 99, 99, 99];
		const saveRows = (label, rows) => {
			restore(label);
			let row = [];
			for (let i = 0; i < rows; i++) row = Array.from({ length: 5 }, readNum);
			row.forEach((v, i) => { if (v < saves[i]) saves[i] = v; });
		};
		if (at(3) !== '-' || race === 7.3) {
			let rows = Math.min(7, Math.floor((lv3 + 2) / 3));
			if (race === 7.3 && rows < 3) rows = 3;
			saveRows('D9104', rows);
		}
		if (at(1) !== '-' && mask !== 'M---') saveRows('D9195', Math.min(10, Math.floor((lv1 + 1) / 2)));
		if (at(2) !== '-') saveRows('D9207', Math.min(5, Math.floor((lv2 + 4) / 5)));
		if (at(4) !== '-' || mask === 'M---') {
			const lvl = mask === 'M---' ? lv1 : lv4;
			saveRows('D92ec', Math.min(6, Math.floor((lvl + 3) / 4)));
		}

		let thac0 = 99;
		const thac0From = (table, index) => { thac0 = Math.min(thac0, Number(chunk(table, index, 2))); };
		if (at(2) !== '-') thac0From('2019161311', Math.min(5, Math.floor((lv2 + 4) / 5)));
		if (at(4) !== '-') thac0From('201916141210', Math.min(6, Math.floor((lv4 + 3) / 4)));
		if (at(3) !== '-') thac0From('20181614121009', Math.min(7, Math.floor((lv3 + 2) / 3)));
		if (at(1) !== '-') thac0From('201816141210080604', Math.min(9, Math.floor((lv1 + 1) / 2)));

		// ------------------------------------------------------------ Racial and class abilities

		let combatNote = '';
		let attacks = '';
		let infravision = 0;
		let saveNote = '';
		let saveNote2 = '';
		let line = traitCount;
		const add = (text) => { lines[line++] = text; };

		if (race === 1.6) {
			if (FNR(100) <= s.breeds) raceName = chunk('East Red ', FNR(2), 5) + raceName;
		} else if (race === 2 || race === 2.1) {
			saveNote = '30% resistance to sleep & charm spells';
			infravision = 60;
			add('Likely to notice secret & concealed doors');
			thief[0] += 10;
			thief[4] += 5;
		} else if (raceGroup === 3) {
			saveNote = '90% resistance to sleep & charm spells';
			infravision = 60;
			add('Likely to notice secret & concealed doors');
			combatNote = '+1 to hit with bow, short sword or long sword';
			add('Can move silently to surprise opponents');
			[5, -5, 0, 5, 10, 5, 0, 0].forEach((v, i) => { thief[i] += v; });
		} else if (raceGroup === 4) {
			saveNote = 'Save vs. Poison as vs. Rod, Staff or Wand';
			infravision = 60;
			combatNote = '+1 to hit orc/halforc/goblin/hobgoblin ; -4 to be hit by giant-sized';
			add('Can detect slopes, tunnels, sliding walls, stone traps & depth underground');
			[0, 10, 15, 0, 0, 0, -10, -5].forEach((v, i) => { thief[i] += v; });
			if (thief[7] < 0) thief[7] = 0;
		} else if (raceGroup === 5) {
			infravision = 60;
			add('Can detect slopes, unsafe walls, depth underground & direction of travel');
			combatNote = '+1 to hit orc/halforc/goblin/hobgoblin ; -4 to be hit by giant-sized';
			[0, 5, 10, 5, 5, 10, -15, 0].forEach((v, i) => { thief[i] += v; });
		} else if (raceGroup === 6) {
			poisonBonus += Math.floor(st[C] / 3.5 + 0.5);
			infravision = race === 6.2 ? 60 : 30;
			add('Can move silently to surprise opponents');
			[5, 5, 5, 10, 15, 5, -15, -5].forEach((v, i) => { thief[i] += v; });
			if (thief[7] < 0) thief[7] = 0;
		} else if (race === 7.2) {
			add('Can avoid detection by disguising scent with herbs');
			add('Can avoid traps 90% of the time');
		} else if (race === 7.3) {
			add('Exceptional senses; never surprised');
			add('Can make or repair items of wood, leather, or metal');
			add(`Spells abilities (once per day as Lv${digits(lv2 || 1)} MgUsr):`);
			add('   Prot. from Evil, Ventriloquism, Dancing Lights, Continual Light,');
			add('   Mirror Image (3 images), Confusion, Dimension Door');
		} else if (race === 7.4) {
			add('Communicates telepathically with other kenku');
			add('Can pass as human 50%; can shape-change for up to one week once every month');
			thief = [45, 37, 35, 33, 25, 15, 88, 20];
			let total = levels.reduce((sum, l) => sum + l, 0);
			if (mask === '-C--') total = 0;
			if (lv2 > 4) total = 5;
			const as = `Lv${digits(total)}`;
			const innate = (spell) => `Innate spell ability: ${spell} (as ${as} MgUsr)`;
			if (total > 2) add(innate(RND() < f(0.2) ? 'Lv1 MgUsr Spell _______________' : 'Magic Missile'));
			if (total > 3) {
				add(innate(RND() < f(0.2) ? 'Lv1 MgUsr Spell _______________' : 'Shocking Grasp'));
				add('Can become invisible with no limit to frequency or duration');
			}
			if (total > 4) {
				let spell = RND() < f(0.5) ? 'Web' : 'Mirror Image';
				if (RND() < f(0.2)) spell = 'Lv2 MgUsr Spell _______________';
				add(innate(spell));
				add(innate('Call Lightning'));
			}
			for (let t = 0; t < 4; t++) {
				if ((lines[t] || '').startsWith('Wings')) lines[line - 1] = `${chunk('RightLeft', FNR(2), 5)} wing once broken -- cannot fly`;
				const length = (lines[t] || '').length;
				for (let k = 0; k < length; k++) {
					const part = () => (lines[t] || '').substr(k, 4);
					const overwrite = (text) => { lines[t] = lines[t].slice(0, k) + text + lines[t].slice(k + 4); };
					if (part() === 'nose') overwrite('beak');
					if (part() === 'Nose') overwrite('Beak');
					if (part() === 'lips') lines[t] = `Multi-colored beak -- ${chunk('stripesspots', FNR(2), 7)}`;
					if (part() === 'hair') lines[t] = 'Thinning feathers';
					if (part() === 'Hair') lines[t] = 'Thick, fluffy feathers';
				}
			}
		} else if (race === 7.5) {
			infravision = 50;
		} else if (race === 8) {
			infravision = 60;
			[-5, 5, 5, 0, 0, 5, 5, -10].forEach((v, i) => { thief[i] += v; });
			if (thief[7] < 0) thief[7] = 0;
		}

		const fighterAttacks = (thrice, twice) => {
			if (lv1 > thrice) attacks = 'Attacks thrice per two rounds';
			if (lv1 > twice) attacks = 'Attacks twice per round';
		};
		if (at(1) === 'F') fighterAttacks(6, 12);
		if (at(1) === 'P') {
			fighterAttacks(6, 12);
			if (lv1 > 18) attacks = 'Attacks five times per two rounds';
			let times = Math.floor(lv1 / 5);
			let timesText = '';
			if (times > 0) {
				if (times > 7) times = 7;
				timesText = `${digits(times)} time${times > 1 ? 's' : ''}`;
			}
			if (good === 1) {
				add("Can detect evil to 60' ; emanates protection from evil in 10-foot radius");
				add(`Can \`lay on hands' to heal${str$(lv1 * 2)}hp once per day`);
				if (timesText) add(`Immune to all diseases ; can cure diease ${timesText} per week`);
				if (lv1 > 2) add('Can turn undead');
				if (FNR(20) < lv1) weapon = '+5 Holy Avenger';
			}
			if (good === 3) {
				add('Can use poisons ; can backstab as thief for +4 to hit & double damage');
				add("Can detect good to 60' ; emanates protection from good in 10-foot radius");
				add(`Can \`lay on hands' to inflict${str$(lv1 * 2)}hp damage once per day`);
				if (timesText) add(`Immune to all diseases ; can cause diease ${timesText} per week`);
				if (lv1 > 2) add('Can neutralize or enlist undead');
				if (FNR(20) < lv1) weapon = '+5 Unholy Avenger';
			}
			saves.forEach((v, i) => { saves[i] = v - 2; });
		}
		if (at(1) === 'R') {
			combatNote = `+${digits(lv1)} damage vs. giant-sized opponents`;
			add('Surpises opponents 1 in 2 times; is surprised 1 in 3 times');
			add('Can track quarry outdoors or underground');
			fighterAttacks(7, 14);
		}
		if (at(1) === 'B') {
			fighterAttacks(5, 10);
			if (lv1 > 3) {
				add(`Can strike creatures affected only by +${digits(Math.floor((lv1 - 2) / 2))} weapon`);
				saves[4] -= Math.floor(lv1 / 4);
			}
			add('Can climb cliffs & trees ; can hide in natural surroundings');
			add('Surprises enemy on 3 in 6 ; is surprised 10% (familiar terrain: 4 in 6 / 5%)');
			add(`Avoids attacks from behind${str$(5 * lv1)}%`);
			add(`Detects illusions${str$(5 * lv1)}%`);
			lines[line - 2] += ` ; detects magic${str$(Math.min(90, 5 * lv1 + 20))}%`;
			add('Secondary skills: survival, first aid, outdoor craft, tracking');
			poisonBonus = 1;
			saves[0] -= 3;
			saves[1] -= 3;
			saves[2] -= 2;
			const skills = BARBARIAN_SKILLS.filter(() => RND() < f(0.2)).slice(0, 3);
			// The separator is only written once two skills are already counted, so the first two run together.
			add(`Tertiary skills: ${skills.length ? skills.map((skill, i) => (i > 1 ? `, ${skill}` : skill)).join('') : 'none'}`);
			add('Native territory ___________________ Clan _________________');
		}
		if (at(3) === 'C') {
			add('Can turn undead');
			if (good === 3) {
				lines[line - 1] = 'Can neutralize or enlist undead';
				for (let t = 0; t < 4; t++) if (lines[t] === 'Fears damnation') lines[t] = 'Fears redemption';
			}
		}
		if (at(3) === 'D') {
			saveNote2 = 'Save vs. Fire & Electricity at +2';
			if (lv3 > 2) add('Can identify plants & animals & pure water; can pass through undergrowth');
			if (lv3 > 6) add('Immune to charm; can change form to reptile, bird or mammal');
		}
		if (at(4) !== '-') {
			let multiplier = 'double';
			if (lv4 > 4) multiplier = 'triple';
			if (lv4 > 8) multiplier = 'quadruple';
			if (lv4 > 16) multiplier = 'quintuple';
			add(`Can backstab opponents at +4 to hit for ${multiplier} damage`);
			add("Can speak `Thieves Cant'");
		}
		if (at(4) === 'A') {
			add('Can don disguises');
			if (lv4 > 8 && st[I] > 14) {
				const n = Math.min(4, lv4 - 8, st[I] - 14);
				lines[line - 2] += ` ; can learn${str$(n)} alignment language${n > 1 ? 's' : ''}`;
			}
		}

		let monk = null;
		if (mask === 'M---') {
			if (lv1 > 1) combatNote = `+${digits(Math.floor(lv1 / 2))} damage bonus with weapon`;
			restore('D9701');
			let row = [];
			for (let i = 0; i < lv1; i++) row = [readNum(), readStr(), readStr(), readStr()];
			monk = { move: row[0], openHand: row[2], abilities: row[3] };
			attacks = `Attacks per round: ${row[1]}`;
		}
		for (let t = 0; t < 4; t++) {
			if (lines[t] === 'Blind') infravision = 0;
			if ((lines[t] || '').startsWith('True Hero')) {
				if (good < 3 && female) lines[t] = 'True Heroine (SIWDCK+4) -- Beloved by everyone! All faults overlooked!';
				if (good === 3 && !female) lines[t] = 'True Villain (SIWDCK+4) -- Feared by many! Hated by all!';
				if (good === 3 && female) lines[t] = 'True Villainess (SIWDCK+4) -- Feared by many! Hated by all!';
			}
		}

		// ------------------------------------------------------------ Spells

		const slots = (table, size, index) => chunk(table, index, size);
		let clerical = '';
		let druidic = '';
		let magicUser = '';
		let illusionist = '';
		const tiered = (level, size, low, mid, high) => {
			let table = low;
			if (level > 19) { level -= 19; table = high; }
			if (level > 9) { level -= 9; table = mid; }
			return slots(table, size, level);
		};
		if (at(2) === 'M') {
			magicUser = tiered(Math.min(29, lv2), 9,
				'1--------2--------21-------32-------421------422------4321-----4332-----43321----',
				'44322----44433----444441---555442---5554421--5555521--55555321-55555332-555553321555553331',
				'555554332555554442555555443555555553555555554555555555666655555666666655666666666777766666');
		}
		if (at(2) === 'I') {
			illusionist = tiered(Math.min(26, lv2), 7,
				'1------2------21-----32-----421----431----432----4321---5332---',
				'54321--54332--554321-554322-554322155442225554322555532255553325555432',
				'5555433555554355555545555555666655566666667777666');
		}
		if (at(3) === 'C') {
			const base = tiered(Math.min(29, lv3), 7,
				'1------2------21-----32-----331----332----3321---3332---44321--',
				'44332--544321-655322-666422-666532-777542-7776531888653188876419997642',
				'9998752999986299999639999973999998399999849999994999999599999969999997');
			const chars = base.split('');
			for (let i = 1; i <= 7; i++) {
				const bonus = Number.parseFloat(String(spellBonus).substr(i * 6 - 6, 1)) || 0;
				const current = chars[i - 1];
				const value = (Number.parseFloat(current) || 0) + bonus;
				if (bonus > 0 && current !== '-') chars[i - 1] = digits(value)[0];
				if (value > 9) chars[i - 1] = 'abcdefg'[value - 10];
			}
			if (st[W] < 18) chars[6] = 'N';
			if (st[W] < 17) chars[5] = 'N';
			clerical = chars.join('');
		}
		if (at(3) === 'D') {
			druidic = slots('2------21-----321----422----432----4321---4431---4432---54321--54332--553321-554432165554326666543', 7, Math.min(14, lv3));
		}
		if (mask === 'P---' && lv1 > 8) clerical = slots('1---2---21--22--221-321-321133113321333133323333', 4, Math.min(12, lv1 - 8));
		if (at(1) === 'R' && lv1 > 7) {
			const index = Math.min(10, lv1 - 7);
			druidic = slots('1--1--2--2--21-21-22-22-221222', 3, index);
			magicUser = slots('--1-1-2-2-2121222222', 2, index);
			if (magicUser === '--') magicUser = '';
		}
		const spells = [
			['Clerical', clerical],
			['Druidic', druidic],
			['Magic-User', magicUser],
			['Illusionist', illusionist],
		].filter(([, slotText]) => slotText !== '').map(([label, slotText]) => ({ label, slots: slotText }));

		// ------------------------------------------------------------ Result

		state.lines = lines;
		const xpDigits = fmt(xp);
		let xpText = xpDigits;
		if (xpDigits.length > 3) xpText = `${xpDigits.slice(0, -3)},${xpDigits.slice(-3)}`;
		if (xpDigits.length > 6) xpText = `${xpText.slice(0, -7)},${xpText.slice(-7)}`;
		restore('D0278');
		const ageNames = Array.from({ length: 5 }, readStr);
		state.rnd = rng.state;

		return {
			number,
			seed,
			name,
			female,
			gender: female ? 'Female' : 'Male',
			social,
			socialName,
			race,
			raceGroup,
			raceName,
			mask,
			classLabel,
			levels,
			levelLabel,
			law,
			good,
			alignment,
			xp,
			xpText,
			age,
			ageCat,
			ageName: ageNames[ageCat - 1],
			physique,
			height,
			weight,
			hand,
			stats: st.slice(),
			excStr,
			excText,
			traitCount,
			traits: lines.slice(0, traitCount),
			lines: lines.filter((l) => l),
			infravision,
			cleric: at(3) === 'C',
			monk,
			str: { toHit, damage, weightAllow, doors, bendBars },
			int: { languages, knowSpell, minSpells, maxSpells, magicUser: at(2) !== '-' },
			wis: { magicAdj, spellBonus, spellFailure },
			dex: { reaction, defense },
			con: { hpAdj: conBonus, systemShock, resurrection },
			cha: { maxHenchmen, loyalty, reaction: chaReaction },
			hp,
			ac,
			thac0,
			weaponMagic,
			combatNote,
			attacks,
			spells,
			saves,
			poisonBonus,
			saveNotes: [saveNote, saveNote2].filter((n) => n),
			weapon,
			armor,
			shield,
			relic,
			tool,
			spellbook: at(2) !== '-',
			henchmen,
			henchmenTotal,
			thieving: at(4) !== '-' || mask === 'M---' || race === 7.4 ? thief : null,
			thievingRaceNote: raceGroup !== 1 && raceGroup !== 7,
			rare: ['P---', 'B---', 'R-C-'].includes(mask) || lines.slice(0, 4).some((l) => l === 'Vampiric' || (l || '').startsWith('True')),
		};
	};
})();
