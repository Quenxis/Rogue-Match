
import { runManager } from '../src/core/RunManager.js';
import { ACTS } from '../src/data/acts.js';

console.log('--- Tesing Act Transition ---');

// 1. Setup Run
runManager.startNewRun();
console.log(`Act 1 Started. Map Length: ${runManager.map.length}`);

// 2. Simulate Progression to Boss
const bossTierIndex = runManager.map.length - 1;
// Mock map/nodes to ensure we can reach boss
// (RunManager generates full map, so we just set currentTier to boss tier)
runManager.currentTier = bossTierIndex;
runManager.currentNode = runManager.map[bossTierIndex][0]; // Assuming 1 boss node

console.log(`Simulating Boss Victory at Tier ${runManager.currentTier}...`);

// 3. Complete Boss Level
runManager.completeLevel();

// 4. Verify Next Tier/Act Logic
// Current logic: completeLevel increments tier. 
// If tier > map.length, it should check?
// Wait, my implementation calls handleActCompletion inside 'else' of map[currentTier].
// If currentTier was 11 (max), completeLevel increments to 12.
// map[12] is undefined. So 'else' block runs.
// currentNode type must be BOSS.

if (runManager.currentActIndex === 1) {
    if (runManager.map.length > 0) {
        console.log(`[PASS] Act 2 Started! Current Act Index: ${runManager.currentActIndex}`);
        console.log(`Act 2 Name: ${ACTS[runManager.currentActIndex].name}`);
        console.log(`New Map Size: ${runManager.map.length}`);
    } else {
        console.error('[FAIL] Act 2 Started but map is empty.');
    }
} else {
    console.error(`[FAIL] Did not transition to Act 2. Index: ${runManager.currentActIndex}, Tier: ${runManager.currentTier}`);
}
