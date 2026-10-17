// Warm, Balanced Procedural Web Audio Synthesizer & Commercial-Safe BGM Engine for OUT OF SIGHT

export type BgmTrackId =
  | 'sneaky_snitch_cloud'
  | 'sneaky_pizzicato'
  | 'noir_spy_jazz'
  | 'caper_chase_groove'
  | 'off';

export interface BgmTrackInfo {
  id: BgmTrackId;
  name: string;
  subtitle: string;
  license: string;
}

export const BGM_TRACKS: ReadonlyArray<BgmTrackInfo> = [
  {
    id: 'sneaky_pizzicato',
    name: '🎵 街角鬼祟·拨弦 (Sneaky Pizzicato)',
    subtitle: '提琴拨弦 + 巴松管低音 · 追捕时自动加速变奏',
    license: 'CC0 1.0 原生合成 (免版权可直接商用)',
  },
  {
    id: 'noir_spy_jazz',
    name: '🎷 午夜特工·爵士 (Noir Spy Jazz)',
    subtitle: 'Walking Bass 大提琴 + 悬疑电钢琴切分律动',
    license: 'CC0 1.0 原生合成 (免版权可直接商用)',
  },
  {
    id: 'caper_chase_groove',
    name: '🥁 街头周旋·律动 (Scheming Caper)',
    subtitle: '轻快木琴与放克低音 · 适合多保安刺激周旋',
    license: 'CC0 1.0 原生合成 (免版权可直接商用)',
  },
  {
    id: 'sneaky_snitch_cloud',
    name: '🌐 Sneaky Snitch (Kevin MacLeod 原曲)',
    subtitle: '经典搞笑潜行神曲 · Wikimedia 云端流媒体',
    license: 'CC BY 3.0/4.0 (署名 Kevin MacLeod 即可免费商用)',
  },
  {
    id: 'off',
    name: '🔇 关闭背景音乐 (仅保留音效)',
    subtitle: '静音 BGM，专注聆听心跳与脚步声',
    license: '-',
  },
];

// Wikimedia Commons official hosted CC-BY OGG file for Kevin MacLeod - Sneaky Snitch
const WIKIMEDIA_SNEAKY_SNITCH_URL =
  'https://upload.wikimedia.org/wikipedia/commons/4/46/Kevin_MacLeod_%7E_Sneaky_Snitch.ogg';

class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isMuted: boolean = false;
  private masterVolume: number = 0.65;
  private bgmVolume: number = 0.42;
  private currentBgmTrack: BgmTrackId = 'sneaky_pizzicato';
  private isBgmPlaying: boolean = false;
  private isChaseTension: boolean = false;
  private bgmStepIndex: number = 0;
  private bgmIntervalId: number | null = null;
  private cloudAudioEl: HTMLAudioElement | null = null;
  private cloudAudioFailed: boolean = false;

  // Built-in debounce timestamps to prevent overlapping sound spam
  private lastFootstepTime: number = 0;
  private footstepLeftRight: boolean = false;
  private lastSirenTime: number = 0;
  private lastWhistleTime: number = 0;
  private lastAlertTime: number = 0;
  private lastAlarmTime: number = 0;
  private heartbeatTimer: number = 0;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        this.ctx = ctx;

        // Warm master low-pass filter to eliminate harsh high-frequency digital piercing
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2400;
        filter.Q.value = 0.7;

        // Soft studio limiter/compressor to prevent clipping when multiple events occur
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 18;
        comp.ratio.value = 6;
        comp.attack.value = 0.005;
        comp.release.value = 0.18;

        const gain = ctx.createGain();
        gain.gain.value = this.masterVolume;

        const bgmBus = ctx.createGain();
        bgmBus.gain.value = this.bgmVolume;

        filter.connect(comp);
        bgmBus.connect(comp);
        comp.connect(gain);
        gain.connect(ctx.destination);

        this.masterFilter = filter;
        this.compressor = comp;
        this.masterGain = gain;
        this.bgmGain = bgmBus;

        // Pre-build a short pink/soft noise buffer for realistic sneaker footsteps & brush hi-hats
        const sr = ctx.sampleRate;
        const buf = ctx.createBuffer(1, Math.floor(sr * 0.25), sr);
        const data = buf.getChannelData(0);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.099;
          b1 = 0.963 * b1 + white * 0.296;
          b2 = 0.57 * b2 + white * 0.952;
          data[i] = (b0 + b1 + b2 + white * 0.18) * 0.15;
        }
        this.noiseBuffer = buf;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getOutputNode(): AudioNode | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    return this.masterFilter || ctx.destination;
  }

  private scheduleDisconnect(source: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
    source.onended = () => {
      try {
        source.disconnect();
        for (let i = 0; i < nodes.length; i++) {
          nodes[i].disconnect();
        }
      } catch {
        // Ignore if already disconnected
      }
    };
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0.0001 : this.masterVolume,
        this.ctx.currentTime,
        0.02
      );
    }
    if (this.cloudAudioEl) {
      this.cloudAudioEl.muted = muted;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
    if (this.cloudAudioEl) {
      this.cloudAudioEl.volume = Math.max(0, Math.min(1, this.masterVolume * this.bgmVolume));
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  // ============================================================================
  // COMMERCIAL-SAFE MULTI-TRACK BACKGROUND MUSIC (BGM) ENGINE
  // ============================================================================

  public setBgmTrack(trackId: BgmTrackId) {
    if (this.currentBgmTrack === trackId && this.isBgmPlaying) return;
    this.currentBgmTrack = trackId;
    this.bgmStepIndex = 0;

    if (trackId === 'off') {
      this.stopBgm();
      return;
    }

    if (this.isBgmPlaying) {
      this.stopBgm();
      this.startBgm();
    }
  }

  public getBgmTrack(): BgmTrackId {
    return this.currentBgmTrack;
  }

  public setChaseTension(chasing: boolean) {
    this.isChaseTension = chasing;
    if (this.cloudAudioEl && !this.cloudAudioEl.paused) {
      this.cloudAudioEl.playbackRate = chasing ? 1.12 : 1.0;
    }
  }

  public startBgm() {
    if (this.currentBgmTrack === 'off') return;
    this.isBgmPlaying = true;
    this.ensureContext();

    if (this.currentBgmTrack === 'sneaky_snitch_cloud' && !this.cloudAudioFailed) {
      this.stopProceduralLoop();
      this.startCloudAudio();
      return;
    }

    this.stopCloudAudio();
    this.startProceduralLoop();
  }

  public stopBgm() {
    this.isBgmPlaying = false;
    this.stopProceduralLoop();
    this.stopCloudAudio();
  }

  private startCloudAudio() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.cloudAudioEl) {
        const audio = new Audio(WIKIMEDIA_SNEAKY_SNITCH_URL);
        audio.crossOrigin = 'anonymous';
        audio.loop = true;
        audio.onerror = () => {
          // Automatically fall back to procedural Sneaky Pizzicato if offline or blocked
          this.cloudAudioFailed = true;
          if (this.isBgmPlaying && this.currentBgmTrack === 'sneaky_snitch_cloud') {
            this.startProceduralLoop();
          }
        };
        this.cloudAudioEl = audio;
      }
      this.cloudAudioEl.muted = this.isMuted;
      this.cloudAudioEl.volume = Math.max(0, Math.min(1, this.masterVolume * this.bgmVolume));
      this.cloudAudioEl.playbackRate = this.isChaseTension ? 1.12 : 1.0;
      const playPromise = this.cloudAudioEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // If autoplay or network fails, use procedural fallback seamlessly
          this.startProceduralLoop();
        });
      }
    } catch {
      this.startProceduralLoop();
    }
  }

  private stopCloudAudio() {
    if (this.cloudAudioEl) {
      try {
        this.cloudAudioEl.pause();
      } catch {
        // ignore
      }
    }
  }

  private startProceduralLoop() {
    if (this.bgmIntervalId !== null) return;
    // Tick every 210ms (~142 BPM eighth-note grid)
    this.bgmIntervalId = window.setInterval(() => {
      if (!this.isBgmPlaying || this.isMuted || this.currentBgmTrack === 'off') return;
      this.playProceduralBgmStep();
    }, 210);
  }

  private stopProceduralLoop() {
    if (this.bgmIntervalId !== null) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  private playProceduralBgmStep() {
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const step = this.bgmStepIndex % 16;
    this.bgmStepIndex += 1;

    const track =
      this.currentBgmTrack === 'sneaky_snitch_cloud'
        ? 'sneaky_pizzicato'
        : this.currentBgmTrack;

    // 1. Track A: "Sneaky Pizzicato" (Incompetech Sneaky Snitch / Scheming Weasel inspired C-minor sneaky caper)
    if (track === 'sneaky_pizzicato') {
      // Bassoon / Upright Bass walking staccato on even steps
      const bassNotes = [
        130.81, 0, 155.56, 0, 174.61, 0, 196.0, 185.0,
        130.81, 0, 196.0, 0, 164.81, 0, 146.83, 196.0,
      ];
      // Quirky Pizzicato violin melody
      const pizzMelody = [
        523.25, 0, 622.25, 587.33, 0, 523.25, 493.88, 0,
        392.0, 440.0, 466.16, 0, 392.0, 0, 523.25, 0,
      ];
      const chaseMelody = [
        523.25, 587.33, 622.25, 698.46, 783.99, 698.46, 622.25, 587.33,
        523.25, 0, 622.25, 0, 783.99, 698.46, 622.25, 587.33,
      ];

      const bFreq = bassNotes[step];
      if (bFreq > 0) {
        this.triggerPluckNote(ctx, now, bFreq, 'triangle', 0.09, 0.15, 680);
      }

      const mFreq = this.isChaseTension ? chaseMelody[step] : pizzMelody[step];
      if (mFreq > 0) {
        this.triggerPluckNote(
          ctx,
          now,
          this.isChaseTension ? mFreq * 1.05 : mFreq,
          'sine',
          0.065,
          0.095,
          1800
        );
      }

      if (step % 4 === 2 || (this.isChaseTension && step % 2 === 1)) {
        this.triggerBrushHat(ctx, now, this.isChaseTension ? 0.032 : 0.02);
      }
      return;
    }

    // 2. Track B: "Noir Spy Jazz" (Pink Panther / Midnight Detective Walking Bass + Rhodes Chords)
    if (track === 'noir_spy_jazz') {
      const walkingBass = [
        110.0, 0, 130.81, 0, 146.83, 0, 155.56, 164.81,
        196.0, 0, 164.81, 0, 146.83, 0, 130.81, 123.47,
      ];
      const spyLead = [
        0, 440.0, 523.25, 0, 659.25, 622.25, 587.33, 0,
        0, 523.25, 493.88, 440.0, 0, 392.0, 440.0, 0,
      ];

      const wb = walkingBass[step];
      if (wb > 0) {
        this.triggerPluckNote(ctx, now, wb, 'sine', 0.11, 0.19, 520);
      }

      const sl = spyLead[step];
      if (sl > 0) {
        this.triggerPluckNote(ctx, now, sl, 'triangle', 0.055, 0.16, 1400);
      }

      // Swing brush hi-hat on steps 0, 2, 3, 4, 6, 7...
      if (step % 4 === 0 || step % 4 === 2 || step % 4 === 3) {
        this.triggerBrushHat(ctx, now, step % 4 === 2 ? 0.028 : 0.016);
      }
      return;
    }

    // 3. Track C: "Scheming Caper Groove" (Upbeat Marimba & Funky Bass)
    if (track === 'caper_chase_groove') {
      const funkBass = [
        146.83, 146.83, 0, 174.61, 196.0, 0, 220.0, 0,
        146.83, 0, 174.61, 185.0, 196.0, 0, 130.81, 146.83,
      ];
      const marimba = [
        587.33, 0, 698.46, 587.33, 880.0, 0, 783.99, 698.46,
        587.33, 698.46, 830.61, 880.0, 0, 783.99, 698.46, 0,
      ];

      const fb = funkBass[step];
      if (fb > 0) {
        this.triggerPluckNote(ctx, now, fb, 'triangle', 0.09, 0.13, 750);
      }

      const mr = marimba[step];
      if (mr > 0) {
        this.triggerPluckNote(ctx, now, mr, 'sine', 0.068, 0.085, 1900);
      }

      if (step % 2 === 1) {
        this.triggerBrushHat(ctx, now, 0.026);
      }
    }
  }

  private triggerPluckNote(
    ctx: AudioContext,
    now: number,
    freq: number,
    type: OscillatorType,
    peakGain: number,
    duration: number,
    cutoffHz: number
  ) {
    if (!this.bgmGain) return;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoffHz, now);
    lp.frequency.exponentialRampToValueAtTime(cutoffHz * 0.45, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.bgmGain);
    this.scheduleDisconnect(osc, lp, gain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private triggerBrushHat(ctx: AudioContext, now: number, peakGain: number) {
    if (!this.bgmGain || !this.noiseBuffer) return;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3200, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.bgmGain);
    this.scheduleDisconnect(noise, hp, gain);
    noise.start(now);
    noise.stop(now + 0.05);
  }

  // ============================================================================
  // IN-GAME SOUND EFFECTS (SFX)
  // ============================================================================

  /**
   * Soft, natural sneaker footstep tap (filtered noise + subtle low thump, alternating L/R pitch)
   */
  public playFootstep(mode: 'crouch' | 'walk' | 'run') {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;

    const now = ctx.currentTime;
    const minInterval = mode === 'run' ? 0.27 : mode === 'walk' ? 0.44 : 0.64;
    if (now - this.lastFootstepTime < minInterval) return;
    this.lastFootstepTime = now;
    this.footstepLeftRight = !this.footstepLeftRight;

    const pitchOffset = this.footstepLeftRight ? 1.0 : 0.92;
    const stepVol = mode === 'run' ? 0.048 : mode === 'walk' ? 0.026 : 0.012;

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime((mode === 'run' ? 520 : 380) * pitchOffset, now);
      bp.Q.setValueAtTime(1.8, now);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(stepVol * 1.15, now + 0.006);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(out);
      this.scheduleDisconnect(noise, bp, nGain);
      noise.start(now);
      noise.stop(now + 0.052);
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startFreq = (mode === 'run' ? 115 : mode === 'walk' ? 92 : 74) * pitchOffset;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.055);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(stepVol * 0.75, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(out);
    this.scheduleDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playVanArrivalHorn() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const playBlast = (startOffset: number, duration: number, peak: number) => {
      [293.66, 369.99].forEach((freq) => {
        const osc = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + startOffset);
        osc.frequency.linearRampToValueAtTime(freq * 0.99, now + startOffset + duration);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1100, now + startOffset);

        gain.gain.setValueAtTime(0.0001, now + startOffset);
        gain.gain.linearRampToValueAtTime(peak, now + startOffset + 0.025);
        gain.gain.setValueAtTime(peak * 0.85, now + startOffset + duration * 0.65);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

        osc.connect(lp);
        lp.connect(gain);
        gain.connect(out);
        this.scheduleDisconnect(osc, lp, gain);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration + 0.02);
      });
    };

    playBlast(0, 0.28, 0.055);
    playBlast(0.36, 0.48, 0.065);
  }

  public playDoorSlideOpen() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.22);
    osc.frequency.setValueAtTime(320, now + 0.23);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain);
    gain.connect(out);
    this.scheduleDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playGuardWhistle() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    if (now - this.lastWhistleTime < 1.2) return;
    this.lastWhistleTime = now;

    const osc = ctx.createOscillator();
    const trillOsc = ctx.createOscillator();
    const trillGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1460, now);
    osc.frequency.linearRampToValueAtTime(1580, now + 0.09);
    osc.frequency.setValueAtTime(1490, now + 0.14);
    osc.frequency.linearRampToValueAtTime(1560, now + 0.28);

    trillOsc.type = 'sine';
    trillOsc.frequency.setValueAtTime(26, now);
    trillGain.gain.setValueAtTime(45, now);

    trillOsc.connect(trillGain);
    trillGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.052, now + 0.018);
    gain.gain.setValueAtTime(0.045, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain);
    gain.connect(out);

    osc.onended = () => {
      try {
        osc.disconnect();
        trillOsc.disconnect();
        trillGain.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };

    trillOsc.start(now);
    osc.start(now);
    trillOsc.stop(now + 0.34);
    osc.stop(now + 0.34);
  }

  public playPickup() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, idx) => {
      const start = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.068, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playSnackEat() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 880.0];
    notes.forEach((f, idx) => {
      const start = now + idx * 0.048;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      osc.frequency.exponentialRampToValueAtTime(f * 1.08, start + 0.12);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  public playOutOfRange() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    [240, 185].forEach((f, idx) => {
      const start = now + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.09);
    });
  }

  public playHideToggle(entering: boolean) {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (entering) {
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.14);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(out);
    this.scheduleDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playAlertPing(level: 'suspicious' | 'spotted') {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    if (now - this.lastAlertTime < 0.45) return;
    this.lastAlertTime = now;

    if (level === 'suspicious') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(392.0, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.16);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      [659.25, 880.0].forEach((freq, i) => {
        const start = now + i * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.075, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);

        osc.connect(gain);
        gain.connect(out);
        this.scheduleDisconnect(osc, gain);
        osc.start(start);
        osc.stop(start + 0.19);
      });
    }
  }

  public playSirenPulse(distanceToPlayer: number) {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    if (now - this.lastSirenTime < 3.5) return;
    if (distanceToPlayer > 38) return;
    this.lastSirenTime = now;

    const atten = Math.max(0.005, Math.min(0.038, (1 - distanceToPlayer / 38) * 0.038));
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(587.33, now + 0.35);
    osc.frequency.linearRampToValueAtTime(440, now + 0.72);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(atten, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.76);

    osc.connect(gain);
    gain.connect(out);
    this.scheduleDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.78);
  }

  public playVictory() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => {
      const start = now + i * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.085, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.44);
    });
  }

  public playThrowablePickup() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const notes = [440, 587.33];
    notes.forEach((f, idx) => {
      const start = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  public playThrowWhoosh() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(gain);
    gain.connect(out);
    this.scheduleDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playHitOfficerBonk() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const bonkOsc = ctx.createOscillator();
    const bonkGain = ctx.createGain();
    bonkOsc.type = 'sine';
    bonkOsc.frequency.setValueAtTime(220, now);
    bonkOsc.frequency.exponentialRampToValueAtTime(520, now + 0.035);
    bonkOsc.frequency.exponentialRampToValueAtTime(150, now + 0.14);

    bonkGain.gain.setValueAtTime(0.0001, now);
    bonkGain.gain.linearRampToValueAtTime(0.12, now + 0.006);
    bonkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    bonkOsc.connect(bonkGain);
    bonkGain.connect(out);
    this.scheduleDisconnect(bonkOsc, bonkGain);
    bonkOsc.start(now);
    bonkOsc.stop(now + 0.16);

    const dizzyNotes = [659.25, 880, 783.99, 1046.5];
    dizzyNotes.forEach((f, idx) => {
      const start = now + 0.07 + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  public playHitCarDent() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    [130, 196, 260].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + 0.22);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(now);
      osc.stop(now + 0.25);
    });

    [0.11, 0.23].forEach((offset) => {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.09);
    });
  }

  public playCaptured() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const notes = [329.63, 293.66, 246.94, 196.0];
    notes.forEach((n, i) => {
      const start = now + i * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.075, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.34);
    });
  }

  public updateProximityHeartbeat(
    minDistance: number,
    dt: number
  ): { intensity: number; bpm: number } {
    const MAX_HEARTBEAT_DIST = 20.0;
    const MIN_HEARTBEAT_DIST = 3.2;

    if (minDistance >= MAX_HEARTBEAT_DIST) {
      this.heartbeatTimer = 0;
      return { intensity: 0, bpm: 0 };
    }

    const normalized = Math.max(
      0,
      Math.min(1, (MAX_HEARTBEAT_DIST - minDistance) / (MAX_HEARTBEAT_DIST - MIN_HEARTBEAT_DIST))
    );
    const intensity = Math.pow(normalized, 1.45);
    const bpm = Math.round(66 + intensity * 92);
    const intervalSec = 60 / bpm;

    this.heartbeatTimer += dt;
    if (this.heartbeatTimer >= intervalSec) {
      this.heartbeatTimer = 0;
      this.playHeartbeatPulse(intensity);
    }

    return { intensity, bpm };
  }

  private playHeartbeatPulse(intensity: number) {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out || intensity <= 0.03) return;
    const now = ctx.currentTime;

    const peakGain = 0.018 + intensity * 0.11;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(72 + intensity * 12, now);
    osc1.frequency.exponentialRampToValueAtTime(34, now + 0.1);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(peakGain, now + 0.016);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc1.connect(gain1);
    gain1.connect(out);
    this.scheduleDisconnect(osc1, gain1);
    osc1.start(now);
    osc1.stop(now + 0.12);

    const dubDelay = Math.max(0.11, 0.15 - intensity * 0.03);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(64 + intensity * 10, now + dubDelay);
    osc2.frequency.exponentialRampToValueAtTime(30, now + dubDelay + 0.085);

    gain2.gain.setValueAtTime(0.0001, now + dubDelay);
    gain2.gain.linearRampToValueAtTime(peakGain * 0.72, now + dubDelay + 0.014);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + dubDelay + 0.095);

    osc2.connect(gain2);
    gain2.connect(out);
    this.scheduleDisconnect(osc2, gain2);
    osc2.start(now + dubDelay);
    osc2.stop(now + dubDelay + 0.1);
  }

  public playTaskSpeedUpAlert() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    [440, 554.37, 659.25].forEach((freq, i) => {
      const start = now + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  public playMonitorDeploy() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.16);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(out);
    this.scheduleDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playMonitorTriggerAlarm() {
    const ctx = this.ensureContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;

    if (now - this.lastAlarmTime < 1.0) return;
    this.lastAlarmTime = now;

    [783.99, 987.77, 783.99].forEach((freq, idx) => {
      const start = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

      osc.connect(gain);
      gain.connect(out);
      this.scheduleDisconnect(osc, gain);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }
}

export const soundFX = new AudioSystem();
