# The original program

These are the files of HEROES, the _AD&D_ 1st edition character generator, a DOS freeware by critterhaven
(1993–1998) written in QuickBASIC 4.5, exactly as they were found. Run `HEROES.EXE` in DOSBox.

`HEROES.DAT` is in the state left by its last use (2024); the web port takes it as its default settings.

| File                            | Role                                     |
| ------------------------------- | ---------------------------------------- |
| `Heroes.exe`                    | The generator (main program)             |
| `HEROES.CP`                     | The control panel (second program)       |
| `HEROES.DAT`                    | The current settings                     |
| `HEROES1.DAT` to `HEROES12.DAT` | Twelve saved data sets                   |
| `HEROES.TRT`                    | The personality traits database (coded)  |
| `HEROES.CLR`                    | The screen colours                       |

## `Heroes.exe` — the generator

Compiled QuickBASIC 4.5 program (170 KB, 1998). On start-up it reads `HEROES.DAT`, `HEROES.CLR` and
`HEROES.TRT`, makes a first character, shows it on an 80 × 25 screen, then waits for a key:

- **any key**: a new character;
- **P**: outputs the character to the printer (LPT1), a `.HRO` file or a `.HTM` file, depending on the
  settings;
- **~**: burst, one character per pass of the loop until the next key;
- **C**: switches to the control panel (`CHAIN "heroes.cp"`);
- **Alt+1 / Alt+2 / Alt+3**: changes the colour of the text, the background or the frame; **Alt+0** restores
  yellow, black and brown;
- **Esc**: quits, after confirmation with a randomly drawn letter.

All the game content (race, class, equipment and spell tables, name syllables…) is compiled into the
executable. The random generator is QuickBASIC's `RND`, and it keeps advancing while the program waits for a
key: the next character therefore depends on the time spent before pressing it.

## `HEROES.CP` — the control panel

Second QuickBASIC program (70 KB, 1995), started with the C key. It shows the settings of `HEROES.DAT` and
changes them, one key per setting:

| Key       | Setting                                                                |
| --------- | ---------------------------------------------------------------------- |
| N         | Create names?                                                          |
| F         | Proportion of female characters                                        |
| G         | Good / Evil limit                                                      |
| X         | Experience points range (editor)                                       |
| C         | Ability score generation method                                        |
| 1         | Reroll 1's?                                                            |
| T         | Use traits?                                                            |
| R         | Race population (editor)                                               |
| B         | Proportion of sub-races                                                |
| S         | Social class population (editor, Space = curve)                        |
| D         | Label the data set and save it to `HEROESn.DAT` (F2 to F12)            |
| F1 to F12 | Load `HEROES1.DAT` to `HEROES12.DAT`                                   |

Four hidden keys, not in the menu: **!** (superheroes, no racial level limits), **@** (favour one ability
score, and so the classes that depend on it), **#** (force the sub-race, from 1 to 20; above 18, fighters get
the minimum ability scores and the alignment of a paladin, and 19 makes them anti-paladins) and **$** or
Backspace (output file type). **Esc** saves `HEROES.DAT` and starts `Heroes.exe` again.

## `HEROES.DAT` — the current settings

148 bytes: 37 single-precision floating-point numbers (4 bytes each), in this order:

| No.      | Contents                                                                                  |
| -------- | ----------------------------------------------------------------------------------------- |
| 1        | Superheroes (1 = yes)                                                                     |
| 2        | Favoured ability score (0 = none, 1 to 4 = Strength, Intelligence, Wisdom, Dexterity)     |
| 3        | Forced sub-race (0 = random, up to 20)                                                    |
| 4        | Reroll 1's (1 = no, 2 = yes)                                                              |
| 5        | Generation method (1 to 4)                                                                |
| 6        | Good / Evil limit (1 to 4)                                                                |
| 7        | Create names (1 = yes)                                                                    |
| 8        | Percentage of female characters                                                           |
| 9        | Percentage of sub-races                                                                   |
| 10 to 12 | Minimum XP, then its mantissa and exponent (the panel edits the last two)                 |
| 13 to 15 | Maximum XP, mantissa, exponent                                                            |
| 16 to 25 | Race weights (9 used)                                                                     |
| 26 to 32 | Social class weights (from Lord to Slave)                                                 |
| 33       | The four letters `OKAY`, which mark a valid file                                          |
| 34       | Use traits (1 = yes)                                                                      |
| 35       | Output: 1 = printer, 2 = `.HRO` file, 3 = `.HTM` file                                     |
| 36–37    | Data set label (8 characters, e.g. `--NONE--`)                                            |

## `HEROES1.DAT` to `HEROES12.DAT` — the data sets

Same format as `HEROES.DAT`. They are settings saved from the panel (D key) and loaded again with F1 to F12.
Those shipped with the program:

| File           | Label    |
| -------------- | -------- |
| `HEROES1.DAT`  | Default  |
| `HEROES2.DAT`  | DefText  |
| `HEROES3.DAT`  | DefHTML  |
| `HEROES4.DAT`  | Fighters |
| `HEROES5.DAT`  | Clerics  |
| `HEROES6.DAT`  | Thieves  |
| `HEROES7.DAT`  | LowMage  |
| `HEROES8.DAT`  | HighMage |
| `HEROES9.DAT`  | Miners   |
| `HEROES10.DAT` | Monsters |
| `HEROES11.DAT` | DrowLord |
| `HEROES12.DAT` | LowGirls |

A file without `OKAY` is rejected with a beep.

## `HEROES.TRT` — the personality traits

Coded text file: every character is shifted by +1 (`A` becomes `B`, a space becomes `!`). The first line,
`HEROES.TRT`, is plain text and serves as a check. Once decoded, each line is a series of traits, for
example:

```text
000001Optimistic (Ch+1)\Pessimistic (Ch-1)|
200020Very healthy (C+2, S+2)\Sickly (C-2, S-2)|
```

- the six digits are the ability score modifiers, in the order Strength, Intelligence, Wisdom, Dexterity,
  Constitution, Charisma; `9` means "no modifier";
- `\` separates the variants of a series (the modifiers are reversed); `|` ends the series;
- `*` marks a limited trait, `^` a trait for humanoids only, `+` a trait that "Great" can be added to; the
  `___` are to be filled in by hand;
- `END|` ends the data, followed by a notice. The program accepts at most 200 series.

The shipped file has 196 series, that is 426 traits.

## `HEROES.CLR` — the colours

6 bytes: three 16-bit integers, the colour of the text, of the background, and of the frame and labels (VGA
colours 0 to 15). The shipped file contains 7, 0, 12: grey text, black background, red frame. Both programs
rewrite it after each Alt+digit; a 0 for the text or the frame is replaced by 14 or 6.

## Name generation

Names come from no list: they are put together at random, syllable by syllable, from a few strings of letters
compiled into `Heroes.exe`. Neither the race nor the sex influences the name itself.

1. **Number of words**: 1 or 2 (even chance), plus one word in 10 % of cases, so up to 3.
2. **Each word** gets a single vowel, kept for the whole word, drawn from `aaaeeeiiou` (a and e 30 %, i 20 %,
   o and u 10 %). It has 1 to 3 syllables when alone, 1 or 2 in a two-word name, 1 in a three-word name. For
   each syllable:
   - **hyphen**: 2 % chance from the 2nd syllable on;
   - **onset consonant**, except when the previous syllable ended with a consonant, or for the 1st syllable
     in 20 % of cases. One letter of `bcdffgghjkkllmmnnprssttvwxyzz` (f, g, k, l, m, n, s, t and z are there
     twice); in 30 % of cases a pair (br, bl, ch, cl, cr, dr, fr, fl, gr, gl, kr, kh, kl, pr, ph, pl, qu, sh,
     sl, st, sp, sk, th, tr); in 2 % of cases str or skl;
   - **vowel**: 90 % the word's vowel; otherwise, from the 2nd syllable on, `y` one time in ten; otherwise a
     diphthong among ai, au, aw, ay, ea, ee, ei, eu, ew, ey, ia, ie, oi, oo, ou, ow, oy. After a diphthong,
     the following syllables go back to the word's vowel;
   - **final consonant**, left out in 10 % of cases for an inner syllable that has an onset, and in 30 % of
     cases for the last one. One letter of `dfgklmnrstxz`; then, drawn one after the other (the last one that
     succeeds wins): ng, sh, st, ch, sk, th (25 %); dd, ff, gg, kk, ll, mm, nn, pp, rr, ss, tt, zz, nt, nd, ns
     (12 %); rc, rd, rf, rg, rk, rl, rm, rn, rs, rt (9 %); rsh, rst, rch, rsk, rth (5 %).

   A word shorter than 4 letters is made again, with the same vowel.

3. **Capitals**: the first letter of each word; after a hyphen, in 80 % of cases.
4. A name shorter than 5 or longer than 25 characters is made again entirely, number of words included.
5. **Titles**, added depending on the character:

   | Title                  | Who gets it                                           |
   | ---------------------- | ----------------------------------------------------- |
   | `Sir` / `Dame`         | paladins                                              |
   | `Master` / `Mistress`  | single-class magic-users above level 8                |
   | `Mr.` / `Ms.`          | brownies                                              |
   | `Agent`                | tabaxi assassins                                      |
   | `the Elder` (at the end) | white elves with more than a million experience points |

Example from a sheet of the real program: "Inis Yamarf".

**Without names** (N set to "No"), the number of words is still drawn, which uses up a random number and
shifts everything after it; the name then stays empty and the titles are not added, except "the Elder". The
`.HRO` sheet leaves a blank instead of the name and the HTML sheet shows `NPC Name _________________`.

As everywhere in the program, every "x % of cases" test draws a random number, even when the other condition
of the test is already false: QuickBASIC always evaluates both sides of an `AND`. The port does the same,
otherwise the following characters would differ.

## Files created by the program

- **`.HRO`**: the character sheet as text (80 columns), named after the character: `_` followed by the first
  seven letters of the name, spaces replaced by `_` (e.g. `_LIMMICH.HRO`).
- **`.HTM`**: the same sheet as HTML, named after the first eight letters of the name.
- **Printer**: the sheet is sent to LPT1, with printer codes (double-width lines). The spell table triggers an
  error 52 in the original program there, which shows a message and waits for a key.
