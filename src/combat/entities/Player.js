import { Entity } from './Entity.js';

export class Player extends Entity {
    constructor(maxHP) {
        super('Player', maxHP);
        this.mana = 0;
        this.gold = 0;
    }

    addMana(amount) {
        this.mana += amount;
    }

    addGold(amount) {
        this.gold += amount;
    }

    spendMana(amount) {
        if (this.mana >= amount) {
            this.mana -= amount;
            return true;
        }
        return false;
    }
}
