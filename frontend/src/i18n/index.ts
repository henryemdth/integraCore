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

export default i18n
