import { registerPlugin } from '@capacitor/core';

export interface IRCode {
  frequency: number;
  pattern: number[];
}

export interface IRPlugin {
  hasIR(): Promise<{ hasIR: boolean }>;
  transmit(code: IRCode): Promise<void>;
  transmitMany(options: { codes: IRCode[]; gapMs?: number }): Promise<{ sent: number }>;
}

export const IR = registerPlugin<IRPlugin>('IR');
