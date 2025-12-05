import { Entity } from './Entity.js';

export class Enemy extends Entity {
    constructor(name, maxHP) {
        super(name, maxHP);
        this.currentIntent = null; // { type: 'ATTACK' | 'DEFEND', value: number }
        this.generateIntent();
    }

    generateIntent() {
        // Simple AI: 70% Attack, 30% Defend
        const roll = Math.random();

        if (roll < 0.7) {
            // Attack for 8-12 damage
            const dmg = Math.floor(Math.random() * 5) + 8;
            this.currentIntent = {
                type: 'ATTACK',
                value: dmg,
                text: `Attack (${dmg})`
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
