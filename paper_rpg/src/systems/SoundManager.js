import { SoundLibrary } from './SoundConfig.js';

export class SoundManager {
    constructor() {
        this.context = null; // Lazy init
        this.volume = {
            master: 0.5,
            bgm: 0.5,
            se: 0.5
        };
        this.muted = {
            master: false,
            bgm: false,
            se: false
        };
    }

    init() {
        if (!this.context) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
            this.createNoiseBuffer(); // Pre-generate noise
        }
    }

    toggleMute(param) {
        if (this.muted.hasOwnProperty(param)) {
            this.muted[param] = !this.muted[param];
            console.log(`[SoundManager] ${param} muted: ${this.muted[param]}`);
        }
    }

    isMuted(param) {
        return this.muted[param];
    }

    getEffectiveVolume(param) {
        if (this.muted.master) return 0;
        if (this.muted[param]) return 0;
        return this.volume[param];
    }

    createNoiseBuffer() {
        if (!this.context) return;
        const bufferSize = this.context.sampleRate * 2.0; // 2 seconds of noise
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.noiseBuffer = buffer;
    }

    resumeContext() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume().then(() => {
                console.log("[SoundManager] AudioContext Resumed");
            });
        }
    }

    playSE(name) {
        if (!this.context) this.init();

        // Ensure context is running
        if (this.context.state === 'suspended') {
            this.resumeContext();
        }

        const config = SoundLibrary[name];
        if (config) {
            this.playProceduralSound(config);
        } else {
            console.warn(`[SoundManager] SE not found: ${name}`);
        }
    }

    playProceduralSound(config) {
        if (!this.context) return;

        const t = this.context.currentTime;
        const gain = this.context.createGain();
        let source;

        // 1. Create Source (Oscillator or Noise)
        if (config.type === 'noise') {
            if (!this.noiseBuffer) {
                this.createNoiseBuffer();
                if (!this.noiseBuffer) return;
            }
            const bufferSource = this.context.createBufferSource();
            bufferSource.buffer = this.noiseBuffer;

            // Pitch/Rate Variance
            let rate = 1.0;
            if (config.pitchVariance) {
                const min = config.pitchVariance.min || 1.0;
                const max = config.pitchVariance.max || 1.0;
                rate = min + Math.random() * (max - min);
            }
            bufferSource.playbackRate.value = rate;

            source = bufferSource;
        } else if (config.type === 'oscillator') {
            const osc = this.context.createOscillator();
            osc.type = config.oscType || 'sine';

            // Frequency Envelope
            if (config.freq) {
                osc.frequency.setValueAtTime(config.freq.start, t);
                if (config.freq.end !== config.freq.start) {
                    const duration = config.freq.duration || config.duration || 0.1;
                    // Choose ramp type based on preference, currently exponential for pitch is nice
                    try {
                        osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, config.freq.end), t + duration);
                    } catch (e) {
                        // Fallback for safety (e.g. freq <= 0)
                        osc.frequency.linearRampToValueAtTime(config.freq.end, t + duration);
                    }
                }
            }
            source = osc;
        } else {
            return; // Unknown type
        }

        // 2. Setup Audio Graph
        // Source -> (Filter) -> Gain -> Destination

        let outputNode = source;

        // Optional Filter
        if (config.filter) {
            const filter = this.context.createBiquadFilter();
            filter.type = config.filter.type;

            if (config.filter.type === 'bandpass' && config.filter.freqStart && config.filter.freqEnd) {
                // Frequency Ramp for Filter
                filter.frequency.setValueAtTime(config.filter.freqStart, t);
                filter.frequency.linearRampToValueAtTime(config.filter.freqEnd, t + (config.filter.duration || 0.1));
            } else {
                filter.frequency.value = config.filter.freq || 1000;
            }

            if (config.filter.Q) {
                filter.Q.value = config.filter.Q;
            }

            outputNode.connect(filter);
            outputNode = filter;
        }

        outputNode.connect(gain);
        gain.connect(this.context.destination);

        // 3. Volume Envelope
        const rawVol = this.getEffectiveVolume('master') * this.getEffectiveVolume('se');
        const multiplier = config.volumeMultiplier || 1.0;
        const targetVol = rawVol * multiplier;

        gain.gain.setValueAtTime(0, t);

        const attack = config.gain.attack || 0.01;
        const decay = config.gain.decay || 0.1;

        // Attack
        gain.gain.linearRampToValueAtTime(targetVol, t + attack);
        // Decay
        gain.gain.exponentialRampToValueAtTime(0.01, t + attack + decay);

        // 4. Start/Stop
        const duration = config.duration || (attack + decay);
        source.start(t);
        source.stop(t + duration + 0.1); // Add buffer time for decay
    }

    playBGM(name) {
        console.log(`[SoundManager] Play BGM: ${name} (Not implemented)`);
    }

    setVolume(type, value) {
        if (this.volume[type] !== undefined) {
            this.volume[type] = Math.max(0, Math.min(1, value));
            console.log(`[SoundManager] Set ${type} volume to ${this.volume[type]}`);
        }
    }
}
