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
        this.onTurnStart = this.onTurnStart.bind(this);
        this.onSwap = this.onSwap.bind(this);
        this.onSwapReverted = this.onSwapReverted.bind(this);
        this.onTurnEnd = this.onTurnEnd.bind(this);

        this.bindEvents();
    }

    bindEvents() {
        EventBus.on(EVENTS.MATCHES_FOUND, this.onMatchesFound, this);
        EventBus.on(EVENTS.VICTORY, this.onVictory, this);
        EventBus.on(EVENTS.ENEMY_ATTACK, this.onDefend, this);
        EventBus.on(EVENTS.TURN_START, this.onTurnStart, this);
        EventBus.on(EVENTS.ITEM_SWAPPED, this.onSwap, this);
        EventBus.on(EVENTS.ITEM_SWAP_REVERTED, this.onSwapReverted, this);
        EventBus.on(EVENTS.TURN_END, this.onTurnEnd, this);
    }
    destroy() {
        EventBus.off(EVENTS.MATCHES_FOUND, this.onMatchesFound, this);
        EventBus.off(EVENTS.VICTORY, this.onVictory, this);
        EventBus.off(EVENTS.ENEMY_ATTACK, this.onDefend, this);
        EventBus.off(EVENTS.TURN_START, this.onTurnStart, this);
        EventBus.off(EVENTS.ITEM_SWAPPED, this.onSwap, this);
        EventBus.off(EVENTS.ITEM_SWAP_REVERTED, this.onSwapReverted, this);
        EventBus.off(EVENTS.TURN_END, this.onTurnEnd, this);
    }

    get combatContext() {
        // Create a compatibility layer for existing hooks
        // Hooks expect: { player, enemy, log(), ... }

        // Capture 'this.combatManager' via closure to ensure access inside getters
        const cm = this.combatManager;
        return {
            player: cm.player,
            enemy: cm.enemy,
            log: (msg) => logManager.log(msg, 'relic'),
            emitState: () => cm.emitState(),
            get maxMoves() { return cm.maxMoves; },
            set maxMoves(v) { cm.maxMoves = v; },
            get currentMoves() { return cm.currentMoves; },
            set currentMoves(v) { cm.currentMoves = v; },
            get manager() { return cm; }
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
        const matchCounts = {};
        matches.forEach(m => {
            let type = m.type;
            if (!type) {
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
        const damage = data.damage || 0;
        this.triggerHook('onDefend', damage);
    }

    onTurnStart() {
        this.triggerHook('onTurnStart');
    }

    onSwap() {
        this.triggerHook('onSwap');
    }

    onSwapReverted() {
        this.triggerHook('onSwapReverted');
    }

    onTurnEnd() {
        this.triggerHook('onTurnEnd');
    }
}
