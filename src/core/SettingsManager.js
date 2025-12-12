/**
 * @file SettingsManager.js
 * @description Handles persistent user settings using localStorage.
 */

export class SettingsManager {
    constructor() {
        this.STORAGE_KEY = 'rogue_match_settings';
        this.settings = this.load();
    }

    /**
     * Load settings from localStorage.
     * @returns {object}
     */
    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.warn('SettingsManager: Failed to load settings from localStorage.', e);
            return {};
        }
    }

    /**
     * Save current settings to localStorage.
     */
    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.warn('SettingsManager: Failed to save settings to localStorage.', e);
        }
    }

    /**
     * Get a setting value.
     * @param {string} key 
     * @param {*} defaultValue 
     * @returns {*}
     */
    get(key, defaultValue) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    /**
     * Set a setting value and save immediately.
     * @param {string} key 
     * @param {*} value 
     */
    set(key, value) {
        this.settings[key] = value;
        this.save();
    }
}

export const settingsManager = new SettingsManager();
