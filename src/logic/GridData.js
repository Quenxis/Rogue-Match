/**
 * @file GridData.js
 * @description Core Logic for the Match-3 Grid. Handles state, swapping, and matching.
 * @dependencies EventBus, GridDetails
 */

import { EventBus } from '../core/EventBus.js';
import { ITEM_TYPES, GridItem } from './GridDetails.js';

export class GridData {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.grid = []; // 2D Array: grid[row][col]
        this.matches = []; // array of matched groups
        this.isFastForward = false;
    }

    setFastForward(value) {
        this.isFastForward = value;
    }

    /**
     * Initialize the grid with random items.
     * Ensures no initial matches exist.
     */
    initialize() {
        let attempts = 0;
        let valid = false;

        while (!valid && attempts < 10) {
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

        console.log('Grid Logic Initialized');
        // Debug print
        this.debugPrint();

        EventBus.emit('grid:created', {
            grid: this.getGridSnapshot(),
            rows: this.rows,
            cols: this.cols
        });
    }

    /**
     * Check if placing a type at (r, c) would cause a match of 3.
     */
    wouldCauseMatch(r, c, type, currentRow) {
        // Check horizontal (left)
        if (c >= 2) {
            if (currentRow[c - 1].type === type && currentRow[c - 2].type === type) return true;
        }
        // Check vertical (up)
        if (r >= 2) {
            if (this.grid[r - 1][c].type === type && this.grid[r - 2][c].type === type) return true;
        }
        return false;
    }

    getGridSnapshot() {
        // Return simple copy for UI
        return this.grid.map(row => row.map(item => ({ type: item.type, id: item.id })));
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
        if (!this.isValidCoord(r1, c1) || !this.isValidCoord(r2, c2)) {
            console.warn('Invalid swap coordinates');
            return false;
        }

        // 1. Perform Swap
        const item1 = this.grid[r1][c1];
        const item2 = this.grid[r2][c2];

        this.grid[r1][c1] = item2;
        this.grid[r2][c2] = item1;

        EventBus.emit('item:swapped', { r1, c1, r2, c2 });

        // 2. Check for Matches
        const matches = this.findMatches();

        if (matches.length > 0) {
            console.log('Match Found!', matches);
            EventBus.emit('matches:found', { matches });

            // Proceed to resolution
            await this.handleMatchResolution(matches);

            return true;
        } else {
            console.log('No match, swapping back...');
            // Swap back
            this.grid[r1][c1] = item1;
            this.grid[r2][c2] = item2;

            // Emit revert event
            EventBus.emit('item:swap_reverted', { r1, c1, r2, c2 });
            return false;
        }
    }

    async handleMatchResolution(matches) {
        // 1. Clear Matched Items
        matches.forEach(({ r, c }) => {
            if (this.grid[r][c].type !== ITEM_TYPES.EMPTY) {
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
            console.log('Cascade Match Found! Resolving...');

            // CRITICAL: Tell the View to animate these matches!
            EventBus.emit('matches:found', { matches: newMatches });

            await this.handleMatchResolution(newMatches);
        }
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
            console.log('Gravity applied', moves);
            EventBus.emit('grid:gravity', { moves });
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
                    // Create new item
                    const randomType = types[Math.floor(Math.random() * types.length)];
                    const newItem = new GridItem(randomType, `item_${idCounter++}_${r}_${c}`); // Unique ID

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
            console.log('Grid Refilled', newItems);
            EventBus.emit('grid:refilled', { newItems });
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
                const type = this.grid[r][c].type;
                if (type === ITEM_TYPES.EMPTY) continue;

                let matchLen = 1;
                while (r + matchLen < this.rows && this.grid[r + matchLen][c].type === type) {
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
                const type = this.grid[r][c].type;
                if (type === ITEM_TYPES.EMPTY) continue;

                let matchLen = 1;
                while (c + matchLen < this.cols && this.grid[r][c + matchLen].type === type) {
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
}
