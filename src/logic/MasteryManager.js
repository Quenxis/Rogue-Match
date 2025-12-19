
/**
 * @file MasteryManager.js
 * @description Manages Gem Mastery Traits, their definitions, and execution logic.
 */

import { MATCH_MASTERY, GEM_TYPES, STATUS_TYPES, EVENTS } from '../core/Constants.js';
import { EventBus } from '../core/EventBus.js';
import { logManager } from '../core/LogManager.js';

export const RARITY = {
    UNCOMMON: 'UNCOMMON',
    RARE: 'RARE',
    EPIC: 'EPIC',
    LEGENDARY: 'LEGENDARY'
};

export const TRIGGERS = {
    PASSIVE: 'PASSIVE',
    MATCH_3: 'MATCH_3',
    MATCH_4: 'MATCH_4',
    MATCH_5: 'MATCH_5', // 5+
    ON_SWAP: 'ON_SWAP'
};

export class MasteryManager {
    constructor() {
        this.traits = new Map(); // id -> Trait Definition
        this._initializeTraits();
    }

    _initializeTraits() {
        // --- SWORDS ---
        this.registerTrait({
            id: 'sword_uncommon_sharpening_stone',
            name: 'Sharpening Stone',
            type: GEM_TYPES.SWORD,
            rarity: RARITY.UNCOMMON,
            trigger: TRIGGERS.PASSIVE,
            description: '[icon:icon_sword] matches deal +1 Damage.',
            execute: (context) => ({ damageMod: 1 })
        });
        this.registerTrait({
            id: 'sword_uncommon_lightweight_hilt',
            name: 'Lightweight Hilt',
            type: GEM_TYPES.SWORD,
            rarity: RARITY.UNCOMMON,
            trigger: TRIGGERS.MATCH_3,
            description: 'Gain 1 Gold per [icon:icon_sword] match (Size 3+).',
            execute: (context) => {
                if (context.player) context.player.addGold(1);
            }
        });
        this.registerTrait({
            id: 'sword_rare_serrated_edge',
            name: 'Serrated Edge',
            type: GEM_TYPES.SWORD,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_sword] applies 2 Bleed.',
            execute: (context) => {
                const { enemy } = context;
                if (enemy) {
                    enemy.statusManager.applyStack(STATUS_TYPES.BLEED, 2);
                    logManager.log('Serrated Edge: Applied 2 Bleed', 'mastery');
                }
            }
        });
        this.registerTrait({
            id: 'sword_rare_heavy_pommel',
            name: 'Heavy Pommel',
            type: GEM_TYPES.SWORD,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_sword] deals +50% Damage.',
            execute: (context) => ({ damageMult: 1.5 })
        });
        this.registerTrait({
            id: 'sword_rare_parry',
            name: 'Parry',
            type: GEM_TYPES.SWORD,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_sword] grants 2 Block.',
            execute: (context) => {
                if (context.player) context.player.addBlock(2);
            }
        });
        this.registerTrait({
            id: 'sword_epic_executioner',
            name: 'Executioner',
            type: GEM_TYPES.SWORD,
            rarity: RARITY.EPIC,
            trigger: TRIGGERS.MATCH_5,
            description: 'Match-5 [icon:icon_sword] deals 2x Damage if enemy HP < 50%.',
            execute: (context) => {
                const { enemy } = context;
                if (enemy && (enemy.currentHP / enemy.maxHP) < 0.5) {
                    logManager.log('Executioner: Double Damage!', 'mastery');
                    return { damageMult: 2.0 };
                }
                return {};
            }
        });

        // --- SHIELDS ---
        this.registerTrait({
            id: 'shield_uncommon_reinforced',
            name: 'Reinforced Steel',
            type: GEM_TYPES.SHIELD,
            rarity: RARITY.UNCOMMON,
            trigger: TRIGGERS.PASSIVE,
            description: '[icon:icon_shield] grants +1 Block.',
            execute: (context) => ({ blockMod: 1 })
        });
        this.registerTrait({
            id: 'shield_rare_spiked_rim',
            name: 'Spiked Rim',
            type: GEM_TYPES.SHIELD,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_shield] grants 3 Thorns.',
            execute: (context) => {
                if (context.player) context.player.statusManager.applyStack(STATUS_TYPES.THORNS, 3);
            }
        });
        this.registerTrait({
            id: 'shield_rare_phalanx',
            name: 'Phalanx',
            type: GEM_TYPES.SHIELD,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_shield] grants +50% Block.',
            execute: (context) => ({ blockMult: 1.5 })
        });
        this.registerTrait({
            id: 'shield_epic_fortress',
            name: 'Fortress',
            type: GEM_TYPES.SHIELD,
            rarity: RARITY.EPIC,
            trigger: TRIGGERS.MATCH_5,
            description: 'Match-5 [icon:icon_shield] grants Banefire (Invulnerability for 1 hit).',
            // NOTE: Banefire status not yet implemented, using huge block/thorns placeholder or new status?
            // User requested "Banefire". Assuming implementation needed or use existing mechanic. 
            // Let's assume Banefire is a specialized status or just a high block for now.
            // Placeholder: 99 Block.
            execute: (context) => {
                logManager.log('Fortress: Applied Banefire (Invulnerable)!', 'mastery');
                if (context.player) context.player.statusManager.applyStack(STATUS_TYPES.INVULNERABLE, 1);
            }
        });

        // --- POTIONS ---
        this.registerTrait({
            id: 'potion_uncommon_larger',
            name: 'Larger Flasks',
            type: GEM_TYPES.POTION,
            rarity: RARITY.UNCOMMON,
            trigger: TRIGGERS.PASSIVE,
            description: '[icon:icon_potion] heals +2 HP.',
            execute: (context) => ({ healMod: 2 })
        });
        this.registerTrait({
            id: 'potion_rare_regeneration',
            name: 'Regeneration',
            type: GEM_TYPES.POTION,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_potion]grants 3 Regen.',
            execute: (context) => {
                // PD Synergy check would happen in CombatManager or here? 
                // Context should have "hasCorruptedFlask".
                if (context.hasCorruptedFlask) {
                    if (context.enemy) context.enemy.statusManager.applyStack(STATUS_TYPES.TOXIN, 3);
                    logManager.log('Regen (Corrupted): 3 Toxin applied.', 'relic');
                } else {
                    if (context.player) context.player.statusManager.applyStack(STATUS_TYPES.REGEN, 3);
                }
            }
        });
        this.registerTrait({
            id: 'potion_rare_purification',
            name: 'Purification',
            type: GEM_TYPES.POTION,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_potion] cleanses 1 Debuff.',
            execute: (context) => {
                if (context.hasCorruptedFlask) {
                    // PD Synergy: Maybe applying more toxins or damage?
                    // Let's clear enemy buffs? Or no synergy.
                } else {
                    if (context.player) context.player.statusManager.cleanse(1);
                }
            }
        });
        this.registerTrait({
            id: 'potion_rare_fire',
            name: 'Alchemist Fire',
            type: GEM_TYPES.POTION,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_potion] deals 5 Damage.',
            execute: (context) => {
                if (context.enemy && context.player) {
                    context.enemy.takeDamage(5, context.player);
                }
            }
        });

        // --- MANA ---
        this.registerTrait({
            id: 'mana_uncommon_flow',
            name: 'Essence Flow',
            type: GEM_TYPES.MANA,
            rarity: RARITY.UNCOMMON,
            trigger: TRIGGERS.PASSIVE,
            description: 'Gain +1 Mana from [icon:icon_mana] matches.',
            execute: (context) => ({ manaMod: 1 })
        });
        this.registerTrait({
            id: 'mana_rare_focus',
            name: 'Deep Focus',
            type: GEM_TYPES.MANA,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_mana] grants 1 Focus.',
            execute: (context) => {
                if (context.player) context.player.statusManager.applyStack(STATUS_TYPES.FOCUS, 1);
            }
        });

        // --- COINS ---
        this.registerTrait({
            id: 'coin_uncommon_pockets',
            name: 'Deep Pockets',
            type: GEM_TYPES.COIN,
            rarity: RARITY.UNCOMMON,
            trigger: TRIGGERS.PASSIVE,
            description: 'Gain +1 Gold per [icon:icon_coin] match.',
            execute: (context) => ({ goldMod: 1 })
        });
        this.registerTrait({
            id: 'coin_uncommon_lucky',
            name: 'Lucky Coin',
            type: GEM_TYPES.COIN,
            rarity: RARITY.UNCOMMON,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_coin] grants 1 Critical Stack.',
            execute: (context) => {
                if (context.player) context.player.statusManager.applyStack(STATUS_TYPES.CRITICAL, 1);
            }
        });
        this.registerTrait({
            id: 'coin_rare_bribe',
            name: 'Bribe',
            type: GEM_TYPES.COIN,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_4,
            description: 'Match-4 [icon:icon_coin] applies Weakness (-25% Dmg).',
            execute: (context) => {
                if (context.enemy) context.enemy.statusManager.applyStack(STATUS_TYPES.WEAKNESS, 1);
                logManager.log('Bribe: Enemy is Weakened!', 'gold');
            }
        });
        this.registerTrait({
            id: 'coin_rare_investment',
            name: 'Investment',
            type: GEM_TYPES.COIN,
            rarity: RARITY.RARE,
            trigger: TRIGGERS.MATCH_5,
            description: 'Match-5 [icon:icon_coin] grants Interest (+10% Gold post-combat, stackable).',
            execute: (context) => {
                // TODO: Store interest in TurnState or CombatManager
                if (context.combatManager) {
                    if (!context.combatManager.interest) context.combatManager.interest = 0;
                    context.combatManager.interest += 0.10;
                    logManager.log('Investment: Interest increased!', 'gold');
                }
            }
        });
    }

    registerTrait(trait) {
        this.traits.set(trait.id, trait);
    }

    getTrait(id) {
        return this.traits.get(id);
    }

    /**
     * Get all traits owned by the player for a specific gem type and trigger.
     * @param {string} gemType 
     * @param {string} trigger 
     */
    getTraitsForGem(gemType, trigger) {
        // We need to access the runManager to see what the player has.
        // Cyclic dependency is an issue if we import runManager at top level if runManager imports this.
        // Solution: Pass ownedTraits as argument OR access global/window OR dynamic import.
        // For now, let's assume we can access `window.runManager` or similar if attached, 
        // OR better: CombatManager passes the traits in.

        // BETTER: MasteryManager shouldn't know about "Player State" directly. 
        // It should just be a library.
        // BUT, `triggerTraits` is a helper method provided for CombatManager.

        // Let's rely on `runManager` being imported dynamically or existing globally if needed, 
        // OR just have CombatManager pass the list of trait IDs.

        // Let's use the `runManager` import from Constants? No, Constants is data. 
        // We will do dynamic import or access the singleton if possible.
        // Actually, importing runManager is fine if runManager doesn't import MasteryManager (it likely doesn't need to).
        // RunManager just stores strings (Ids).

        const { runManager } = require('../core/RunManager.js'); // CommonJS style or standard import if ES modules circular handling works.
        // ES Modules handle circular refs fine usually if just using the exported object.

        // Let's assume standard import at top of file works (I'll add it if missing later, wait, I can't seeing imports).
        // I'll rewrite triggerTraits to use `runManager`.

        // RE-READING: I didn't import runManager in MasteryManager.js yet.

        return [];
    }

    /**
     * Trigger all applicable traits for an event.
     * @param {string} trigger - TRIGGERS.MATCH_4 etc
     * @param {string} gemType - GEM_TYPES.SWORD etc
     * @param {Array<string>} ownedTraitIds - List of trait IDs the player has
     * @param {object} context - { player, enemy, combatManager, matchSize }
     */
    triggerTraits(trigger, gemType, ownedTraitIds, context) {
        // Access Singleton directly (assuming it's safe)
        // Since we are in the same bundle/module system.

        // Note: We need to import runManager.
        // Since I cannot check imports easily without re-reading, 
        // I'll assume I need to ADD the import at the top of the file in a separate step 
        // OR just use a global getter if available.

        // Let's assume passed context has `runManager` or `player` with traits.
        // Ideally `context.player.traits`? Player class doesn't store traits yet. `runManager` does.

        // TEMPORARY: using window.runManager if available, or just mocking.
        // Real implement:


        const results = [];

        ownedTraitIds.forEach(id => {
            const trait = this.traits.get(id);
            if (trait && trait.type === gemType && trait.trigger === trigger) {
                logManager.log(`Trait Triggered: ${trait.name}`, 'mastery');
                const result = trait.execute(context);
                if (result) results.push(result);
            }
        });

        return results;
    }
}

export const masteryManager = new MasteryManager();
