import { db } from './db';

export type PhraseKey = 'prepara' | 'lavora' | 'riposa' | 'completato';

export const PHRASE_TEXT: Record<PhraseKey, string> = {
  prepara: 'Preparati',
  lavora: 'Lavora',
  riposa: 'Riposa',
  completato: 'Allenamento completato',
};

export type VoiceMode = { kind: 'computer' } | { kind: 'profile'; profileId: number };

export type VoiceSelection =
  | { mode: 'computer'; computerVoiceURI: string }
  | { mode: 'profile'; profileId: number; computerVoiceURI: string };

export class TimerAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private computerVoiceURI = '';
  private mode: VoiceMode = { kind: 'computer' };

  setComputerVoice(voiceURI: string) {
    this.computerVoiceURI = voiceURI;
  }

  setMode(mode: VoiceMode) {
    this.mode = mode;
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      // A compressor/limiter ahead of the destination lets every tone run its gain
      // close to full scale without risking clipping — this is what makes the beeps
      // audible over gym noise at max phone volume (small phone speakers otherwise
      // reproduce a soft, low-gain sine tone very quietly compared to a limited signal).
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      compressor.knee.setValueAtTime(6, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.15, this.ctx.currentTime);
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.getCtx();
  }

  private tone(freq: number, duration: number, peak: number, type: OscillatorType, startAt = 0) {
    const ctx = this.getCtx();
    const now = ctx.currentTime + startAt;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Short/long beep, e.g. for the 3-2-1 countdown. Square wave: louder-feeling on
   * small phone speakers than a pure sine at the same peak gain, thanks to its
   * harmonic content. */
  beep(long = false) {
    this.tone(1318.5, long ? 0.45 : 0.16, 0.9, 'square');
  }

  /** Final 3-2-1 countdown: short beep, short beep, long beep — never spoken. */
  playCountdownBeep(remaining: number) {
    this.beep(remaining <= 1);
  }

  /** Bright two-note chime marking the exact instant a work phase starts. */
  playWorkStartBell() {
    this.tone(1568, 0.55, 0.95, 'triangle');
    this.tone(2093, 0.5, 0.6, 'triangle', 0.04);
  }

  speakText(text: string) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'it-IT';
    if (this.computerVoiceURI) {
      const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === this.computerVoiceURI);
      if (voice) utter.voice = voice;
    }
    speechSynthesis.speak(utter);
  }

  async speakPhrase(key: PhraseKey) {
    if (this.mode.kind === 'profile') {
      const recording = await db.voiceRecordings
        .where({ targetType: 'phrase', phraseKey: key, profileId: this.mode.profileId })
        .first();
      if (recording) {
        this.playBlob(recording.audioBlob);
        return;
      }
    }
    this.speakText(PHRASE_TEXT[key]);
  }

  async speakExercise(exerciseId: number) {
    const recording = await db.voiceRecordings.where({ targetType: 'exercise', exerciseId }).first();
    if (recording) {
      this.playBlob(recording.audioBlob);
      return;
    }
    const ex = await db.exercises.get(exerciseId);
    if (ex) this.speakText(ex.name);
  }

  private playBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(() => URL.revokeObjectURL(url));
  }
}
