/**
 * @file EventBus.js
 * @description Central Event Bus for handling communication between decoupled systems (Grid, UI, Phaser Scenes).
 * @dependencies None
 */

class EventBusImpl {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} eventName 
     * @param {Function} callback 
     */
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName 
     * @param {Function} callback 
     */
    off(eventName, callback) {
        if (!this.events[eventName]) return;
        this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    }

    /**
     * Emit an event with data
     * @param {string} eventName 
     * @param {*} data 
     */
    emit(eventName, data) {
        if (eventName === 'grid:item_updated') {
            const listeners = this.events[eventName] || [];
            console.log(`[EventBus] Emitting 'grid:item_updated'. Listeners: ${listeners.length}`);
            listeners.forEach((callback, index) => {
                console.log(`[EventBus] Executing Listener #${index}:`, callback);
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[EventBus] Listener #${index} FAILED:`, err);
                }
            });
            return; // Already handled
        }

        if (!this.events[eventName]) return;
        this.events[eventName].forEach(callback => callback(data));
    }
}

export const EventBus = new EventBusImpl();
