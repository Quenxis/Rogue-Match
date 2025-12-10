import { runManager } from '../core/RunManager.js';

export class RewardScene extends Phaser.Scene {
    constructor() {
        super('RewardScene');
    }

    init(data) {
        this.rewards = data.rewards || { gold: 0 };
    }

    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Overlay Background
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.9);

        // Title
        this.add.text(centerX, this.scale.height * 0.15, 'VICTORY!', {
            font: '48px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Reward 1: Gold
        const goldY = this.scale.height * 0.35;
        this.add.text(centerX, goldY - 50, `Loot Found:`, { font: '24px Arial', fill: '#ffffff' }).setOrigin(0.5);

        const goldText = this.add.text(centerX, goldY, `💰 ${this.rewards.gold} Gold`, {
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
        const skillBtn = this.add.container(centerX, this.scale.height * 0.55);
        const btnBg = this.add.rectangle(0, 0, 250, 60, 0x4444ff).setInteractive({ useHandCursor: true });
        const btnTx = this.add.text(0, 0, 'New Skill (Coming Soon)', { font: '20px Arial', fill: '#ffffff' }).setOrigin(0.5);
        skillBtn.add([btnBg, btnTx]);

        skillBtn.on('pointerdown', () => {
            // Placeholder action
            btnTx.setText('Skill Added!');
        });

        // Continue Button
        const continueBtn = this.add.text(centerX, this.scale.height * 0.85, 'Continue to Map >>', {
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
