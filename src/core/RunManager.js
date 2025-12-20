import { RELICS } from '../data/relics.js';
import { ACTS } from '../data/acts.js';
import { HEROES } from '../data/heroes.js';
import { EventBus } from './EventBus.js';

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
                target[prop] = value;
                return true;
            }
        });

        this.map = [];
        this.currentTier = 0;
        this.currentActIndex = 0; // Start with Act 1
        this.currentNode = null; // Track exact current node { tier, index }

        // Initialize Masteries immediately to prevent Debug view crashes
        this.matchMasteries = new Set();
    }

    resetRun() {
        this.map = [];
        this.currentNode = null;
        this.currentTier = 0;
        this.player.currentHP = 0; // Mark as dead/reset
    }

    startNewRun(heroId = 'warrior') {
        // Reset Map & Progression FIRST
        this.map = [];
        this.currentTier = 0;
        this.currentNode = null;
        this.currentActIndex = 0;

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
        // Merge starting relics
        const startingRelics = heroData && heroData.startingRelics ? [...heroData.startingRelics] : [];
        startingRelics.forEach(r => this.addRelic(r));

        // Initialize Match Masteries (Empty by default, gained via gameplay)
        this.matchMasteries = new Set();



        this.generateMap();
    }

    // --- Match Mastery System ---
    unlockMastery(masteryId) {
        if (!this.matchMasteries.has(masteryId)) {
            this.matchMasteries.add(masteryId);
            console.log(`[RunManager] Mastery Unlocked: ${masteryId}`);
            return true;
        }
        return false;
    }

    removeMastery(masteryId) {
        if (this.matchMasteries.has(masteryId)) {
            this.matchMasteries.delete(masteryId);
            console.log(`[RunManager] Mastery Removed: ${masteryId}`);
            return true;
        }
        return false;
    }

    hasMastery(masteryId) {
        return this.matchMasteries ? this.matchMasteries.has(masteryId) : false;
    }

    // --- Inventory System ---
    addRelic(relicId) {
        if (!this.player.relics.includes(relicId)) {
            this.player.relics.push(relicId);
            console.log(`Relic added: ${relicId}`);

            // Trigger onEquip hook if exists
            const relic = RELICS[relicId];
            if (relic && relic.hooks && relic.hooks.onEquip) {
                console.log(`Triggering onEquip for ${relicId}`);
                relic.hooks.onEquip(this);
            }
            return true;
        }
        return false;
    }

    removeRelic(relicId) {
        const index = this.player.relics.indexOf(relicId);
        if (index > -1) {
            this.player.relics.splice(index, 1);
            console.log(`Relic removed: ${relicId}`);

            // Trigger onUnequip hook if exists (for completeness, though not strictly requested yet)
            const relic = RELICS[relicId];
            if (relic && relic.hooks && relic.hooks.onUnequip) {
                relic.hooks.onUnequip(this);
            }
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

    getRelics() {
        return this.player.relics;
    }

    /**
     * Returns a list of Relic IDs that are valid for looting.
     * Filter criteria:
     * 1. Not already owned by player.
     * 2. Not marked as heroSpecific (unless bypassed).
     * 3. Not in the excluded list (e.g. starting relics of other heroes).
     */
    getAvailableRelicIds(includeHeroSpecific = false, excludedIds = []) {
        const allIds = Object.keys(RELICS);
        const owned = this.getRelics();

        return allIds.filter(id => {
            // Filter 1: Already Owned
            if (owned.includes(id)) return false;

            // Filter 2: Excluded (Starting Relics)
            if (excludedIds.includes(id)) return false;

            // Filter 3: Hero Specific
            const relic = RELICS[id];
            if (!includeHeroSpecific && relic.heroSpecific) return false;

            return true;
        });
    }

    /**
     * Collects all starting relics from all heroes to exclude them from general loot.
     */
    getAllStartingRelics() {
        const ids = new Set();
        Object.values(HEROES).forEach(hero => {
            if (hero.startingRelics) {
                hero.startingRelics.forEach(r => ids.add(r));
            }
        });
        return Array.from(ids);
    }

    /**
     * Generates 3 reward choices for Elite/Boss victory.
     * Choices are Relics (if available) or Gold (+75).
     */
    generateEliteRewards() {
        const startingRelics = this.getAllStartingRelics();
        let available = this.getAvailableRelicIds(false, startingRelics);

        // Shuffle available
        available.sort(() => Math.random() - 0.5);

        const choices = [];

        // Pick up to 3
        for (let i = 0; i < 3; i++) {
            if (available.length > 0) {
                const relicId = available.pop();
                choices.push({ type: 'RELIC', id: relicId });
            } else {
                choices.push({ type: 'GOLD', value: 75 });
            }
        }

        return choices;
    }

    // --- Map Generation (Reworked for 12 Tiers & Better Pacing) ---
    generateMap() {
        this.map = [];
        // Fixed 12 Tiers strategy
        const tierCount = 12;

        // 1. Initialize Skeleton (Tiers & Density)
        this._initializeNodes(tierCount);

        // 2. Generate Paths (Anti-Choke & Connectivity)
        if (!this._generatePaths()) {
            console.warn('[RunManager] Map generation failed connectivity check. Retrying...');
            this.generateMap(); // Simple retry recursion
            return;
        }

        // 3. Distribute Room Types (Zones)
        this._distributeRoomTypes();

        // 4. Post-Process & Fairness (Safe nodes in funnels)
        this._ensureFairness();
    }

    _getDensityForTier(tierIndex) {
        // Tier 0 (Start): Random 2-4
        if (tierIndex === 0) {
            const roll = Math.random();
            if (roll < 0.2) return 2;
            if (roll < 0.8) return 3;
            return 4;
        }
        // Tier 1-3 (Expansion): 3-4 (Max 4 for cleaner flow)
        if (tierIndex >= 1 && tierIndex <= 3) {
            return Math.random() < 0.6 ? 3 : 4;
        }
        // Tier 4-5 (Mid-Game Funnel): Strict 3
        if (tierIndex >= 4 && tierIndex <= 5) {
            return 3;
        }
        // Tier 6-8 (Late-Game Freedom): 3-4 (Max 4)
        if (tierIndex >= 6 && tierIndex <= 8) {
            return Math.random() < 0.6 ? 3 : 4;
        }
        // Tier 9 (Pre-Camp): Strict 3
        if (tierIndex === 9) {
            return 3;
        }
        // Tier 10 (Campfire) & 11 (Boss): 1
        if (tierIndex >= 10) {
            return 1;
        }
        return 3; // Fallback
    }

    _initializeNodes(tierCount) {
        for (let i = 0; i < tierCount; i++) {
            const nodes = [];
            const count = this._getDensityForTier(i);

            for (let j = 0; j < count; j++) {
                let type = 'BATTLE'; // Default
                let status = (i === 0) ? 'AVAILABLE' : 'LOCKED';
                let enemyId = 'slime'; // Placeholder

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

    _generatePaths() {
        const tiers = this.map.length;

        // Forward Pass: Connect Tiers
        for (let i = 0; i < tiers - 1; i++) {
            const currentNodes = this.map[i];
            const nextNodes = this.map[i + 1];
            // Track incoming counts for fan-in limit (Max 2 inputs)
            const incomingCounts = new Array(nextNodes.length).fill(0);

            // Helper: Find closest node index by relative position
            const getBestTargetIndex = (currIdx, currLen, nextLen) => {
                const ratio = currIdx / (currLen - 1 || 1);
                return Math.round(ratio * (nextLen - 1));
            };

            currentNodes.forEach(curr => {
                // 1. Identify Ideal 'Straight' Target
                const idealNextIdx = getBestTargetIndex(curr.index, currentNodes.length, nextNodes.length);

                // 2. Identify Candidates (Ideal + Neighbors)
                let candidates = [idealNextIdx];
                if (idealNextIdx > 0) candidates.push(idealNextIdx - 1);
                if (idealNextIdx < nextNodes.length - 1) candidates.push(idealNextIdx + 1);

                // 3. Shuffle/Sort Candidates (Clean Flow: 70% straight bias)
                let potentialTargets = [];

                const tryAddTarget = (idx) => {
                    if (idx >= 0 && idx < nextNodes.length && incomingCounts[idx] < 2) {
                        return true;
                    }
                    return false;
                };

                const wantStraight = Math.random() < 0.7;

                if (wantStraight && tryAddTarget(idealNextIdx)) {
                    potentialTargets.push(idealNextIdx);
                } else {
                    let neighbors = candidates.filter(c => c !== idealNextIdx);
                    if (!potentialTargets.includes(idealNextIdx)) neighbors.push(idealNextIdx);
                    neighbors.sort(() => Math.random() - 0.5);
                    for (let n of neighbors) {
                        if (tryAddTarget(n)) {
                            potentialTargets.push(n);
                            break;
                        }
                    }
                }

                if (potentialTargets.length === 0) {
                    candidates.sort((a, b) => Math.abs(a - idealNextIdx) - Math.abs(b - idealNextIdx));
                    potentialTargets.push(candidates[0]);
                }

                if (potentialTargets.length < 2 && Math.random() < 0.35) {
                    let neighbors = candidates.filter(c => !potentialTargets.includes(c));
                    neighbors.sort(() => Math.random() - 0.5);
                    for (let n of neighbors) {
                        if (tryAddTarget(n)) {
                            potentialTargets.push(n);
                            break;
                        }
                    }
                }

                potentialTargets.forEach(idx => {
                    if (!curr.next.includes(idx)) {
                        curr.next.push(idx);
                        incomingCounts[idx]++;
                    }
                });
            });

            // 2. Backward Pass: Orphan Rescue
            nextNodes.forEach((next, nIdx) => {
                if (incomingCounts[nIdx] === 0) {
                    let bestParent = null;
                    let minDiff = 999;
                    const nextRel = nIdx / (nextNodes.length - 1 || 1);

                    currentNodes.forEach(curr => {
                        const currRel = curr.index / (currentNodes.length - 1 || 1);
                        const diff = Math.abs(currRel - nextRel);
                        if (diff < minDiff) {
                            if (!bestParent || (curr.next.length < 2)) {
                                minDiff = diff;
                                bestParent = curr;
                            }
                        }
                    });

                    if (bestParent) {
                        bestParent.next.push(nIdx);
                        incomingCounts[nIdx]++;
                        // Ensure connection exists (it might already if parent had full usage?? No, incoming is 0)
                        if (!bestParent.next.includes(nIdx)) bestParent.next.push(nIdx);
                    }
                }
            });
        }

        // Final Step: Dedup connections
        this.map.forEach(tier => {
            tier.forEach(node => {
                node.next = [...new Set(node.next)].sort((a, b) => a - b);
            });
        });

        // Integrity Check: Articulation Points (Anti-Choke)
        return this._validateConnectivity();
    }

    _validateConnectivity() {
        // Simple BFS Reachability from T0 to T10
        const startNodes = this.map[0];
        const targetTierIndex = 10; // Campfire

        const getReachable = (excludedNodeId) => {
            let reached = new Set();
            let queue = [];

            // Start nodes (exclude if skipped, though we don't skip T0 usually)
            startNodes.forEach(n => {
                if (n.id !== excludedNodeId) queue.push(n);
            });

            while (queue.length > 0) {
                const curr = queue.shift();
                if (reached.has(curr.id)) continue;
                reached.add(curr.id);

                if (curr.tier === targetTierIndex) return true; // Reached target tier

                curr.next.forEach(nextIdx => {
                    const nextNode = this.map[curr.tier + 1][nextIdx];
                    if (nextNode && nextNode.id !== excludedNodeId) {
                        queue.push(nextNode);
                    }
                });
            }
            return false;
        };

        // 1. Check Baseline
        if (!getReachable(null)) return false;

        // 2. Check each node in Tier 1 to 9
        for (let t = 1; t <= 9; t++) {
            const tierNodes = this.map[t];
            // If tier has 1 node, it IS a choke point. 
            // In our design, Tiers 1-9 should have >= 3 nodes.
            // But if generic generation failed...
            if (tierNodes.length < 2) return false; // Hard fail if tier is too thin (except by design, but design says min 3)

            for (const node of tierNodes) {
                // Temporarily "remove" this node and check path
                if (!getReachable(node.id)) {
                    // console.warn(`[RunManager] Map Choke found at ${node.id}. Regenerating.`);
                    return false;
                }
            }
        }

        return true;
    }

    _distributeRoomTypes() {
        // Zones:
        // Start (0-2): Battle (T0), Battle/Event (T1-2)
        // Challenge (3-6): Elite, Shop, Treasure
        // Prep (7-9): Shop, Event. T9 Safe.
        // Finale (10-11): Rest, Boss.

        const act = ACTS[this.currentActIndex];

        for (let t = 0; t < this.map.length; t++) {
            const nodes = this.map[t];

            if (t === 0) {
                // Always Battle
                nodes.forEach(n => {
                    n.type = 'BATTLE';
                    this._assignEnemyToNode(n, t, act);
                });
                continue;
            }
            if (t === 10) {
                nodes.forEach(n => n.type = 'REST');
                continue;
            }
            if (t === 11) {
                nodes.forEach(n => {
                    n.type = 'BOSS';
                    const bosses = act.bosses || ['crystal_burrower'];
                    n.enemyId = bosses[Math.floor(Math.random() * bosses.length)];
                });
                continue;
            }

            nodes.forEach(node => {
                node.type = 'BATTLE'; // Reset default
                const roll = Math.random();

                // Start Zone (1-2)
                if (t >= 1 && t <= 2) {
                    if (roll < 0.2) node.type = 'EVENT';
                    else node.type = 'BATTLE';
                }

                // Challenge Zone (3-6)
                else if (t >= 3 && t <= 6) {
                    if (roll < 0.25) node.type = 'SHOP';
                    else if (roll < 0.45) node.type = 'ELITE';
                    else if (roll < 0.55) node.type = 'TREASURE';
                    else if (roll < 0.75) node.type = 'EVENT';
                    else node.type = 'BATTLE';
                }

                // Prep Zone (7-9)
                else if (t >= 7 && t <= 9) {
                    if (t === 9) {
                        // Safe: Battle or Shop or Event. NO ELITES.
                        if (roll < 0.3) node.type = 'SHOP';
                        else if (roll < 0.5) node.type = 'EVENT';
                        else node.type = 'BATTLE';
                    } else {
                        if (roll < 0.3) node.type = 'SHOP';
                        else if (roll < 0.45) node.type = 'ELITE';
                        else if (roll < 0.65) node.type = 'EVENT';
                        else node.type = 'BATTLE';
                    }
                }

                // Assign Enemy if Combat
                if (node.type === 'BATTLE' || node.type === 'ELITE') {
                    this._assignEnemyToNode(node, t, act);
                }
            });
        }
    }

    _assignEnemyToNode(node, tier, act) {
        if (node.type === 'ELITE') {
            const elites = act.elites || ['dragon'];
            node.enemyId = elites[Math.floor(Math.random() * elites.length)];
        } else {
            // Battle: Filter by difficulty/tier if needed
            // Default pool: Slime, Rat
            let pool = ['slime', 'rat'];

            // Progressive difficulty
            if (tier >= 2) pool.push('skeleton');
            if (tier >= 4) pool.push('orc');

            // Or use act.enemies and filter?
            // Let's use specific logic for better pacing

            node.enemyId = pool[Math.floor(Math.random() * pool.length)];
        }
    }

    _ensureFairness() {
        // 1. Prevent back-to-back Elites
        // 2. Prevent Funnel Death (Tier 4-5 check)

        const tiers = this.map.length;

        // Helper: Check parents
        const getParents = (node, tierIdx) => {
            if (tierIdx === 0) return [];
            return this.map[tierIdx - 1].filter(p => p.next.includes(node.index));
        };

        // Initialize Shop Count for Tier 0
        this.map[0].forEach(n => n.shopCount = 0);

        // Run fairness only on variable tiers (1-9)
        // Exclude Tier 10 (Rest) and Tier 11 (Boss)
        for (let t = 1; t < 10; t++) {
            const nodes = this.map[t];

            // Funnel Safety Check (Tier 4, 5)
            // If this tier size <= 3, ensure at least one SAFE node (Battle/Event)
            if (nodes.length <= 3) {
                const safeNodes = nodes.filter(n => n.type === 'BATTLE' || n.type === 'EVENT');
                if (safeNodes.length === 0) {
                    // Force one random to be BATTLE
                    const rnd = nodes[Math.floor(Math.random() * nodes.length)];
                    rnd.type = 'BATTLE';
                }
            }

            nodes.forEach(node => {
                const parents = getParents(node, t);

                // --- PATH SHOP LIMIT LOGIC (Max 2 per line) ---
                const parentMaxShops = parents.reduce((max, p) => Math.max(max, p.shopCount || 0), 0);

                if (node.type === 'SHOP') {
                    if (parentMaxShops >= 2) {
                        node.type = 'BATTLE'; // Force Battle if limit reached
                        node.shopCount = parentMaxShops;
                    } else {
                        node.shopCount = parentMaxShops + 1;
                    }
                } else {
                    node.shopCount = parentMaxShops;
                }

                // No Back-to-Back Elites
                if (node.type === 'ELITE') {
                    if (parents.some(p => p.type === 'ELITE')) {
                        node.type = 'BATTLE';
                    }
                }

                // No Back-to-Back shops
                if (node.type === 'SHOP') {
                    if (parents.some(p => p.type === 'SHOP')) {
                        node.type = 'BATTLE';
                    }
                }

                // Limit Consecutive Events
                // Goal: Max 2 in a row (rare), realistically 1.
                if (node.type === 'EVENT') {
                    const parentEvents = parents.filter(p => p.type === 'EVENT');
                    if (parentEvents.length > 0) {
                        // Check for 3-chain (Grandparents)
                        const isThreeChain = parentEvents.some(p => {
                            const grandParents = getParents(p, t - 1);
                            return grandParents.some(gp => gp.type === 'EVENT');
                        });

                        if (isThreeChain) {
                            node.type = 'BATTLE'; // Hard ban on 3 events in a row
                        } else {
                            // Soft ban on 2 events (User prefers 1)
                            // 80% chance to break chain here to prefer "Event -> Battle"
                            if (Math.random() < 0.8) {
                                node.type = 'BATTLE';
                            }
                        }
                    }
                }

                // Limit Consecutive TREASURE (Relic)
                // Goal: Max 2 in a row (rare), realistically 1.
                if (node.type === 'TREASURE') {
                    const parentTreasures = parents.filter(p => p.type === 'TREASURE');
                    if (parentTreasures.length > 0) {
                        // Check for 3-chain (Grandparents)
                        const isThreeChain = parentTreasures.some(p => {
                            const grandParents = getParents(p, t - 1);
                            return grandParents.some(gp => gp.type === 'TREASURE');
                        });

                        if (isThreeChain) {
                            node.type = 'BATTLE'; // Hard ban on 3 treasures
                        } else {
                            // Soft ban on 2 treasures
                            if (Math.random() < 0.8) {
                                node.type = 'BATTLE';
                            }
                        }
                    }
                }
            });
        }
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

        // Idempotency check: If already completed, do nothing
        if (this.currentNode.status === 'COMPLETED') {
            console.warn(`[RunManager] Node ${this.currentNode.id} already completed. Ignoring duplicate completion.`);
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
