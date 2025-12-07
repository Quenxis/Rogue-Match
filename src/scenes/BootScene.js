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
        this.load.json('events', 'src/data/events.json');
        this.load.image('hero_sprite', 'assets/entities/warrior.png');
        this.load.image('tex_enemy_placeholder', 'assets/entities/enemy.png');
    }

    create() {
        this.scene.start('MapScene');
    }
}
