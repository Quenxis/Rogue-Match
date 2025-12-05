import { runManager } from './RunManager.js';
import { logManager } from './LogManager.js';

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
        }
    };

    console.log('%c DEBUG TOOLS LOADED ', 'background: #222; color: #bada55');
    console.log('Use window.cheats or just cheats in console:');
    console.log('cheats.kill() - Kill enemy');
    console.log('cheats.gold(n) - Add gold');
    console.log('cheats.heal(n) - Heal HP');
    console.log('cheats.god() - Full HP + 1000 Gold');
}
