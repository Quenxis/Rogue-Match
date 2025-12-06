/**
 * @file BattleScene.js
 * @description Main gameplay scene. Manages the visual representation of the battle.
 * @dependencies Phaser, EventBus, GridData, AssetFactory, GridView
 */

import { EventBus } from '../core/EventBus.js';
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

export class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
        this.gridLogic = null;
        this.gridView = null;
    }

    preload() {
        this.load.image(ASSETS.SWORD, 'assets/sword.png');
        this.load.image(ASSETS.SHIELD, 'assets/shield.png');
        this.load.image(ASSETS.POTION, 'assets/potion.png');
        this.load.image(ASSETS.COIN, 'assets/coin.png');
        this.load.image(ASSETS.MANA, 'assets/mana.png');
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

        // 3b. Initialize Combat Log View (Bottom Right Side)
        // 3b. Initialize Combat Log View (Bottom Right Side)
        // x=870 (Centered on Right Column 980, Width 220 means 870->1090)
        // bottomY=590 (Anchored 10px from bottom)
        // Width 220 (Wider for single line text)
        // Height 200 (Max Expanded Height)
        this.logView = new CombatLogView(this, 870, 590, 220, 200);

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

        // Cleanup on shutdown
        this.events.on('shutdown', this.shutdown, this);
    }

    shutdown() {
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
    }

    update() {
        // Game loop
    }
}
