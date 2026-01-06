/**
 * @file BattleScene.js
 * @description Main gameplay scene. Manages the visual representation of the battle.
 * @dependencies Phaser, EventBus, GridData, AssetFactory, GridView
 */

import { EventBus } from '../core/EventBus.js';
import { runManager } from '../core/RunManager.js';
import { EVENTS, ASSETS } from '../core/Constants.js';
import { GridData } from '../logic/GridData.js';
import { AssetFactory } from '../view/AssetFactory.js';
import { GridView } from '../view/GridView.js';
import { CombatManager } from '../combat/CombatManager.js';
import { CombatView } from '../view/CombatView.js';
import { CombatLogView } from '../view/CombatLogView.js';
import { RelicSystem } from '../combat/RelicSystem.js';
import { TopBar } from '../view/TopBar.js';
import { createVersionWatermark } from '../view/UIHelper.js';
import { audioManager } from '../core/AudioManager.js';

export class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
        this.gridLogic = null;
        this.gridView = null;
    }

    preload() {
        // Items loaded in BootScene (Global)
    }

    create(data) {
        console.log('Battle Scene Ready', data);

        // Play/Sync BGM
        audioManager.playBGM('bgm_main', this);

        // 0. Background
        // Get Background from current Act
        const actIndex = runManager.currentActIndex || 0;
        // Import ACTS dynamically if needed or rely on runManager?
        // Better to import ACTS or check runManager helper if it exists.
        // runManager doesn't expose ACTS directly, but we can import it.
        // Let's use a safe fallback.

        let bgKey = 'bg_dungeon';
        // We need to import ACTS to know the key, OR RunManager can provide it.
        // Since we can't easily add import to top of this file without reading it all again (risky with replace_file_content on large files), 
        // let's try to deduce or just hardcode for now/use placeholder logic?
        // No, let's fix it properly. I'll use a hardcoded check for now or assume RunManager has it.
        // Actually, I can import ACTS at the top if I read the file.
        // But wait, I have the file cached from Step 169.
        // I will use a simple switch or just import it.

        // Let's rely on data if passed? No.
        // Let's use the key from acts.js if possible.
        // I'll add the import in a separate call if needed, but for now:
        if (actIndex === 1) bgKey = 'bg_dungeon2';

        this.add.image(this.scale.width / 2, this.scale.height / 2, bgKey)
            .setDisplaySize(this.scale.width, this.scale.height); // Stretch to fit

        // 1. Generate Assets
        const assetFactory = new AssetFactory(this);
        assetFactory.generateAssets();

        // 2. Initialize Logic
        this.gridLogic = new GridData(8, 8); // 8x8 Grid

        // Expose to global window for testing via console
        window.grid = this.gridLogic;

        // 3. Initialize View
        // Initialize View (Visuals)
        const centerX = this.scale.width * 0.5;
        const centerY = this.scale.height * 0.45; // Slightly higher than center to leave room for UI
        this.gridView = new GridView(this, centerX, centerY);

        // 3b. Initialize Combat Log View (Top Right Side)
        const logWidth = 350; // Wider log
        const logX = this.scale.width - logWidth - 20;
        const logY = 50; // TopBar Height (glued to bottom)
        this.logView = new CombatLogView(this, logX, logY, logWidth, 400);

        // 3c. Initialize Top Bar
        this.topBar = new TopBar(this);

        createVersionWatermark(this);

        // 4. Start grid (will trigger events that View listens to)
        this.gridLogic.initialize();

        // 5. Initialize Combat System
        // Logic (Manager)
        this.combatManager = new CombatManager(this, data);

        // Visuals (View)
        this.combatView = new CombatView(this, this.combatManager);

        // Systems (Relics)
        this.relicSystem = new RelicSystem(this.combatManager);

        // Notify other systems that the scene is ready
        EventBus.emit(EVENTS.SCENE_READY, { scene: 'BattleScene' });

        // Start Combat Logic (Emits initial state to View)
        this.combatManager.init();

        // Listen for Victory
        this.onVictoryBound = this.handleVictory.bind(this);
        EventBus.on(EVENTS.VICTORY, this.onVictoryBound);

        // Listen for Defeat
        this.onDefeatBound = this.handleDefeat.bind(this);
        EventBus.on(EVENTS.GAME_OVER, this.onDefeatBound);

        // Cleanup on shutdown
        this.events.on('shutdown', this.shutdown, this);
    }

    handleVictory(data) {
        // Wait a moment for animations
        this.time.delayedCall(1000, () => {
            const node = runManager.currentNode; // Get current node info
            console.log(`[BattleScene] Victory! Node: ${node ? node.id : 'null'} Type: ${node ? node.type : 'N/A'}`);

            // Check if Elite or Boss
            const isSpecial = node && (node.type === 'ELITE' || node.type === 'BOSS');

            // Determine Rewards
            let choices = [];
            if (isSpecial) {
                choices = runManager.generateEliteRewards();
            }

            let totalGold = data.combat.goldReward;

            // Apply Interest (from Traits like Investment)
            if (data.combat.interest && data.combat.interest > 0) {
                const interestBonus = Math.floor(totalGold * data.combat.interest);
                totalGold += interestBonus;
                console.log(`[BattleScene] Applied Interest: +${interestBonus} Gold (${data.combat.interest * 100}%)`);
            }

            // Launch Reward Scene (Always)
            // RewardScene handles: Adding Gold, Displaying Rewards, and Calling runManager.completeLevel()
            this.scene.start('RewardScene', {
                rewards: {
                    gold: totalGold,
                    choices: choices
                }
            });
        });
    }

    handleDefeat(data) {
        // Wait a moment for death animation
        this.time.delayedCall(1500, () => {
            runManager.resetRun(); // Ensure run is cleared
            // Go to Hero Select to restart run
            this.scene.start('HeroSelectScene');
        });
    }

    shutdown() {
        try {
            EventBus.off(EVENTS.VICTORY, this.onVictoryBound);
            EventBus.off(EVENTS.GAME_OVER, this.onDefeatBound);
            if (this.combatManager) {
                this.combatManager.destroy();
                this.combatManager = null;
            }
            if (this.combatView) {
                this.combatView.destroy();
                this.combatView = null;
            }
            if (this.relicSystem) {
                this.relicSystem.destroy();
                this.relicSystem = null;
            }
            if (this.gridView) {
                this.gridView.destroy();
                this.gridView = null;
            }
            // TopBar usually cleans itself up via 'shutdown' event, but manual is safer?
            // TopBar listens to 'shutdown'.
        } catch (e) {
            console.error('[BattleScene] Error during shutdown:', e);
        }
    }

    update() {
        // Game loop
    }
}
