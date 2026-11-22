import type { GamepadStatus, InputState } from './types';

export interface GamepadButtonEdgeEvents {
  pausePressed: boolean;
  cameraPressed: boolean;
}

export interface GamepadSample {
  status: GamepadStatus;
  input: InputState;
  events: GamepadButtonEdgeEvents;
}

const DEADZONE = 0.14;

/**
 * Pure mapper from raw Web Gamepad API axes/buttons into My Asphalt analog InputState.
 * Standard mapping (Xbox / DualSense / Switch Pro / Generic Bluetooth controllers):
 * - Axis 0: Left Stick X (-1 left, +1 right)
 * - Button 7 (RT/R2) or Button 0 (A/Cross): Throttle
 * - Button 6 (LT/L2) or Button 2 (X/Square): Brake
 * - Button 1 (B/Circle) or Button 4 (LB/L1): Drift
 * - Button 3 (Y/Triangle) or Button 5 (RB/R1): Nitro / Shockwave
 * - Button 14/15: D-Pad Left / Right
 * - Button 9 (Start/Options): Pause toggle
 * - Button 8 (View/Share): Cycle Camera
 */
export function mapGamepadAxesAndButtons(
  axes: readonly number[],
  buttons: readonly { pressed: boolean; value: number }[]
): {
  input: InputState;
  pauseDown: boolean;
  cameraDown: boolean;
  anyActive: boolean;
} {
  const rawStickX = axes[0] ?? 0;
  let analogSteer = 0;
  if (Math.abs(rawStickX) > DEADZONE) {
    const sign = Math.sign(rawStickX);
    analogSteer = sign * ((Math.abs(rawStickX) - DEADZONE) / (1 - DEADZONE));
  }

  const dpadLeft = Boolean(buttons[14]?.pressed);
  const dpadRight = Boolean(buttons[15]?.pressed);
  if (dpadLeft) analogSteer = -1;
  if (dpadRight) analogSteer = 1;

  const rtVal = buttons[7]?.value ?? 0;
  const ltVal = buttons[6]?.value ?? 0;
  const btnA = Boolean(buttons[0]?.pressed);
  const btnB = Boolean(buttons[1]?.pressed);
  const btnX = Boolean(buttons[2]?.pressed);
  const btnY = Boolean(buttons[3]?.pressed);
  const btnLB = Boolean(buttons[4]?.pressed);
  const btnRB = Boolean(buttons[5]?.pressed);

  const analogThrottle = Math.max(rtVal, btnA ? 1 : 0);
  const analogBrake = Math.max(ltVal, btnX ? 1 : 0);

  const throttle = analogThrottle > 0.08;
  const brake = analogBrake > 0.08;
  const left = analogSteer < -0.15;
  const right = analogSteer > 0.15;
  const drift = btnB || btnLB;
  const nitro = btnY || btnRB;
  const pauseDown = Boolean(buttons[9]?.pressed);
  const cameraDown = Boolean(buttons[8]?.pressed);

  const anyActive = throttle || brake || left || right || drift || nitro;

  return {
    input: {
      throttle,
      brake,
      left,
      right,
      drift,
      nitro,
      analogSteer: Math.max(-1, Math.min(1, analogSteer)),
      analogThrottle: Math.max(0, Math.min(1, analogThrottle)),
      analogBrake: Math.max(0, Math.min(1, analogBrake)),
    },
    pauseDown,
    cameraDown,
    anyActive,
  };
}

export class GamepadManager {
  private prevPause = false;
  private prevCamera = false;
  private lastConnectedName = '';

  public poll(): GamepadSample {
    const empty: GamepadSample = {
      status: { connected: false, name: '', active: false },
      input: {
        throttle: false,
        brake: false,
        left: false,
        right: false,
        drift: false,
        nitro: false,
      },
      events: { pausePressed: false, cameraPressed: false },
    };

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return empty;
    }

    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i]!.connected) {
        pad = pads[i];
        break;
      }
    }

    if (!pad) {
      this.prevPause = false;
      this.prevCamera = false;
      this.lastConnectedName = '';
      return empty;
    }

    this.lastConnectedName = pad.id || 'Bluetooth Controller';
    const mapped = mapGamepadAxesAndButtons(pad.axes, pad.buttons);

    const pausePressed = mapped.pauseDown && !this.prevPause;
    const cameraPressed = mapped.cameraDown && !this.prevCamera;
    this.prevPause = mapped.pauseDown;
    this.prevCamera = mapped.cameraDown;

    return {
      status: {
        connected: true,
        name: this.lastConnectedName,
        active: mapped.anyActive,
      },
      input: mapped.input,
      events: { pausePressed, cameraPressed },
    };
  }

  public triggerRumble(strongMagnitude: number, weakMagnitude: number, durationMs: number): void {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;
      const actuator = (
        pad as Gamepad & {
          vibrationActuator?: {
            playEffect?: (
              type: string,
              params: {
                duration: number;
                strongMagnitude: number;
                weakMagnitude: number;
                startDelay?: number;
              }
            ) => Promise<void>;
          };
        }
      ).vibrationActuator;

      if (actuator && typeof actuator.playEffect === 'function') {
        actuator
          .playEffect('dual-rumble', {
            startDelay: 0,
            duration: Math.max(40, Math.min(800, durationMs)),
            strongMagnitude: Math.max(0, Math.min(1, strongMagnitude)),
            weakMagnitude: Math.max(0, Math.min(1, weakMagnitude)),
          })
          .catch(() => {});
      }
    }
  }
}

export const gamepadManager = new GamepadManager();
