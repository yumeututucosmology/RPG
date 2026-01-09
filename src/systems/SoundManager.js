import { SoundLibrary } from './SoundConfig.js';

/**
 * サウンドマネージャークラス
 * 音の再生、ボリューム管理、プロシージャルサウンド生成を行う
 */
export class SoundManager {
    constructor() {
        this.context = null; // 遅延初期化
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

    /**
     * オーディオコンテキストの初期化
     */
    init() {
        if (!this.context) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
            this.createNoiseBuffer(); // ノイズバッファの事前生成
        }
    }

    /**
     * ミュート切替
     * @param {string} param - 'master', 'bgm', 'se'
     */
    toggleMute(param) {
        if (this.muted.hasOwnProperty(param)) {
            this.muted[param] = !this.muted[param];
            console.log(`[SoundManager] ${param} muted: ${this.muted[param]}`);
        }
    }

    /**
     * ミュート状態の取得
     */
    isMuted(param) {
        return this.muted[param];
    }

    /**
     * 実効ボリュームの計算（ミュート考慮）
     */
    getEffectiveVolume(param) {
        if (this.muted.master) return 0;
        if (this.muted[param]) return 0;
        return this.volume[param];
    }

    /**
     * ノイズ用バッファの生成（ホワイトノイズ）
     */
    createNoiseBuffer() {
        if (!this.context) return;
        const bufferSize = this.context.sampleRate * 2.0; // 2秒分
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.noiseBuffer = buffer;
    }

    /**
     * コンテキストの再開（ブラウザ制限対策）
     */
    resumeContext() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume().then(() => {
                console.log("[SoundManager] AudioContext Resumed");
            });
        }
    }

    /**
     * SE再生
     * @param {string} name - SoundConfigで定義された名前
     */
    playSE(name) {
        if (!this.context) this.init();

        // コンテキストがサスペンド状態なら再開を試みる
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

    /**
     * プロシージャル（合成）サウンドの生成と再生
     * @param {object} config - サウンド設定オブジェクト
     */
    playProceduralSound(config) {
        if (!this.context) return;

        const t = this.context.currentTime;
        const gain = this.context.createGain();
        let source;

        // 1. 音源生成 (Oscillator or Noise)
        if (config.type === 'noise') {
            if (!this.noiseBuffer) {
                this.createNoiseBuffer();
                if (!this.noiseBuffer) return;
            }
            const bufferSource = this.context.createBufferSource();
            bufferSource.buffer = this.noiseBuffer;

            // ピッチ（再生速度）のランダム変動
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

            // 周波数エンベロープ（ピッチ変動）
            if (config.freq) {
                osc.frequency.setValueAtTime(config.freq.start, t);
                if (config.freq.end !== config.freq.start) {
                    const duration = config.freq.duration || config.duration || 0.1;
                    try {
                        // 指数関数的な変化（自然な音程変化）
                        osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, config.freq.end), t + duration);
                    } catch (e) {
                        osc.frequency.linearRampToValueAtTime(config.freq.end, t + duration);
                    }
                }
            }
            source = osc;
        } else {
            return; // 不明なタイプ
        }

        // 2. オーディオグラフの構築
        // Source -> (Filter) -> Gain -> Destination

        let outputNode = source;

        // フィルタ（オプション）
        if (config.filter) {
            const filter = this.context.createBiquadFilter();
            filter.type = config.filter.type;

            if (config.filter.type === 'bandpass' && config.filter.freqStart && config.filter.freqEnd) {
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

        // 3. ボリュームエンベロープ
        const rawVol = this.getEffectiveVolume('master') * this.getEffectiveVolume('se');
        const multiplier = config.volumeMultiplier || 1.0;
        const targetVol = rawVol * multiplier;

        // 最適化: 音量がほぼゼロなら再生しない（処理負荷軽減＆バグ防止）
        if (targetVol < 0.001) {
            return;
        }

        gain.gain.setValueAtTime(0, t);

        const attack = config.gain.attack || 0.01;
        const decay = config.gain.decay || 0.1;

        // Attack (立ち上がり)
        gain.gain.linearRampToValueAtTime(targetVol, t + attack);
        // Decay (減衰)
        gain.gain.exponentialRampToValueAtTime(0.01, t + attack + decay);

        // 4. 再生開始と停止予約
        const duration = config.duration || (attack + decay);
        source.start(t);
        source.stop(t + duration + 0.1); // 余韻を含めて少し余裕を持たせる
    }

    /**
     * BGM再生（未実装）
     */
    playBGM(name) {
        console.log(`[SoundManager] Play BGM: ${name} (Not implemented)`);
    }

    /**
     * 音量設定
     */
    setVolume(type, value) {
        if (this.volume[type] !== undefined) {
            this.volume[type] = Math.max(0, Math.min(1, value));
            console.log(`[SoundManager] Set ${type} volume to ${this.volume[type]}`);
        }
    }
}
