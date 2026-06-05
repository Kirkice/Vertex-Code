"use strict";
/**
 * NotificationService - Manages notification settings (sound and TTS)
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = exports.DEFAULT_NOTIFICATION_CONFIG = void 0;
exports.DEFAULT_NOTIFICATION_CONFIG = {
    ttsEnabled: false,
    ttsSpeed: 1.0,
    soundEnabled: true,
    soundVolume: 0.5,
};
class NotificationService {
    constructor(config) {
        this.config = { ...exports.DEFAULT_NOTIFICATION_CONFIG, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    // TTS settings
    isTtsEnabled() {
        return this.config.ttsEnabled;
    }
    setTtsEnabled(enabled) {
        this.config.ttsEnabled = enabled;
    }
    getTtsSpeed() {
        return Math.min(Math.max(0.5, this.config.ttsSpeed), 2.0);
    }
    setTtsSpeed(speed) {
        this.config.ttsSpeed = Math.min(Math.max(0.5, speed), 2.0);
    }
    // Sound settings
    isSoundEnabled() {
        return this.config.soundEnabled;
    }
    setSoundEnabled(enabled) {
        this.config.soundEnabled = enabled;
    }
    getSoundVolume() {
        return Math.min(Math.max(0, this.config.soundVolume), 1.0);
    }
    setSoundVolume(volume) {
        this.config.soundVolume = Math.min(Math.max(0, volume), 1.0);
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=index.js.map