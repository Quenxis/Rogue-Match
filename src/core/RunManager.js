
export class RunManager {
    constructor() {
        if (RunManager.instance) {
            return RunManager.instance;
        }
        RunManager.instance = this;

        this.player = {
            currentHP: 100,
            maxHP: 100,
            gold: 99, // Testing start amount
            relics: [], // Array of IDs
            potions: [], // Array of Objects { id, name, effect }
            deck: ['FIREBALL', 'HEAL'] // Initial Skills
        };

        this.map = [];
        this.currentTier = 0;
    }

    startNewRun() {
        this.player.currentHP = this.player.maxHP;
        this.player.gold = 99;
        this.player.relics = [];
        this.player.potions = [];
        this.player.deck = ['FIREBALL', 'HEAL'];

        this.generateMap();
        this.currentTier = 0;
    }

    // --- Inventory System ---
    addRelic(relicId) {
        if (!this.player.relics.includes(relicId)) {
            this.player.relics.push(relicId);
            console.log(`Relic added: ${relicId}`);
            return true;
        }
        return false;
    }

    addPotion(potion) {
        if (this.player.potions.length < 3) {
            this.player.potions.push(potion);
            console.log(`Potion added: ${potion.id}`);
            return true;
        }
        console.log('Inventory Full: Cannot add potion');
        return false;
    }

    removePotion(index) {
        if (index >= 0 && index < this.player.potions.length) {
            const removed = this.player.potions.splice(index, 1);
            return removed[0];
        }
        return null;
    }

    hasRelic(relicId) {
        return this.player.relics.includes(relicId);
    }

    addGold(amount) {
        this.player.gold += amount;
    }

    spendGold(amount) {
        if (this.player.gold >= amount) {
            this.player.gold -= amount;
            return true;
        }
        return false;
    }

    // --- Map Generation ---
    generateMap() {
        this.map = [];
        const tiers = 10;

        for (let i = 0; i < tiers; i++) {
            const nodes = [];
            // Simple structure: 2-3 nodes per tier
            // Tier 0: Weak Battle
            // Tier 4: Shop
            // Tier 9: Boss

            let type = 'BATTLE';
            let enemyId = 'slime'; // Default
            let status = (i === 0) ? 'AVAILABLE' : 'LOCKED';

            if (i === 0) {
                nodes.push({ type: 'BATTLE', id: `0-0`, status: 'AVAILABLE', enemyId: 'slime' });
                nodes.push({ type: 'BATTLE', id: `0-1`, status: 'AVAILABLE', enemyId: 'rat' });
            } else if (i === 4) {
                nodes.push({ type: 'SHOP', id: `${i}-0`, status: 'LOCKED' });
            } else if (i === 9) {
                nodes.push({ type: 'BOSS', id: `${i}-0`, status: 'LOCKED', enemyId: 'dragon' });
            } else {
                // Random mix for intermediate tiers
                const count = Math.floor(Math.random() * 2) + 2; // 2 or 3 nodes
                for (let j = 0; j < count; j++) {
                    const rand = Math.random();
                    if (rand < 0.2) type = 'TREASURE'; // 20%
                    else if (rand < 0.4) type = 'EVENT'; // 20%
                    else if (rand < 0.5 && i > 2) type = 'ELITE'; // 10% (later tiers)
                    else type = 'BATTLE';

                    // Assign simple enemies for now
                    const enemies = ['slime', 'rat', 'skeleton', 'orc'];
                    enemyId = enemies[Math.floor(Math.random() * enemies.length)];

                    nodes.push({ type, id: `${i}-${j}`, status: 'LOCKED', enemyId });
                }
            }
            this.map.push(nodes);
        }
        return this.map;
    }

    getNode(tier, index) {
        if (this.map[tier] && this.map[tier][index]) {
            return this.map[tier][index];
        }
        return null;
    }

    completeLevel() {
        // Mark current nodes as COMPLETED (logic might need refinement if multiple paths)
        // For now, unlock next tier
        this.currentTier++;
        if (this.map[this.currentTier]) {
            this.map[this.currentTier].forEach(node => node.status = 'AVAILABLE');
        }
    }

    updatePlayerState(hp, gold) {
        this.player.currentHP = hp;
        this.player.gold = gold;
    }

    getRelics() {
        return this.player.relics;
    }

    applyEffect(effects) {
        let resultLog = [];

        if (effects.heal) {
            const oldHP = this.player.currentHP;
            this.player.currentHP = Math.min(this.player.currentHP + effects.heal, this.player.maxHP);
            resultLog.push(`Healed ${this.player.currentHP - oldHP} HP`);
        }
        if (effects.damage) {
            this.player.currentHP = Math.max(0, this.player.currentHP - effects.damage);
            resultLog.push(`Took ${effects.damage} Damage`);
        }
        if (effects.gold) {
            this.player.gold += effects.gold;
            if (this.player.gold < 0) this.player.gold = 0;
            const sign = effects.gold > 0 ? '+' : '';
            resultLog.push(`${sign}${effects.gold} Gold`);
        }
        if (effects.get_relic) {
            // Add specific relic or random?
            // For now assume logic handles selection, or effect passes ID
            // Here assume effect.get_relic is boolean (True = random) or String ID
            // BUT for simplicity let's say caller handles random selection if needed?
            // Actually Event logic usually is specific.
            // Let's defer random logic to EventScene.
        }

        // Simple Gambling Logic for Stranger Event
        if (effects.gamble_relic) {
            if (Math.random() < effects.gamble_relic) {
                // Win Relic!
                // Trigger in Scene? OR handle here?
                // Let's return a flag.
                resultLog.push("WON RELIC!");
                return { success: true, log: resultLog, gambleWon: true };
            } else {
                resultLog.push("Lost the gamble...");
                return { success: true, log: resultLog, gambleWon: false };
            }
        }

        return { success: true, log: resultLog };
    }
}

export const runManager = new RunManager();
