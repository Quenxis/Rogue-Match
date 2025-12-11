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
        description: 'Gain 5 extra Gold after winning a battle.',
        icon: '🗿',
        color: 0xffd700,
        type: 'PASSIVE',
        hooks: {
            onVictory: (combat) => {
                combat.player.addGold(5);
                combat.log('Golden Idol: +5 Gold');
                return true;
            }
        }
    },
    'spiked_shield': {
        name: 'Spiked Shield',
        description: 'Reflects 3 damage when attacked while blocking.',
        icon: '🛡️',
        color: 0x555555,
        type: 'PASSIVE',
        hooks: {
            onDefend: (combat, damage) => {
                if (combat.player.block > 0) {
                    combat.enemy.takeDamage(3); // Fixed thorns damage
                    combat.log('Spiked Shield reflected 3 dmg!');
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
        color: 0xaa00aa,
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
    }
};
