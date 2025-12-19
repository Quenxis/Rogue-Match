
/**
 * @file RewardService.js
 * @description Logic for generating loot drafts (Traits, Currency, Consumables).
 */

import { masteryManager, RARITY } from '../logic/MasteryManager.js';
import { runManager } from '../core/RunManager.js';

export const REWARD_TYPES = {
    TRAIT: 'TRAIT',
    GOLD: 'GOLD',
    HEAL: 'HEAL',
    MAX_HP: 'MAX_HP'
};

export class RewardService {

    /**
     * Generates 3 reward options for the player.
     * @param {string} tier - Current Run Tier (affects rarity)
     * @returns {Array} - Array of 3 Reward Objects
     */
    generateRewards(tier = 1) {
        const rewards = [];
        const draftedIds = []; // Track IDs generated in this draft to prevent duplicates

        // Slot 1: Utility / Common (High chance of Gold/Heal)
        rewards.push(this._generateUtilityReward(tier));

        // Slot 2: Trait (Uncommon/Rare)
        const slot2 = this._generateTraitReward(tier, [RARITY.UNCOMMON, RARITY.RARE], draftedIds);
        rewards.push(slot2);
        if (slot2.type === REWARD_TYPES.TRAIT) draftedIds.push(slot2.id);

        // Slot 3: Power (Rare/Epic or another Trait)
        // Higher tiers = chance for Epic
        let rarityPool = [RARITY.RARE];
        if (tier >= 5) rarityPool.push(RARITY.EPIC);

        const slot3 = this._generateTraitReward(tier, rarityPool, draftedIds);
        rewards.push(slot3);

        return rewards;
    }

    _generateUtilityReward(tier) {
        const roll = Math.random();
        if (roll < 0.4) {
            return {
                type: REWARD_TYPES.GOLD,
                value: 20 + (tier * 5),
                title: 'Coin Pouch',
                description: `Gain ${20 + (tier * 5)} Gold.`
            };
        } else if (roll < 0.7) {
            return {
                type: REWARD_TYPES.HEAL,
                value: 15, // Flat or %? Flat is safer for now.
                title: 'Bandages',
                description: 'Heal 15 HP.'
            };
        } else {
            return {
                type: REWARD_TYPES.MAX_HP,
                value: 2,
                title: 'Vitality',
                description: 'Gain +2 Max HP.'
            };
        }
    }

    _generateTraitReward(tier, rarityAllowed, excludeIds = []) {
        // Filter available traits from masteryManager
        // Logic: specific rarity, NOT owned already, NOT in exclude list.

        const allTraits = Array.from(masteryManager.traits.values());
        const owned = runManager.traits || [];

        const candidates = allTraits.filter(t =>
            rarityAllowed.includes(t.rarity) &&
            !owned.includes(t.id) &&
            !excludeIds.includes(t.id)
        );

        if (candidates.length === 0) {
            // Fallback if collected everything in this pool
            return {
                type: REWARD_TYPES.GOLD,
                value: 50,
                title: 'Coin Pouch',
                description: 'Gain 50 Gold (No Traits available).'
            };
        }

        const selected = candidates[Math.floor(Math.random() * candidates.length)];

        return {
            type: REWARD_TYPES.TRAIT,
            id: selected.id,
            rarity: selected.rarity,
            gemType: selected.type,
            title: selected.name,
            description: selected.description
        };
    }
}

export const rewardService = new RewardService();
