import { logManager } from '../../core/LogManager.js';
import { StatusEffectManager } from '../StatusEffectManager.js';
import { EventBus } from '../../core/EventBus.js';
import { EVENTS } from '../../core/Constants.js';

export class Entity {
    constructor(name, maxHP) {
        this.name = name;
        this.maxHP = maxHP;
        this.currentHP = maxHP;
        this.block = 0;
        this.isDead = false;
        this.statusManager = new StatusEffectManager(this);
    }

    takeDamage(amount, source = null) {
        if (this.isDead) return 0;

        // Status Effects Reaction (Thorns)
        this.statusManager.onHit(source);

        let actualDamage = amount;

        // Block mitigation
        if (this.block > 0) {
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
    }

    addBlock(amount) {
        if (this.isDead) return;
        this.block += amount;
        logManager.log(`${this.name} gained ${amount} block.`, 'block');
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
