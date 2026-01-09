export const SoundLibrary = {
    // Jump Sound: Square wave, rising pitch (NES style)
    jump: {
        type: 'oscillator',
        oscType: 'square',
        freq: { start: 150, end: 600, duration: 0.1 },
        gain: { attack: 0.01, decay: 0.2 },
        volumeMultiplier: 1.0,
        duration: 0.2
    },

    // Walk Sound: Noise with Lowpass filter, Pitch variance
    walk: {
        type: 'noise',
        filter: { type: 'lowpass', freq: 1000 },
        gain: { attack: 0.005, decay: 0.02 }, // Extremely short tick
        pitchVariance: { min: 0.8, max: 1.2 },
        volumeMultiplier: 2.0,
        duration: 0.05
    },

    // Menu Open: High pitch sine ping
    menu_open: {
        type: 'oscillator',
        oscType: 'sine',
        freq: { start: 880, end: 1760, duration: 0.1 },
        gain: { attack: 0.02, decay: 0.5 },
        volumeMultiplier: 0.8,
        duration: 0.5
    },

    // Cursor Move: Short triangle blip
    cursor: {
        type: 'oscillator',
        oscType: 'triangle',
        freq: { start: 440, end: 440, duration: 0.1 },
        gain: { attack: 0.01, decay: 0.1 },
        volumeMultiplier: 0.5,
        duration: 0.1
    },

    // Select: Positive square chirp
    select: {
        type: 'oscillator',
        oscType: 'square',
        freq: { start: 440, end: 880, duration: 0.1 },
        gain: { attack: 0.02, decay: 0.3 },
        volumeMultiplier: 0.6,
        duration: 0.3
    },

    // Cancel: Sliding down triangle
    cancel: {
        type: 'oscillator',
        oscType: 'triangle',
        freq: { start: 330, end: 220, duration: 0.1 },
        gain: { attack: 0.02, decay: 0.2 },
        volumeMultiplier: 1.8,
        duration: 0.2
    },

    // Sword Swing: Bandpass filtered noise (Swish)
    sword: {
        type: 'noise',
        filter: { type: 'bandpass', freqStart: 800, freqEnd: 3200, duration: 0.1, Q: 1.0 },
        gain: { attack: 0.05, decay: 0.2 },
        pitchVariance: { min: 1.0, max: 1.4 },
        volumeMultiplier: 1.5,
        duration: 0.2
    }
};
