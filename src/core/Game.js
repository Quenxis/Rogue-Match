/**
 * @file Game.js
 * @description Main Game Configuration and Entry Point.
 * @dependencies Phaser, BattleScene, BootScene
 */

import { BattleScene } from '../scenes/BattleScene.js';
import { BootScene } from '../scenes/BootScene.js';
import { MapScene } from '../scenes/MapScene.js';
import { RewardScene } from '../scenes/RewardScene.js';
import { ShopScene } from '../scenes/ShopScene.js';
import { EventScene } from '../scenes/EventScene.js';
import { TreasureScene } from '../scenes/TreasureScene.js';
import { logManager } from './LogManager.js';
import { initDebugTools } from './DebugTools.js';

export const APP_VERSION = '0.3.26';

const config = {
    type: Phaser.AUTO,
    width: 1920, // Full HD
    height: 1080,
    parent: 'game-container',
    backgroundColor: '#000000',
    scene: [BootScene, MapScene, BattleScene, RewardScene, ShopScene, EventScene, TreasureScene], // BootScene first usually
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
        pixelArt: false,
        antialias: true,
        roundPixels: false // Improved scaling for HD assets
    }
};

let game = null;

export function startGame() {
    logManager.init('log-content');
    logManager.log('<strong>Game Started</strong>', 'turn');
    initDebugTools();
    const game = new Phaser.Game(config); // Keep local const
    window.game = game; // Expose global
}
