
export class RunManager {
    constructor() {
        if (RunManager.instance) {
            return RunManager.instance;
        }
        RunManager.instance = this;

        this.player = {
            currentHP: 100,
            maxHP: 100,
            gold: 0,
            mana: 0 // Mana resets between battles usually? User said "give sense to mana so player spends it". Usually mana is per-battle. Let's keep it per-battle for now, or persistent?
            // "RunManager... drží data... currentHP, maxHP, gold"
            // Mana is often per battle. I will stick to HP/Gold for persistence across battles unless specified.
            // Wait, "Deck (skills)" IS persistent.
        };

        this.map = [];
        this.currentTier = 0;
    }

    startNewRun() {
        this.player.currentHP = this.player.maxHP;
        this.player.gold = 0;
        this.generateMap();
        this.currentTier = 0;
    }

    generateMap() {
        this.map = [
            // Tier 0: Weak Enemies
            [
                { type: 'BATTLE', id: '0-0', status: 'AVAILABLE', enemyId: 'slime' },
                { type: 'BATTLE', id: '0-1', status: 'AVAILABLE', enemyId: 'rat' }
            ],
            // Tier 1: Medium Enemies
            [
                { type: 'BATTLE', id: '1-0', status: 'LOCKED', enemyId: 'orc' },
                { type: 'BATTLE', id: '1-1', status: 'LOCKED', enemyId: 'skeleton' }
            ],
            // Tier 2: Boss
            [
                { type: 'BOSS', id: '2-0', status: 'LOCKED', enemyId: 'dragon' }
            ]
        ];
        return this.map;
    }

    getNode(tier, index) {
        if (this.map[tier] && this.map[tier][index]) {
            return this.map[tier][index];
        }
        return null;
    }

    completeLevel() {
        this.currentTier++;
        // Unlock next tier
        if (this.map[this.currentTier]) {
            this.map[this.currentTier].forEach(node => node.status = 'AVAILABLE');
        }
    }

    updatePlayerState(hp, gold) {
        this.player.currentHP = hp;
        this.player.gold = gold;
    }
}

export const runManager = new RunManager();
