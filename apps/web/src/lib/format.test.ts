import { describe, expect, it } from "vitest";
import { formatUsd, slugify } from "./format";

describe("format", () => {
  it("slugify normaliza acentos y símbolos", () => {
    expect(slugify("  Acme Argentina — Sede Córdoba! ")).toBe("acme-argentina-sede-cordoba");
  });

  it("formatUsd muestra la moneda explícita", () => {
    expect(formatUsd(382.4)).toContain("USD");
  });
});
