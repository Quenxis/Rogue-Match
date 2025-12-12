/**
 * @file GridData.js
 * @description Core Logic for the Match-3 Grid. Handles state, swapping, and matching.
 * @dependencies EventBus, GridDetails
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, GAME_SETTINGS } from '../core/Constants.js';
import { ITEM_TYPES, GridItem } from './GridDetails.js';
import { runManager } from '../core/RunManager.js';

export class GridData {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.grid = []; // 2D Array: grid[row][col]
        this.matches = []; // array of matched groups
        this.isFastForward = false;
        this.matches = []; // array of matched groups
        this.isFastForward = false;
    }

    // --- MANIPULATION API FOR ENEMIES ---

    setFastForward(value) {
        this.isFastForward = value;
    }

    // --- MANIPULATION API FOR ENEMIES ---

    lockRandomGems(count, silent = false) {
        let available = [];
        this.grid.forEach((row, r) => {
            row.forEach((item, c) => {
                if (!item.isLocked && item.type !== ITEM_TYPES.EMPTY) {
                    available.push({ item, r, c });
                }
            });
        });

        let lockedItems = [];
        for (let i = 0; i < count && available.length > 0; i++) {
            const index = Math.floor(Math.random() * available.length);
            const entry = available.splice(index, 1)[0]; // {item, r, c}

            entry.item.isLocked = true;
            lockedItems.push({ r: entry.r, c: entry.c, id: entry.item.id }); // Store coord & ID

            EventBus.emit(EVENTS.GRID_ITEM_UPDATED, { item: entry.item, silent: silent });
        }
        return lockedItems;
    }

    trashRandomGems(count, silent = false) {
        let available = [];
        this.grid.forEach((row, r) => {
            row.forEach((item, c) => {
                if (!item.isTrash && !item.isLocked && item.type !== ITEM_TYPES.EMPTY) {
                    available.push({ item, r, c });
                }
            });
        });

        let trashedItems = [];
        for (let i = 0; i < count && available.length > 0; i++) {
            const index = Math.floor(Math.random() * available.length);
            const entry = available.splice(index, 1)[0];
            const item = entry.item;

            item.isTrash = true;
            item.originalType = item.type; // Optional: if we want to revert? But usually permanent.
            item.type = 'TRASH'; // Or keep type but treat as trash?
            // Spec: "Mění typ drahokamu na bezbarvý/neutrální... Netvoří trojice."

            // Push to result list
            trashedItems.push({ r: entry.r, c: entry.c, id: item.id });

            EventBus.emit(EVENTS.GRID_ITEM_UPDATED, { item: item, silent: silent });
        }
        return trashedItems;
    }

    /**
     * Initialize the grid with random items.
     * Ensures no initial matches exist.
     */
    initialize() {
        let attempts = 0;
        let valid = false;

        while (!valid && attempts < 100) {
            attempts++;
            this.grid = [];
            let idCounter = 0;
            // Exclude EMPTY from random generation
            const types = Object.values(ITEM_TYPES).filter(t => t !== ITEM_TYPES.EMPTY);

            for (let r = 0; r < this.rows; r++) {
                const row = [];
                for (let c = 0; c < this.cols; c++) {
                    let randomType;
                    do {
                        randomType = types[Math.floor(Math.random() * types.length)];
                    } while (this.wouldCauseMatch(r, c, randomType, row)); // Prevent pre-matches

                    row.push(new GridItem(randomType, `item_${idCounter++}`));
                }
                this.grid.push(row);
            }

            // Double check for any accidental matches
            if (this.getAllMatches().length === 0) {
                valid = true;
            } else {
                console.warn('Grid generation failed (matches found). Retrying...');
            }
        }

        // console.log('Grid Logic Initialized');
        // Debug print
        this.debugPrint();

        EventBus.emit(EVENTS.GRID_CREATED, {
            grid: this.getGridSnapshot(),
            rows: this.rows,
            cols: this.cols
        });
    }

    /**
     * Check if placing a type at (r, c) would cause a match of 3.
     */
    wouldCauseMatch(r, c, type, currentRow) {
        // NOTE: currentRow arg is mainly for initial generation where "grid" is incomplete.
        // During Refill/Game, currentRow IS this.grid[r], so we can check neighbors safely (if they exist).

        const itemAt = (rr, cc) => {
            if (this.isValidCoord(rr, cc)) {
                // If checking current row (rr === r) and this.grid[r] is undefined (Init phase),
                // use 'currentRow' array.
                if (rr === r && (!this.grid[rr] || !this.grid[rr][cc])) {
                    // Check if 'currentRow' has this index (it's being built)
                    // We only build left-to-right, so cc MUST be < current 'c'
                    if (currentRow && cc < currentRow.length) {
                        return currentRow[cc];
                    }
                    return null;
                }

                // Normal access
                if (this.grid[rr]) {
                    return this.grid[rr][cc];
                }
            }
            return null;
        };

        // Horizontal (Left)
        if (c >= 2) {
            const left1 = itemAt(r, c - 1);
            const left2 = itemAt(r, c - 2);
            if (left1 && left2 && left1.type === type && left2.type === type) return true;
        }
        // Horizontal (Right) - needed for Refill holes
        if (c < this.cols - 2) {
            const right1 = itemAt(r, c + 1);
            const right2 = itemAt(r, c + 2);
            if (right1 && right2 && right1.type === type && right2.type === type) return true;
        }
        // Horizontal (Middle) - Left & Right
        if (c >= 1 && c < this.cols - 1) {
            const left = itemAt(r, c - 1);
            const right = itemAt(r, c + 1);
            if (left && right && left.type === type && right.type === type) return true;
        }

        // Vertical (Up)
        if (r >= 2) {
            const up1 = itemAt(r - 1, c);
            const up2 = itemAt(r - 2, c);
            if (up1 && up2 && up1.type === type && up2.type === type) return true;
        }
        // Vertical (Down)
        if (r < this.rows - 2) {
            const down1 = itemAt(r + 1, c);
            const down2 = itemAt(r + 2, c);
            if (down1 && down2 && down1.type === type && down2.type === type) return true;
        }
        // Vertical (Middle)
        if (r >= 1 && r < this.rows - 1) {
            const up = itemAt(r - 1, c);
            const down = itemAt(r + 1, c);
            if (up && down && up.type === type && down.type === type) return true;
        }

        return false;
    }

    getGridSnapshot() {
        // Return simple copy for UI
        return this.grid.map(row => row.map(item => ({
            type: item.type,
            id: item.id,
            isLocked: item.isLocked,
            isTrash: item.isTrash
        })));
    }

    getItemAt(row, col) {
        if (this.isValidCoord(row, col)) {
            return this.grid[row][col];
        }
        return null;
    }

    isValidCoord(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }

    /**
     * Attempt to swap two items.
     */
    async swapItems(r1, c1, r2, c2) {
        // console.log(`GridData: Swap Requested [${r1},${c1}] <-> [${r2},${c2}]`);
        if (!this.isValidCoord(r1, c1) || !this.isValidCoord(r2, c2)) {
            console.warn('Invalid swap coordinates');
            return false;
        }

        // 1. Check Locks
        if (this.grid[r1][c1].isLocked || this.grid[r2][c2].isLocked) {
            console.log('Swap Blocked: Item is Locked');
            // Visual feedback could be triggered here?
            return false;
        }
        if (this.grid[r1][c1].isTrash || this.grid[r2][c2].isTrash) {
            // Trash IS NOT movable (Blocker)
            console.log('Swap Blocked: Item is Trash');
            return false;
        }

        // 2. Perform Swap
        const item1 = this.grid[r1][c1];
        const item2 = this.grid[r2][c2];

        this.grid[r1][c1] = item2;
        this.grid[r2][c2] = item1;

        EventBus.emit(EVENTS.ITEM_SWAPPED, { r1, c1, r2, c2 });

        // 2. Check for Matches
        const matches = this.findMatches();

        if (matches.length > 0) {
            // console.log('Match Found!', matches);
            // EventBus.emit(EVENTS.MATCHES_FOUND, { matches }); // MOVED to handleMatchResolution

            // Proceed to resolution
            await this.handleMatchResolution(matches);

            return true;
        } else {
            console.log('No match found.');

            // PHANTOM GLOVES CHECK
            if (runManager.hasRelic('phantom_gloves')) {
                // console.log('Phantom Gloves Active: Allowing swap without match.');
                // Do NOT revert.
                // Treated as a valid move (consumes move elsewhere).
                // Need to ensure deadlocks are checked if board state changes?
                // Yes, after any move, check logic usually handled by turn end?
                // Actually CombatManager handles turn end.
                // Add Small Delay to match Swap Animation (300ms) so users don't click mid-animation
                // or so GridView doesn't unlock too fast.
                await new Promise(resolve => setTimeout(resolve, 300));

                return true;
            }

            // console.log('No match, swapping back...');
            // Swap back
            this.grid[r1][c1] = item1;
            this.grid[r2][c2] = item2;

            // Emit revert event
            EventBus.emit(EVENTS.ITEM_SWAP_REVERTED, { r1, c1, r2, c2 });
            return false;
        }
    }

    async handleMatchResolution(matches) {
        // 0. Include Adjacent Trash in Matches (Destruction Logic)
        const trashMatches = this.checkAdjacentTrash(matches);
        // Combine matches, ensuring no duplicates if possible (though Set inside checkAdjacentTrash helps)
        // Actually, let's just push unique items to matches array if formatted same
        trashMatches.forEach(tm => {
            // Check if already in matches to avoid double counting?
            if (!matches.some(m => m.r === tm.r && m.c === tm.c)) {
                matches.push(tm);
            }
            if (!matches.some(m => m.r === tm.r && m.c === tm.c)) {
                matches.push(tm);
            }
        });

        // CRITICAL: Tell View about ALL matches (core + adjacent trash)
        EventBus.emit(EVENTS.MATCHES_FOUND, { matches });

        // 1. Clear Matched Items
        matches.forEach(({ r, c }) => {
            if (this.grid[r][c].type !== ITEM_TYPES.EMPTY) {
                // Clear state
                this.grid[r][c].isLocked = false;
                this.grid[r][c].isTrash = false;
                this.grid[r][c].type = ITEM_TYPES.EMPTY;
            }
        });

        // WAIT for Match Animation (Destroy)
        await new Promise(resolve => setTimeout(resolve, this.isFastForward ? 1 : 300));

        // 2. Apply Gravity (Move items down)
        // 2. Apply Gravity (Move items down)
        const gravityMoves = this.applyGravity();

        // 3. Refill (Spawn new items)
        this.refill();

        // WAIT for Physics Animation (Gravity + Spawn)
        // Previous: Gravity Wait (700) + Refill Wait (1300) = 2000 total?
        // Now they run concurrently-ish.
        // View: Refill finishes at ~1350ms max.
        // Gravity finishes at ~900ms.
        // So we wait for the LONGEST animation.
        // Let's stick to 1200-1300 to be safe for cascade check.
        await new Promise(resolve => setTimeout(resolve, this.isFastForward ? 1 : 1200));

        // 4. Check for Cascading Matches
        const newMatches = this.findMatches();
        if (newMatches.length > 0) {
            // console.log('Cascade Match Found! Resolving...');

            // CRITICAL: Tell the View to animate these matches!
            // EventBus.emit(EVENTS.MATCHES_FOUND, { matches: newMatches }); // MOVED to handleMatchResolution logic

            await this.handleMatchResolution(newMatches);
        } else {
            // MATCHING SETTLED - CHECK FOR DEADLOCK
            if (!this.hasPossibleMoves()) {
                console.log('No moves possible! Reshuffling...');
                await new Promise(resolve => setTimeout(resolve, 500)); // Delay for clarity
                await this.reshuffle();
            }
        }
    }

    checkAdjacentTrash(matches) {
        const trashToDestroy = [];
        const checked = new Set(); // Prevent duplicates

        matches.forEach(({ r, c }) => {
            const neighbors = [
                { r: r - 1, c: c },
                { r: r + 1, c: c },
                { r: r, c: c - 1 },
                { r: r, c: c + 1 }
            ];

            neighbors.forEach(n => {
                if (this.isValidCoord(n.r, n.c)) {
                    const id = `${n.r},${n.c}`;
                    if (!checked.has(id)) {
                        checked.add(id);
                        const item = this.grid[n.r][n.c];
                        if (item.isTrash && item.type !== ITEM_TYPES.EMPTY) {
                            trashToDestroy.push({ r: n.r, c: n.c, type: 'TRASH' });
                        }
                    }
                }
            });
        });
        return trashToDestroy;
    }

    hasPossibleMoves() {
        // Horizontal Swaps
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 1; c++) {
                if (this.canSwapSimulate(r, c, r, c + 1)) return true;
            }
        }
        // Vertical Swaps
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows - 1; r++) {
                if (this.canSwapSimulate(r, c, r + 1, c)) return true;
            }
        }
        return false;
    }

    canSwapSimulate(r1, c1, r2, c2) {
        const item1 = this.grid[r1][c1];
        const item2 = this.grid[r2][c2];

        // Locked items cannot swap
        if (item1.isLocked || item2.isLocked) return false;

        // Trash IS NOT movable, so we block.
        if (item1.isTrash || item2.isTrash) return false;

        const t1 = item1.type;
        const t2 = item2.type;

        if (t1 === t2) return false;

        // Simulate
        this.grid[r1][c1] = item2;
        this.grid[r2][c2] = item1;

        const hasMatch = this.findMatches().length > 0;

        // Revert
        this.grid[r1][c1] = item1;
        this.grid[r2][c2] = item2;

        return hasMatch;
    }

    async reshuffle() {
        console.log('Reshuffling Grid...');
        EventBus.emit(EVENTS.SHOW_NOTIFICATION, { text: 'NO MOVES! SHUFFLING...', color: 0xff0000 });

        let valid = false;
        let attempts = 0;
        const flatItems = [];

        // Extract content
        this.grid.forEach(row => row.forEach(item => {
            flatItems.push({
                type: item.type,
                isLocked: item.isLocked,
                isTrash: item.isTrash,
                id: item.id
            });
        }));

        while (!valid && attempts < 100) {
            attempts++;
            // Shuffle flatItems
            for (let i = flatItems.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [flatItems[i], flatItems[j]] = [flatItems[j], flatItems[i]];
            }

            // Apply to grid temporarily
            let idx = 0;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const info = flatItems[idx++];
                    this.grid[r][c].type = info.type;
                    // CRITICAL: Must update Lock/Trash state for simulation to be valid!
                    this.grid[r][c].isLocked = info.isLocked;
                    this.grid[r][c].isTrash = info.isTrash;
                }
            }

            // Check matches and moves
            if (this.findMatches().length === 0) {
                if (this.hasPossibleMoves()) {
                    valid = true;
                }
            }
        }

        if (valid) {
            let idx = 0;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const info = flatItems[idx++];
                    const item = this.grid[r][c];
                    item.type = info.type;
                    item.isLocked = info.isLocked;
                    item.isTrash = info.isTrash;
                    item.id = info.id;
                }
            }

            // Emit Update
            EventBus.emit(EVENTS.GRID_CREATED, {
                grid: this.getGridSnapshot(),
                rows: this.rows,
                cols: this.cols
            });
        } else {
            console.warn('Reshuffle failed to find valid config. Deadlock Protocol Initiated.');
            this.deadlockPurge();
        }
    }

    deadlockPurge() {
        console.log('DEADLOCK PROTOCOL: Purging Grid...');
        EventBus.emit(EVENTS.SHOW_NOTIFICATION, { text: "GRID BLOCKED! PURGING...", color: 0xff0000 });

        // Purge all debuffs
        this.grid.forEach(row => {
            row.forEach(item => {
                if (item.type !== ITEM_TYPES.EMPTY) {
                    item.isLocked = false;
                    item.isTrash = false;
                    if (item.type === 'TRASH') {
                        // Restore to random valid gem? Or just reroll in next shuffle?
                        // If we leave it as TRASH type but !isTrash, it might act weird if not handled.
                        // Safest: Reroll type now or let reshuffle handle it if we change type here.
                        // Let's randomize it to a valid base type.
                        const types = Object.values(ITEM_TYPES).filter(t => t !== ITEM_TYPES.EMPTY);
                        item.type = types[Math.floor(Math.random() * types.length)];
                    }
                }
            });
        });

        // Trigger updates so View sees the purge?
        // Actually, immediately reshuffle. View will see the FINAL Result.
        // We might want a small delay? But logic is sync.
        // Let's just reshuffle immediately.

        this.reshuffle();
    }


    applyGravity() {
        const moves = []; // { id, fromRow, fromCol, toRow, toCol }

        // Process each column
        for (let c = 0; c < this.cols; c++) {
            let writeRow = this.rows - 1;

            // From bottom to top
            for (let r = this.rows - 1; r >= 0; r--) {
                const item = this.grid[r][c];

                if (item.type !== ITEM_TYPES.EMPTY) {
                    // If we have a gap below, move this item down
                    if (writeRow !== r) {
                        // Move item in grid
                        this.grid[writeRow][c] = item;
                        this.grid[r][c] = new GridItem(ITEM_TYPES.EMPTY, 'temp_empty');

                        moves.push({
                            id: item.id,
                            fromRow: r,
                            fromCol: c,
                            toRow: writeRow,
                            toCol: c
                        });
                    }
                    writeRow--;
                }
            }
        }

        if (moves.length > 0) {
            // console.log('Gravity applied', moves);
            EventBus.emit(EVENTS.GRID_GRAVITY, { moves });
            return moves.length;
        }
        return 0;
    }

    refill() {
        const newItems = [];
        let idCounter = Date.now();

        // Include MANA, exclude EMPTY
        const types = Object.values(ITEM_TYPES).filter(t => t !== ITEM_TYPES.EMPTY);

        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[r][c].type === ITEM_TYPES.EMPTY) {
                    let randomType;
                    let valid = false;
                    let attempts = 0;

                    // Try to pick a type that doesn't match
                    do {
                        attempts++;
                        randomType = types[Math.floor(Math.random() * types.length)];

                        // Check if this type would cause a match
                        const causesMatch = this.wouldCauseMatch(r, c, randomType, this.grid[r]); // Note: wouldCauseMatch logic adjusted below

                        if (!causesMatch) {
                            valid = true; // No match, safe to place
                        } else {
                            // Causes match! 
                            // 50% chance to ACCEPT it anyway (Risk/Reward) -> Now Configurable
                            // 50% chance to REJECT and try again
                            if (Math.random() < GAME_SETTINGS.REFILL_MATCH_CHANCE) {
                                valid = true; // Accepted the risk
                            }
                            // Else valid=false, loop again to find another type
                        }
                    } while (!valid && attempts < 10);

                    const newItem = new GridItem(randomType, `item_${idCounter++}_${r}_${c}`);
                    this.grid[r][c] = newItem;

                    newItems.push({
                        item: newItem,
                        row: r,
                        col: c
                    });
                }
            }
        }

        if (newItems.length > 0) {
            // console.log('Grid Refilled', newItems);
            EventBus.emit(EVENTS.GRID_REFILLED, { newItems });
        }
    }



    getAllMatches() {
        const matches = [];
        const uniqueSet = new Set();

        const addMatch = (r, c) => {
            const key = `${r},${c}`;
            if (!uniqueSet.has(key)) {
                uniqueSet.add(key);
                matches.push({ r, c });
            }
        };

        // Vertical matches
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows - 2; r++) {
                const item = this.grid[r][c];
                const type = item.type;
                if (type === ITEM_TYPES.EMPTY || item.isTrash || type === ITEM_TYPES.TRASH) continue;

                let matchLen = 1;
                while (r + matchLen < this.rows && this.grid[r + matchLen][c].type === type && !this.grid[r + matchLen][c].isTrash) {
                    matchLen++;
                }

                if (matchLen >= 3) {
                    for (let i = 0; i < matchLen; i++) {
                        addMatch(r + i, c);
                    }
                    r += matchLen - 1; // Skip checked
                }
            }
        }

        // Horizontal matches
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                const item = this.grid[r][c];
                const type = item.type;
                if (type === ITEM_TYPES.EMPTY || item.isTrash || type === ITEM_TYPES.TRASH) continue;

                let matchLen = 1;
                while (c + matchLen < this.cols && this.grid[r][c + matchLen].type === type && !this.grid[r][c + matchLen].isTrash) {
                    matchLen++;
                }

                if (matchLen >= 3) {
                    for (let i = 0; i < matchLen; i++) {
                        addMatch(r, c + i);
                    }
                    c += matchLen - 1;
                }
            }
        }

        return matches;
    }

    findMatches() {
        // Return match coordinates WITH TYPES
        const coords = this.getAllMatches();
        return coords.map(c => ({
            r: c.r,
            c: c.c,
            type: this.grid[c.r][c.c].type
        }));
    }

    debugPrint() {
        console.group('Grid State');
        const iconMap = {
            [ITEM_TYPES.SWORD]: '⚔️',
            [ITEM_TYPES.SHIELD]: '🛡️',
            [ITEM_TYPES.POTION]: '❤️',
            [ITEM_TYPES.COIN]: '💰',
            [ITEM_TYPES.MANA]: '💧',
            [ITEM_TYPES.EMPTY]: '⬛'
        };

        let output = '';
        for (let r = 0; r < this.rows; r++) {
            let rowStr = `${r} | `;
            for (let c = 0; c < this.cols; c++) {
                rowStr += (iconMap[this.grid[r][c].type] || '?') + ' ';
            }
            output += rowStr + '\n';
        }
        console.log(output);
        console.groupEnd();
    }

    checkDeadlock() {
        if (!this.hasPossibleMoves()) {
            console.log('Deadlock detected by external check (Start Turn). Reshuffling...');
            this.reshuffle();
            return true;
        }
        return false;
    }
}
