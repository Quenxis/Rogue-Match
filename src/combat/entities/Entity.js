export class Entity {
    constructor(name, maxHP) {
        this.name = name;
        this.maxHP = maxHP;
        this.currentHP = maxHP;
        this.block = 0;
        this.isDead = false;
    }

    takeDamage(amount) {
        if (this.isDead) return 0;

        let actualDamage = amount;

        // Block mitigation
        if (this.block > 0) {
            if (this.block >= actualDamage) {
                this.block -= actualDamage;
                actualDamage = 0;
            } else {
                actualDamage -= this.block;
                this.block = 0;
            }
        }

        this.currentHP = Math.max(0, this.currentHP - actualDamage);

        if (this.currentHP === 0) {
            this.die();
        }

        return actualDamage; // Return damage taken (for UI logs)
    }

    heal(amount) {
        if (this.isDead) return;
        this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
    }

    addBlock(amount) {
        if (this.isDead) return;
        this.block += amount;
    }

    resetBlock() {
        this.block = 0;
    }

    die() {
        this.isDead = true;
        console.log(`${this.name} has died!`);
    }
}
