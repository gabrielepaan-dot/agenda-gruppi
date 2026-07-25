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
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.getCtx();
  }

  beep(long = false) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const duration = long ? 0.4 : 0.15;
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.01);
  }

  /** Final 3-2-1 countdown: short beep, short beep, long beep — never spoken. */
  playCountdownBeep(remaining: number) {
    this.beep(remaining <= 1);
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
