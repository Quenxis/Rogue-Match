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
            onVictory: (runManager) => {
                runManager.addGold(5);
                console.log('Golden Idol: Added 5 Gold');
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
    }
};
