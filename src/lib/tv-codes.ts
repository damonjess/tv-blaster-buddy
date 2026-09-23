// TV power-off codes derived from the TV-B-Gone project, LIRC, IRDB, and manufacturer IR captures.
// Patterns are in microseconds, alternating ON/OFF, for Android's ConsumerIrManager.
import type { IRCode } from './ir-plugin';

export type Protocol = 'nec' | 'sirc' | 'rc5' | 'rc6' | 'panasonic' | 'jvc' | 'sharp' | 'kaseikyo' | 'pronto';

// Per-protocol repeat behaviour. Real remotes and TV-B-Gone use protocol-specific
// frame periods and repeat cadences.
export const PROTOCOL_TIMING: Record<Protocol, { repeat: number; gapMs: number }> = {
  nec: { repeat: 3, gapMs: 42 },       // ~67.5ms frame + ~40ms lead-out
  sirc: { repeat: 3, gapMs: 26 },      // Sony requires >=3 frames, 45ms period
  rc5: { repeat: 2, gapMs: 92 },       // RC5 frame period is ~114ms
  rc6: { repeat: 2, gapMs: 105 },      // RC6 mode 0 frame period ~105ms
  panasonic: { repeat: 2, gapMs: 42 }, // ~130ms frame period
  jvc: { repeat: 3, gapMs: 50 },       // JVC repeats the frame ~55ms apart
  sharp: { repeat: 3, gapMs: 45 },     // Sharp 15-bit frame period ~45ms
  kaseikyo: { repeat: 2, gapMs: 50 },  // Kaseikyo 48-bit frame period ~50ms
  pronto: { repeat: 2, gapMs: 50 },    // Default gap for raw pronto captures
};

// NEC protocol helper (32-bit)
export function nec(hex: number, freq = 38000): IRCode {
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
export function sirc(value: number, bits: number): IRCode {
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
export function rc5(value: number): IRCode {
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

// RC6 Mode 0 helper (Philips/LG/Samsung RC6, 20-bit)
export function rc6(value: number, bits = 20): IRCode {
  const HDR_MARK = 2666, HDR_SPACE = 889;
  const UNIT = 444;
  const pattern: number[] = [HDR_MARK, HDR_SPACE];

  let lastLevel = 1;
  let currentDur = 0;

  const pushHalf = (level: number, multiplier = 1) => {
    const dur = UNIT * multiplier;
    if (level === lastLevel) {
      currentDur += dur;
    } else {
      if (currentDur > 0) pattern.push(currentDur);
      lastLevel = level;
      currentDur = dur;
    }
  };

  // Start bit (1)
  pushHalf(1); pushHalf(0);

  // Mode bits (000 for Mode 0)
  for (let i = 0; i < 3; i++) {
    pushHalf(0); pushHalf(1);
  }

  // Trailer bit (double length 0)
  pushHalf(0, 2); pushHalf(1, 2);

  // Data bits
  for (let i = bits - 1; i >= 0; i--) {
    const bit = (value >>> i) & 1;
    if (bit === 1) {
      pushHalf(1); pushHalf(0);
    } else {
      pushHalf(0); pushHalf(1);
    }
  }
  if (currentDur > 0) pattern.push(currentDur);

  return { frequency: 36000, pattern, protocol: 'rc6' };
}

// Panasonic helper (48-bit)
export function panasonic(addr: number, data: number): IRCode {
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

// JVC helper (16-bit, LSB-first)
export function jvc(value: number): IRCode {
  const HDR_MARK = 8400, HDR_SPACE = 4200;
  const BIT_MARK = 526, ONE_SPACE = 1574, ZERO_SPACE = 526;
  const pattern: number[] = [HDR_MARK, HDR_SPACE];
  for (let i = 0; i < 16; i++) {
    pattern.push(BIT_MARK);
    pattern.push(((value >>> i) & 1) ? ONE_SPACE : ZERO_SPACE);
  }
  pattern.push(BIT_MARK);
  pattern.push(40000);
  return { frequency: 38000, pattern, protocol: 'jvc' };
}

// Sharp 15-bit helper (AQUOS & classic Sharp sets)
export function sharp(address: number, command: number): IRCode {
  const BIT_MARK = 320, ONE_SPACE = 1680, ZERO_SPACE = 680;
  const pattern: number[] = [];

  const value = ((address & 0x1F) << 10) | ((command & 0xFF) << 2) | 0x02;
  for (let i = 14; i >= 0; i--) {
    pattern.push(BIT_MARK);
    pattern.push(((value >>> i) & 1) ? ONE_SPACE : ZERO_SPACE);
  }
  pattern.push(BIT_MARK);
  pattern.push(40000);
  return { frequency: 38000, pattern, protocol: 'sharp' };
}

// Kaseikyo / Denon 48-bit helper
export function kaseikyo(vendor: number, addr: number, cmd: number): IRCode {
  const HDR_MARK = 3380, HDR_SPACE = 1690;
  const BIT_MARK = 423, ONE_SPACE = 1269, ZERO_SPACE = 423;
  const pattern: number[] = [HDR_MARK, HDR_SPACE];

  const send = (val: number, bits: number) => {
    for (let i = 0; i < bits; i++) {
      pattern.push(BIT_MARK);
      pattern.push(((val >>> i) & 1) ? ONE_SPACE : ZERO_SPACE);
    }
  };

  send(vendor, 16);
  send(addr, 8);
  send(cmd, 8);
  const parity = (vendor ^ (vendor >> 8) ^ addr ^ cmd) & 0xFF;
  send(parity, 8);
  pattern.push(BIT_MARK);
  pattern.push(40000);
  return { frequency: 38000, pattern, protocol: 'kaseikyo' };
}

// Pronto Hex parser for raw IR capture strings (e.g. "0000 006d 0022 0002 ...")
export function pronto(prontoStr: string): IRCode {
  const tokens = prontoStr.trim().split(/\s+/).map((s) => parseInt(s, 16));
  if (tokens.length < 4) {
    throw new Error('Invalid Pronto Hex string: too short');
  }

  const frequencyHz = Math.round(1000000 / (tokens[1] * 0.241246));
  const burst1Pairs = tokens[2];
  const burst2Pairs = tokens[3];
  const totalPairs = burst1Pairs + burst2Pairs;

  const pattern: number[] = [];
  const timeFactor = tokens[1] * 0.241246;

  for (let i = 0; i < totalPairs * 2 && 4 + i < tokens.length; i++) {
    pattern.push(Math.round(tokens[4 + i] * timeFactor));
  }

  return { frequency: frequencyHz || 38000, pattern, protocol: 'pronto' };
}

export interface Brand {
  name: string;
  category?: 'popular' | 'regional' | 'smart_tv' | 'budget';
  models?: string[];
  codes: IRCode[];
  // true = shared fallback NEC/RC5 code reused across rebadged/budget sets
  shared?: boolean;
}

// Comprehensive multi-brand database containing 50+ TV brands and major IR protocols.
export const BRANDS: Brand[] = [
  {
    name: 'Samsung',
    category: 'popular',
    codes: [
      nec(0xE0E040BF), // Universal Power Toggle
      nec(0xE0E0B04F), // Discrete Power Off
      nec(0x02FD48B7), // Alternate Samsung NEC
      nec(0xE0E019E6), // Legacy Samsung Smart TV
      rc6(0x0C, 20),   // Samsung RC6 Power
    ],
  },
  {
    name: 'LG',
    category: 'popular',
    codes: [
      nec(0x20DF10EF), // Universal Power Toggle
      nec(0x20DA10EF), // Discrete Power Off
      nec(0x04FB08F7), // Legacy LG NEC
      rc6(0x000C, 20), // LG RC6 Mode 0
    ],
  },
  {
    name: 'Sony',
    category: 'popular',
    codes: [
      sirc(0xA90, 12),  // SIRC 12-bit Power Toggle
      sirc(0xA8B, 12),  // SIRC 12-bit Discrete Power Off
      sirc(0x2A50, 15), // SIRC 15-bit Power Toggle
      sirc(0x290, 20),  // SIRC 20-bit BRAVIA Power Toggle
      sirc(0xB8F, 20),  // SIRC 20-bit BRAVIA Discrete Power Off
    ],
  },
  {
    name: 'Panasonic',
    category: 'popular',
    codes: [
      panasonic(0x4004, 0x0100BCBD), // Panasonic 48-bit Power Toggle
      panasonic(0x4004, 0x0100A0A1), // Panasonic 48-bit Discrete Power Off
      nec(0x0100BCBD),               // Panasonic NEC Mode
      kaseikyo(0x002A, 0x08, 0x3D),  // Kaseikyo Panasonic
    ],
  },
  {
    name: 'Philips',
    category: 'popular',
    codes: [
      rc5(0x300C),     // RC5 System 0x18 Power
      rc5(0x100C),     // RC5 System 0x00 Power Toggle
      rc6(0x100C, 20), // RC6 Mode 0 Power Toggle
      rc6(0x000C, 20), // RC6 Mode 0 Alternate
    ],
  },
  {
    name: 'Digihome / Vestel',
    category: 'regional',
    models: [
      '24225SMLED',
      '24278SMFHD',
      '32278HDD',
      '43278SMFHD',
      '49278SMFHD',
      '55278SMFHD',
      'Vestel MB90/MB100/MB120/MB130/MB211',
    ],
    codes: [
      nec(0x00BF12ED), // Standard Digihome / Vestel NEC Chassis Power (24225SMLED)
      nec(0x00BF48B7), // Digihome Alternate NEC Power
      nec(0x00BF13EC), // Digihome Discrete Power Off
      nec(0x00BF0AF5), // Digihome / Vestel Power Toggle Alt 2
      nec(0x04FB08F7), // Digihome 4K Smart TV (MB120/MB130/MB211)
      nec(0x20DF10EF), // Digihome Android Smart TV
      nec(0x02FD48B7), // Digihome DVD Combi / Legacy
      rc5(0x100C),     // Digihome RC5 System 0x00
      rc5(0x180C),     // Digihome RC5 System 0x18
      rc6(0x000C, 20), // Digihome RC6 Mode 0
    ],
  },
  {
    name: 'TCL',
    category: 'popular',
    codes: [
      nec(0x20DF10EF), // TCL Roku TV Power
      nec(0x4CB340BF), // TCL Smart TV NEC
      nec(0x00FF12ED), // TCL Android TV
      nec(0x02FD48B7), // TCL Legacy
    ],
  },
  {
    name: 'Hisense',
    category: 'popular',
    codes: [
      nec(0x20DF10EF), // Hisense Smart TV
      nec(0xFB0408F7), // Hisense VIDAA Power
      nec(0x00FF807F), // Hisense Alternate
      nec(0x02FD48B7), // Hisense Legacy
    ],
  },
  {
    name: 'Vizio',
    category: 'popular',
    codes: [
      nec(0x20DF10EF), // Vizio Power
      nec(0x4CB340BF), // Vizio SmartCast
      nec(0x00FF10EF), // Vizio E-Series / M-Series
    ],
  },
  {
    name: 'Sharp',
    category: 'popular',
    codes: [
      sharp(0x01, 0x12), // Sharp AQUOS 15-bit Power
      nec(0x41A2, 38000), // Sharp NEC Mode 1
      nec(0x4122, 38000), // Sharp NEC Mode 2
    ],
  },
  {
    name: 'Toshiba',
    category: 'popular',
    codes: [
      nec(0x02FD48B7), // Toshiba Regza Power
      nec(0x45BC01FE), // Toshiba Alternate
      nec(0x00FF000C), // Toshiba Fire TV Edition
    ],
  },
  {
    name: 'Roku TV',
    category: 'smart_tv',
    codes: [
      nec(0x20DF10EF), // Universal Roku TV Power (TCL/Hisense/Onn/Sharp Roku)
      nec(0x4CB340BF), // Roku TV Alternate
    ],
  },
  {
    name: 'Amazon Fire TV Edition',
    category: 'smart_tv',
    codes: [
      nec(0x00FF000C), // Insignia/Toshiba/Element Fire TV IR Power
      nec(0x20DF10EF), // Fire TV Edition Alternate
    ],
  },
  {
    name: 'Android / Google TV IR',
    category: 'smart_tv',
    codes: [
      nec(0x00FF40BF), // Universal Android TV Receiver Power
      nec(0x00FF12ED), // Xiaomi / TCL Android TV
      nec(0x807F18E7), // Shield / Mecool IR Receiver
    ],
  },
  {
    name: 'Xiaomi (Mi TV / Redmi)',
    category: 'popular',
    codes: [
      nec(0x00FF40BF), // Mi TV IR Power
      nec(0x20DF10EF), // Redmi TV Smart Power
      nec(0x00BF12ED), // Mi Box IR Receiver
    ],
  },
  {
    name: 'Insignia',
    category: 'popular',
    codes: [
      nec(0x02FD48B7), // Insignia Fire TV / HDTV
      nec(0x00FF000C), // Insignia Fire TV Edition
    ],
  },
  {
    name: 'Onn (Walmart)',
    category: 'popular',
    codes: [
      nec(0x20DF10EF), // Onn Roku TV Power
      nec(0x02FD48B7), // Onn Google TV / HDTV
    ],
  },
  {
    name: 'JVC',
    category: 'popular',
    codes: [
      jvc(0xC0E8),     // JVC 16-bit Power
      nec(0x02FD48B7), // JVC Roku/Smart TV
      nec(0x00BF12ED), // JVC Europe (Vestel Chassis)
    ],
  },
  {
    name: 'Hitachi',
    category: 'popular',
    codes: [
      nec(0x01FE48B7), // Hitachi Power
      nec(0x00FF12ED), // Hitachi Smart TV
      nec(0x00BF12ED), // Hitachi Europe (Vestel Chassis)
    ],
  },
  {
    name: 'RCA / Proscan',
    category: 'popular',
    codes: [
      nec(0x35CA827D), // RCA Power
      nec(0x02FD48B7), // RCA Roku TV
    ],
  },
  {
    name: 'Sanyo',
    category: 'popular',
    codes: [
      nec(0x1C2358A7), // Sanyo HDTV Power
      nec(0x00FF12ED), // Sanyo Roku TV
    ],
  },
  {
    name: 'Magnavox',
    category: 'popular',
    codes: [
      rc5(0x180C),     // Magnavox RC5 Power
      nec(0x866B807F), // Magnavox Funai Power
    ],
  },
  {
    name: 'Emerson / Funai',
    category: 'popular',
    codes: [
      nec(0x866B807F), // Emerson/Funai Power
      nec(0x02FD48B7), // Emerson Smart TV
    ],
  },
  {
    name: 'Westinghouse',
    category: 'popular',
    codes: [
      nec(0xE2102FD0), // Westinghouse Power
      nec(0x02FD48B7), // Westinghouse Roku TV
    ],
  },
  {
    name: 'Blaupunkt',
    category: 'regional',
    codes: [
      nec(0x00BF12ED), // Blaupunkt Vestel Chassis
      rc5(0x100C),     // Blaupunkt RC5
      nec(0x04FB08F7), // Blaupunkt Smart TV
    ],
  },
  {
    name: 'Bush / Logik (UK)',
    category: 'regional',
    codes: [
      nec(0x00BF12ED), // Bush/Logik UK Power
      nec(0x20DF10EF), // Bush Smart TV
    ],
  },
  {
    name: 'Grundig / Beko',
    category: 'regional',
    codes: [
      rc5(0x100C),     // Grundig European RC5
      nec(0x01FE48B7), // Grundig Smart TV
    ],
  },
  {
    name: 'Haier',
    category: 'popular',
    codes: [
      nec(0x00FE40BF), // Haier Power
      nec(0x02FD48B7), // Haier Android TV
    ],
  },
  {
    name: 'Changhong',
    category: 'regional',
    codes: [
      nec(0x00FF40BF), // Changhong Power
      nec(0x02FD48B7), // Changhong Smart TV
    ],
  },
  {
    name: 'Skyworth',
    category: 'regional',
    codes: [
      nec(0x00FF40BF), // Skyworth Power
      nec(0x02FD48B7), // Skyworth Android TV
    ],
  },
  {
    name: 'Konka',
    category: 'regional',
    codes: [
      nec(0x00FF40BF), // Konka Power
      nec(0x02FD48B7), // Konka Smart TV
    ],
  },
  {
    name: 'AOC',
    category: 'budget',
    codes: [
      nec(0x00FE40BF), // AOC Power
      nec(0x02FD48B7), // AOC Smart TV
    ],
  },
  {
    name: 'Apex Digital',
    category: 'budget',
    codes: [
      nec(0x00FF807F), // Apex Power
      nec(0x02FD48B7), // Apex HDTV
    ],
  },
  {
    name: 'Akai',
    category: 'budget',
    codes: [
      nec(0x00FF12ED), // Akai Power
      rc5(0x100C),     // Akai RC5
    ],
  },
  {
    name: 'Daewoo',
    category: 'budget',
    codes: [
      nec(0x00FE12ED), // Daewoo Power
      rc5(0x100C),     // Daewoo RC5
    ],
  },
  {
    name: 'Dynex',
    category: 'budget',
    codes: [
      nec(0x02FD48B7), // Dynex Power
    ],
  },
  {
    name: 'Element',
    category: 'budget',
    codes: [
      nec(0x02FD48B7), // Element Power
      nec(0x20DF10EF), // Element Fire/Roku TV
    ],
  },
  {
    name: 'Hannspree',
    category: 'budget',
    codes: [
      nec(0x00FF807F), // Hannspree Power
    ],
  },
  {
    name: 'InFocus / ViewSonic',
    category: 'budget',
    codes: [
      nec(0x00FF807F), // InFocus/ViewSonic Power
      nec(0x02FD48B7), // ViewSonic Smart TV
    ],
  },
  {
    name: 'Loewe',
    category: 'regional',
    codes: [
      rc5(0x100C),     // Loewe RC5 Power
      rc6(0x100C, 20), // Loewe RC6 Power
    ],
  },
  {
    name: 'Mitsubishi',
    category: 'budget',
    codes: [
      kaseikyo(0x002A, 0x01, 0x12), // Mitsubishi Kaseikyo Power
      nec(0x00FE48B7),              // Mitsubishi NEC
    ],
  },
  {
    name: 'OK. (MediaMarkt / Saturn)',
    category: 'regional',
    codes: [
      nec(0x00BF12ED), // OK. Vestel Power
    ],
  },
  {
    name: 'Orion / Sansui',
    category: 'budget',
    codes: [
      nec(0x02FD48B7), // Orion/Sansui Power
      nec(0x00FE12ED), // Orion Alternate
    ],
  },
  {
    name: 'Pioneer',
    category: 'popular',
    codes: [
      nec(0xA55A50AF), // Pioneer Plasma / Elite Power
      nec(0xAA5550AF), // Pioneer Kuro Discrete Power
      nec(0x02FD48B7), // Pioneer Smart TV
    ],
  },
  {
    name: 'Polaroid / Seiki',
    category: 'budget',
    codes: [
      nec(0x02FD48B7), // Polaroid/Seiki Power
      nec(0x20DF10EF), // Seiki Smart TV
    ],
  },
  {
    name: 'Sceptre',
    category: 'budget',
    codes: [
      nec(0x00FF000C), // Sceptre Power
      nec(0x02FD48B7), // Sceptre Smart TV
    ],
  },
  {
    name: 'SunBriteTV',
    category: 'budget',
    codes: [
      nec(0x02FD48B7), // SunBrite Outdoor TV Power
      nec(0x20DF10EF), // SunBrite Smart TV
    ],
  },
  {
    name: 'Telefunken / Thomson / Saba',
    category: 'regional',
    codes: [
      nec(0x00BF12ED), // Telefunken Vestel
      rc5(0x100C),     // Thomson RC5
      nec(0x20DF10EF), // Thomson/TCL Smart TV
    ],
  },
  {
    name: 'Zenith',
    category: 'budget',
    codes: [
      nec(0x20DF10EF), // Zenith Power Toggle
      nec(0x04FB08F7), // Zenith Legacy
    ],
  },
  {
    name: 'NEC Generic & Universal Sweeper',
    category: 'budget',
    shared: true,
    codes: [
      nec(0x00FF000C), // Standard TV-B-Gone Code 1
      nec(0x00FF000D), // Standard TV-B-Gone Code 2
      nec(0x807F18E7), // Standard TV-B-Gone Code 3
      nec(0xFF00FF00), // Standard TV-B-Gone Code 4
      nec(0x00FF807F), // Universal Budget TV Code
      nec(0x00FE12ED), // Universal Asian TV Code
    ],
  },
];

// Flat list kept for backwards compatibility / counts.
export const POWER_OFF_CODES = BRANDS.flatMap(b => b.codes.map(code => ({ brand: b.name, code })));
