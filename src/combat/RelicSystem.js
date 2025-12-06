/**
 * @file RelicSystem.js
 * @description Manages passive relic effects using the Observer pattern.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Constants.js';
import { runManager } from '../core/RunManager.js';
import { RELICS } from '../data/relics.js';
import { logManager } from '../core/LogManager.js';

export class RelicSystem {
    constructor(combatManager) {
        this.combatManager = combatManager;

        // Bind methods to ensure correct 'this' context when called by EventBus
        this.onMatchesFound = this.onMatchesFound.bind(this);
        this.onVictory = this.onVictory.bind(this);
        this.onDefend = this.onDefend.bind(this);

        this.bindEvents();
    }

    bindEvents() {
        EventBus.on(EVENTS.MATCHES_FOUND, this.onMatchesFound, this);
        EventBus.on(EVENTS.VICTORY, this.onVictory, this);
        EventBus.on(EVENTS.ENEMY_ATTACK, this.onDefend, this);
    }

    destroy() {
        EventBus.off(EVENTS.MATCHES_FOUND, this.onMatchesFound, this);
        EventBus.off(EVENTS.VICTORY, this.onVictory, this);
        EventBus.off(EVENTS.ENEMY_ATTACK, this.onDefend, this);
    }

    get combatContext() {
        // Create a compatibility layer for existing hooks
        // Hooks expect: { player, enemy, log(), ... }
        return {
            player: this.combatManager.player,
            enemy: this.combatManager.enemy,
            log: (msg) => logManager.log(msg, 'relic'),
            // Some hooks might access other combat props, but these are the big ones
            emitState: () => this.combatManager.emitState()
        };
    }

    triggerHook(hookName, ...args) {
        const relicIds = runManager.getRelics();
        const context = this.combatContext;
        let anyTriggered = false;

        relicIds.forEach(id => {
            const relic = RELICS[id];
            if (relic && relic.hooks && relic.hooks[hookName]) {
                try {
                    const triggered = relic.hooks[hookName](context, ...args);
                    if (triggered) {
                        anyTriggered = true;
                        EventBus.emit(EVENTS.RELIC_TRIGGERED, { relicId: id });
                    }
                } catch (e) {
                    console.error(`Error in relic hook ${id}.${hookName}: `, e);
                }
            }
        });

        if (anyTriggered) {
            this.combatManager.emitState(); // Refresh UI if anything changed
        }
    }

    onMatchesFound(data) {
        const { matches } = data;
        // Logic duplicated from old CombatManager to calculate counts, 
        // OR we can rely on the hook expecting (combat, count, type).
        // Wait, the old logic iterated types.
        // We should replicate that grouping here effectively.

        const matchCounts = {};
        matches.forEach(m => {
            let type = m.type;
            if (!type) {
                // If type missing, try to resolve from grid (risky if already cleared?)
                // Actually CombatManager handled this.
                // For safety, let's assume type is passed or we skip.
                return;
            }
            matchCounts[type] = (matchCounts[type] || 0) + 1;
        });

        // Loop counts and trigger
        Object.entries(matchCounts).forEach(([type, count]) => {
            this.triggerHook('onMatch', count, type);
        });
    }

    onVictory() {
        this.triggerHook('onVictory');
    }

    onDefend(data) {
        // data should contain { damage, intent } etc
        // Spiked Shield hook: onDefend(combat, damage)
        const damage = data.damage || 0;
        this.triggerHook('onDefend', damage);
    }
}
