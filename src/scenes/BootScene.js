/**
 * @file BootScene.js
 * @description Preloader scene for loading assets before the game starts.
 * @dependencies Phaser
 */

import { audioManager } from '../core/AudioManager.js';

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
        this.load.image('huntress', 'assets/entities/huntress.png');
        this.load.image('hero_doctor', 'assets/entities/plague_doctor.png');
        this.load.image('tex_crystal_burrower', 'assets/entities/crystal_burrower.png');

        // Icons (Small versions for UI)
        this.load.image('icon_sword', 'assets/icons/sword.png');
        this.load.image('icon_shield', 'assets/icons/shield.png');
        this.load.image('icon_mana', 'assets/icons/mana.png');
        this.load.image('icon_lock', 'assets/icons/lock.png');
        this.load.image('icon_trash', 'assets/icons/trash.png');
        this.load.image('icon_coin', 'assets/icons/coin.png');
        this.load.image('icon_bow', 'assets/icons/bow.png');
        this.load.image('icon_potion', 'assets/icons/potion.png');

        // Items (Global for Guide)
        this.load.image('SWORD', 'assets/items/sword.png');
        this.load.image('SHIELD', 'assets/items/shield.png');
        this.load.image('POTION', 'assets/items/potion.png');
        this.load.image('COIN', 'assets/items/coin.png');
        this.load.image('MANA', 'assets/items/mana.png');
        this.load.image('trash', 'assets/items/trash.png');
        this.load.image('lock', 'assets/items/lock.png');
        this.load.image('BOW', 'assets/items/bow.png'); // New Bow Gem

        // Backgrounds
        this.load.image('map_bg', 'assets/backgrounds/map_bg.png');

        // Audio
        this.load.audio('bgm_main', 'assets/audio/bgm_main.mp3');

        // Abilities
        this.load.image('ability_2', 'assets/abilities/heal.png');
        this.load.image('ability_3', 'assets/abilities/shield_slam.png');
        this.load.image('ability_4', 'assets/abilities/aimed_shot.png');
        this.load.image('ability_5', 'assets/abilities/extraction.png');
        this.load.image('ability_6', 'assets/abilities/outbreak.png');
    }

    create() {
        // Init Audio Manager
        audioManager.init(this);

        // Prevent audio from pausing when window loses focus
        this.sound.pauseOnBlur = false;

        this.scene.start('HeroSelectScene');
    }
}
