// Procedural Web Audio API Synthesizer for OUT OF SIGHT (Street Edition)
class AudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private lastFootstepTime: number = 0;
  private lastSirenTime: number = 0;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playFootstep(mode: 'crouch' | 'walk' | 'run') {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const minInterval = mode === 'run' ? 0.25 : mode === 'walk' ? 0.42 : 0.62;
    if (now - this.lastFootstepTime < minInterval) return;
    this.lastFootstepTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = mode === 'run' ? 125 : mode === 'walk' ? 92 : 65;
    const volume = mode === 'run' ? 0.13 : mode === 'walk' ? 0.065 : 0.028;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq + Math.random() * 16, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.075);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.085);
  }

  // Dramatic dual-horn & siren when the "参保直通车" arrives in the street cutscene
  public playVanArrivalHorn() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Dual-tone truck air horn (F4 + A4)
    [349.23, 440.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.98, now + 0.35);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    });

    // Second short blast
    [349.23, 440.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + 0.46);
      gain.gain.setValueAtTime(0.11, now + 0.46);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.46);
      osc.stop(now + 1.08);
    });
  }

  public playDoorSlideOpen() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.25);
    osc.frequency.setValueAtTime(480, now + 0.26);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playGuardWhistle() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2450, now);
    osc.frequency.linearRampToValueAtTime(2780, now + 0.12);
    osc.frequency.setValueAtTime(2520, now + 0.18);
    osc.frequency.linearRampToValueAtTime(2850, now + 0.38);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.065);

      gain.gain.setValueAtTime(0.12, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.26);
    });
  }

  public playSnackEat() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [587.33, 783.99, 1174.66];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.05);
      osc.frequency.exponentialRampToValueAtTime(f * 1.15, now + idx * 0.05 + 0.14);

      gain.gain.setValueAtTime(0.13, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.17);
    });
  }

  public playHideToggle(entering: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (entering) {
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.14);
    }

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playAlertPing(level: 'suspicious' | 'spotted') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (level === 'suspicious') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(587.33, now + 0.16);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      [0, 0.12].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(i === 0 ? 740 : 987.77, now + offset);
        gain.gain.setValueAtTime(0.14, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.2);
      });
    }
  }

  public playSirenPulse(distanceToPlayer: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastSirenTime < 1.1) return;
    if (distanceToPlayer > 55) return;
    this.lastSirenTime = now;

    const atten = Math.max(0.01, Math.min(0.08, (1 - distanceToPlayer / 55) * 0.075));
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.linearRampToValueAtTime(790, now + 0.45);
    osc.frequency.linearRampToValueAtTime(560, now + 0.9);

    gain.gain.setValueAtTime(atten, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.98);
  }

  public playVictory() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n, now + i * 0.09);
      gain.gain.setValueAtTime(0.15, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.46);
    });
  }

  public playThrowablePickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 659.25];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.045);
      gain.gain.setValueAtTime(0.1, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.13);
    });
  }

  public playThrowWhoosh() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playHitOfficerBonk() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Hollow coconut/cartoon BONK impact
    const bonkOsc = ctx.createOscillator();
    const bonkGain = ctx.createGain();
    bonkOsc.type = 'sine';
    bonkOsc.frequency.setValueAtTime(210, now);
    bonkOsc.frequency.exponentialRampToValueAtTime(620, now + 0.045);
    bonkOsc.frequency.exponentialRampToValueAtTime(140, now + 0.15);
    bonkGain.gain.setValueAtTime(0.24, now);
    bonkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    bonkOsc.connect(bonkGain);
    bonkGain.connect(ctx.destination);
    bonkOsc.start(now);
    bonkOsc.stop(now + 0.17);

    // 2. Dizzy cartoon stars tweet
    const dizzyNotes = [880, 1174.66, 987.77, 1318.5];
    dizzyNotes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + 0.08 + idx * 0.06);
      gain.gain.setValueAtTime(0.11, now + 0.08 + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08 + idx * 0.06 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.08 + idx * 0.06);
      osc.stop(now + 0.08 + idx * 0.06 + 0.13);
    });
  }

  public playHitCarDent() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Heavy metallic CLANG-CRUNCH
    [135, 195, 285].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.52, now + 0.28);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
    });

    // 2. Car alarm double chirp
    [0.12, 0.26].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1046.5, now + offset);
      gain.gain.setValueAtTime(0.09, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }

  public playCaptured() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [311.13, 277.18, 233.08, 174.61];
    notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n, now + i * 0.12);
      gain.gain.setValueAtTime(0.14, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.36);
    });
  }

  private heartbeatTimer = 0;

  /**
   * Proximity Heartbeat System:
   * - Completely silent when minDistance >= 28m (walk away -> heartbeat disappears).
   * - As player gets closer (< 28m down to 3m), BPM ramps from 68 -> 170 and chest-thump volume intensifies.
   */
  public updateProximityHeartbeat(
    minDistance: number,
    dt: number
  ): { intensity: number; bpm: number } {
    const MAX_HEARTBEAT_DIST = 28.0;
    const MIN_HEARTBEAT_DIST = 3.2;

    if (minDistance >= MAX_HEARTBEAT_DIST) {
      this.heartbeatTimer = 0;
      return { intensity: 0, bpm: 0 };
    }

    const normalized = Math.max(
      0,
      Math.min(1, (MAX_HEARTBEAT_DIST - minDistance) / (MAX_HEARTBEAT_DIST - MIN_HEARTBEAT_DIST))
    );
    const intensity = Math.pow(normalized, 1.3);
    const bpm = Math.round(68 + intensity * 102); // 68 BPM (far) -> 170 BPM (very close)
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
    if (!ctx || intensity <= 0.01) return;
    const now = ctx.currentTime;

    // Gain scales strongly with proximity intensity (quiet pulse far away, visceral thump up close)
    const peakGain = 0.045 + intensity * 0.36;

    // "LUB" (First deep systolic thump)
    const osc1 = ctx.createOscillator();
    const sub1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    sub1.type = 'triangle';
    osc1.frequency.setValueAtTime(90 + intensity * 18, now);
    osc1.frequency.exponentialRampToValueAtTime(34, now + 0.11);
    sub1.frequency.setValueAtTime(56, now);
    sub1.frequency.exponentialRampToValueAtTime(26, now + 0.11);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(peakGain, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    sub1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    sub1.start(now);
    osc1.stop(now + 0.13);
    sub1.stop(now + 0.13);

    // "DUB" (Second tighter diastolic thump ~0.13s later)
    const dubDelay = Math.max(0.1, 0.15 - intensity * 0.04);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(78 + intensity * 14, now + dubDelay);
    osc2.frequency.exponentialRampToValueAtTime(30, now + dubDelay + 0.09);

    gain2.gain.setValueAtTime(0.001, now + dubDelay);
    gain2.gain.linearRampToValueAtTime(peakGain * 0.8, now + dubDelay + 0.012);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + dubDelay + 0.1);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + dubDelay);
    osc2.stop(now + dubDelay + 0.11);
  }

  public playTaskSpeedUpAlert() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [523.25, 659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.09, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.16);
    });
  }
}

export const soundFX = new AudioSystem();
