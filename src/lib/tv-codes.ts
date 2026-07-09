// TV power-off codes derived from the TV-B-Gone project and common IR databases.
// Patterns are in microseconds, alternating ON/OFF, for Android's ConsumerIrManager.
import type { IRCode } from './ir-plugin';

export type Protocol = 'nec' | 'sirc' | 'rc5' | 'panasonic' | 'jvc';

// Per-protocol repeat behaviour. Real remotes (and TV-B-Gone) don't spam a flat
// gap for every protocol — each has its own frame period and repeat cadence, so a
// gap that's fine for SIRC is too short for RC5's long frames.
export const PROTOCOL_TIMING: Record<Protocol, { repeat: number; gapMs: number }> = {
  nec: { repeat: 3, gapMs: 42 },       // ~67.5ms frame + ~40ms lead-out
  sirc: { repeat: 3, gapMs: 26 },      // Sony requires >=3 frames, 45ms period
  rc5: { repeat: 2, gapMs: 92 },       // RC5 frame period is ~114ms
  panasonic: { repeat: 2, gapMs: 42 }, // ~130ms frame period
  jvc: { repeat: 3, gapMs: 50 },       // JVC repeats the frame (no re-header) ~55ms apart
};

// NEC protocol helper (32-bit)
function nec(hex: number, freq = 38000): IRCode {
  const HDR_MARK = 9000, HDR_SPACE = 4500;
  const BIT_MARK = 560, ONE_SPACE = 1690, ZERO_SPACE = 560;
  const pattern: number[] = [HDR_MARK, HDR_SPACE];
  for (let i = 31; i >= 0; i--) {
    pattern.push(BIT_MARK);
    pattern.push(((hex >>> i) & 1) ? ONE_SPACE : ZERO_SPACE);
  }
  pattern.push(BIT_MARK);
  pattern.push(40000); // trailing lead-out so the receiver registers frame end
  return { frequency: freq, pattern, protocol: 'nec' };
}

// SIRC (Sony) helper: 12/15/20-bit
function sirc(value: number, bits: number): IRCode {
  const HDR_MARK = 2400, HDR_SPACE = 600;
  const ONE_MARK = 1200, ZERO_MARK = 600, GAP = 600;
  const pattern: number[] = [HDR_MARK, HDR_SPACE];
  for (let i = 0; i < bits; i++) {
    pattern.push(((value >>> i) & 1) ? ONE_MARK : ZERO_MARK);
    pattern.push(GAP);
  }
  return { frequency: 40000, pattern, protocol: 'sirc' };
}

// RC5 helper (Philips, 14-bit)
function rc5(value: number): IRCode {
  const HALF = 889;
  const bits: number[] = [];
  for (let i = 13; i >= 0; i--) bits.push((value >>> i) & 1);
  const pattern: number[] = [];
  let lastLevel = -1;
  let runDur = 0;
  const push = (level: number, dur: number) => {
    if (level === lastLevel) { runDur += dur; }
    else {
      if (lastLevel !== -1) pattern.push(runDur);
      lastLevel = level; runDur = dur;
    }
  };
  for (const b of bits) {
    if (b === 1) { push(0, HALF); push(1, HALF); }
    else { push(1, HALF); push(0, HALF); }
  }
  pattern.push(runDur);
  return { frequency: 36000, pattern, protocol: 'rc5' };
}

// Panasonic helper (48-bit)
function panasonic(addr: number, data: number): IRCode {
  const HDR_MARK = 3502, HDR_SPACE = 1750;
  const BIT_MARK = 435, ONE_SPACE = 1307, ZERO_SPACE = 435;
  const pattern: number[] = [HDR_MARK, HDR_SPACE];
  const send = (val: number, bits: number) => {
    for (let i = bits - 1; i >= 0; i--) {
      pattern.push(BIT_MARK);
      pattern.push(((val >> i) & 1) ? ONE_SPACE : ZERO_SPACE);
    }
  };
  send(addr, 16);
  send(data, 32);
  pattern.push(BIT_MARK);
  pattern.push(40000);
  return { frequency: 37000, pattern, protocol: 'panasonic' };
}

export interface Brand {
  name: string;
  codes: IRCode[];
}

// Grouped by manufacturer so users can converge on their actual TV instead of
// spraying all brands. Each brand carries every known power-off variant for it.
export const BRANDS: Brand[] = [
  { name: 'Samsung', codes: [nec(0xE0E040BF), nec(0x02FD48B7), nec(0xE0E019E6)] },
  { name: 'LG', codes: [nec(0x20DF10EF), nec(0x04FB08F7)] },
  { name: 'Sony', codes: [sirc(0xA90, 12), sirc(0x2A50, 15), sirc(0x290, 20)] },
  { name: 'Panasonic', codes: [panasonic(0x4004, 0x0100BCBD), nec(0x0100BCBD)] },
  // Philips is RC5/RC6 — the previous "Philips NEC (LG code)" entry was a placeholder and is removed.
  { name: 'Philips', codes: [rc5(0x300C), rc5(0x100C)] },
  { name: 'Vizio', codes: [nec(0x20DF10EF), nec(0x4CB340BF)] },
  { name: 'Sharp', codes: [nec(0x41A2, 38000), nec(0x4122, 38000)] },
  { name: 'Toshiba', codes: [nec(0x02FD48B7), nec(0x45BC01FE)] },
  { name: 'TCL', codes: [nec(0x20DF10EF), nec(0x4CB340BF)] },
  { name: 'Hisense', codes: [nec(0x20DF10EF), nec(0xFB0408F7)] },
  { name: 'Digihome / Vestel', codes: [nec(0x00BF12ED), nec(0x04FB08F7)] },
  { name: 'Insignia', codes: [nec(0x02FD48B7)] },
  { name: 'Roku TV', codes: [nec(0x20DF10EF)] },
  { name: 'JVC', codes: [nec(0xC0E8)] },
  { name: 'Hitachi', codes: [nec(0x1FE48B7)] },
  { name: 'RCA', codes: [nec(0x35CA827D)] },
  { name: 'Sanyo', codes: [nec(0x1C2358A7)] },
  { name: 'Magnavox', codes: [rc5(0x180C)] },
  { name: 'Emerson', codes: [nec(0x866B807F)] },
  { name: 'Westinghouse', codes: [nec(0xE2102FD0)] },
  { name: 'NEC Generic', codes: [nec(0x00FF000C), nec(0x00FF000D), nec(0x807F18E7), nec(0xFF00FF00)] },
];

// Flat list kept for backwards compatibility / counts.
export const POWER_OFF_CODES = BRANDS.flatMap(b => b.codes.map(code => ({ brand: b.name, code })));
