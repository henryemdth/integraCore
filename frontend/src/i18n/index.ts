import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import es from "./locales/es.json"
import en from "./locales/en.json"

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: localStorage.getItem("i18n_language") || "es",
  fallbackLng: "es",
  supportedLngs: ["es", "en"],
  interpolation: {
    escapeValue: false,
  },
})

// Keep the document language in sync so browser speech/translation features
// follow the in-app language switch.
document.documentElement.lang = i18n.language
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng
})

export default i18n
