import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  SPOKEN_LANGUAGES,
  languageLabel,
  spokenLanguage,
} from "../src/lib/voice/languages";

describe("spoken language selection", () => {
  it("falls back to English for profiles saved before this setting existed", () => {
    expect(spokenLanguage(undefined)).toBe("en");
    expect(languageLabel(undefined)).toBe("English");
  });

  it("refuses a code the SDK does not accept", () => {
    expect(spokenLanguage("xx")).toBe(DEFAULT_LANGUAGE);
    expect(spokenLanguage("../../etc/passwd")).toBe(DEFAULT_LANGUAGE);
    expect(spokenLanguage("")).toBe(DEFAULT_LANGUAGE);
    expect(spokenLanguage("EN")).toBe(DEFAULT_LANGUAGE);
  });

  it("covers the full set the installed SDK accepts", () => {
    // Guards against the list drifting from the SDK on a dependency bump.
    expect(LANGUAGE_CODES.length).toBe(72);
    for (const code of ["ja", "zh", "ar", "pt-br", "cy"])
      expect(spokenLanguage(code)).toBe(code);
  });

  it("keeps a supported language", () => {
    for (const { code, label } of SPOKEN_LANGUAGES) {
      expect(spokenLanguage(code)).toBe(code);
      expect(languageLabel(code)).toBe(label);
    }
  });

  it("offers English and no duplicate codes", () => {
    expect(LANGUAGE_CODES).toContain("en");
    expect(new Set(LANGUAGE_CODES).size).toBe(LANGUAGE_CODES.length);
  });

  it("starts every page load in English", () => {
    // The selection lives in React state only, so a reload cannot restore it.
    expect(DEFAULT_LANGUAGE).toBe("en");
  });
});
