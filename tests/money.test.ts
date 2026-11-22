import { describe, expect, it } from "vitest";
import { formatINR, formatINRShort, parseRupees } from "../src/lib/money";

describe("money", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatINR(14500)).toBe("₹14,500");
    expect(formatINR(125000)).toBe("₹1,25,000");
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(-2500)).toBe("−₹2,500");
    expect(formatINR(999.6)).toBe("₹1,000");
  });
  it("formats compact tiles", () => {
    expect(formatINRShort(14500)).toBe("₹14.5k");
    expect(formatINRShort(120000)).toBe("₹1.2L");
    expect(formatINRShort(800)).toBe("₹800");
  });
  it("parses rupee input", () => {
    expect(parseRupees("₹1,500")).toBe(1500);
    expect(parseRupees("abc")).toBeNull();
  });
});
