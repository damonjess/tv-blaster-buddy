import { describe, it, expect } from "vitest";
import {
  BRANDS,
  POWER_OFF_CODES,
  nec,
  sirc,
  rc5,
  rc6,
  panasonic,
  jvc,
  sharp,
  kaseikyo,
  pronto,
} from "../lib/tv-codes";

describe("IR Protocol Encoders", () => {
  it("should generate valid NEC IR pattern", () => {
    const code = nec(0x20DF10EF);
    expect(code.frequency).toBe(38000);
    expect(code.protocol).toBe("nec");
    expect(code.pattern.length).toBeGreaterThan(60);
    expect(code.pattern[0]).toBe(9000); // Header mark
    expect(code.pattern[1]).toBe(4500); // Header space
    code.pattern.forEach((val) => {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
    });
  });

  it("should generate valid SIRC IR pattern", () => {
    const code = sirc(0xA90, 12);
    expect(code.frequency).toBe(40000);
    expect(code.protocol).toBe("sirc");
    expect(code.pattern[0]).toBe(2400); // SIRC Header mark
    expect(code.pattern[1]).toBe(600);  // SIRC Header space
    code.pattern.forEach((val) => {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
    });
  });

  it("should generate valid RC5 IR pattern", () => {
    const code = rc5(0x300C);
    expect(code.frequency).toBe(36000);
    expect(code.protocol).toBe("rc5");
    expect(code.pattern.length).toBeGreaterThan(10);
    code.pattern.forEach((val) => {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
    });
  });

  it("should generate valid RC6 IR pattern", () => {
    const code = rc6(0x100C, 20);
    expect(code.frequency).toBe(36000);
    expect(code.protocol).toBe("rc6");
    expect(code.pattern[0]).toBe(2666); // RC6 Header mark
    expect(code.pattern[1]).toBe(889);  // RC6 Header space
    code.pattern.forEach((val) => {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
    });
  });

  it("should generate valid Panasonic IR pattern", () => {
    const code = panasonic(0x4004, 0x0100BCBD);
    expect(code.frequency).toBe(37000);
    expect(code.protocol).toBe("panasonic");
    expect(code.pattern[0]).toBe(3502);
    expect(code.pattern[1]).toBe(1750);
  });

  it("should generate valid JVC IR pattern", () => {
    const code = jvc(0xC0E8);
    expect(code.frequency).toBe(38000);
    expect(code.protocol).toBe("jvc");
    expect(code.pattern[0]).toBe(8400);
    expect(code.pattern[1]).toBe(4200);
  });

  it("should generate valid Sharp 15-bit IR pattern", () => {
    const code = sharp(0x01, 0x12);
    expect(code.frequency).toBe(38000);
    expect(code.protocol).toBe("sharp");
    expect(code.pattern.length).toBe(32); // 15 bits * 2 + trailing mark & space
  });

  it("should generate valid Kaseikyo IR pattern", () => {
    const code = kaseikyo(0x002A, 0x01, 0x12);
    expect(code.frequency).toBe(38000);
    expect(code.protocol).toBe("kaseikyo");
    expect(code.pattern[0]).toBe(3380);
    expect(code.pattern[1]).toBe(1690);
  });

  it("should parse Pronto Hex string correctly", () => {
    const prontoHex = "0000 006d 0002 0000 0156 00ab 0015 0015";
    const code = pronto(prontoHex);
    expect(code.protocol).toBe("pronto");
    expect(code.frequency).toBeGreaterThan(30000);
    expect(code.frequency).toBeLessThan(50000);
    expect(code.pattern.length).toBe(4);
  });
});

describe("TV Brands Database", () => {
  it("should have over 40 brands defined", () => {
    expect(BRANDS.length).toBeGreaterThan(40);
  });

  it("should have at least one valid code per brand", () => {
    BRANDS.forEach((brand) => {
      expect(brand.name).toBeTruthy();
      expect(brand.codes.length).toBeGreaterThan(0);
      brand.codes.forEach((code) => {
        expect(code.frequency).toBeGreaterThan(20000);
        expect(code.pattern.length).toBeGreaterThan(0);
      });
    });
  });

  it("should generate a complete flat list of power off codes", () => {
    expect(POWER_OFF_CODES.length).toBeGreaterThan(100);
  });

  it("should include Digihome 24225SMLED in the TV database", () => {
    const digihome = BRANDS.find((b) => b.name.includes("Digihome"));
    expect(digihome).toBeDefined();
    expect(digihome?.models).toContain("24225SMLED");
    expect(digihome?.codes.length).toBeGreaterThan(5);
  });
});
