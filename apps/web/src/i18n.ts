import { concepts } from "@triveni/content";
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

// The teacher's app is in Hindi, with English one tap away. One namespace per screen, in
// locales/{en,hi}/<screen>.json, plus common.json.

export type UiLanguage = "hi" | "en";

const files = import.meta.glob<{ default: Record<string, unknown> }>("./locales/*/*.json", { eager: true });
const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, file] of Object.entries(files)) {
  const [, language, namespace] = path.match(/\/locales\/(\w+)\/(\w+)\.json$/)!;
  (resources[language] ??= {})[namespace] = file.default;
}

const storageKey = "triveni-language";
// localStorage can throw (private mode, blocked storage): fall back to Hindi.
function saved(): UiLanguage {
  try {
    return localStorage.getItem(storageKey) === "en" ? "en" : "hi";
  } catch {
    return "hi";
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: saved(),
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export function setLanguage(language: UiLanguage) {
  i18n.changeLanguage(language);
  document.documentElement.lang = language;
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // Not remembered, but the app still switches.
  }
}
// Tests run without a document.
if (typeof document !== "undefined") document.documentElement.lang = i18n.language;

// The interface language, and a concept's name in it.
export function useUiLanguage() {
  const { i18n: current } = useTranslation();
  const language = current.language as UiLanguage;
  const conceptName = (id: string) => {
    const concept = concepts.find((c) => c.id === id);
    return (language === "hi" ? concept?.nameHi : concept?.name) ?? id;
  };
  // Dates like "Fri, 30 Oct" or "शुक्र, 30 अक्टू॰".
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return { language, conceptName, formatDate };
}

export default i18n;
