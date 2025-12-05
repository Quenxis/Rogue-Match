/**
 * @file BootScene.js
 * @description Preloader scene for loading assets before the game starts.
 * @dependencies Phaser
 */

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Load global assets here
    }

    create() {
        this.scene.start('MapScene');
    }
}
