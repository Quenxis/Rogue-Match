import { runManager } from '../src/core/RunManager.js';

describe('RunManager - Map Generation & Logic', () => {

    it('should generate a map with 10 tiers', () => {
        runManager.startNewRun();
        const map = runManager.map;
        expect(map.length).toBe(10);
    });

    it('should ensure Start Tier is Available and future tiers are Locked', () => {
        runManager.startNewRun();
        const map = runManager.map;

        // Tier 0
        expect(map[0][0].status).toBe('AVAILABLE');

        // Tier 1+
        expect(map[1][0].status).toBe('LOCKED');
    });

    it('should ensure map connectivity (no orphans)', () => {
        // Run multiple tests to check randomness
        for (let k = 0; k < 20; k++) {
            runManager.startNewRun();
            const map = runManager.map;

            // Check tiers 1 to 9 (start tier has 0 inputs)
            for (let i = 1; i < map.length; i++) {
                const currentTierNodes = map[i];
                const prevTierNodes = map[i - 1];

                // For each node in current tier, ensure it has at least one parent
                currentTierNodes.forEach((node, idx) => {
                    let inputs = 0;
                    prevTierNodes.forEach(prevNode => {
                        if (prevNode.next.includes(idx)) {
                            inputs++;
                        }
                    });

                    // Rule: No Orphans (must have at least 1 input)
                    if (inputs === 0) {
                        throw new Error(`Node ${i}-${idx} is an ORPHAN! It has 0 inputs.`);
                    }
                });
            }
        }
    });

    it('should ensure Boss is at the end', () => {
        runManager.startNewRun();
        const lastTier = runManager.map[9];
        expect(lastTier.length).toBe(1);
        expect(lastTier[0].type).toBe('BOSS');
    });

    it('should respect Map Balance rules (Caps & Placement)', () => {
        runManager.startNewRun();
        const map = runManager.map;
        let shopCount = 0;
        let treasureCount = 0;

        for (let i = 0; i < map.length; i++) {
            const nodes = map[i];
            nodes.forEach(node => {
                if (node.type === 'SHOP') {
                    shopCount++;
                    // Rule: No Shop in Tier 0 or 1
                    if (i < 2) {
                        throw new Error(`Found SHOP in Tier ${i} (Should be >= 2)`);
                    }
                }
                if (node.type === 'TREASURE') {
                    treasureCount++;
                }
            });
        }

        // Check Caps
        if (shopCount > 3) throw new Error(`Too many Shops: ${shopCount} (Max 3)`);

        // Treasures: Initial Bag (1) + Fairness Overrides (ensuring each path has one).
        // If paths are disjoint, we might need more. Max 4 covers most sane map (2-4 start nodes).
        if (treasureCount > 4) throw new Error(`Too many Treasures: ${treasureCount} (Max 4 allowed with Fairness fix)`);

        // Check Minimums (Statistical, but reasonable to expect > 0 for standard run)
        // expect(shopCount).toBeGreaterThan(0);
    });
    it('should ensure every Start Node can reach at least one Treasure', () => {
        for (let k = 0; k < 10; k++) {
            runManager.startNewRun();
            const map = runManager.map;
            const startNodes = map[0];

            startNodes.forEach(startNode => {
                let queue = [startNode];
                let visited = new Set();
                let foundTreasure = false;

                while (queue.length > 0) {
                    const current = queue.shift();
                    if (visited.has(current.id)) continue;
                    visited.add(current.id);

                    if (current.type === 'TREASURE') {
                        foundTreasure = true;
                        break;
                    }

                    const nextTier = map[current.tier + 1];
                    if (nextTier) {
                        current.next.forEach(nextIdx => {
                            if (nextTier[nextIdx]) {
                                queue.push(nextTier[nextIdx]);
                            }
                        });
                    }
                }

                if (!foundTreasure) {
                    throw new Error(`Start Node ${startNode.id} has NO path to a Treasure! Seed: ${k}`);
                }
            });
        }
    });

    it('should ensure Shops are spaced out (No consecutive or close clusters)', () => {
        for (let k = 0; k < 10; k++) {
            runManager.startNewRun();
            const map = runManager.map;

            for (let i = 2; i < map.length; i++) {
                const currentTier = map[i];
                const prevTier = map[i - 1];
                const prevPrevTier = map[i - 2];

                currentTier.forEach(node => {
                    if (node.type === 'SHOP') {
                        // Check Parents
                        const parents = prevTier.filter(p => p.next.includes(node.index));
                        if (parents.some(p => p.type === 'SHOP')) {
                            throw new Error(`Consecutive Shop found at ${node.id} (Parent was Shop)`);
                        }

                        // Check Grandparents
                        if (i > 2) {
                            const grandParents = prevPrevTier.filter(gp =>
                                gp.next.some(nextIdx => parents.some(p => p.index === nextIdx))
                            );

                            if (grandParents.some(gp => gp.type === 'SHOP')) {
                                throw new Error(`Shop Too Close at ${node.id} (Grandparent was Shop)`);
                            }
                        }
                    }
                });
            }
        }
    });

});
