(() => {
	const H = Heroes;
	const SETTINGS_KEY = 'heroes.v2.settings';
	const SLOTS_KEY = 'heroes.v2.slots';
	const COLORS_KEY = 'heroes.v2.colors';
	// Passes of the key-wait loop per millisecond, each drawing one RND(1): measured in DOSBox Staging at
	// 20,000 cycles (7,257 passes between key presses 0.8 s apart).
	const DRAWS_PER_MS = 9.1;
	const ERROR_52 = ' Unknown Error 52 ; Press Any Key ';

	const $ = (selector) => document.querySelector(selector);
	const screen = $('#screen');
	const sheet = $('#sheet');
	const status = $('#status');
	const printout = $('#printout');

	const load = (key, fallback) => {
		try {
			return JSON.parse(localStorage.getItem(key)) ?? fallback;
		} catch {
			return fallback;
		}
	};
	const save = (key, value) => {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// Storage can be unavailable (private mode, file:// restrictions); settings then last for the session.
		}
	};
	// HEROES.DAT keeps each X.P. bound as a mantissa in quarters and a power of ten, which the control panel
	// steps; settings saved by earlier versions only have the amounts.
	const mantissa = (amount) => {
		if (!(amount > 0)) return [0, 0];
		const exp = Math.floor(Math.log10(amount));
		return [Math.round((amount / 10 ** exp) * 4) / 4, exp];
	};
	const normalize = (s) => {
		const n = {
			...H.DEFAULT_SETTINGS,
			...s,
			races: H.DEFAULT_SETTINGS.races.map((d, i) => Number(s.races?.[i] ?? d)),
			social: H.DEFAULT_SETTINGS.social.map((d, i) => Number(s.social?.[i] ?? d)),
		};
		if (s.xpMinMant === undefined) [n.xpMinMant, n.xpMinExp] = mantissa(n.xpMin);
		if (s.xpMaxMant === undefined) [n.xpMaxMant, n.xpMaxExp] = mantissa(n.xpMax);
		return n;
	};

	let settings = normalize(load(SETTINGS_KEY, H.DEFAULT_SETTINGS));
	let slots = (load(SLOTS_KEY, null) || H.PRESETS).map(normalize);
	let colors = load(COLORS_KEY, H.DEFAULT_COLORS);

	// The page wears the HEROES.CLR colours too: text, background (dark, as a text-mode background) and frame.
	const paint = () => {
		const [text, back, frame] = colors;
		const style = document.documentElement.style;
		style.setProperty('--text', H.PALETTE[text & 15]);
		style.setProperty('--back', H.PALETTE[back & 7]);
		style.setProperty('--frame', H.PALETTE[frame & 15]);
	};
	const setColors = (next) => {
		colors = next;
		save(COLORS_KEY, colors);
		paint();
	};

	// One run of HEROES.EXE: the trait pool, the shield bonus and the paladin blessing carry over between
	// characters. Leaving for the control panel (CHAIN) ends the run, so coming back starts a new one.
	let state;
	let counter;
	let current;
	let bursting;
	// 'main' (key-wait loop), 'error' (printer error, waiting for a key), 'exit' (confirm letter), 'panel'
	// (HEROES.CP) or 'dos'.
	let mode;
	let panel;
	let letter;
	let idleFrom = performance.now();
	let spin = 0;

	// Passes the key-wait loop made since the last call; each one drew a RND and stepped the spinner. In a
	// burst the key is read on the pass right after a character.
	const idlePasses = () => {
		const now = performance.now();
		const passes = bursting && mode === 'main' ? 1 : Math.round((now - idleFrom) * DRAWS_PER_MS);
		idleFrom = now;
		spin += passes;
		return passes;
	};

	// ------------------------------------------------------------ Screen

	// The screen is redrawn on every frame for the spinner and the clock; only the rows that changed are
	// replaced, usually just the spinner's.
	let shown = [];
	const paintLines = (lines) => {
		if (shown.length !== lines.length) {
			screen.replaceChildren(...lines.map(() => document.createElement('div')));
			shown = [];
		}
		lines.forEach((html, i) => {
			if (shown[i] !== html) screen.children[i].innerHTML = html;
		});
		shown = lines;
	};

	const draw = () => {
		let cells;
		if (mode === 'exit') cells = H.renderExitScreen(letter, colors);
		else if (mode === 'panel') cells = panel.cells;
		else if (mode === 'dos') cells = null;
		else {
			cells = H.renderScreen(current, {
				colors,
				names: settings.names,
				output: settings.output,
				burst: bursting,
				message: mode === 'error' ? ERROR_52 : undefined,
				spin: spin + Math.round((performance.now() - idleFrom) * DRAWS_PER_MS),
			});
		}
		if (cells) paintLines(H.screenLines(cells));
		else {
			screen.textContent = 'C:\\>_';
			shown = [];
		}
		screen.classList.toggle('dos', !cells);
		const seed = current ? current.seed.toString(16).padStart(6, '0') : '------';
		status.textContent = `RND state ${seed} · data set ${settings.label}`;
	};

	const showSheet = () => {
		if (current && !sheet.hidden) sheet.innerHTML = H.renderSheet(current);
	};

	const tick = () => {
		if (mode === 'main' || mode === 'error') draw();
		requestAnimationFrame(tick);
	};

	// ------------------------------------------------------------ Characters

	const roll = (idle) => {
		counter++;
		current = H.nextCharacter(settings, state, counter, { idle });
		showSheet();
	};

	const start = () => {
		state = H.createState(settings);
		counter = 0;
		bursting = false;
		mode = 'main';
		idleFrom = performance.now();
		roll(0);
		draw();
	};

	const newCharacter = (idle = idlePasses()) => {
		mode = 'main';
		roll(idle);
		draw();
	};

	// "~": a character on every pass of the key-wait loop, one RND apart, until a key is pressed. With an even,
	// positive breed setting it also stops on a paladin, barbarian, ranger-cleric, vampire or "True" trait.
	const burstStep = () => {
		if (!bursting || mode !== 'main') return;
		idleFrom = performance.now();
		spin++;
		roll(1);
		if (settings.breed > 0 && settings.breed % 2 === 0 && current.rare) bursting = false;
		draw();
		if (bursting) requestAnimationFrame(burstStep);
	};

	const download = (filename, content, type) => {
		const url = URL.createObjectURL(new Blob([content], { type }));
		const link = Object.assign(document.createElement('a'), { href: url, download: filename });
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};
	const saveHtml = (c) => download(H.htmlFileName(c), H.exportHtml([c]), 'text/html');
	const saveHro = (c) => download(H.hroFileName(c), H.renderText(c), 'text/plain');

	// The printer stream: CHR$(14) widens a line, CHR$(146) is dropped by the printer.
	const printSheet = (c) => {
		const text = H.renderPrint(c).replace(/\x92/g, '');
		const escape = (s) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
		printout.innerHTML = text.split('\r\n').map((line) => (line.startsWith('\x0e')
			? `<span class="wide">${escape(line.slice(1))}</span>`
			: escape(line))).join('\n');
		window.print();
		// LPRINT holds the program, so the time in the print dialog draws nothing.
		idleFrom = performance.now();
	};

	// "P": output the character. The printer path stops at the spell table with error 52, as in the
	// original, which waits for a key and rolls a new character. During a burst the burst goes on.
	const output = () => {
		const idle = idlePasses();
		if (settings.output === 1) {
			printSheet(current);
			if (current.spells.length) {
				state.rnd = advance(state.rnd, idle);
				mode = 'error';
				draw();
				return;
			}
		} else if (settings.output === 2) saveHro(current);
		else saveHtml(current);
		newCharacter(idle);
	};

	const advance = (rnd, draws) => {
		for (let i = 0; i < draws; i++) rnd = H.rndNext(rnd);
		return rnd;
	};

	// Esc: SUB a902 draws a random letter to confirm with; its own key wait draws nothing.
	const askExit = () => {
		state.rnd = H.rndNext(advance(state.rnd, idlePasses()));
		letter = String.fromCharCode(64 + Math.floor((state.rnd / H.RND_PERIOD) * 26) + 1);
		mode = 'exit';
		draw();
	};

	const setColor = (index) => {
		setColors(index < 0 ? [...H.RESET_COLORS] : colors.map((c, i) => (i === index ? (c + 1) % 16 : c)));
		draw();
	};

	// One key as INKEY$ returns it, after the main loop's UCASE$; `alt` is the colour an Alt+digit steps.
	// Other Alt keys come as CHR$(0) + scan code, which the main loop takes as any other key.
	const press = (key, alt) => {
		if (mode === 'panel') return;
		if (mode === 'dos') {
			start();
			return;
		}
		if (mode === 'error') {
			newCharacter();
			if (bursting) requestAnimationFrame(burstStep);
			return;
		}
		if (mode === 'exit') {
			if (key.toUpperCase() === letter) {
				mode = 'dos';
				bursting = false;
				draw();
			} else {
				idlePasses();
				newCharacter(0);
				if (bursting) requestAnimationFrame(burstStep);
			}
			return;
		}
		if (alt !== undefined) {
			setColor(alt);
			return;
		}
		const k = key.toUpperCase();
		if (k === 'ESCAPE') askExit();
		else if (k === 'C') openPanel();
		else if (k === '~') {
			const idle = idlePasses();
			const wasBursting = bursting;
			bursting = true;
			newCharacter(idle);
			if (!wasBursting) requestAnimationFrame(burstStep);
		} else if (k === 'P') output();
		else {
			const idle = idlePasses();
			bursting = false;
			newCharacter(idle);
		}
	};

	// ------------------------------------------------------------ Control panel

	// BEEP: the PC speaker at 800 Hz for a quarter of a second.
	let audio;
	const beep = () => {
		try {
			audio ??= new AudioContext();
			const osc = audio.createOscillator();
			const gain = audio.createGain();
			osc.type = 'square';
			osc.frequency.value = 800;
			gain.gain.value = 0.05;
			osc.connect(gain).connect(audio.destination);
			osc.start();
			osc.stop(audio.currentTime + 0.25);
		} catch {
			// No audio: the beep is only a warning.
		}
	};

	// "C" chains to HEROES.CP, which runs until Esc saves HEROES.DAT and chains back.
	function openPanel() {
		bursting = false;
		mode = 'panel';
		panel = H.createPanel({ settings, slots, colors, beep });
		draw();
	}

	const panelPress = (k) => {
		const result = panel.press(k);
		if (result.colors) setColors(result.colors);
		if (result.store) save(SLOTS_KEY, slots);
		if (result.exit) {
			settings = normalize(panel.settings());
			save(SETTINGS_KEY, settings);
			panel = null;
			start();
			return;
		}
		draw();
	};

	// ------------------------------------------------------------ Input

	// Alt+1, Alt+2, Alt+3 step the text, background and label colours; Alt+0 restores 14, 0, 6.
	const ALT = { Digit1: 0, Digit2: 1, Digit3: 2, Digit0: -1, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad0: -1 };
	const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'Dead', 'Unidentified'];

	// The control panel reads keys through SUB 4166: the arrows, Home, End, PgUp and PgDn come as the digits
	// of the keypad, other extended keys as their scan code character (Insert is "R", Delete "S").
	const PANEL_KEYS = {
		Enter: '\r', Escape: '\x1b', Backspace: '\b', Tab: '\t',
		ArrowUp: '8', ArrowDown: '2', ArrowLeft: '4', ArrowRight: '6',
		Home: '7', End: '1', PageUp: '9', PageDown: '3', Insert: 'R', Delete: 'S',
	};
	const panelKey = (key, code, altKey) => {
		if (altKey) {
			const alt = ALT[code];
			return alt === undefined ? null : `Alt${alt < 0 ? 0 : alt + 1}`;
		}
		if (/^F([1-9]|1[0-2])$/.test(key)) return key;
		return PANEL_KEYS[key] ?? (key.length === 1 ? key : null);
	};

	const input = (key, code, altKey) => {
		if (mode === 'panel') {
			const k = panelKey(key, code, altKey);
			if (k !== null) panelPress(k);
		} else press(key, altKey ? ALT[code] : undefined);
	};

	// On French and international layouts "~" is a dead key (Option+N on a Mac, AltGr+2 on Windows, Shift+`
	// on US-International), which the browser only reports as "Dead".
	const deadTilde = (event, altGr) => event.key === 'Dead'
		&& ((event.code === 'KeyN' && event.altKey) || (event.code === 'Digit2' && altGr) || (event.code === 'Backquote' && event.shiftKey));

	document.addEventListener('keydown', (event) => {
		// Windows reports AltGr as Ctrl+Alt; the character it types is the key.
		const altGr = event.getModifierState?.('AltGraph');
		const key = deadTilde(event, altGr) ? '~' : event.key;
		if ((event.ctrlKey && !altGr) || event.metaKey || MODIFIERS.includes(key)) return;
		if (event.target.closest?.('button, input, select, a')) return;
		event.preventDefault();
		input(key, event.code, event.altKey && !altGr && key !== '~');
	});
	screen.addEventListener('click', () => press(' '));

	document.querySelector('nav').addEventListener('click', (event) => {
		const button = event.target.closest('[data-action], [data-key]');
		if (!button) return;
		button.blur();
		const action = button.dataset.action;
		if (action === 'sheet') {
			sheet.hidden = !sheet.hidden;
			button.setAttribute('aria-pressed', String(!sheet.hidden));
			showSheet();
		} else if (action === 'html') saveHtml(current);
		else if (action === 'hro') saveHro(current);
		else input(button.dataset.key);
	});

	paint();
	start();
	requestAnimationFrame(tick);
})();
