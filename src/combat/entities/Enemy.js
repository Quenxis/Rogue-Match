import { Entity } from './Entity.js';

export class Enemy extends Entity {
    constructor(name, maxHP) {
        super(name, maxHP);
        this.currentIntent = null; // { type: 'ATTACK' | 'DEFEND', value: number }
        this.buffs = []; // Array of { type: string, value: number, duration: number }
        this.generateIntent();
    }

    addBuff(type, value, duration) {
        this.buffs.push({ type, value, duration });
        console.log(`${this.name} gained buff: ${type} +${value} for ${duration} turns.`);
    }

    tickBuffs() {
        // Decrease duration
        this.buffs.forEach(buff => buff.duration--);
        // Remove expired
        const expired = this.buffs.filter(b => b.duration <= 0);
        if (expired.length > 0) {
            console.log(`${this.name} buffs expired:`, expired);
        }
        this.buffs = this.buffs.filter(b => b.duration > 0);
    }

    getStrength() {
        // Base strength (assume 0 for now as it wasn't tracked) + buffs
        // Or if base strength is properties check this.strength?
        // Entity doesn't seem to have strength property in snippet, assume 0 base.
        const buffStrength = this.buffs
            .filter(b => b.type === 'STRENGTH')
            .reduce((sum, b) => sum + b.value, 0);
        return (this.strength || 0) + buffStrength;
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
