import { runManager } from '../core/RunManager.js';
import { TopBar } from '../view/TopBar.js';
import { GAME_SETTINGS } from '../core/Constants.js';

export class RestScene extends Phaser.Scene {
    constructor() {
        super('RestScene');
    }

    create() {
        // UI: TopBar
        this.topBar = new TopBar(this);
        this.topBar.setTitle('Rest Site');

        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Background (Reuse map bg, maybe tinited)
        const bg = this.add.image(centerX, centerY, 'map_bg').setDepth(-10);
        const scaleX = this.scale.width / bg.width;
        const scaleY = this.scale.height / bg.height;
        bg.setScale(Math.max(scaleX, scaleY));
        bg.setTint(0x442222); // Reddish warm tint for campfire

        // Campfire Icon/Visual (Big emoji for now)
        this.add.text(centerX, centerY - 100, '🔥', { fontSize: '120px' }).setOrigin(0.5);
        this.add.text(centerX, centerY + 20, 'You found a safe spot to rest.', {
            font: '24px Arial', fill: '#ffaa88'
        }).setOrigin(0.5);

        // Action Buttons Container
        this.buttonsContainer = this.add.container(centerX, centerY + 150);

        // REST BUTTON
        const healAmount = Math.floor(runManager.player.maxHP * 0.30);
        this.restBtn = this.createButton(0, 0, `REST (+${healAmount} HP)`, 0x228822, () => {
            this.handleRest(healAmount);
        });

        this.buttonsContainer.add(this.restBtn);
    }

    createButton(x, y, label, color, callback) {
        const container = this.add.container(x, y);

        const bg = this.add.rectangle(0, 0, 240, 60, color)
            .setStrokeStyle(2, 0xffffff);

        const text = this.add.text(0, 0, label, {
            fontSize: '24px', fontStyle: 'bold', fill: '#ffffff'
        }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.tweens.add({
                    targets: container, scale: 0.95, yoyo: true, duration: 100,
                    onComplete: callback
                });
            })
            .on('pointerover', () => bg.setFillStyle(color, 0.8))
            .on('pointerout', () => bg.setFillStyle(color, 1));

        container.add([bg, text]);
        return container;
    }

    handleRest(amount) {
        // Heal
        runManager.applyEffect({ heal: amount });
        this.topBar.render(); // Update HP bar

        // Visual Feedback
        this.restBtn.destroy(); // Remove button

        this.add.text(this.scale.width / 2, this.scale.height / 2 + 150, "Rested.", {
            fontSize: '32px', fill: '#00ff00', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Show Continue Button
        this.time.delayedCall(800, () => {
            const continueBtn = this.createButton(0, 100, "CONTINUE", 0x444444, () => {
                this.handleContinue();
            });
            this.buttonsContainer.add(continueBtn);
        });
    }

    handleContinue() {
        runManager.completeLevel();
        this.scene.start('MapScene');
    }
}
