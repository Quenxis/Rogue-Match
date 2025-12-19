import { logManager } from '../../core/LogManager.js';
import { StatusEffectManager } from '../StatusEffectManager.js';
import { EventBus } from '../../core/EventBus.js';
import { EVENTS, STATUS_TYPES, GAME_SETTINGS } from '../../core/Constants.js';

export class Entity {
    constructor(name, maxHP) {
        this.name = name;
        this.maxHP = maxHP;
        this.currentHP = maxHP;
        this.block = 0;
        this.isDead = false;
        this.statusManager = new StatusEffectManager(this);
    }

    takeDamage(amount, source = null, options = {}) {
        if (this.isDead) return 0;

        let actualDamage = amount;

        // -1. Invulnerable Check
        if (this.statusManager.getStack(STATUS_TYPES.INVULNERABLE) > 0) {
            logManager.log(`${this.name} is INVULNERABLE! Damage negated.`, 'block');
            // Consume 1 stack? Usually Fortress says "for 1 hit".
            this.statusManager.removeStack(STATUS_TYPES.INVULNERABLE, 1);
            EventBus.emit(EVENTS.ENTITY_DEFENDED, { entity: this, amount: 0, type: 'INVULNERABLE' }); // Signal visual 
            return 0;
        }

        // 0. Source Weakness Check (Reduces incoming damage)
        if (source && source.statusManager && source.statusManager.getStack(STATUS_TYPES.WEAKNESS) > 0) {
            actualDamage = Math.floor(actualDamage * 0.75); // 25% reduction
            // logManager.log(`Attack reduced by Weakness!`, 'info');
        }

        // 1. Vulnerable Check
        if (this.statusManager.getStack(STATUS_TYPES.VULNERABLE) > 0) {
            actualDamage = Math.ceil(actualDamage * GAME_SETTINGS.VULNERABLE_MULTIPLIER);
        }

        // 2. Block mitigation (Skipped if Piercing)
        if (this.block > 0 && !options.isPiercing) {
            if (this.block >= actualDamage) {
                this.block -= actualDamage;
                actualDamage = 0;
                logManager.log(`${this.name} blocked ${amount} damage!`, 'block');
            } else {
                actualDamage -= this.block;
                logManager.log(`${this.name} blocked ${this.block} damage, took ${actualDamage}!`, 'damage');
                this.block = 0;
            }
        } else {
            if (actualDamage > 0) {
                logManager.log(`${this.name} took ${actualDamage} damage!`, 'damage');
            }
        }

        // Emit Generic Event for Animations (regardless of damage taken, we might want "Hit" effect or "Block" effect)
        // If fully blocked, we might want a different effect?
        // Current CombatView logic: damage > 0 -> Red tint, damage == 0 -> Block tint (if blocked).
        // Let's pass the raw attempt + actual taken so View can decide.
        EventBus.emit(EVENTS.ENTITY_DAMAGED, {
            entity: this,
            amount: actualDamage, // Actual HP lost
            rawAmount: amount, // Input damage
            source: source,
            type: options.type || 'NORMAL',
            isPiercing: options.isPiercing || false,
            skipAnimation: options.skipAnimation || false
        });

        // Status Effects Reaction (Thorns, etc.) runs AFTER visual damage trigger
        // This ensures the "Attack" animation starts before the "Thorns" return damage animation.
        this.statusManager.onHit(source);

        this.currentHP = Math.max(0, this.currentHP - actualDamage);

        if (this.currentHP <= 0) {
            this.currentHP = 0;
            this.die();
        }

        return actualDamage; // Return damage taken (for UI logs)
    }

    heal(amount) {
        if (this.isDead) return;
        this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
        logManager.log(`${this.name} healed for ${amount} HP.`, 'heal');

        EventBus.emit(EVENTS.ENTITY_HEALED, {
            entity: this,
            amount: amount
        });
    }

    addBlock(amount) {
        if (this.isDead) return;
        this.block += amount;
        logManager.log(`${this.name} gained ${amount} block.`, 'block');

        if (amount > 0) {
            EventBus.emit(EVENTS.ENTITY_DEFENDED, {
                entity: this,
                amount: amount
            });
        }
    }

    resetBlock() {
        if (this.block > 0) {
            // logManager.log(`${this.name} block expired.`, 'info'); // Optional spam
            this.block = 0;
        }
    }

    die() {
        this.isDead = true;
        logManager.log(`${this.name} has died!`, 'turn');
        // Emit event so CombatManager can check win/lose conditions
        EventBus.emit(EVENTS.ENTITY_DIED, { entity: this });
    }
}
