/**
 * Landscape-aware gyroscope / accelerometer tilt steering controller.
 * Supports iOS 13+ permission requests, resting-angle calibration,
 * a 3.5-degree deadzone, 26-degree full-lock range, and low-pass smoothing.
 */
export class TiltSteeringController {
  private supported =
    typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';
  private enabled = false;
  private listening = false;
  private calibratedOffset = 0;
  private needsCalibration = false;
  private rawTiltDeg = 0;
  private smoothedSteer = 0;
  private hasSample = false;

  public isSupported(): boolean {
    return this.supported;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (!next) {
      this.smoothedSteer = 0;
    } else {
      this.calibrate();
    }
  }

  public calibrate(): void {
    if (this.hasSample) {
      this.calibratedOffset = this.rawTiltDeg;
      this.needsCalibration = false;
    } else {
      this.needsCalibration = true;
    }
    this.smoothedSteer = 0;
  }

  public async requestPermissionAndStart(): Promise<boolean> {
    if (!this.supported) return false;
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DOE?.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res !== 'granted') {
          return false;
        }
      } catch {
        return false;
      }
    }
    this.startListening();
    return true;
  }

  public startListening(): void {
    if (!this.supported || this.listening) return;
    window.addEventListener('deviceorientation', this.handleOrientation);
    this.listening = true;
  }

  public stopListening(): void {
    if (!this.listening) return;
    window.removeEventListener('deviceorientation', this.handleOrientation);
    this.listening = false;
    this.smoothedSteer = 0;
  }

  private getScreenAngle(): number {
    if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
      return screen.orientation.angle;
    }
    const winOri = (window as unknown as { orientation?: number }).orientation;
    return typeof winOri === 'number' ? winOri : 0;
  }

  private handleOrientation = (e: DeviceOrientationEvent): void => {
    const beta = e.beta;
    const gamma = e.gamma;
    if (beta === null && gamma === null) return;

    const angle = this.getScreenAngle();
    let tilt = 0;
    if (angle === 90) {
      tilt = beta ?? 0;
    } else if (angle === -90 || angle === 270) {
      tilt = -(beta ?? 0);
    } else if (angle === 180) {
      tilt = -(gamma ?? 0);
    } else {
      // Portrait or CSS-rotated landscape stage
      tilt = gamma ?? 0;
    }

    this.rawTiltDeg = tilt;
    this.hasSample = true;
    if (this.needsCalibration) {
      this.calibratedOffset = tilt;
      this.needsCalibration = false;
    }
  };

  /**
   * Returns smoothed analog steering in [-1, 1] when tilt is enabled and receiving samples.
   */
  public sampleSteer(): number {
    if (!this.enabled || !this.hasSample) {
      this.smoothedSteer += (0 - this.smoothedSteer) * 0.3;
      return Math.abs(this.smoothedSteer) < 0.01 ? 0 : this.smoothedSteer;
    }

    const deadzone = 3.5;
    const maxRange = 26;
    const delta = this.rawTiltDeg - this.calibratedOffset;
    const absDelta = Math.abs(delta);

    let target = 0;
    if (absDelta > deadzone) {
      const normalized = Math.min(1, (absDelta - deadzone) / (maxRange - deadzone));
      target = Math.sign(delta) * normalized;
    }

    this.smoothedSteer += (target - this.smoothedSteer) * 0.28;
    return Math.abs(this.smoothedSteer) < 0.01 ? 0 : this.smoothedSteer;
  }
}

export const tiltSteering = new TiltSteeringController();
