/**
 * Tactile vibration wrapper around navigator.vibrate for mobile/tablet feedback.
 */
class HapticsEngine {
  private enabled = true;

  public setEnabled(next: boolean): void {
    this.enabled = next;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  private pulse(pattern: number | number[]): void {
    if (!this.enabled || !this.isSupported()) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore browser permission restrictions
    }
  }

  public playKerbRumble(): void {
    this.pulse(12);
  }

  public playGearShift(): void {
    this.pulse(15);
  }

  public playShuntImpact(): void {
    this.pulse([30, 20, 45]);
  }

  public playSpikeStrip(): void {
    this.pulse([20, 15, 20, 15, 35]);
  }

  public playSplashdown(): void {
    this.pulse([50, 30, 80]);
  }

  public playShockwave(): void {
    this.pulse([40, 20, 60]);
  }
}

export const hapticsEngine = new HapticsEngine();
