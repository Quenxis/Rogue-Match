/**
 * @file GridDetails.js
 * @description Constants and helper classes for Grid items.
 * @dependencies None
 */

import { GEM_TYPES } from '../core/Constants.js';

export const ITEM_TYPES = GEM_TYPES;

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
