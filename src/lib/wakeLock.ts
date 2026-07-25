export class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  private handleVisibility = () => {
    if (this.wanted && document.visibilityState === 'visible' && !this.sentinel) {
      this.acquire();
    }
  };

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  async acquire() {
    this.wanted = true;
    if (!('wakeLock' in navigator)) return;
    try {
      this.sentinel = await (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      this.sentinel = null;
    }
  }

  async release() {
    this.wanted = false;
    try {
      await this.sentinel?.release();
    } catch {
      // ignore
    }
    this.sentinel = null;
  }

  destroy() {
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.release();
  }
}
