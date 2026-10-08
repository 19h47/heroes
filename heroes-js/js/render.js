// Output routines of Heroes.exe: the .HRO text file (SUB 0063 of the second module), the HTML file
// (SUB 3c30) and the on-screen sheet, which shows the .HRO layout.
window.Heroes = window.Heroes || {};

(() => {
	const H = Heroes;
	const RULE = '-'.repeat(79);
	const URL = 'http://www.geocities.com/Area51/Vault/1642';

	const fmt = (n) => String(Number(n.toPrecision(7)));
	const str$ = (n) => (n < 0 ? '' : ' ') + fmt(n);
	const digits = (n) => str$(n).slice(1);
	// PRINT of a number: leading space for positives, always a trailing space.
	const num = (n) => `${str$(n)} `;
	const signed = (n) => (n > -1 ? `+${digits(n)}` : num(n));
	const percent = (n) => (n > -1 ? `+${digits(n)} %` : `${num(n)}%`);
	const using = (n, width, decimals = 0) => n.toFixed(decimals).padStart(width);
	const escape = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
	const pad2 = (n) => String(n).padStart(2, '0');
	const stamp = (date) => [
		`${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${date.getFullYear()}`,
		`${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
	].join(', ');

	const baseName = (c) => {
		let t = c.name || str$(c.number);
		if (t.startsWith('Agent')) t = t.slice(6);
		if (t.startsWith('Ms.') || t.startsWith('Mr.')) t = t.slice(4);
		return t;
	};
	H.hroFileName = (c) => `_${baseName(c).slice(0, 7).replace(/ /g, '_')}.hro`;
	// Only the first seven characters have spaces and dots replaced (FOR I = 1 TO 7 over LEFT$(T$, 8)); DOS then
	// drops a space left in eighth place.
	H.htmlFileName = (c) => {
		const base = baseName(c).slice(0, 8);
		return `${base.slice(0, 7).replace(/[ .]/g, '_')}${base.slice(7).trim()}.htm`;
	};

	const printer = () => {
		const out = [];
		let line = '';
		return {
			p: (text = '') => { line += text; },
			nl: (text = '') => {
				out.push(line + text);
				line = '';
			},
			tab: (column) => {
				if (line.length > column - 1) {
					out.push(line);
					line = '';
				}
				line = line.padEnd(column - 1);
			},
			done: () => (line ? [...out, line] : out).join('\r\n') + '\r\n',
		};
	};

	// ------------------------------------------------------------ .HRO text file and printout

	// SUB 0063 writes the .HRO file; SUB 203c sends nearly the same sheet to LPT1 (lpt), with CHR$(146) and the
	// CHR$(14) double-width prefix around the name, no blank lines between the abilities and another footer.
	const sheetText = (c, date, lpt) => {
		const { p, nl, tab, done } = printer();
		const [S, I, W, D, C, CH] = c.stats;
		const gap = () => { if (!lpt) nl(); };

		if (lpt) p('\x92');
		tab(lpt ? 50 : 45);
		nl(c.good === 3 ? '[ Non-Player Character ]' : 'Player _______________');
		const name = c.name || ' '.repeat(25);
		const wide = lpt ? '\x0e' : '';
		if (!lpt) nl();
		nl(wide + '='.repeat(name.length));
		nl(wide + name);
		nl(wide + '='.repeat(name.length));
		nl(lpt ? '\x92' : '');
		p(c.socialName === 'Lady' ? '' : `${c.gender} `);
		p(c.socialName);
		tab(40);
		nl(c.alignment);
		p(c.raceName);
		tab(40);
		nl(c.classLabel);
		p(c.physique);
		tab(40);
		nl(`Level ${c.levelLabel}`);
		p(`Age: ${digits(c.age)} yrs (${c.ageName})`);
		tab(40);
		nl(`X.P.: ${c.xpText}`);
		nl(c.hand);
		nl(RULE);
		c.lines.forEach((l) => nl(l));
		if (c.infravision !== 0) nl(`Infravision to${num(c.infravision)}feet`);
		if (c.cleric) nl('Patron Deity _____________________________________________________');
		if (c.monk) {
			nl(RULE);
			nl(`Movement: ${digits(c.monk.move)}"`);
			nl(`Open-handed damge per attack: ${c.monk.openHand}`);
			nl(`Special abilities: ${c.monk.abilities}`);
		}
		nl(RULE);

		const { str, int, wis, dex, con, cha } = c;
		p(`Strength      ${using(S, 2)}${c.excText.padEnd(4).slice(0, 4)} `);
		tab(23);
		nl(`To Hit ${signed(str.toHit)} ; Damage ${signed(str.damage)} ; Weight All. ${signed(str.weightAllow)} G.P.`);
		tab(23);
		nl(`Open Doors on ${str.doors}`);
		tab(23);
		nl(`Bend Bars & Lift Gates${num(str.bendBars)}%`);
		gap();

		p(`Intelligence  ${using(I, 2)}`);
		tab(23);
		p(`Add'l Languages${num(int.languages)}`);
		if (int.magicUser) {
			nl(`; Know Spell ${num(int.knowSpell)}%`);
			tab(23);
			p(`Min Spells/Lvl${num(int.minSpells)}; Max Spells/Lvl${int.maxSpells < 99 ? num(int.maxSpells) : ' All'}`);
		}
		nl();
		gap();

		p(`Wisdom        ${using(W, 2)}`);
		tab(23);
		nl(`Magical Attack Adj. ${wis.magicAdj === 99 ? ' * Immunities' : signed(wis.magicAdj)}`);
		if (c.cleric) {
			gap();
			tab(23);
			nl(`Chance of Spell Failure${num(wis.spellFailure)}%`);
			gap();
			tab(23);
			nl(`Spell Bonus ${wis.spellBonus}`);
		}
		gap();

		p(`Dexterity     ${using(D, 2)}`);
		tab(23);
		nl(`Reaction/Attack ${signed(dex.reaction)}`);
		tab(23);
		nl(`Defensive Adjustment ${signed(dex.defense)}`);
		gap();

		p(`Constitution  ${using(C, 2)}`);
		tab(23);
		nl(`Hit Point Adj. ${signed(con.hpAdj)}`);
		tab(23);
		nl(`System Shock${num(con.systemShock)}% ; Resurrection${num(con.resurrection)}%`);
		gap();

		p(`Charisma      ${using(CH, 2)}  `);
		tab(23);
		nl(`Max. Henchmen${num(cha.maxHenchmen)}`);
		tab(23);
		nl(`Loyalty Base ${percent(cha.loyalty)} ; Reaction Adj. ${percent(cha.reaction)}`);
		nl(RULE);

		p('COMBAT:');
		tab(11);
		nl(`Hit Points (${num(c.hp)}) Current ______`);
		tab(11);
		nl(`Armor Class${c.ac < 0 ? ' ' : ''}${num(c.ac)}${dex.defense !== 0 ? ' (incl. dexterity adjustment)' : ''}`);
		tab(11);
		p(`THAC0:${num(c.thac0)}`);
		if (str.toHit !== 0) p(' (not incl. strength modifier)');
		if (c.weaponMagic > 0) p(' (not incl. weapon bonus)');
		nl();
		if (c.combatNote) {
			tab(11);
			nl(c.combatNote);
		}
		if (c.attacks) {
			tab(11);
			nl(c.attacks);
		}

		if (c.spells.length) {
			nl(RULE);
			const width = Math.max(...c.spells.map((s) => s.slots.length)) * 5;
			nl(`SPELL     Spell Level ${' 1st  2nd  3rd  4th  5th  6th  7th  8th  9th'.slice(0, width)}`);
			nl(`CASTING:              ${' ---  ---  ---  ---  ---  ---  ---  ---  ---'.slice(0, width)}`);
			// The printout calls the .HRO spell-row SUB (1e61) instead of its own (3a67); PRINT #3 on a closed
			// file raises error 52, the handler shows "Unknown Error 52 ; Press Any Key" and the sheet ends here.
			if (lpt) return done();
			c.spells.forEach(({ label, slots }) => {
				p(`          ${label}`);
				tab(23);
				[...slots].forEach((ch) => {
					let n = Number.parseInt(ch, 10) || 0;
					if (ch >= 'a' && ch <= 'g') n = ch.charCodeAt(0) - 87;
					p(n > 0 ? `${using(n, 3)}  ` : '  -  ');
				});
				if (label === 'Clerical' && c.wis.spellBonus !== '') p('(incl. wisdom bonus)');
				nl();
			});
		}

		nl(RULE);
		p('SAVING');
		tab(11);
		p('Paralyzation, Poison');
		tab(33);
		p('Petrification');
		tab(48);
		p('Rod, Staff');
		tab(60);
		nl('Breath');
		p('THROWS:');
		tab(11);
		p('or Death Magic');
		tab(33);
		p('or Polymorph');
		tab(48);
		p('or Wand');
		tab(60);
		p('Weapon');
		tab(68);
		nl('Spell');
		[11, 33, 48, 60, 68].forEach((column, i) => {
			tab(column);
			p(num(c.saves[i]));
		});
		nl();
		if (c.poisonBonus > 0) {
			tab(11);
			nl(`Save vs. Poison at +${digits(c.poisonBonus)}`);
		}
		c.saveNotes.forEach((note) => {
			tab(11);
			nl(note);
		});

		nl(RULE);
		p('POSSESSIONS:');
		[c.weapon, c.armor, c.shield, c.relic, c.tool, c.spellbook ? 'Spellbook' : ''].filter((x) => x).forEach((item) => {
			tab(14);
			nl(item);
		});

		if (c.henchmen.length) {
			nl(RULE);
			p('HENCHMEN:');
			tab(14);
			let used = 0;
			c.henchmen.forEach((entry, i) => {
				const text = i < c.henchmen.length - 1 ? `${entry}, ` : entry;
				used += text.length;
				if (used > 64) {
					nl();
					tab(14);
					used = 0;
				}
				p(text);
			});
			nl();
		}

		if (c.thieving) {
			nl(RULE);
			p('THIEVING ABILITIES:');
			if (c.thievingRaceNote) p(' (incl. race modifiers)');
			if (c.stats[3] > 18) p(' (incl. dex bonus)');
			nl();
			nl(' Pick      Open    Find/Remove   Move      Hide in   Hear    Climb   Read');
			nl(' Pockets   Locks   Traps         Silenty   Shadows   Noise   Walls   Languages');
			const t = c.thieving;
			nl(`${using(t[0], 4)}%     ${using(t[1], 4)}%   ${using(t[2], 4)}%         ${using(t[3], 4)}%     ${using(t[4], 4)}%     ${using(t[5], 4)}%   ${using(t[6], 6, 1)}% ${using(t[7], 4)}%`);
		}

		nl(RULE);
		if (lpt) {
			nl('from the HEROES Character Generator (C) Critterhaven Software 1993');
			nl(`${stamp(date)}, Character #${num(c.number)} ${URL}`);
			return done();
		}
		nl(`${stamp(date)}, Character #${num(c.number)}from the HEROES Character Generator`);
		nl(`(c) 1993 critterhaven software, ${URL}`);
		nl(RULE);
		return done();
	};
	H.renderText = (c, date = new Date()) => sheetText(c, date, false);
	// Bytes sent to the printer, CP437 control codes included.
	H.renderPrint = (c, date = new Date()) => sheetText(c, date, true);

	// ------------------------------------------------------------ HTML file

	// SUB 3c30 writes the file with PRINT #3: nothing is escaped, and the line breaks fall where the BASIC
	// statements end without a semicolon.
	H.renderHtmlBody = (c, date = new Date()) => {
		const { p, nl, done } = printer();
		const { str, int, wis, dex, con, cha } = c;
		const [S, I, W, D, C, CH] = c.stats;
		const TD = '<td valign=top align=left>';
		const CENTER = '<td valign=top align=center>';
		const plus = (n) => (n > -1 ? `+${digits(n)}` : num(n));
		const plusPercent = (n) => (n > -1 ? `+${digits(n)} %` : `${num(n)}%`);

		nl('<!-- =========== -->');
		nl(`<a name="${c.name}"></a><p>`);
		nl(`<table cellpadding=5 border=5><tr>${TD}`);
		nl(`<h3>${c.name || 'NPC Name _________________'}</h3><p>`);
		nl('[ Non-Player Character ]<p>');
		nl('<table cellpadding=5 border=0>');
		nl('<tr>');
		nl(`${TD}${c.socialName === 'Lady' ? '' : `${c.gender} `}${c.socialName}</td>`);
		nl(`${TD}${c.alignment}</td></tr>`);
		nl('<tr>');
		nl(`${TD}${c.raceName}</td>${TD}${c.classLabel}</td></tr>`);
		nl('<tr>');
		nl(`${TD}${c.physique}</td>`);
		nl(`${TD}Level ${c.levelLabel}</td></tr>`);
		nl('<tr>');
		nl(`${TD}Age: ${digits(c.age)} yrs (${c.ageName})</td>`);
		nl(`${TD}X.P.: ${c.xpText}</td></tr>`);
		nl('<tr>');
		nl(`${TD}${c.hand}</td></tr></table>`);
		p(`<p><table cellpadding=5 border=0><tr>${TD}<ul>`);
		c.lines.forEach((l) => nl(`<li>${l}`));
		if (c.infravision !== 0) nl(`<li>Infravision to${num(c.infravision)}feet`);
		if (c.cleric) nl('<li>Patron Deity _____________________________________________________<p>');
		if (c.monk) {
			p(`<li>Movement: ${digits(c.monk.move)}"`);
			nl(`<li>Open-handed damage per attack: ${c.monk.openHand}`);
			nl(`<li>Special abilities: ${c.monk.abilities}`);
		}
		nl('</ul></td></tr></table>');

		nl('<p><table cellpadding=5 border=0>');
		nl(`${TD}Strength</td>`);
		nl(`<td valign=top align=right>${num(S)}${c.excText}</td>`);
		nl(`${TD}To Hit ${plus(str.toHit)}; Damage ${plus(str.damage)}; Weight All. ${plus(str.weightAllow)} G.P.`);
		nl(`<br>Open Doors on ${str.doors}`);
		nl(`<br>Bend Bars & Lift Gates${num(str.bendBars)}%</td></tr>`);
		nl('<tr>');
		nl(`${TD}Intelligence</td>`);
		nl(`<td valign=top align=right>${num(I)}</td>`);
		p(`${TD}Add'l Languages${num(int.languages)}`);
		if (int.magicUser) {
			nl(`; Know Spell ${num(int.knowSpell)}%`);
			p(`<br>Min Spells/Lvl${num(int.minSpells)}; Max Spells/Lvl${int.maxSpells < 99 ? num(int.maxSpells) : ' All'}`);
		}
		nl('</td></tr>');
		nl('<tr>');
		nl(`${TD}Wisdom</td>`);
		nl(`<td vlaign=top align=right>${num(W)}</td>`);
		nl(`${TD}Magical Attack Adj. ${wis.magicAdj === 99 ? ' * Immunities' : plus(wis.magicAdj)}`);
		if (c.cleric) {
			nl(`<br>Chance of Spell Failure${num(wis.spellFailure)}%`);
			nl(`<br>Spell Bonus ${wis.spellBonus}`);
		}
		nl('</td></tr>');
		nl('<tr>');
		nl(`${TD}Dexterity</td>`);
		nl(`<td valign=top align=right>${num(D)}</td>`);
		nl(`${TD}Reaction/Attack ${plus(dex.reaction)}`);
		nl(`<br>Defensive Adjustment ${plus(dex.defense)}`);
		nl('</td></tr>');
		nl('<tr>');
		nl(`${TD}Constitution</td>`);
		nl(`<td valign=top align=right>${num(C)}</td>`);
		nl(`${TD}Hit Point Adj. ${plus(con.hpAdj)}<br>System Shock${num(con.systemShock)}% ; Resurrection${num(con.resurrection)}%`);
		nl('</td></tr>');
		nl('<tr>');
		nl(`${TD}Charisma</td>`);
		nl(`<td valign=top align=right>${num(CH)}</td>`);
		nl(`${TD}Max. Henchmen${num(cha.maxHenchmen)}`);
		nl(`<br>Loyalty Base ${plusPercent(cha.loyalty)} ; Reaction Adj. ${plusPercent(cha.reaction)}`);
		nl('</td></tr></table>');

		nl('<p><table cellpadding=5 border=0><tr>');
		nl(`${TD}COMBAT:</td>${TD}Hit Points (${num(c.hp)}) Current ______`);
		nl(`<br>Armor Class${c.ac < 0 ? ' ' : ''}${num(c.ac)}${dex.defense !== 0 ? ' (incl. dexterity adjustment)' : ''}`);
		nl(`<br>THAC0:${num(c.thac0)}${str.toHit !== 0 ? ' (not incl. strength modifier)' : ''}${c.weaponMagic > 0 ? ' (not incl. weapon bonus)' : ''}`);
		if (c.combatNote) nl(`<br>${c.combatNote}`);
		if (c.attacks) nl(`<br>${c.attacks}`);
		nl('</td></tr></table>');

		if (c.spells.length) {
			p(`<p><table cellpadding=5 border=0><tr>${TD}SPELL<br>CASTING:</td>${TD}Spell Level</td>`);
			const width = Math.max(...c.spells.map((s) => s.slots.length));
			for (let i = 0; i < width; i++) nl(`${CENTER}${'1st2nd3rd4th5th6th7th8th9th'.substr(i * 3, 3)}</td>`);
			c.spells.forEach(({ label, slots }) => {
				nl(`<tr>${TD}</td><td valign=top align=right>${label}${label === 'Clerical' && wis.spellBonus !== '' ? '<br>(incl. wisdom bonus)' : ''}</td>`);
				[...slots].forEach((ch) => {
					let n = Number.parseInt(ch, 10) || 0;
					if (ch >= 'a' && ch <= 'g') n = ch.charCodeAt(0) - 87;
					p(n > 0 ? `${CENTER}${num(n)}</td>` : `${CENTER}--</td>`);
				});
				nl('</tr>');
			});
			p('</table>');
		}

		nl('<p><table cellpadding=5><tr>');
		nl(`${TD}SAVING<br>THROWS:</td>`);
		['Paralyzation, Poison<br>or Death Magic', 'Petrification<br>or Polymorph', 'Rod, Staff<br>or Wand', 'Breath<br>Weapon']
			.forEach((head) => nl(`${CENTER}${head}</td>`));
		nl(`${CENTER}Spell</td></tr>`);
		nl(`<tr>${TD}</td>${c.saves.map((v) => `${CENTER}${num(v)}`).join('</td>')}</td></tr>`);
		const NOTE = '<tr><td></td><td colspan=5 valign=top>';
		if (c.poisonBonus > 0) nl(`${NOTE}Save vs. Poison at +${digits(c.poisonBonus)}</td></tr>`);
		c.saveNotes.forEach((note) => nl(`${NOTE}${note}</td></tr>`));
		nl('</table>');
		nl();

		p(`<p><table cellpadding=5 border=0><tr>${TD}POSSESSIONS:</td>${TD}`);
		[c.weapon, c.armor, c.shield, c.relic, c.tool].filter((x) => x).forEach((item) => nl(`${item}<br>`));
		if (c.spellbook) nl('Spellbook<br>');
		nl('</td></tr></table>');
		if (c.henchmen.length) {
			nl(`<p><table cellpadding=5 border=0><tr>${TD}HENCHMEN:</td>${TD}`);
			nl(`${c.henchmen.join(', ')}</td></tr></table>`);
		}

		if (c.thieving) {
			nl('<p><table cellpadding=5 border=0><tr>');
			nl('<td colspan=8 valign=top>THIEVING ABILITIES:');
			if (c.thievingRaceNote) p(' (incl. race modifiers)');
			if (D > 18) p(' (incl. dex bonus)');
			nl('</td><tr>');
			nl(`${CENTER}Pick<br>Pockets</td>${CENTER}Open<br>Locks</td>`);
			nl(`${CENTER}Find/Remove<br>Trap</td>${CENTER}Move<br>Silenty</td>`);
			nl(`${CENTER}Hide in<br>Shadows</td>${CENTER}Hear<br>Noise</td>`);
			nl(`${CENTER}Climb<br>Walls</td>${CENTER}Read<br>Language</td></tr>`);
			nl(`${c.thieving.map((v) => `${CENTER}${num(v)}%</td>`).join('')}</tr></table>`);
		}

		p(`<p><font size=-2>${stamp(date)}, Character #${num(c.number)}<br>from the <a href="${URL}">`);
		nl('<b>HEROES Character Generator</b></a> (C) Critterhaven Software 1993</font></td></tr></table>');
		return done().replace(/\r\n$/, '');
	};

	H.exportHtml = (characters, date = new Date()) => `<html><body>\r\n${characters.map((c) => H.renderHtmlBody(c, date)).join('\r\n')}\r\n</body></html>\r\n`;

	// ------------------------------------------------------------ On-screen sheet

	H.renderSheet = (c) => `<pre class="hro">${escape(H.renderText(c).replace(/\r\n$/, ''))}</pre>`;
})();
