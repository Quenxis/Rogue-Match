import { runManager } from './RunManager.js';
import { logManager } from './LogManager.js';
import { RELICS } from '../data/relics.js';
import { ENEMIES } from '../data/enemies.js'; // Import Enemies
import { EventBus } from './EventBus.js';

export function initDebugTools() {
    window.cheats = {
        // --- HELPERS ---
        _getBattle: () => {
            if (!window.game) return null;
            // distinct check using Key
            if (window.game.scene.isActive('BattleScene')) {
                return window.game.scene.getScene('BattleScene');
            }
            return null;
        },

        _getMap: () => {
            if (!window.game) return null;
            if (window.game.scene.isActive('MapScene')) {
                return window.game.scene.getScene('MapScene');
            }
            return null;
        },

        // --- COMBAT CHEATS ---
        kill: () => {
            const battle = window.cheats._getBattle();
            if (battle && battle.combatManager && battle.combatManager.enemy) {
                battle.combatManager.enemy.takeDamage(99999);
                battle.combatManager.checkWinCondition();
                logManager.log('<strong>CHEAT: Enemy Executed</strong>', 'info');
            } else {
                console.warn('No active combat/enemy found.');
            }
        },

        heal: (amount = 999) => {
            runManager.player.currentHP = Math.min(runManager.player.currentHP + amount, runManager.player.maxHP);

            // Try window.combat (Direct Manager Access)
            const cm = window.combat;
            if (cm && cm.player) {
                cm.player.currentHP = runManager.player.currentHP;
                if (typeof cm.emitState === 'function') cm.emitState();
            }

            const msg = `CHEAT: Healed ${amount} HP`;
            logManager.log(`<strong>${msg}</strong>`, 'heal');
            console.log(msg);
            EventBus.emit('ui:refresh_topbar');
        },

        armor: (amount = 50) => {
            const cm = window.combat;
            if (cm && cm.player) {
                // Use method if exists, else prop
                if (typeof cm.player.addBlock === 'function') cm.player.addBlock(amount);
                else cm.player.block += amount;

                if (typeof cm.emitState === 'function') cm.emitState();

                const msg = `CHEAT: Added ${amount} Block`;
                logManager.log(`<strong>${msg}</strong>`, 'info');
                console.log(msg);
            } else {
                console.warn('Combat not active (window.combat missing).');
            }
        },

        mana: (amount = 10) => {
            const cm = window.combat;
            if (cm && cm.player) {
                if (typeof cm.player.addMana === 'function') cm.player.addMana(amount);
                else cm.player.mana += amount;

                if (typeof cm.emitState === 'function') cm.emitState();

                const msg = `CHEAT: Added ${amount} Mana`;
                logManager.log(`<strong>${msg}</strong>`, 'info');
                console.log(msg);
            } else {
                console.warn('Combat not active (window.combat missing).');
            }
        },

        spawn: (enemyKey) => {
            const battle = window.cheats._getBattle();
            if (battle) {
                // If we are in battle, maybe replace current? Or warn.
                console.warn('Already in battle. Use this from Map or Debug Scene to force start battle.');
                // Actually, let's allow "forcing" a battle from MapScene if possible

                // If we are NOT in battle, try to find MapScene and start one
                return;
            }

            // Try MapScene launch
            const map = window.cheats._getMap();
            if (map) {
                // Manually start battle?
                console.log('Starting battle with ' + enemyKey);
                window.game.scene.start('BattleScene', { enemyId: enemyKey });
            }
        },

        forceWin: () => {
            // Instant Win current node
            const battle = window.cheats._getBattle();
            if (battle) {
                window.cheats.kill();
            } else {
                console.warn('Not in battle');
            }
        },

        // --- MAP CHEATS ---
        unlockMap: () => {
            // Need access to MapScene nodes
            const map = window.cheats._getMap();
            if (map && map.mapManager) {
                // Hacky: Set all nodes to 'available' or 'visited'
                map.mapManager.getAllNodes().forEach(n => {
                    n.status = 'available';
                    // This might break logic if not careful, but it's a cheat.
                });
                map.createMapVisuals(); // Re-render
                logManager.log('<strong>CHEAT: Map Unlocked</strong>', 'info');
            } else {
                console.warn('MapScene not active.');
            }
        },

        // --- GENERAL CHEATS ---
        gold: (amount = 1000) => {
            runManager.addGold(amount);
            logManager.log(`<strong>CHEAT: Added ${amount} Gold</strong>`, 'gold');
            EventBus.emit('ui:refresh_topbar');
        },

        god: () => {
            window.cheats.heal(999);
            window.cheats.gold(5000);
            const battle = window.cheats._getBattle();
            if (battle) window.cheats.armor(100);
        },

        listEnemies: () => {
            console.table(ENEMIES);
        },

        // Debug
        info: () => {
            console.log('RunManager:', runManager);
            console.log('Game:', window.game);
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
                } else {
                    console.warn('Inventory full?');
                }
            } else {
                console.error('Invalid Potion ID. Use cheats.listItems() to see available.');
            }
        }
    };

    console.log('%c DEBUG TOOLS UPDATED ', 'background: #444; color: #bada55');
    console.log('cheats.kill()      - Kill current enemy');
    console.log('cheats.heal(n)     - Heal HP (default full)');
    console.log('cheats.armor(n)    - Add Block (default 50)');
    console.log('cheats.mana(n)     - Add Mana (default 10)');
    console.log('cheats.gold(n)     - Add Gold (default 1000)');
    console.log('cheats.god()       - God Mode (Full HP, Gold, Block)');
    console.log('cheats.spawn(id)   - Force battle with Enemy ID');
    console.log('cheats.forceWin()  - Instant win');
    console.log('cheats.unlockMap() - Unlock all map nodes');
    console.log('cheats.listEnemies() - Show Enemy IDs');
    console.log('cheats.listItems()   - Show Relic/Potion IDs');
    console.log('cheats.getRelic(id)  - Add Relic');
    console.log('cheats.getPotion(id) - Add Potion');
}
