import { Entity } from './Entity.js';

export class Player extends Entity {
    constructor(maxHP) {
        super('Player', maxHP);
        this.mana = 0;
        this.gold = 0;
        this.strength = 0;
        this.skills = []; // Equipped skills (IDs)
    }


    addStrength(amount) {
        this.strength += amount;
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
