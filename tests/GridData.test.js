import { GridData } from '../src/logic/GridData.js';
import { ITEM_TYPES } from '../src/logic/GridDetails.js';

describe('GridData Advanced Logic', () => {

    // Helper to create a neutral grid (checkerboard) to avoid accidental random matches
    function createNeutralGrid(rows = 8, cols = 8) {
        const grid = new GridData(rows, cols);
        grid.initialize();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                grid.grid[r][c].type = (r + c) % 2 === 0 ? ITEM_TYPES.SWORD : ITEM_TYPES.SHIELD;
            }
        }
        return grid;
    }

    it('should detect a simple Horizontal Match-3', () => {
        const grid = createNeutralGrid();

        // [X] [X] [X]
        grid.grid[2][2].type = ITEM_TYPES.POTION;
        grid.grid[2][3].type = ITEM_TYPES.POTION;
        grid.grid[2][4].type = ITEM_TYPES.POTION;

        const matches = grid.getAllMatches();
        expect(matches.length).toBe(3);

        // Verify coords
        const has = (r, c) => matches.some(m => m.r === r && m.c === c);
        expect(has(2, 2)).toBe(true);
        expect(has(2, 3)).toBe(true);
        expect(has(2, 4)).toBe(true);
    });

    it('should detect a Vertical Match-4', () => {
        const grid = createNeutralGrid();

        // [X]
        // [X]
        // [X]
        // [X]
        grid.grid[0][0].type = ITEM_TYPES.COIN;
        grid.grid[1][0].type = ITEM_TYPES.COIN;
        grid.grid[2][0].type = ITEM_TYPES.COIN;
        grid.grid[3][0].type = ITEM_TYPES.COIN;

        const matches = grid.getAllMatches();
        expect(matches.length).toBe(4);
    });

    it('should correctly handle L-Shape intersections', () => {
        const grid = createNeutralGrid();

        //    [X]
        //    [X]
        // [X][X][X]

        // Vertical Part
        grid.grid[1][2].type = ITEM_TYPES.MANA;
        grid.grid[2][2].type = ITEM_TYPES.MANA;
        grid.grid[3][2].type = ITEM_TYPES.MANA; // Junction

        // Horizontal Part
        grid.grid[3][0].type = ITEM_TYPES.MANA;
        grid.grid[3][1].type = ITEM_TYPES.MANA;
        // grid[3][2] is already set

        const matches = grid.getAllMatches();
        // Unique tiles: 5 total
        expect(matches.length).toBe(5);
    });

    it('should correctly apply gravity (logic only)', () => {
        const grid = createNeutralGrid(4, 4);

        // Setup column 0: [A, B, C, D]
        const idA = grid.grid[0][0].id;
        const idB = grid.grid[1][0].id;
        const idC = grid.grid[2][0].id;
        // D will be removed

        // Simulate Match Removal at bottom
        grid.grid[3][0].type = ITEM_TYPES.EMPTY;

        // Apply Gravity
        const moves = grid.applyGravity();
        expect(moves).toBeGreaterThan(0);

        // Expected result: [EMPTY, A, B, C]
        // Check positions by ID tracking logic
        expect(grid.grid[3][0].id).toBe(idC);
        expect(grid.grid[2][0].id).toBe(idB);
        expect(grid.grid[1][0].id).toBe(idA);
        expect(grid.grid[0][0].type).toBe(ITEM_TYPES.EMPTY);
    });

    it('should refill all empty spaces', () => {
        const grid = createNeutralGrid(4, 4);

        // Create gaps
        grid.grid[0][0].type = ITEM_TYPES.EMPTY;
        grid.grid[0][1].type = ITEM_TYPES.EMPTY;
        grid.grid[3][3].type = ITEM_TYPES.EMPTY;

        grid.refill();

        // Check for NO empty
        let emptyCount = 0;
        grid.grid.forEach(row => row.forEach(item => {
            if (item.type === ITEM_TYPES.EMPTY) emptyCount++;
        }));

        expect(emptyCount).toBe(0);
    });

    it('should identify invalid swaps', async () => {
        const grid = createNeutralGrid();

        // Try swapping two distinct items that result in NO match
        // (0,0) is SWORD, (0,1) is SHIELD (based on checkerboard)

        const result = await grid.swapItems(0, 0, 0, 1);

        expect(result).toBe(false); // Swap should fail

        // Verify items are back in original places (types match checkerboard)
        expect(grid.grid[0][0].type).toBe(ITEM_TYPES.SWORD);
        expect(grid.grid[0][1].type).toBe(ITEM_TYPES.SHIELD);
    });

});
