"use strict";
/**
 * LanguageService - Manages language and localization settings
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageService = exports.SUPPORTED_LANGUAGES = exports.DEFAULT_LANGUAGE_CONFIG = void 0;
exports.DEFAULT_LANGUAGE_CONFIG = {
    language: "en",
};
exports.SUPPORTED_LANGUAGES = [
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
    { code: "zh-TW", name: "繁體中文" },
    { code: "ja", name: "日本語" },
    { code: "ko", name: "한국어" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "pt", name: "Português" },
    { code: "ru", name: "Русский" },
];
class LanguageService {
    constructor(config) {
        this.config = { ...exports.DEFAULT_LANGUAGE_CONFIG, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    getLanguage() {
        return this.config.language;
    }
    setLanguage(language) {
        const supported = exports.SUPPORTED_LANGUAGES.find((l) => l.code === language);
        if (supported) {
            this.config.language = language;
        }
    }
    getSupportedLanguages() {
        return [...exports.SUPPORTED_LANGUAGES];
    }
    isLanguageSupported(language) {
        return exports.SUPPORTED_LANGUAGES.some((l) => l.code === language);
    }
    getCurrentLanguageName() {
        const lang = exports.SUPPORTED_LANGUAGES.find((l) => l.code === this.config.language);
        return lang?.name || "English";
    }
}
exports.LanguageService = LanguageService;
//# sourceMappingURL=index.js.map