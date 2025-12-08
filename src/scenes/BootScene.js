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
        this.load.image('tex_skeleton', 'assets/entities/skeleton.png');
        this.load.image('tex_rat', 'assets/entities/rat.png');
        this.load.image('tex_slime', 'assets/entities/slime.png');
        this.load.image('tex_orc', 'assets/entities/orc.png');
        this.load.image('tex_dragon', 'assets/entities/dragon.png');

        // Icons (Small versions for UI)
        this.load.image('icon_sword', 'assets/icons/sword.png');
        this.load.image('icon_shield', 'assets/icons/shield.png');
        this.load.image('icon_mana', 'assets/icons/mana.png');

        // Backgrounds
        this.load.image('map_bg', 'assets/backgrounds/map_bg.png');
    }

    create() {
        this.scene.start('MapScene');
    }
}
