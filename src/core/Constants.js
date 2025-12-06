/**
 * @file Constants.js
 * @description Single Source of Truth for all game constants.
 */

export const EVENTS = {
    // Combat
    TURN_START: 'combat:turn_start',
    TURN_END: 'combat:turn_end',
    PLAYER_ATTACK: 'combat:player_attack',
    ENEMY_ATTACK: 'combat:enemy_attack',
    VICTORY: 'game:victory',
    DEFEAT: 'game:defeat',

    // Grid / Match-3
    GRID_CREATED: 'grid:created',
    MATCHES_FOUND: 'matches:found',
    ITEM_SWAPPED: 'item:swapped',
    ITEM_SWAP_REVERTED: 'item:swap_reverted',
    GRID_GRAVITY: 'grid:gravity',
    GRID_REFILLED: 'grid:refilled',

    // UI
    UI_ANIMATION_COMPLETE: 'ui:animation_complete',
    UI_REFRESH_TOPBAR: 'ui:refresh_topbar',
    UI_UPDATE: 'ui:update_stats',
    SHOW_NOTIFICATION: 'ui:show_notification',
    POTION_USE_REQUESTED: 'potion:use_requested',
    SCENE_READY: 'scene:ready',
    RELIC_TRIGGERED: 'ui:relic_triggered'
};

export const ASSETS = {
    HERO: 'hero_sprite',
    ENEMY_PLACEHOLDER: 'tex_enemy_placeholder',

    // Gem Textures (matching GEM_TYPES keys usually)
    SWORD: 'SWORD',
    SHIELD: 'SHIELD',
    POTION: 'POTION',
    COIN: 'COIN',
    MANA: 'MANA'
};

export const ENTITIES = {
    PLAYER: 'PLAYER',
    ENEMY: 'ENEMY',
    ENDED: 'ENDED' // Turn State
};

export const SKILLS = {
    FIREBALL: 'FIREBALL',
    HEAL: 'HEAL'
};

export const GAME_SETTINGS = {
    MAX_MOVES: 3,
    GRID_ROWS: 8,
    GRID_COLS: 8
};

export const GEM_TYPES = {
    SWORD: 'SWORD',
    SHIELD: 'SHIELD',
    POTION: 'POTION',
    MANA: 'MANA',
    COIN: 'COIN',
    EMPTY: 'EMPTY'
};
