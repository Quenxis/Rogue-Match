import { runManager } from '../core/RunManager.js';

export class RewardScene extends Phaser.Scene {
    constructor() {
        super('RewardScene');
    }

    init(data) {
        this.rewards = data.rewards || { gold: 0 };
    }

    create() {
        // Overlay Background
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.9);

        // Title
        this.add.text(400, 100, 'VICTORY!', {
            font: '48px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Reward 1: Gold
        this.add.text(400, 250, `Loot Found:`, { font: '24px Arial', fill: '#ffffff' }).setOrigin(0.5);

        const goldText = this.add.text(400, 300, `💰 ${this.rewards.gold} Gold`, {
            font: '32px Arial',
            fill: '#ffff00'
        }).setOrigin(0.5);

        // Animate Gold
        this.tweens.add({
            targets: goldText,
            scale: { from: 0.5, to: 1.2 },
            yoyo: true,
            repeat: 1,
            duration: 300
        });

        // Reward 2: Placeholder for Card/Skill Draft
        const skillBtn = this.add.container(400, 400);
        const btnBg = this.add.rectangle(0, 0, 250, 60, 0x4444ff).setInteractive({ useHandCursor: true });
        const btnTx = this.add.text(0, 0, 'New Skill (Coming Soon)', { font: '20px Arial', fill: '#ffffff' }).setOrigin(0.5);
        skillBtn.add([btnBg, btnTx]);

        skillBtn.on('pointerdown', () => {
            // Placeholder action
            btnTx.setText('Skill Added!');
        });

        // Continue Button
        const continueBtn = this.add.text(400, 520, 'Continue to Map >>', {
            font: '28px Arial',
            fill: '#ffffff',
            backgroundColor: '#00aa00',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.start('MapScene');
            });

        // Hover effects
        continueBtn.on('pointerover', () => continueBtn.setScale(1.1));
        continueBtn.on('pointerout', () => continueBtn.setScale(1));
    }
}
