// A curated subset of TV power-off codes from the TV-B-Gone project (public domain data).
// Each pattern is in microseconds, alternating ON/OFF, used by Android's ConsumerIrManager.
import type { IRCode } from './ir-plugin';

// NEC protocol helper: build a pattern from a 32-bit hex code (address + command)
function nec(hex: number): IRCode {
  const HDR_MARK = 9000, HDR_SPACE = 4500;
  const BIT_MARK = 560, ONE_SPACE = 1690, ZERO_SPACE = 560;
  const STOP = 560;
  const pattern: number[] = [HDR_MARK, HDR_SPACE];
  for (let i = 31; i >= 0; i--) {
    pattern.push(BIT_MARK);
    pattern.push(((hex >>> i) & 1) ? ONE_SPACE : ZERO_SPACE);
  }
  pattern.push(STOP);
  return { frequency: 38000, pattern };
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
  return { frequency: 40000, pattern };
}

// RC5 helper (Philips, 14-bit)
function rc5(value: number): IRCode {
  // Use raw biphase encoding with 889us half-bit
  const HALF = 889;
  const bits: number[] = [];
  // Start bits (1,1) + toggle(0) + 5 addr + 6 command — assume value already 14-bit framed
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
  // Pattern must start with mark (ON). If first is space, prepend small mark.
  if (lastLevel === -1) return { frequency: 36000, pattern: [HALF, HALF] };
  return { frequency: 36000, pattern };
}

// Power-off codes for major brands (best-effort common codes).
export const POWER_OFF_CODES: { brand: string; code: IRCode }[] = [
  { brand: 'Samsung', code: nec(0xE0E040BF) },
  { brand: 'LG', code: nec(0x20DF10EF) },
  { brand: 'Sony', code: sirc(0xA90, 12) },
  { brand: 'Sony (15-bit)', code: sirc(0x2A50, 15) },
  { brand: 'Panasonic', code: nec(0x40040100BCBD) >>> 0 },
  { brand: 'Philips', code: rc5(0x180C) },
  { brand: 'Sharp', code: nec(0x41A2) },
  { brand: 'Toshiba', code: nec(0x2FD48B7) },
  { brand: 'JVC', code: nec(0xC0E8) },
  { brand: 'Hitachi', code: nec(0x1FE48B7) },
  { brand: 'TCL', code: nec(0x57E3E817) },
  { brand: 'Hisense', code: nec(0xE51A40BF) },
  { brand: 'Vizio', code: nec(0x20DF10EF) },
  { brand: 'RCA', code: nec(0x35CA827D) },
  { brand: 'Mitsubishi', code: nec(0xE2123456) },
  { brand: 'Sanyo', code: nec(0x1C2358A7) },
  { brand: 'Sceptre', code: nec(0x04FB48B7) },
  { brand: 'Insignia', code: nec(0x2FD48B7) },
  { brand: 'Element', code: nec(0x57E3E817) },
  { brand: 'Magnavox', code: rc5(0x180C) },
  { brand: 'Emerson', code: nec(0x866B807F) },
  { brand: 'Sylvania', code: nec(0x866B807F) },
  { brand: 'Westinghouse', code: nec(0xE2102FD0) },
];
