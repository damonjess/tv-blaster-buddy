// A curated collection of TV power-off codes from the TV-B-Gone project and common IR databases.
// Each pattern is in microseconds, alternating ON/OFF, used by Android's ConsumerIrManager.
import type { IRCode } from './ir-plugin';

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
  // Trailing gap so the receiver registers the end of the frame.
  pattern.push(40000);
  return { frequency: freq, pattern };
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
  return { frequency: 36000, pattern };
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
  return { frequency: 37000, pattern };
}

export const POWER_OFF_CODES: { brand: string; code: IRCode }[] = [
  // --- Samsung ---
  { brand: 'Samsung 1', code: nec(0xE0E040BF) },
  { brand: 'Samsung 2', code: nec(0x02FD48B7) },
  { brand: 'Samsung 3', code: nec(0xE0E019E6) },

  // --- LG ---
  { brand: 'LG 1', code: nec(0x20DF10EF) },
  { brand: 'LG 2', code: nec(0x04FB08F7) },

  // --- Sony ---
  { brand: 'Sony 12-bit', code: sirc(0xA90, 12) },
  { brand: 'Sony 15-bit', code: sirc(0x2A50, 15) },
  { brand: 'Sony 20-bit', code: sirc(0x290, 20) },

  // --- Panasonic ---
  { brand: 'Panasonic 1', code: panasonic(0x4004, 0x0100BCBD) },
  { brand: 'Panasonic 2', code: nec(0x0100BCBD) },

  // --- Philips ---
  { brand: 'Philips RC5', code: rc5(0x300C) },
  { brand: 'Philips NEC', code: nec(0x20DF10EF) }, // Many modern Philips use LG-style NEC

  // --- Vizio ---
  { brand: 'Vizio 1', code: nec(0x20DF10EF) },
  { brand: 'Vizio 2', code: nec(0x4CB340BF) },

  // --- Sharp ---
  { brand: 'Sharp 1', code: nec(0x41A2, 38000) },
  { brand: 'Sharp 2', code: nec(0x4122, 38000) },

  // --- Toshiba ---
  { brand: 'Toshiba 1', code: nec(0x02FD48B7) },
  { brand: 'Toshiba 2', code: nec(0x45BC01FE) },

  // --- TCL ---
  { brand: 'TCL 1', code: nec(0x20DF10EF) },
  { brand: 'TCL 2', code: nec(0x4CB340BF) },

  // --- Hisense ---
  { brand: 'Hisense 1', code: nec(0x20DF10EF) },
  { brand: 'Hisense 2', code: nec(0xFB0408F7) },

  // --- Digihome / Vestel ---
  { brand: 'Digihome 1', code: nec(0x00BF12ED) },
  { brand: 'Digihome 2', code: nec(0x04FB08F7) },

  // --- Roku / Insignia ---
  { brand: 'Insignia', code: nec(0x02FD48B7) },
  { brand: 'Roku TV', code: nec(0x20DF10EF) },

  // --- Generic / Universal ---
  { brand: 'NEC Generic 1', code: nec(0x00FF000C) },
  { brand: 'NEC Generic 2', code: nec(0x00FF000D) },
  { brand: 'NEC Generic 3', code: nec(0x807F18E7) },
  { brand: 'NEC Generic 4', code: nec(0xFF00FF00) },
  { brand: 'JVC', code: nec(0xC0E8) },
  { brand: 'Hitachi', code: nec(0x1FE48B7) },
  { brand: 'RCA', code: nec(0x35CA827D) },
  { brand: 'Mitsubishi', code: nec(0xE2123456) },
  { brand: 'Sanyo', code: nec(0x1C2358A7) },
  { brand: 'Magnavox', code: rc5(0x180C) },
  { brand: 'Emerson', code: nec(0x866B807F) },
  { brand: 'Westinghouse', code: nec(0xE2102FD0) },
];
