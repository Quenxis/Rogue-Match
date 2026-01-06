/**
 * @file SkillSystem.js
 * @description Manages Active Skills logic, execution, and cost verification.
 */

import { SKILL_DATA, STATUS_TYPES, EVENTS, GEM_TYPES } from '../../core/Constants.js';
import { logManager } from '../../core/LogManager.js';
import { EventBus } from '../../core/EventBus.js';

export class SkillSystem {
    constructor(combatManager) {
        this.combatManager = combatManager;
    }

    /**
     * Attempts to execute a skill by ID.
     * @param {string} skillId 
     * @returns {boolean} True if skill was executed
     */
    execute(skillId) {
        if (!this.combatManager.canInteract()) {
            logManager.log('Cannot use skill while busy!', 'warning');
            return false;
        }

        const data = SKILL_DATA[skillId];
        if (!data) {
            console.error(`UNKNOWN SKILL: ${skillId}`);
            return false;
        }

        const context = this.getSkillContext();

        // 1. Verify Cost & Conditions
        if (!this.canUseSkill(skillId, true)) {
            // Logs handled inside verification if 'verbose' is true
            return false;
        }

        const cost = this.calculateCost(skillId);

        // 2. Pay Logic (Mana + Focus)
        context.player.mana -= cost;
        if (cost > 0 && context.player.statusManager.getStack(STATUS_TYPES.FOCUS) > 0) {
            context.player.statusManager.consumeStacks(STATUS_TYPES.FOCUS);
            logManager.log('Focus consumed for skill!', 'info');
        }

        // 3. Specific Skill Logic
        this._runSkillEffect(skillId, data, context);

        // 4. Post-Execution Updates
        this.combatManager.emitState();
        this.combatManager.checkWinCondition();

        return true;
    }

    _runSkillEffect(skillId, data, context) {
        const { player, enemy } = context;

        switch (skillId) {
            case 'FIREBALL':
                enemy.takeDamage(data.damage, player, { type: 'SKILL', skill: 'FIREBALL' });
                break;

            case 'HEAL':
                player.heal(data.heal);
                break;

            case 'SHIELD_SLAM':
                const shieldCost = data.shieldCost || 0;
                player.addBlock(-shieldCost); // Consume Block
                enemy.takeDamage(data.damage, player, { type: 'SKILL', skill: 'SHIELD_SLAM' });
                logManager.log(`Shield Slam! -${shieldCost} Block`, 'info');
                break;

            case 'AIMED_SHOT':
                // Damage
                enemy.takeDamage(data.damage, player, { isPiercing: true, type: 'SKILL', skill: 'AIMED_SHOT' });
                // Vulnerable Status
                if (data.vulnerable > 0) {
                    enemy.statusManager.applyStack(STATUS_TYPES.VULNERABLE, data.vulnerable);
                }
                logManager.log(`Aimed Shot! ${data.damage} Piercing DMG.`, 'info');
                break;

            case 'EXTRACTION':
                const currentStacks = enemy.statusManager.getStack(STATUS_TYPES.TOXIN);
                // Consume
                enemy.statusManager.stacks[STATUS_TYPES.TOXIN] = 0;
                EventBus.emit(EVENTS.EXTRACTION_CAST, { stacks: currentStacks });

                // Dmg & Heal
                const dmg = currentStacks * data.damagePerStack;
                const heal = Math.floor(dmg * data.healRatio);

                enemy.takeDamage(dmg, player, { type: 'SKILL', skill: 'EXTRACTION', skipAnimation: true });
                player.heal(heal);

                logManager.log(`Extraction: Consumed ${currentStacks} Toxin. Dealt ${dmg} DMG, Healed ${heal} HP.`, 'info');
                break;

            case 'OUTBREAK':
                // Capture Toxin Stacks BEFORE effect starts (though it's usually static during turn)
                const currentToxin = enemy.statusManager.getStack(STATUS_TYPES.TOXIN);

                // +1 Move Conditional
                if (currentToxin >= data.threshold) {
                    this.combatManager.currentMoves++; // Assuming public access or setter
                    logManager.log(`Outbreak: Threshold met (${currentToxin}), +1 Action!`, 'skill');
                    // We emit state at end of execute() anyway
                } else {
                    logManager.log(`Outbreak: Threshold not met (${currentToxin}/${data.threshold})`, 'info');
                }

                // Transmute Logic
                if (window.grid && window.grid.transmuteRandomGems) {
                    // Logic is asynchronous actually... but execute() is sync usually.
                    // We can fire-and-forget the visual part or handle it via callback.
                    // CombatManager handled it via async callback.

                    window.grid.transmuteRandomGems(data.transmuteCount, GEM_TYPES.POTION, {
                        preModificationCallback: async (targets) => {
                            await new Promise(resolve => {
                                EventBus.emit(EVENTS.OUTBREAK_CAST, {
                                    targets,
                                    onComplete: resolve
                                });
                                setTimeout(resolve, 3000); // Safety
                            });
                        }
                    }).then(selected => {
                        logManager.log(`Outbreak: Transmuted ${selected.length} gems to Potions.`, 'info');
                    });
                }
                break;

            default:
                console.warn(`SkillSystem: No logic implemented for ${skillId}`);
                break;
        }
    }

    /**
     * Checks if a skill CAN be used (Cost + Conditions).
     * @param {string} skillId 
     * @param {boolean} verbose - If true, logs why it failed.
     */
    canUseSkill(skillId, verbose = false) {
        const data = SKILL_DATA[skillId];
        if (!data) return false;

        const context = this.getSkillContext();
        const cost = this.calculateCost(skillId);

        // 1. Mana Check
        if (context.player.mana < cost) {
            if (verbose) logManager.log(`Not enough Mana! (${context.player.mana}/${cost})`, 'warning');
            return false;
        }

        // 2. Specific Conditions
        switch (skillId) {
            case 'SHIELD_SLAM':
                if (context.player.block < (data.shieldCost || 0)) {
                    if (verbose) logManager.log(`Need at least ${data.shieldCost} Block!`, 'warning');
                    return false;
                }
                break;

            case 'AIMED_SHOT':
                const maxSwords = data.maxSwords || 9;
                const swordCount = this._countGridItems(GEM_TYPES.SWORD);
                if (swordCount > maxSwords) {
                    if (verbose) logManager.log(`Too many swords for Aimed Shot! (${swordCount}/${maxSwords})`, 'warning');
                    return false;
                }
                break;

            case 'EXTRACTION':
                const toxin = context.enemy.statusManager.getStack(STATUS_TYPES.TOXIN);
                if (toxin <= 0) {
                    if (verbose) logManager.log('Extraction requires Toxin on enemy.', 'warning');
                    return false;
                }
                break;
        }

        return true;
    }

    /**
     * Checks if ANY skill is usable (for Auto End Turn logic).
     */
    canUseAnySkill() {
        if (!this.combatManager.player) return false;

        const skills = this.combatManager.player.skills || [];
        for (const skillId of skills) {
            // We don't want verbose logs for auto-check
            if (this.canUseSkill(skillId, false)) return true;
        }
        return false;
    }

    calculateCost(skillId) {
        const data = SKILL_DATA[skillId];
        if (!data) return 999;

        const player = this.combatManager.player;
        const focus = player.statusManager.getStack(STATUS_TYPES.FOCUS);

        let multiplier = 1.0;
        if (focus === 1) multiplier = 0.5;
        if (focus >= 2) multiplier = 0.0;

        return Math.floor(data.cost * multiplier);
    }

    getSkillContext() {
        return {
            player: this.combatManager.player,
            enemy: this.combatManager.enemy
        };
    }

    /**
     * Helper to count specific item types on the grid.
     */
    _countGridItems(type) {
        let count = 0;
        if (window.grid && window.grid.grid) {
            window.grid.grid.forEach(row => {
                row.forEach(item => {
                    if (item && item.type === type && !item.isTrash) {
                        count++;
                    }
                });
            });
        }
        return count;
    }
}
