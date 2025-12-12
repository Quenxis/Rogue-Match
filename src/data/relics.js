export const RELICS = {
    'vampire_ring': {
        name: 'Vampire Ring',
        description: 'Heals 2 HP when matching 4+ items.',
        icon: '💍',
        color: 0xff0000,
        type: 'PASSIVE',
        // Hook logic will be handled by CombatManager looking up this ID
        hooks: {
            onMatch: (combat, count, type) => {
                if (count >= 4) {
                    combat.player.heal(2);
                    combat.log('Vampire Ring healed 2 HP!');
                    return true; // Triggered
                }
                return false;
            }
        }
    },
    'golden_idol': {
        name: 'Golden Idol',
        description: 'Gain 5 extra [icon:icon_coin] after winning a battle.',
        icon: '🗿',
        color: 0xffd700,
        type: 'PASSIVE',
        hooks: {
            onVictory: (combat) => {
                combat.player.addGold(5);
                combat.log('Golden Idol: +5 [icon:icon_coin]');
                return true;
            }
        }
    },
    'spiked_shield': {
        name: 'Spiked Shield',
        description: 'Reflects 3 damage when attacked while has at least 1[icon:icon_shield].',
        icon: '🛡️',
        type: 'PASSIVE',
        hooks: {
            onDefend: (combat, damage) => {
                if (combat.player.block > 0) {
                    combat.enemy.takeDamage(3); // Fixed thorns damage
                    combat.log('Spiked Shield reflected 3 [icon:icon_sword]!');
                    return true;
                }
                return false;
            }
        }
    },
    'phantom_gloves': {
        name: 'Phantom Gloves',
        description: 'Allows you to swap gems without creating a match.',
        icon: '👻',
        color: 0xE4ACE4,
        type: 'PASSIVE',
        hooks: {} // Logic handled in GridData
    },
    'crimson_hourglass': {
        name: 'Crimson Hourglass',
        description: 'You have 4 Moves per turn. The 4th move applies 6 Bleed to you.',
        icon: '⏳',
        color: 0x990000,
        type: 'PASSIVE',
        hooks: {
            onTurnStart: (combat) => {
                combat.maxMoves = 4;
                combat.currentMoves = 4;
                combat.log('Crimson Hourglass: +1 Move. Beware the cost!');
                return true;
            },
            onSwap: (combat) => {
                // CombatManager handles swap first, so currentMoves is already decremented.
                // If we went from 1 -> 0, that was the 4th move.
                if (combat.currentMoves === 0) {
                    combat.player.statusManager.applyStack('BLEED', 6);
                    // combat.log('Crimson Hourglass exacted its price: 4 Bleed!', 'relic');
                    return true;
                }
                return false;
            },
            onSwapReverted: (combat) => {
                // If a swap is reverted, it means the move was NOT consumed (moves refunded).
                // If we applied Bleed (because we were at 0 moves), we must undo it.
                // Revert means moves went 0 -> 1.
                if (combat.currentMoves === 1) { // It's 1 because CombatManager refunded it before this event
                    combat.player.statusManager.removeStack('BLEED', 6);
                    // combat.log('Crimson Hourglass penalty reverted.', 'relic');
                    return true;
                }
                return false;
            }
        }
    },
    'greed_pact': {
        name: 'Greed Pact',
        description: 'Matching [icon:icon_coin] gives 3x gold but you take 5 DMG if you end turn without collecting any [icon:icon_coin]',
        icon: '💰',
        color: 0xffd700,
        type: 'PASSIVE',
        hooks: {
            onTurnStart: (combat) => {
                // Apply visual marker status
                // We use applyStack to ensure it's visible. 1 Stack is enough.
                const hasCurse = combat.player.statusManager.getStack('GREED_CURSE') > 0;
                if (!hasCurse) {
                    combat.player.statusManager.applyStack('GREED_CURSE', 1);
                }
                return true;
            },
            onTurnEnd: (combat) => {
                // Access the underlying manager from the context proxy
                // The proxy exposes 'manager' property based on my previous edit to RelicSystem
                const cm = combat.manager;
                if (cm && cm.turnState && !cm.turnState.goldCollected) {
                    combat.log('Greed Curse claims its price: 5 DMG!', 'warning');
                    combat.player.takeDamage(5); // Direct damage, ignores block? Usually curses do true damage or normal. Let's do normal takeDamage.
                    return true;
                }
                return false;
            }
        }
    },
    'splintered_arrowhead': {
        name: 'Splintered Arrowhead',
        description: 'Your Bow attacks deal +1 Piercing Damage',
        icon: '🏹',
        type: 'PASSIVE',
        hooks: {} // No hooks, handled in CombatManager logic directly
    },
    'blood_tipped_edge': {
        name: 'Blood-Tipped Edge',
        description: 'Sword attacks apply +1 Bleed.\n(Match 3 [icon:icon_sword] now applies 1 Bleed)', // newline for cleaner layout
        icon: '🗡️',
        color: 0xA13535, // Blood Red
        type: 'PASSIVE',
        hooks: {}
    },
    'tortoise_shell': {
        name: 'Tortoise Shell',
        description: 'If you deal no damage in a turn, gain +5 [icon:icon_shield]',
        icon: '🐢',
        type: 'PASSIVE',
        hooks: {
            onTurnEnd: (combat) => {
                const cm = combat.manager;
                if (cm && cm.turnState && !cm.turnState.damageDealt) {
                    combat.player.addBlock(5);
                    combat.log('Tortoise Shell grants +5 Block!', 'relic');
                    return true;
                }
                return false;
            }
        }
    }
};