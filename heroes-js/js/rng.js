window.Heroes = window.Heroes || {};

// RND of the QuickBASIC 4.5 runtime linked into Heroes.exe (segment 1687, offset 63d4): a 24-bit linear
// congruential generator whose state is also the returned value, as a fraction of 2^24. The program never
// calls RANDOMIZE; it calls RND(1) in its key-wait loop, so the state reached when a character starts
// depends on how long the player waited. Any of the 2^24 states can therefore start a character.
Heroes.RND_PERIOD = 0x1000000;
Heroes.RND_START = 0x50000;

Heroes.rndNext = (state) => (Math.imul(state, 0xfd43fd) + 0xc39ec3) & 0xffffff;

Heroes.createRng = (seed) => {
	let state = seed & 0xffffff;
	return {
		random: () => {
			state = Heroes.rndNext(state);
			return state / Heroes.RND_PERIOD;
		},
		get state() { return state; },
	};
};

Heroes.newSeed = () => Math.floor(Math.random() * Heroes.RND_PERIOD);
