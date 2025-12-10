import { runManager } from '../core/RunManager.js';
import { RELICS } from '../data/relics.js';
import { TopBar } from '../view/TopBar.js';

export class TreasureScene extends Phaser.Scene {
    constructor() {
        super('TreasureScene');
    }

    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // UI Setup
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x111122); // Dark Blue BG

        this.topBar = new TopBar(this);
        this.topBar.setTitle('TREASURE');

        // Chest Visual
        const chestY = this.scale.height * 0.45;
        this.chest = this.add.text(centerX, chestY, '📦', { fontSize: '120px' }).setOrigin(0.5);
        this.chest.setInteractive({ useHandCursor: true });

        this.instruction = this.add.text(centerX, chestY + 150, 'Click to Open', {
            font: '24px Arial', color: '#aaaaaa'
        }).setOrigin(0.5);

        this.chest.on('pointerdown', () => this.openChest());
    }

    openChest() {
        this.chest.disableInteractive();
        this.instruction.setVisible(false);
        this.chest.setText('🎁'); // Open

        // Pick Random Relic
        const allRelicIds = Object.keys(RELICS);
        const playerRelics = runManager.getRelics();
        const available = allRelicIds.filter(id => !playerRelics.includes(id));

        let rewardId = null;
        if (available.length > 0) {
            rewardId = available[Math.floor(Math.random() * available.length)];
        } else {
            // Fallback: Gold
            rewardId = 'gold_fallback';
        }

        if (rewardId === 'gold_fallback') {
            runManager.addGold(50);
            this.showReward('Bag of Gold', 'Found 50 Gold instead of a relic.', '💰', 0xffd700);
        } else {
            const relic = RELICS[rewardId];
            runManager.addRelic(rewardId);
            this.showReward(relic.name, relic.description, relic.icon, relic.color);
        }

        // Update UI
        this.topBar.render();
    }

    showReward(name, desc, icon, color) {
        const centerX = this.scale.width / 2;
        const chestY = this.scale.height * 0.45;

        // Shine Effect
        const glow = this.add.circle(centerX, chestY, 10, color).setAlpha(0.5);
        this.tweens.add({
            targets: glow,
            scale: 20,
            alpha: 0,
            duration: 1000
        });

        // Icon Pop
        // Remove old chest text or overlay?
        this.add.text(centerX, chestY, icon, { fontSize: '100px' }).setOrigin(0.5)
            .setScale(0).setDepth(10);

        this.tweens.add({
            targets: this.add.text(centerX, chestY, icon, { fontSize: '100px' }).setOrigin(0.5).setDepth(10),
            scale: 1,
            duration: 500,
            ease: 'Back.out'
        });

        // Text
        const textY = chestY + 100;
        this.add.text(centerX, textY, name, {
            font: 'bold 36px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0).setY(textY + 30);

        this.add.text(centerX, textY + 50, desc, {
            font: '20px Arial', fill: '#cccccc'
        }).setOrigin(0.5).setAlpha(0).setY(textY + 80);

        // Animate Text In
        this.tweens.add({
            targets: [this.children.list[this.children.list.length - 1], this.children.list[this.children.list.length - 2]],
            y: '-=30',
            alpha: 1,
            duration: 500,
            delay: 300
        });

        // Continue Button
        this.time.delayedCall(1200, () => {
            const btnY = this.scale.height * 0.85;
            const btn = this.add.text(centerX, btnY, 'CONTINUE', {
                backgroundColor: '#444444', padding: { x: 20, y: 10 }, font: '20px Arial'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                runManager.completeLevel();
                this.scene.start('MapScene');
            });
        });
    }
}
