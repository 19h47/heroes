// The 80×25 text screen of Heroes.exe: SUB aa8e (CLS and frame), SUB b30a (the character) and SUB ab8a
// (menu and status lines), then the key-wait loop's spinner and TIME$. Colours come from HEROES.CLR.
window.Heroes = window.Heroes || {};

(() => {
	const H = Heroes;
	const COLS = 80;
	const ROWS = 25;
	// HEROES.CLR as shipped: text, background, frame and labels. Alt+0 resets to 14, 0, 6.
	H.DEFAULT_COLORS = [7, 0, 12];
	H.RESET_COLORS = [14, 0, 6];
	H.SPINNER = '\xfa\xf9:\xf0=-+*\xfeO';
	const VERSION = 'v.040798';

	const fmt = (n) => String(Number(n.toPrecision(7)));
	const num = (n) => `${n < 0 ? '' : ' '}${fmt(n)} `;
	const pad2 = (n) => String(n).padStart(2, '0');
	const time$ = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
	// Cells hold CP437 codes as in video memory; these are the ones the program writes.
	const CP437 = { 0x94: 'ö', 0xb3: '│', 0xbf: '┐', 0xc0: '└', 0xd9: '┘', 0xda: '┌', 0xba: '║', 0xbb: '╗', 0xbc: '╝', 0xc4: '─', 0xc8: '╚', 0xc9: '╔', 0xcd: '═', 0xf0: '≡', 0xf9: '∙', 0xfa: '·', 0xfe: '■' };
	const glyph = (ch) => CP437[ch.charCodeAt(0)] || ch;

	// PRINT, LOCATE, COLOR and TAB of the QuickBASIC runtime on a colour text page.
	const page = () => {
		const cells = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => [' ', 7]));
		let row = 1;
		let col = 1;
		let attr = 7;
		const api = {
			cells,
			color: (fg, bg) => { attr = ((bg & 7) << 4) | (fg & 15); },
			cls: () => cells.forEach((line) => line.forEach((cell) => { cell[0] = ' '; cell[1] = attr; })),
			locate: (r, c) => { row = r; col = c; },
			print: (text = '', newline = false) => {
				for (const ch of String(text)) {
					if (col > COLS) { col = 1; row++; }
					if (row <= ROWS) cells[row - 1][col - 1] = [ch, attr];
					col++;
				}
				if (newline) { row++; col = 1; }
			},
			tab: (n) => {
				if (col > n) { row++; col = 1; }
				api.print(' '.repeat(n - col));
			},
		};
		return api;
	};
	H.page = page;

	const frame = (s, [text, back, label]) => {
		s.color(label, back);
		s.cls();
		s.locate(1, 1);
		s.print(`\xc9${'\xcd'.repeat(78)}\xbb`);
		for (let r = 2; r <= 23; r++) {
			s.locate(r, 1);
			s.print('\xba');
			s.locate(r, 80);
			s.print('\xba');
		}
		s.locate(24, 1);
		s.print(`\xc8${'\xcd'.repeat(78)}\xbc`);
	};
	H.frame = frame;

	const OUTPUT_PROMPTS = { 1: 'Print ', 2: 'Make .HRO Textfile for ', 3: 'Make HTML File for ' };

	// Menu and status lines (rows 22 to 24); `message` replaces the character number line while busy.
	const menu = (s, [text, back, label], { c, output, burst, canOutput, message }) => {
		s.locate(22, 3);
		s.color(text, label);
		s.print(' HEROES \xfe Adventure Characters ');
		s.color(back, label);
		if (burst) s.print('Burst');
		s.tab(47);
		s.print('             C = Control Panel ');
		s.tab(78);
		s.locate(23, 3);
		const who = c && c.name ? `\`${c.name}'` : 'Character';
		if (canOutput) s.print(` P = ${(OUTPUT_PROMPTS[output] || '') + who}`);
		s.tab(78);
		s.locate(23, 57);
		s.print(' Esc = Exit ');
		s.tab(78);
		s.locate(24, 3);
		if (message !== undefined) {
			s.print(message);
		} else {
			s.print(`            Character #${num(c ? c.number : 0)}`);
		}
		s.tab(47);
		s.print(' Any Other Key = New Character');
		s.tab(78);
	};

	const sheet = (s, [text, back, label], c, names) => {
		s.color(text, back);
		if (names) {
			s.locate(2, 3);
			s.color(label, back);
			s.print(c.name, true);
			s.locate(3, 3);
			s.print('\xc4'.repeat(c.name.length), true);
			s.color(text, back);
		}
		['Strength', 'Intelligence', 'Wisdom', 'Dexterity', 'Constitution', 'Charisma'].forEach((name, i) => {
			s.locate(i + 10, 3);
			s.color(label, back);
			s.print(`${name.padEnd(12)} `);
			s.color(text, back);
			s.print(String(c.stats[i]).padStart(2));
			if (i === 0) s.print(c.excText, true);
		});
		s.locate(4, 3);
		s.print(c.socialName === 'Lady' ? '' : `${c.gender} `);
		s.print(c.socialName, true);
		s.locate(5, 3);
		s.print(c.raceName, true);
		s.locate(6, 3);
		s.print(c.physique, true);
		s.locate(7, 3);
		s.print(`${fmt(c.age)} Yrs Old (${c.ageName})`, true);
		s.locate(8, 3);
		s.print(c.hand, true);
		s.locate(4, 30);
		s.print(c.alignment, true);
		s.locate(5, 30);
		s.print(c.classLabel, true);
		s.locate(6, 30);
		s.print(`Level ${c.levelLabel}`, true);
		s.locate(7, 30);
		s.print(`${fmt(c.hp)} Hit Points`, true);
		s.locate(8, 30);
		s.print(`X.P.: ${c.xpText}`, true);
		// Traits climb from row 20, the first one at the bottom.
		c.traits.forEach((trait, i) => {
			s.color(text, back);
			s.locate(20 - i, 3);
			s.print(trait, true);
		});
		s.color(text, back);
		s.locate(10, 24);
		s.print(`AC${c.ac < 0 ? ' ' : ''}${num(c.ac)}`);
		if (c.armor) s.print(`by ${c.armor}`, true);
		let row = 11;
		s.locate(row, 24);
		if (c.shield) {
			s.print(` and ${c.shield}`, true);
			row++;
		}
		[c.weapon, c.tool, c.relic].forEach((item) => {
			s.locate(row, 24);
			if (item) {
				s.print(item, true);
				row++;
			}
		});
		s.locate(4, 58);
		s.color(label, back);
		s.print('THAC0:');
		s.color(text, back);
		s.print(num(c.thac0), true);
		s.locate(5, 58);
		s.color(label, back);
		s.print('Henchmen:');
		s.color(text, back);
		s.print(c.henchmenTotal ? ` ${fmt(c.henchmenTotal)}` : ' None', true);
		c.henchmen.forEach((entry, i) => {
			s.locate(i + 6, 61);
			s.print(entry, true);
		});
	};

	const idle = (s, [, back, label], clock, spin) => {
		s.color(back, label);
		s.locate(24, 4);
		s.print(H.SPINNER[spin % H.SPINNER.length]);
		s.locate(24, 6);
		s.print(time$(clock));
	};

	// The main screen after a character is rolled. `spin` is the pass count of the key-wait loop.
	H.renderScreen = (c, { colors = H.DEFAULT_COLORS, names = true, output = 1, burst = false, canOutput = true, message, clock = new Date(), spin = 1 } = {}) => {
		const s = page();
		frame(s, colors);
		if (c) sheet(s, colors, c, names);
		menu(s, colors, { c, output, burst, canOutput, message });
		if (message === undefined) idle(s, colors, clock, spin);
		return s.cells;
	};

	// SUB a902: Esc asks for a random letter before leaving to DOS.
	H.renderExitScreen = (letter, colors = H.DEFAULT_COLORS) => {
		const s = page();
		frame(s, colors);
		s.locate(10, 26);
		s.print(` Press \`${letter}' To Confirm Exit`, true);
		s.locate(11, 26);
		s.print('Or Any Other Key To Continue', true);
		s.locate(21, 3);
		s.print(`The HEROES Character Generator ${VERSION}`, true);
		s.locate(22, 3);
		s.print('http://www.geocities.com/Area51/Vault/1642', true);
		s.locate(23, 3);
		s.print('by t\u0094ff, gzweb@qnis.net', true);
		return s.cells;
	};

	H.screenText = (cells) => cells.map((line) => line.map(([ch]) => glyph(ch)).join('').replace(/ +$/, '')).join('\n').replace(/\n+$/, '');

	const PALETTE = ['#000', '#00a', '#0a0', '#0aa', '#a00', '#a0a', '#a50', '#aaa', '#555', '#55f', '#5f5', '#5ff', '#f55', '#f5f', '#ff5', '#fff'];
	H.PALETTE = PALETTE;
	const escape = (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch] || ch;
	H.screenLines = (cells) => cells.map((line) => {
		let out = '';
		let run = '';
		let current = -1;
		const flush = () => {
			if (run) out += `<span style="color:${PALETTE[current & 15]};background:${PALETTE[(current >> 4) & 7]}">${run}</span>`;
			run = '';
		};
		line.forEach(([ch, attr]) => {
			if (attr !== current) {
				flush();
				current = attr;
			}
			run += escape(glyph(ch));
		});
		flush();
		return out;
	});
})();
