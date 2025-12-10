/**
 * @file StatusEffectManager.js
 * @description Manages stack-based status effects for an Entity.
 */

import { STATUS_TYPES } from '../core/Constants.js';
import { logManager } from '../core/LogManager.js';

const CONFIG = {
    [STATUS_TYPES.BLEED]: { max: 99, category: 'DEBUFF' },
    [STATUS_TYPES.REGEN]: { max: 99, category: 'BUFF' },
    [STATUS_TYPES.THORNS]: { max: 99, category: 'BUFF' },
    [STATUS_TYPES.FOCUS]: { max: 2, category: 'BUFF' },
    [STATUS_TYPES.CRITICAL]: { max: 2, category: 'BUFF' },
    [STATUS_TYPES.VULNERABLE]: { max: 99, category: 'DEBUFF' },
    [STATUS_TYPES.STRENGTH]: { max: 99, category: 'BUFF' }
};

export class StatusEffectManager {
    constructor(entity) {
        this.entity = entity;
        this.stacks = {}; // { TYPE: currentAmount }

        // Initialize
        Object.values(STATUS_TYPES).forEach(type => {
            this.stacks[type] = 0;
        });
    }

    /**
     * Apply stacks of a specific effect type.
     * Logic: Current = Math.Min(Current + New, Max)
     */
    applyStack(type, amount) {
        if (!CONFIG[type]) return;

        const current = this.stacks[type] || 0;
        const max = CONFIG[type].max;

        const newTotal = Math.min(current + amount, max);
        const added = newTotal - current;

        if (added > 0) {
            this.stacks[type] = newTotal;
            logManager.log(`${this.entity.name} gained ${added} ${type} (Total: ${newTotal})`, 'info');
        }
    }

    removeStack(type, amount) {
        if (!this.stacks[type]) return;
        this.stacks[type] = Math.max(0, this.stacks[type] - amount);
        // logManager.log(`${this.entity.name} lost ${amount} ${type}`, 'info');
    }

    getStack(type) {
        return this.stacks[type] || 0;
    }

    /**
     * Reduces all DEBUFF stacks by 'amount'.
     */
    cleanse(amount) {
        Object.values(STATUS_TYPES).forEach(type => {
            if (CONFIG[type].category === 'DEBUFF' && this.stacks[type] > 0) {
                const initial = this.stacks[type];
                this.removeStack(type, amount);
                const removed = initial - this.stacks[type];
                if (removed > 0) {
                    logManager.log(`${this.entity.name} cleansed ${removed} ${type}!`, 'heal');
                }
            }
        });
    }

    /**
     * Called at the START of the turn.
     * Phase A: Activate Effect
     * Phase B: Decay
     */
    onTurnStart() {
        // BLEED: Dot Damage
        const bleed = this.getStack(STATUS_TYPES.BLEED);
        if (bleed > 0) {
            this.entity.takeDamage(bleed);
            logManager.log(`${this.entity.name} took ${bleed} bleed damage.`, 'damage');
        }

        // REGEN: Heal
        const regen = this.getStack(STATUS_TYPES.REGEN);
        if (regen > 0) {
            this.entity.heal(regen);
        }
    }

    onTurnEnd() {
        // DECAY Logic
        // Bleed, Regen, Thorns, Vulnerable decay by 1.
        [STATUS_TYPES.BLEED, STATUS_TYPES.REGEN, STATUS_TYPES.THORNS, STATUS_TYPES.VULNERABLE].forEach(type => {
            if (this.stacks[type] > 0) {
                this.removeStack(type, 1);
            }
        });
    }

    /**
     * Called when the entity IS HIT by an attack.
     * @param {Entity} attacker 
     */
    onHit(attacker) {
        // Thorns Logic - Reflects damage to attacker
        // NOTE: Thorns do NOT consume stacks on hit. They only decay at turn start.
        const thorns = this.getStack(STATUS_TYPES.THORNS);
        if (thorns > 0 && attacker) {
            attacker.takeDamage(thorns);
            logManager.log(`${attacker.name} took ${thorns} thorns damage!`, 'damage');
        }
    }

    /**
     * Called when the entity USES a skill or ATTACKS.
     * Logic: Consumable buffs (Focus, Critical)
     */
    consumeStacks(type) {
        if (this.stacks[type] > 0) {
            this.removeStack(type, 999); // Remove All
        }
    }
}
