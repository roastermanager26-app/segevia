import { describe, expect, it } from "vitest";
import { backoffSeconds, hasAtLeastRole, isKnownJobType, parseJobPayload } from "./index";

describe("roles", () => {
  it("respeta la jerarquía", () => {
    expect(hasAtLeastRole("owner", "admin")).toBe(true);
    expect(hasAtLeastRole("operator", "admin")).toBe(false);
    expect(hasAtLeastRole(null, "viewer")).toBe(false);
  });
});

describe("jobs", () => {
  it("calcula backoff exponencial con tope", () => {
    expect(backoffSeconds(1)).toBe(15);
    expect(backoffSeconds(2)).toBe(30);
    expect(backoffSeconds(3)).toBe(60);
    expect(backoffSeconds(20)).toBe(3600);
  });

  it("valida payloads conocidos y rechaza inválidos", () => {
    expect(isKnownJobType("system.ping")).toBe(true);
    expect(isKnownJobType("nope")).toBe(false);
    expect(parseJobPayload("system.ping", { message: "hola" })).toEqual({ message: "hola" });
    expect(() => parseJobPayload("system.ping", { message: 1 })).toThrow();
  });
});
