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
    TOXIN_APPLIED: 'combat:toxin_applied',
    OUTBREAK_CAST: 'combat:outbreak_cast',
    EXTRACTION_CAST: 'combat:extraction_cast',
    MIDAS_TOUCH_CAST: 'combat:midas_touch_cast',
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
    GRID_ITEM_UPDATED: 'grid:item_updated',

    // Generic Entity Events (Animation Drivers)
    ENTITY_HEALED: 'entity:healed',
    ENTITY_DAMAGED: 'entity:damaged',
    ENTITY_DEFENDED: 'entity:defended'
};

export const ASSETS = {
    HERO: 'hero_sprite',
    ENEMY_PLACEHOLDER: 'tex_enemy_placeholder',

    // Gem Textures (matching GEM_TYPES keys usually)
    SWORD: 'SWORD',
    SHIELD: 'SHIELD',
    POTION: 'POTION',
    COIN: 'COIN',
    MANA: 'MANA',
    BOW: 'BOW',

    // UI Icons
    ICON_SWORD: 'icon_sword',
    ICON_SHIELD: 'icon_shield',
    ICON_MANA: 'icon_mana',
    ICON_LOCK: 'icon_lock',
    ICON_TRASH: 'icon_trash',
    ICON_BOW: 'icon_bow',
    ICON_TOXIN: 'icon_toxin'
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
    AIMED_SHOT: 'AIMED_SHOT',
    EXTRACTION: 'EXTRACTION',
    OUTBREAK: 'OUTBREAK'
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
        desc: 'Deal 12 Piercing DMG +☠️\nRequirements: 9 or less [icon:icon_sword]on grid'
    },
    EXTRACTION: {
        cost: 3,
        damagePerStack: 1,
        healRatio: 2.0, // 200%
        icon: 'ability_5', // Placeholder
        color: 0x88ff00,
        name: 'Extraction',
        desc: 'Consume all [c:#39ff14]☣️[/c] stacks on the enemy.\nDeal damage equal to the number of [c:#39ff14]☣️[/c] consumed. Heal for 200% of the damage dealt.'
    },
    OUTBREAK: {
        cost: 8,
        transmuteCount: 3,
        threshold: 6, // Toxin Threshold for Extra Move
        icon: 'ability_6', // Placeholder
        color: 0x44cc00,
        name: 'Outbreak',
        desc: 'Convert 3 gems into [icon:icon_potion].\nWhen used, if the enemy has 6+ [c:#39ff14]☣️[/c]\n-> gain 1 Move.'
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
    WEAKNESS: 'WEAKNESS',
    INVULNERABLE: 'INVULNERABLE',
    BARRICADE: 'BARRICADE', // Block retention
    VULNERABLE: 'VULNERABLE', // New Debuff
    WEAKNESS: 'WEAKNESS', // Deals 25% less damage
    STRENGTH: 'STRENGTH',
    GREED_CURSE: 'GREED_CURSE',
    TOXIN: 'TOXIN', // New
    INVULNERABLE: 'INVULNERABLE' // Blocks 1 hit completely
};

// New Match Mastery Constants
export const MATCH_MASTERY = {
    SWORD_BLEED: 'SWORD_BLEED',
    SWORD_CRUSH: 'SWORD_CRUSH',
    SHIELD_THORNS: 'SHIELD_THORNS',
    SHIELD_WALL: 'SHIELD_WALL',
    POTION_REGEN: 'POTION_REGEN',
    POTION_PURIFY: 'POTION_PURIFY',
    MANA_FOCUS: 'MANA_FOCUS',
    COIN_CRIT: 'COIN_CRIT',
    BOW_RUPTURE: 'BOW_RUPTURE'
};

export const POTION_DATA = {
    HEAL: { value: 20 },
    MANA: { value: 10 },
    STRENGTH: { value: 2 }
};
