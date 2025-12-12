/**
 * @file Constants.js
 * @description Single Source of Truth for all game constants.
 */

export const EVENTS = {
    // Combat
    MATCHES_FOUND: 'combat:matches_found',
    PLAYER_ATTACK: 'combat:player_attack',
    PLAYER_HEAL: 'combat:player_heal',
    PLAYER_DEFEND: 'combat:player_defend',
    ENEMY_ATTACK: 'combat:enemy_attack',
    ENEMY_DEFEND: 'combat:enemy_defend',
    ENEMY_HEAL: 'combat:enemy_heal',
    ENEMY_LOCK: 'combat:enemy_lock',
    ENEMY_TRASH: 'combat:enemy_trash',
    TURN_START: 'combat:turn_start',
    TURN_END: 'combat:turn_end',
    VICTORY: 'combat:victory',
    DEFEAT: 'game:defeat',
    ENTITY_DIED: 'combat:entity_died',

    // Grid / Match-3
    GRID_CREATED: 'grid:created',
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
    RELIC_TRIGGERED: 'ui:relic_triggered',
    GRID_ITEM_UPDATED: 'grid:item_updated'
};

export const ASSETS = {
    HERO: 'hero_sprite',
    ENEMY_PLACEHOLDER: 'tex_enemy_placeholder',

    // Gem Textures (matching GEM_TYPES keys usually)
    SWORD: 'SWORD',
    SHIELD: 'SHIELD',
    POTION: 'POTION',
    COIN: 'COIN',
    COIN: 'COIN',
    MANA: 'MANA',

    // UI Icons
    ICON_SWORD: 'icon_sword',
    ICON_SHIELD: 'icon_shield',
    ICON_MANA: 'icon_mana',
    ICON_LOCK: 'icon_lock',
    ICON_TRASH: 'icon_trash',
    ICON_BOW: 'icon_bow', // New
    BOW: 'BOW' // New Gem Texture
};

export const ENTITIES = {
    PLAYER: 'PLAYER',
    ENEMY: 'ENEMY',
    ENDED: 'ENDED' // Turn State
};

export const SKILLS = {
    FIREBALL: 'FIREBALL',
    HEAL: 'HEAL',
    SHIELD_SLAM: 'SHIELD_SLAM',
    AIMED_SHOT: 'AIMED_SHOT'
};

// Single source of truth for skill balance
export const SKILL_DATA = {
    FIREBALL: {
        cost: 6,
        damage: 8,
        icon: 'ability_1',
        color: 0xff4400,
        name: 'Fireball',
        desc: 'Deal 8 damage to enemy'
    },
    HEAL: {
        cost: 6,
        heal: 10,
        icon: 'ability_2',
        color: 0x44ff44,
        name: 'Heal',
        desc: 'Restore 10 HP'
    },
    SHIELD_SLAM: {
        cost: 8, // Mana Cost
        shieldCost: 6, // Block/Shield Cost
        damage: 14,
        icon: 'ability_3',
        color: 0x2222aa,
        name: 'Shield Slam',
        desc: 'Spend your block and mana to deal 14 DMG'
    },
    AIMED_SHOT: {
        cost: 5,
        damage: 12,
        vulnerable: 1,
        maxSwords: 9,
        icon: 'ability_4', // User provided icon
        color: 0x22aa22,
        name: 'Aimed Shot',
        desc: 'Deal 12 Piercing DMG + Vulnerable. Requirements: 9 or less Swords on grid.'
    }
};

export const MOVESET_TYPES = {
    ATTACK: 'ATTACK',
    DEFEND: 'DEFEND',
    BUFF: 'BUFF',
    DEBUFF: 'DEBUFF'
};

export const GRID_STATUS = {
    LOCKED: 'LOCKED',
    TRASH: 'TRASH'
};

export const GAME_SETTINGS = {
    MAX_MOVES: 3,
    GRID_ROWS: 8,
    GRID_COLS: 8,
    REFILL_MATCH_CHANCE: 0.5, // Chance (0.0 - 1.0) to allow a new gem to create an immediate match during refill
    REFILL_MATCH_CHANCE: 0.5, // Chance (0.0 - 1.0) to allow a new gem to create an immediate match during refill
    VULNERABLE_MULTIPLIER: 1.25, // 25% extra damage taken
    GRID_SCALE: 1.65, // Scale for Grid and Tokens
    MAP_SCALE: 1.2    // Scale for Map nodes (separate from Grid)
};

export const GEM_TYPES = {
    SWORD: 'SWORD',
    SHIELD: 'SHIELD',
    POTION: 'POTION',
    MANA: 'MANA',
    COIN: 'COIN',
    BOW: 'BOW', // New Type
    EMPTY: 'EMPTY'
};

export const STATUS_TYPES = {
    BLEED: 'BLEED',
    REGEN: 'REGEN',
    THORNS: 'THORNS',
    FOCUS: 'FOCUS',
    CRITICAL: 'CRITICAL',
    VULNERABLE: 'VULNERABLE', // New Debuff
    STRENGTH: 'STRENGTH',
    GREED_CURSE: 'GREED_CURSE'
};

export const POTION_DATA = {
    HEAL: { value: 20 },
    MANA: { value: 10 },
    STRENGTH: { value: 2 }
};
