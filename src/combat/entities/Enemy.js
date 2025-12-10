import { Entity } from './Entity.js';

export class Enemy extends Entity {
    constructor(name, maxHP) {
        super(name, maxHP);
        this.currentIntent = null;
        this.forcedIntents = [];
    }

    getStrength() {
        // Base strength (0) + Status Strength
        return this.statusManager ? this.statusManager.getStack('STRENGTH') : 0;
    }

    generateIntent() {
        // Simple AI: 70% Attack, 30% Defend
        // NOTE: This default AI is overridden by CombatManager's moveset logic usually.
        // But let's keep it safe.
        const roll = Math.random();

        // Use getStrength() for damage calculation
        const str = this.getStrength();

        if (roll < 0.7) {
            // Attack for 8-12 damage + Strength
            const baseDmg = Math.floor(Math.random() * 5) + 8;
            const finalDmg = baseDmg + str;
            this.currentIntent = {
                type: 'ATTACK',
                value: finalDmg,
                text: `Attack (${finalDmg})`
            };
        } else {
            // Defend for 5-10 block
            const block = Math.floor(Math.random() * 6) + 5;
            this.currentIntent = {
                type: 'DEFEND',
                value: block,
                text: `Block (${block})`
            };
        }

        console.log(`${this.name} intends to: ${this.currentIntent.text}`);
    }

    executeIntent(target) {
        if (this.isDead || !this.currentIntent) return;

        const { type, value } = this.currentIntent;

        if (type === 'ATTACK') {
            const dealt = target.takeDamage(value);
            console.log(`${this.name} attacked ${target.name} for ${dealt} damage!`);
        } else if (type === 'DEFEND') {
            this.addBlock(value);
            console.log(`${this.name} gained ${value} block!`);
        }
    }
}
