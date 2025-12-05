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
import { logManager } from './LogManager.js';

const config = {
    type: Phaser.AUTO,
    width: 1100, // Widened for Combat Log
    height: 600,
    parent: 'game-container',
    backgroundColor: '#000000',
    scene: [BootScene, MapScene, BattleScene, RewardScene, ShopScene], // BootScene first usually
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

let game = null;

export function startGame() {
    logManager.init('log-content');
    logManager.log('<strong>Game Started</strong>', 'turn');
    game = new Phaser.Game(config);
}
