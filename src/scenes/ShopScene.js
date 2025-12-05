import { runManager } from '../core/RunManager.js';
import { AssetFactory } from '../view/AssetFactory.js'; // Reuse texture gen if needed or just use text/shapes

export class ShopScene extends Phaser.Scene {
    constructor() {
        super('ShopScene');
    }

    create() {
        // Background
        this.add.rectangle(550, 300, 1100, 600, 0x111111);

        // Title
        this.add.text(550, 50, 'MERCHANT', { font: '32px Arial', fill: '#ffd700' }).setOrigin(0.5);

        // Gold Display
        this.goldText = this.add.text(550, 90, `Gold: ${runManager.player.gold}`, { font: '24px Arial', fill: '#ffffff' }).setOrigin(0.5);

        // Exit Button
        const exitBtn = this.add.text(550, 520, 'Leave Shop', {
            font: '24px Arial',
            fill: '#ffffff',
            backgroundColor: '#444444',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.start('MapScene');
            });

        exitBtn.on('pointerover', () => exitBtn.setStyle({ fill: '#ffff00' }));
        exitBtn.on('pointerout', () => exitBtn.setStyle({ fill: '#ffffff' }));

        this.generateShopItems();
    }

    generateShopItems() {
        const items = [
            { id: 'potion_heal', name: 'Health Potion', cost: 30, type: 'POTION', effect: 'Heal 20 HP', color: 0xff0000 },
            { id: 'potion_mana', name: 'Mana Potion', cost: 40, type: 'POTION', effect: 'Gain 10 Mana', color: 0x0000ff },
            { id: 'potion_strength', name: 'Strength Potion', cost: 50, type: 'POTION', effect: '+2 Str for Combat', color: 0xffaa00 }
        ];

        // Display 3 Items
        const startX = 350; // Center 550. Gap 200. Left 350, Center 550, Right 750
        const gap = 200;

        items.forEach((item, index) => {
            const x = startX + (index * gap);
            this.createShopCard(x, 250, item);
        });
    }

    createShopCard(x, y, item) {
        const container = this.add.container(x, y);

        const bg = this.add.rectangle(0, 0, 160, 220, 0x222222).setStrokeStyle(2, 0x666666);

        const nameText = this.add.text(0, -80, item.name, { font: '16px Arial', fill: '#ffffff', wordWrap: { width: 140 } }).setOrigin(0.5);

        const icon = this.add.circle(0, -20, 30, item.color); // Placeholder icon

        const descText = this.add.text(0, 30, item.effect, { font: '12px Arial', fill: '#aaaaaa', align: 'center', wordWrap: { width: 140 } }).setOrigin(0.5);

        const costText = this.add.text(0, 70, `${item.cost} G`, { font: 'bold 20px Arial', fill: '#ffd700' }).setOrigin(0.5);

        const buyBtnBase = this.add.rectangle(0, 100, 140, 30, 0x00aa00).setInteractive({ useHandCursor: true });
        const buyBtnText = this.add.text(0, 100, 'BUY', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5);

        container.add([bg, nameText, icon, descText, costText, buyBtnBase, buyBtnText]);

        // Logic
        buyBtnBase.on('pointerdown', () => {
            this.buyItem(item, container);
        });
    }

    buyItem(item, container) {
        if (runManager.player.gold >= item.cost) {
            // Try add to inventory
            let success = false;
            if (item.type === 'POTION') {
                success = runManager.addPotion(item);
            }

            if (success) {
                runManager.spendGold(item.cost);
                this.goldText.setText(`Gold: ${runManager.player.gold}`);

                // Feedback
                const successText = this.add.text(0, 0, 'SOLD!', { font: '24px Arial', fill: '#00ff00', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
                container.add(successText);
                container.getAt(5).disableInteractive().setFillStyle(0x333333); // Disable button

                // Clear sold text after delay? Or just leave it.
            } else {
                this.showFeedback(container.x, container.y, 'Inventory Full!');
            }
        } else {
            this.showFeedback(container.x, container.y, 'Not Enough Gold!');
        }
    }

    showFeedback(x, y, message) {
        const text = this.add.text(x, y, message, { font: '20px Arial', fill: '#ff0000', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
        this.tweens.add({
            targets: text,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });
    }
}
