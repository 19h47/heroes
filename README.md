# HEROES — Adventure Character Generator

Character generator for _AD&D_ 1st edition, a DOS program by critterhaven software (1993–1998) written in QuickBASIC 4.5. Every key press makes a new, complete character: ability scores, race, class, levels, equipment, spells, personality traits and name. The character can then be printed or saved to a file.

This repository keeps the original program and a faithful web port of it, checked sheet by sheet against the real program running in DOSBox.

## Why this port

I used HEROES for real, on the family Windows 98 PC, at the end of the 1990s. I was finishing middle school and playing a lot of Dungeons & Dragons, and I made a great many characters with it. I have always kept a copy, but as the years went by it became harder and harder to run, and I am on a Mac now.

So I took it apart. With the help of an AI coding assistant, the two compiled QuickBASIC programs were unpacked, disassembled and decompiled, and every table, rule and random draw was carried over to JavaScript. The port does not imitate HEROES: it replays it. Given the same settings and the same random state, it makes the same characters as the original, which `.re/` checks against sessions of the real program captured in DOSBox. It now runs in any browser, at [19h47.github.io/heroes](https://19h47.github.io/heroes/).

## The repository

| Folder       | Contents                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------- |
| `original/`  | The original program, as it was; it runs in DOSBox (`HEROES.EXE`)                            |
| `heroes-js/` | The web port: open `index.html`; `node heroes-js/test/smoke.js` runs the tests                |
| `.re/`       | The reverse engineering: decompiled code (`*.bas`), disassembly and tools that compare the port with the original |

How the original program works, the format of each of its files and how names are generated are described in [`original/README.md`](original/README.md).

The Python tools of `.re/` are installed with `python3 -m venv .re/venv && .re/venv/bin/pip install -r .re/requirements.txt`. The captures in `.re/dos/` are not versioned: `.re/capture.sh` makes them again with DOSBox Staging.

## GitHub Pages

`.github/workflows/pages.yml` runs the tests and publishes `heroes-js/` on every push to `main` that changes it. To turn it on, set _Settings → Pages → Source_ to _GitHub Actions_.

## Credits

- **HEROES** — © 1993 critterhaven software, by töff (gzweb@qnis.net, formerly http://www.geocities.com/Area51/Vault/1642). The original files, and the game data, tables and traits reproduced in the port and in `.re/`, remain the work of their author.
- **IBM VGA 9×16 font** — from [The Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) by VileR, licensed under [CC BY-SA 4.0](heroes-js/fonts/LICENSE.TXT).

This is an unofficial, non-commercial tribute, made to keep a program that has disappeared from the internet alive and playable. If you are the author of HEROES or hold its rights and would like this repository changed or taken down, please open an issue.
