/**
 * Every language the installed ElevenLabs agent SDK accepts as a conversation
 * override, listed with its own native name. Generated from the SDK typing
 * ConversationConfigOverrideAgentLanguage, English first then alphabetical.
 *
 * A language still has to be added to the agent Additional languages in the
 * ElevenLabs dashboard, and the agent must allow the language override.
 * Anything it is not configured for falls back to the agent default.
 */
export const SPOKEN_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
  { code: "az", label: "Azərbaycan" },
  { code: "bs", label: "Bosanski" },
  { code: "ca", label: "Català" },
  { code: "cs", label: "Čeština" },
  { code: "cy", label: "Cymraeg" },
  { code: "da", label: "Dansk" },
  { code: "de", label: "Deutsch" },
  { code: "et", label: "Eesti" },
  { code: "es", label: "Español" },
  { code: "tl", label: "Filipino" },
  { code: "fr", label: "Français" },
  { code: "ga", label: "Gaeilge" },
  { code: "gl", label: "Galego" },
  { code: "ha", label: "Hausa" },
  { code: "hr", label: "Hrvatski" },
  { code: "id", label: "Indonesia" },
  { code: "is", label: "Íslenska" },
  { code: "it", label: "Italiano" },
  { code: "jv", label: "Jawa" },
  { code: "sw", label: "Kiswahili" },
  { code: "lv", label: "Latviešu" },
  { code: "lb", label: "Lëtzebuergesch" },
  { code: "lt", label: "Lietuvių" },
  { code: "hu", label: "Magyar" },
  { code: "ms", label: "Melayu" },
  { code: "nl", label: "Nederlands" },
  { code: "no", label: "Norsk" },
  { code: "pl", label: "Polski" },
  { code: "pt", label: "Português" },
  { code: "pt-br", label: "Português (Brasil)" },
  { code: "ro", label: "Română" },
  { code: "sk", label: "Slovenčina" },
  { code: "sl", label: "Slovenščina" },
  { code: "so", label: "Soomaali" },
  { code: "fi", label: "Suomi" },
  { code: "sv", label: "Svenska" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "tr", label: "Türkçe" },
  { code: "el", label: "Ελληνικά" },
  { code: "be", label: "Беларуская" },
  { code: "bg", label: "Български" },
  { code: "ky", label: "Кыргызча" },
  { code: "kk", label: "Қазақ тілі" },
  { code: "mk", label: "Македонски" },
  { code: "ru", label: "Русский" },
  { code: "sr", label: "Српски" },
  { code: "uk", label: "Українська" },
  { code: "ka", label: "Ქართული" },
  { code: "hy", label: "Հայերեն" },
  { code: "he", label: "עברית" },
  { code: "ur", label: "اردو" },
  { code: "ar", label: "العربية" },
  { code: "ps", label: "پښتو" },
  { code: "sd", label: "سنڌي" },
  { code: "fa", label: "فارسی" },
  { code: "ne", label: "नेपाली" },
  { code: "mr", label: "मराठी" },
  { code: "hi", label: "हिन्दी" },
  { code: "as", label: "অসমীয়া" },
  { code: "bn", label: "বাংলা" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "th", label: "ไทย" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
] as const;

export type SpokenLanguage = (typeof SPOKEN_LANGUAGES)[number]["code"];
export const LANGUAGE_CODES = SPOKEN_LANGUAGES.map((l) => l.code) as [
  SpokenLanguage,
  ...SpokenLanguage[],
];
export const DEFAULT_LANGUAGE: SpokenLanguage = "en";

/** Never trust a stored or supplied code: fall back rather than assume. */
export function spokenLanguage(value: string | undefined): SpokenLanguage {
  return LANGUAGE_CODES.includes(value as SpokenLanguage)
    ? (value as SpokenLanguage)
    : DEFAULT_LANGUAGE;
}

export function languageLabel(code: string | undefined) {
  return (
    SPOKEN_LANGUAGES.find((l) => l.code === spokenLanguage(code))?.label ??
    "English"
  );
}
