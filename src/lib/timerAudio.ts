import { db } from './db';

export const PHRASE_TEXT: Record<'lavora' | 'riposa' | 'completato', string> = {
  lavora: 'Lavora',
  riposa: 'Riposa',
  completato: 'Allenamento completato',
};

export class TimerAudio {
  private ctx: AudioContext | null = null;

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

  beep() {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  speakText(text: string) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'it-IT';
    speechSynthesis.speak(utter);
  }

  speakNumber(n: number) {
    this.speakText(String(n));
  }

  async speakPhrase(key: 'lavora' | 'riposa' | 'completato') {
    const recording = await db.voiceRecordings.where({ targetType: 'phrase', phraseKey: key }).first();
    if (recording) {
      this.playBlob(recording.audioBlob);
      return;
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
