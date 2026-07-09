import { registerPlugin } from '@capacitor/core';

export interface IRCode {
  frequency: number;
  pattern: number[];
  protocol?: 'nec' | 'sirc' | 'rc5' | 'panasonic';
}

export interface IRPlugin {
  hasIR(): Promise<{ hasIR: boolean; exists?: boolean; frequencies?: { min: number; max: number }[] }>;
  transmit(code: IRCode): Promise<void>;
  transmitMany(options: { codes: IRCode[]; gapMs?: number }): Promise<{ sent: number }>;
}

export const IR = registerPlugin<IRPlugin>('IR');
