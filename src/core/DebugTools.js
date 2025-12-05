import { runManager } from './RunManager.js';
import { logManager } from './LogManager.js';
import { RELICS } from '../data/relics.js';
import { EventBus } from './EventBus.js';

export function initDebugTools() {
    window.cheats = {
        kill: () => {
            if (window.combat && window.combat.enemy) {
                window.combat.enemy.takeDamage(9999);
                window.combat.checkWinCondition();
                logManager.log('<strong>CHEAT: Enemy Executed</strong>', 'info');
            } else {
                console.warn('No active combat found.');
            }
        },

        gold: (amount = 100) => {
            runManager.addGold(amount);
            logManager.log(`<strong>CHEAT: Added ${amount} Gold</strong>`, 'gold');
            // Refresh UI if possible? 
            // Currently UI updates are event driven or on interaction. 
            // TopBar might not update immediately unless we emit event.
            // Let's force a refresh if possible, or just wait for next interaction.
        },

        heal: (amount = 100) => {
            runManager.player.currentHP = Math.min(runManager.player.currentHP + amount, runManager.player.maxHP);
            // Also heal combat player if active
            if (window.combat && window.combat.player) {
                window.combat.player.currentHP = runManager.player.currentHP;
                window.combat.updateUI();
            }
            logManager.log(`<strong>CHEAT: Healed ${amount} HP</strong>`, 'heal');
        },

        god: () => {
            runManager.addGold(1000);
            runManager.player.currentHP = runManager.player.maxHP;
            if (window.combat && window.combat.player) {
                window.combat.player.currentHP = runManager.player.currentHP;
                window.combat.updateUI();
            }
            logManager.log('<strong>CHEAT: GOD MODE ACTIVATED</strong>', 'info');
        },

        getRelic: (id) => {
            if (RELICS[id]) {
                if (runManager.addRelic(id)) {
                    logManager.log(`<strong>CHEAT: Added Relic ${RELICS[id].name}</strong>`, 'info');
                    EventBus.emit('ui:refresh_topbar');
                } else {
                    console.warn('Relic already owned.');
                }
            } else {
                console.error('Invalid Relic ID. Use cheats.listItems() to see available.');
            }
        },

        getAllRelics: () => {
            Object.keys(RELICS).forEach(id => {
                runManager.addRelic(id);
            });
            logManager.log('<strong>CHEAT: Added ALL Relics</strong>', 'info');
            EventBus.emit('ui:refresh_topbar');
        },

        getPotion: (id) => {
            const POTIONS = {
                'potion_heal': { id: 'potion_heal', name: 'Health Potion', type: 'POTION', effect: 'Heal 20 HP', color: 0xff0000 },
                'potion_mana': { id: 'potion_mana', name: 'Mana Potion', type: 'POTION', effect: 'Gain 10 Mana', color: 0x0000ff },
                'potion_strength': { id: 'potion_strength', name: 'Strength Potion', type: 'POTION', effect: '+2 Str for Combat', color: 0xffaa00 }
            };

            if (POTIONS[id]) {
                if (runManager.addPotion(POTIONS[id])) {
                    logManager.log(`<strong>CHEAT: Added ${POTIONS[id].name}</strong>`, 'info');
                    EventBus.emit('ui:refresh_topbar');
                }
            } else {
                console.error('Invalid Potion ID. Use cheats.listItems() to see available.');
            }
        },

        listItems: () => {
            console.group('--- Available Items ---');
            console.log('%c RELICS:', 'color: gold; font-weight: bold;');
            Object.entries(RELICS).forEach(([id, r]) => console.log(`${id}: ${r.name}`));

            console.log('%c POTIONS:', 'color: cyan; font-weight: bold;');
            console.log('potion_heal');
            console.log('potion_mana');
            console.log('potion_strength');
            console.groupEnd();
        }
    };

    console.log('%c DEBUG TOOLS LOADED ', 'background: #222; color: #bada55');
    console.log('Use window.cheats or just cheats in console:');
    console.log('cheats.kill() - Kill enemy');
    console.log('cheats.gold(n) - Add gold');
    console.log('cheats.heal(n) - Heal HP');
    console.log('cheats.god() - Full HP + 1000 Gold');
    console.log('cheats.getRelic(id) - Add specific relic');
    console.log('cheats.getAllRelics() - Add ALL relics');
    console.log('cheats.getPotion(id) - Add specific potion');
    console.log('cheats.listItems() - List IDs');
}
