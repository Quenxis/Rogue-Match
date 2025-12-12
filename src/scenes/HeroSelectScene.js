
import { HEROES } from '../data/heroes.js';
import { runManager } from '../core/RunManager.js';

export class HeroSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HeroSelectScene' });
    }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        // Background (Placeholder color until user provides image)
        this.add.rectangle(w / 2, h / 2, w, h, 0x111111).setOrigin(0.5);

        // Title
        this.add.text(w / 2, 100, 'Select Your Hero', {
            font: 'bold 64px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Container for Heroes
        const startX = w * 0.25;
        const gap = w * 0.25;

        const heroKeys = ['warrior', 'huntress', 'locked_2'];

        heroKeys.forEach((key, index) => {
            const x = startX + (index * gap);
            const y = h / 2;

            this.createHeroCard(x, y, key);
        });
    }

    createHeroCard(x, y, heroId) {
        const heroData = HEROES[heroId];
        const isUnlocked = !!heroData;

        const cardContainer = this.add.container(x, y);

        // Card BG
        const bg = this.add.rectangle(0, 0, 300, 500, 0x222222).setStrokeStyle(4, 0x555555);
        if (isUnlocked) bg.setStrokeStyle(4, 0xaa8800); // Gold border for available hero

        // Hero Image / Placeholder
        let image;
        if (isUnlocked && this.textures.exists(heroData.texture)) {
            image = this.add.image(0, -50, heroData.texture);
            // Fit inside card
            const scaleX = 280 / image.width;
            const scaleY = 350 / image.height;
            const configScale = heroData.scale || 1.0;
            const scale = Math.min(scaleX, scaleY) * configScale;
            image.setScale(scale);
        } else {
            image = this.add.text(0, -50, '?', { fontSize: '96px', color: '#555' }).setOrigin(0.5);
        }

        // Name
        const nameText = this.add.text(0, 150, isUnlocked ? heroData.name : 'Coming Soon', {
            font: 'bold 32px Arial',
            fill: isUnlocked ? '#ffd700' : '#888888'
        }).setOrigin(0.5);

        cardContainer.add([bg, image, nameText]);

        if (isUnlocked) {
            // Interactive Logic
            bg.setInteractive({ useHandCursor: true });

            bg.on('pointerover', () => {
                this.tweens.add({
                    targets: cardContainer,
                    scale: 1.1,
                    duration: 200,
                    ease: 'Back.out'
                });
                bg.setStrokeStyle(4, 0xffffff);
            });

            bg.on('pointerout', () => {
                this.tweens.add({
                    targets: cardContainer,
                    scale: 1.0,
                    duration: 200,
                    ease: 'Power2'
                });
                bg.setStrokeStyle(4, 0xaa8800);
            });

            bg.on('pointerdown', () => {
                console.log('Hero Selected:', heroId);
                // Start Run
                runManager.startNewRun(heroId);
                this.scene.start('MapScene');
            });
        } else {
            // Locked visual
            bg.setAlpha(0.5);
        }
    }
}
