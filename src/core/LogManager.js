import { EventBus } from './EventBus.js';

export class LogManager {
    constructor() {
        if (LogManager.instance) {
            return LogManager.instance;
        }
        LogManager.instance = this;
        this.history = []; // optional: keep history
    }

    init(containerId) {
        // No DOM init needed
    }

    log(message, type = 'info') {
        const time = this.getTime();
        const entry = { message, type, time };
        this.history.push(entry);

        // Emit event for Phaser View to pick up
        EventBus.emit('log:entry', entry);
    }

    clear() {
        this.history = [];
        EventBus.emit('log:clear');
    }

    getTime() {
        const now = new Date();
        return now.toTimeString().split(' ')[0].substring(0, 8); // HH:MM:SS
    }
}

export const logManager = new LogManager();
