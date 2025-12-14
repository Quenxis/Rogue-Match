import { ACTS } from '../data/acts.js';
import { HEROES } from '../data/heroes.js';

export class RunManager {
    constructor() {
        console.log('[RunManager] Constructor called (Singleton check)');
        if (RunManager.instance) {
            return RunManager.instance;
        }
        RunManager.instance = this;

        const initialState = {
            currentHP: 100,
            maxHP: 60,
            gold: 99,
            relics: ['crimson_hourglass'], // Testing
            potions: [],
            deck: ['FIREBALL', 'HEAL']
        };

        this.player = new Proxy(initialState, {
            set: (target, prop, value) => {
                if (prop === 'gold') {
                    // console.log(`[GOLD TRAP] Gold change: ${target[prop]} -> ${value}`);
                    // console.trace(); // Enabled for debugging
                }
                target[prop] = value;
                return true;
            }
        });

        this.map = [];
        this.currentTier = 0;
        this.currentActIndex = 0; // Start with Act 1
        this.currentNode = null; // Track exact current node { tier, index }
    }

    startNewRun(heroId = 'warrior') {
        // console.log('[RunManager] Starting New Run (Resetting State)!');

        // Store Selected Hero ID
        this.selectedHeroId = heroId;

        // Load Skills and Relics (Passives) from Hero Definition
        // If heroId valid, use it, else default
        const heroData = HEROES[heroId] || HEROES['warrior'];

        // Apply Hero Stats (with defaults if missing)
        this.player.maxHP = heroData.maxHP || 60; // Default 60
        this.player.currentHP = this.player.maxHP;
        this.player.gold = (heroData.gold !== undefined) ? heroData.gold : 15; // Default 15

        this.player.relics = [];
        this.player.potions = [];

        this.player.deck = heroData && heroData.skills ? [...heroData.skills] : ['SHIELD_SLAM'];
        // Merge starting relics? Or overwrite? Usually start fresh + starting relics
        this.player.relics = heroData && heroData.startingRelics ? [...heroData.startingRelics] : [];

        this.generateMap();
        this.currentTier = 0;
        this.currentNode = null;
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

    // --- Map Generation (Refactored) ---
    generateMap() {
        this.map = [];
        const currentAct = ACTS[this.currentActIndex];
        const tierSizes = this._calculateTierSizes(currentAct);

        // 1. Initialize Skeleton (All BATTLE)
        this._initializeNodes(tierSizes, currentAct);

        // 2. Distribute Special Rooms (Bag System)
        this._distributeRoomTypes();

        // 3. Generate Paths (Monotonic + Filters)
        this._generatePaths();

        // 4. Post-Process Rules (Pacing, Spacing, Variety)
        this._applyPostProcessing();

        // 5. Fairness Limits (Reachability)
        this._ensureFairness();
    }

    _calculateTierSizes(act) {
        const sizes = [];
        sizes.push(Math.floor(Math.random() * 3) + 2); // Tier 0: 2-4 nodes

        // Generate up to length - 1 (Boss is last)
        const totalTiers = act.length;

        for (let i = 1; i < totalTiers - 1; i++) {
            let prev = sizes[i - 1];
            let next = prev;
            const roll = Math.random();
            if (roll < 0.3) next = Math.max(2, prev - 1);
            else if (roll > 0.6) next = Math.min(5, prev + 1);
            else if (Math.random() < 0.1) next = Math.floor(Math.random() * 4) + 2;
            sizes.push(next);
        }
        sizes.push(1); // Final Tier: Boss
        return sizes;
    }

    _initializeNodes(tierSizes, act) {
        for (let i = 0; i < tierSizes.length; i++) {
            const nodes = [];
            const count = tierSizes[i];

            for (let j = 0; j < count; j++) {
                let type = 'BATTLE';
                let status = (i === 0) ? 'AVAILABLE' : 'LOCKED';
                let enemyId = 'slime';

                if (i === tierSizes.length - 1) {
                    type = 'BOSS';
                    // Pick random boss from Act
                    const bosses = act.bosses || ['dragon'];
                    enemyId = bosses[Math.floor(Math.random() * bosses.length)];
                } else {
                    // Default Enemy Pool from Act
                    const enemies = act.enemies || ['slime'];
                    enemyId = enemies[Math.floor(Math.random() * enemies.length)];

                    // Keep Tier 1 Easy logic for now (can be config'd later)
                    if (i === 1) enemyId = Math.random() < 0.5 ? 'slime' : 'rat';
                }

                nodes.push({
                    type,
                    id: `${i}-${j}`,
                    status,
                    enemyId,
                    tier: i,
                    index: j,
                    next: []
                });
            }
            this.map.push(nodes);
        }
    }

    _distributeRoomTypes() {
        const tiers = this.map.length;
        let candidates = [];
        for (let i = 1; i < tiers - 1; i++) {
            for (let j = 0; j < this.map[i].length; j++) {
                candidates.push({ t: i, idx: j });
            }
        }

        // Shuffle
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // Caps
        const limitShop = 3;
        const limitTreasure = 1; // Start with 1, let Fairness add more if needed
        const limitElite = 3;
        const limitEvent = 5;

        let counts = { shop: 0, treasure: 0, elite: 0, event: 0 };

        for (const slot of candidates) {
            const tier = slot.t;
            const node = this.map[tier][slot.idx];

            if (counts.shop < limitShop && tier >= 2 && tier <= 7) {
                node.type = 'SHOP'; counts.shop++; continue;
            }
            if (counts.elite < limitElite && tier >= 3) {
                node.type = 'ELITE'; counts.elite++; continue;
            }
            if (counts.treasure < limitTreasure) {
                node.type = 'TREASURE'; counts.treasure++; continue;
            }
            if (counts.event < limitEvent) {
                node.type = 'EVENT'; counts.event++; continue;
            }
        }
    }

    _generatePaths() {
        const tiers = this.map.length;
        for (let i = 0; i < tiers - 1; i++) {
            const currentNodes = this.map[i];
            const nextNodes = this.map[i + 1];
            const incomingCounts = new Array(nextNodes.length).fill(0);
            let minAllowedTarget = 0;

            // 1. Primary Connections
            for (let nodeIdx = 0; nodeIdx < currentNodes.length; nodeIdx++) {
                const node = currentNodes[nodeIdx];
                const jitter = (Math.random() * 0.2) - 0.1;
                const ratio = Math.max(0, Math.min(1, (nodeIdx / (currentNodes.length - 1 || 1)) + jitter));
                const idealTarget = Math.round(ratio * (nextNodes.length - 1));

                let candidates = [idealTarget];
                if (idealTarget > 0) candidates.push(idealTarget - 1);
                if (idealTarget < nextNodes.length - 1) candidates.push(idealTarget + 1);

                candidates = candidates.filter(c => c >= minAllowedTarget);
                candidates.sort((a, b) => {
                    const distA = Math.abs(a - idealTarget);
                    const distB = Math.abs(b - idealTarget);
                    if (distA !== distB) return distA - distB;
                    return incomingCounts[a] - incomingCounts[b];
                });

                let validCandidates = candidates.filter(c => incomingCounts[c] < 2);

                if (validCandidates.length === 0) {
                    const fallbackIndex = nextNodes.findIndex((_, idx) => idx >= minAllowedTarget && incomingCounts[idx] < 2);
                    validCandidates = (fallbackIndex !== -1) ? [fallbackIndex] : [Math.min(minAllowedTarget, nextNodes.length - 1)];
                }

                const pick = validCandidates[0];
                node.next.push(pick);
                incomingCounts[pick]++;
                minAllowedTarget = pick;
            }

            // 2. Backfill Orphans
            nextNodes.forEach((nextNode, nextIdx) => {
                if (incomingCounts[nextIdx] === 0) {
                    let bestParent = null;
                    let minRatioDist = 999;
                    currentNodes.forEach((pNode, pIdx) => {
                        const ratioP = pIdx / (currentNodes.length - 1 || 1);
                        const ratioN = nextIdx / (nextNodes.length - 1 || 1);
                        const dist = Math.abs(ratioP - ratioN);
                        if (dist < minRatioDist) {
                            minRatioDist = dist;
                            bestParent = pNode;
                        }
                    });
                    if (bestParent && !bestParent.next.includes(nextIdx)) {
                        bestParent.next.push(nextIdx);
                        incomingCounts[nextIdx]++;
                    }
                }
            });
        }
    }

    _applyPostProcessing() {
        const tiers = this.map.length;
        for (let i = 1; i < tiers - 1; i++) {
            const currentNodes = this.map[i];
            const prevNodes = this.map[i - 1];

            currentNodes.forEach(node => {
                const parents = prevNodes.filter(p => p.next.includes(node.index));

                // Rule 1: No Back-to-Back Elites
                if (node.type === 'ELITE') {
                    if (parents.some(p => p.type === 'ELITE')) {
                        node.type = 'BATTLE';
                    }
                }

                // Rule 2: Cap Consecutive Events
                if (node.type === 'EVENT') {
                    const parentEvent = parents.find(p => p.type === 'EVENT');
                    if (parentEvent && i > 1) {
                        const grandParents = this.map[i - 2].filter(gp => gp.next.includes(parentEvent.index));
                        if (grandParents.some(gp => gp.type === 'EVENT')) {
                            node.type = 'BATTLE';
                        }
                    }
                }

                // Rule 3: Shop Spacing (Parent/Grandparent check)
                if (node.type === 'SHOP') {
                    if (parents.some(p => p.type === 'SHOP')) {
                        node.type = 'BATTLE';
                    } else if (i > 1) {
                        const grandParents = [];
                        parents.forEach(p => {
                            const gps = this.map[i - 2].filter(gp => gp.next.includes(p.index));
                            grandParents.push(...gps);
                        });
                        if (grandParents.some(gp => gp.type === 'SHOP')) {
                            node.type = 'BATTLE';
                        }
                    }
                }
            });
        }
    }

    _ensureFairness() {
        const startNodes = this.map[0];
        // Ensure at least one treasure exists contextually, or we will spawn it.
        // const hasTreasure = this.map.some(tier => tier.some(n => n.type === 'TREASURE'));
        // Always run logic to ensure per-path availability

        startNodes.forEach(startNode => {
            let queue = [startNode];
            let visited = new Set();
            let foundTreasure = false;
            let candidatesForSwap = [];

            while (queue.length > 0) {
                const current = queue.shift();
                if (visited.has(current.id)) continue;
                visited.add(current.id);

                if (current.type === 'TREASURE') {
                    foundTreasure = true;
                    break;
                }

                // Candidates: BATTLE or EVENT (Tier 2-7)
                if ((current.type === 'BATTLE' || current.type === 'EVENT') && current.tier >= 2 && current.tier <= 7) {
                    candidatesForSwap.push(current);
                }

                const nextTier = this.map[current.tier + 1];
                if (nextTier) {
                    current.next.forEach(nextIdx => {
                        if (nextTier[nextIdx]) queue.push(nextTier[nextIdx]);
                    });
                }
            }

            if (!foundTreasure) {
                if (candidatesForSwap.length > 0) {
                    // Bias towards BATTLE nodes
                    const battles = candidatesForSwap.filter(n => n.type === 'BATTLE');
                    const pool = battles.length > 0 ? battles : candidatesForSwap;

                    const target = pool[Math.floor(Math.random() * pool.length)];
                    target.type = 'TREASURE';
                    // console.log(`Fairness fix: Spawned treasure at ${target.id}`);
                }
            }
        });
    }

    getNode(tier, index) {
        if (this.map[tier] && this.map[tier][index]) {
            return this.map[tier][index];
        }
        return null;
    }

    enterNode(node) {
        this.currentNode = node;
    }

    completeLevel() {
        if (!this.currentNode) {
            console.warn('Completed level but currentNode is null');
            this.currentTier++;
            return;
        }

        this.currentNode.status = 'COMPLETED';
        this.currentTier++;

        if (this.map[this.currentTier]) {
            const nextTierNodes = this.map[this.currentTier];
            const connectedIndices = this.currentNode.next || [];
            connectedIndices.forEach(index => {
                if (nextTierNodes[index]) nextTierNodes[index].status = 'AVAILABLE';
            });
        }
    }

    updatePlayerState(hp, gold) {
        // console.log(`[RunManager] Update State Request - HP: ${hp}, Gold: ${gold}`);
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
        if (effects.gamble_relic) {
            if (Math.random() < effects.gamble_relic) {
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
