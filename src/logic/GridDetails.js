/**
 * @file GridDetails.js
 * @description Constants and helper classes for Grid items.
 * @dependencies None
 */

export const ITEM_TYPES = {
    SWORD: 'SWORD',   // Attack
    SHIELD: 'SHIELD', // Defense
    POTION: 'POTION', // Health
    MANA: 'MANA',     // Resource for Skills
    COIN: 'COIN',     // Currency
    EMPTY: 'EMPTY'    // Placeholder for cleared tiles
};

export class GridItem {
    /**
     * @param {string} type - One of ITEM_TYPES
     * @param {string} id - Unique ID for tracking (useful for animations)
     */
    constructor(type, id) {
        this.type = type;
        this.id = id;
        this.isMatched = false;
    }

    isEmpty() {
        return this.type === ITEM_TYPES.EMPTY;
    }
}
