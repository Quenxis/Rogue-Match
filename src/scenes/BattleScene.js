/**
 * @file BattleScene.js
 * @description Main gameplay scene. Manages the visual representation of the battle.
 * @dependencies Phaser, EventBus, GridData, AssetFactory, GridView
 */

import { EventBus } from '../core/EventBus.js';
import { GridData } from '../logic/GridData.js';
import { AssetFactory } from '../view/AssetFactory.js';
import { GridView } from '../view/GridView.js';
import { CombatManager } from '../combat/CombatManager.js';
import { CombatLogView } from '../view/CombatLogView.js';
import { TopBar } from '../view/TopBar.js';
import { createVersionWatermark } from '../view/UIHelper.js';

export class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
        this.gridLogic = null;
        this.gridView = null;
    }

    preload() {
        this.load.image('SWORD', 'assets/sword.png');
        this.load.image('SHIELD', 'assets/shield.png');
        this.load.image('POTION', 'assets/potion.png');
        this.load.image('COIN', 'assets/coin.png');
        this.load.image('MANA', 'assets/mana.png');
    }

    create(data) {
        console.log('Battle Scene Ready', data);

        // 1. Generate Assets
        const assetFactory = new AssetFactory(this);
        assetFactory.generateAssets();

        // 2. Initialize Logic
        this.gridLogic = new GridData(8, 8); // 8x8 Grid

        // Expose to global window for testing via console
        window.grid = this.gridLogic;

        // 3. Initialize View
        // Canvas is 1100 wide.
        // Grid Center: 550 (Absolute Center)
        this.gridView = new GridView(this, 550, 350);

        // 3b. Initialize Combat Log View (Right Side)
        // x=920 (Right aligned with margin)
        // Width 170 (Fixed)
        this.logView = new CombatLogView(this, 920, 50, 170, 0);

        // 3c. Initialize Top Bar
        this.topBar = new TopBar(this);

        createVersionWatermark(this);

        // 4. Start grid (will trigger events that View listens to)
        this.gridLogic.initialize();

        // 5. Initialize Combat System
        // Pass entire data object (includes enemyId, nodeType)
        this.combatManager = new CombatManager(this, data);

        // Notify other systems that the scene is ready
        EventBus.emit('scene:ready', { scene: 'BattleScene' });

        // Cleanup on shutdown
        this.events.on('shutdown', this.shutdown, this);
    }

    shutdown() {
        if (this.combatManager) {
            this.combatManager.destroy();
            this.combatManager = null;
        }
    }

    update() {
        // Game loop
    }
}
