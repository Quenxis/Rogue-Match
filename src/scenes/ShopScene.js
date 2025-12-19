import { TopBar } from '../view/TopBar.js';
import { runManager } from '../core/RunManager.js';
import { AssetFactory } from '../view/AssetFactory.js';
import { createVersionWatermark } from '../view/UIHelper.js';
import { RELICS } from '../data/relics.js';

export class ShopScene extends Phaser.Scene {
    constructor() {
        super('ShopScene');
    }

    create() {
        // UI TopBar
        this.topBar = new TopBar(this);
        this.topBar.render();

        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Background
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x111111);

        // Title
        this.add.text(centerX, 80, 'MERCHANT', { font: '32px Arial', fill: '#ffd700' }).setOrigin(0.5); // Lowered slightly

        // Gold Display (Handled by TopBar now, but we can keep a shop specific one or remove)
        // Removing duplicate gold display for cleaner UI
        // this.goldText = ...

        // Exit Button
        const exitBtn = this.add.text(centerX, this.scale.height - 50, 'Leave Shop', {
            font: '24px Arial',
            fill: '#ffffff',
            backgroundColor: '#444444',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                runManager.completeLevel();
                this.scene.start('MapScene');
            });

        exitBtn.on('pointerover', () => exitBtn.setStyle({ fill: '#ffff00' }));
        exitBtn.on('pointerout', () => exitBtn.setStyle({ fill: '#ffffff' }));

        this.generateShopItems();

        createVersionWatermark(this);
    }

    generateShopItems() {
        // --- ROW 1: RELICS ---
        const startingRelics = runManager.getAllStartingRelics();
        let availableRelics = runManager.getAvailableRelicIds(false, startingRelics);
        // Shuffle and take 3
        availableRelics.sort(() => Math.random() - 0.5);
        const relicIds = availableRelics.slice(0, 3);

        const relicItems = relicIds.map(id => {
            const r = RELICS[id];
            return {
                id: id,
                name: r.name,
                cost: 100, // Relic Price
                type: 'RELIC',
                effect: r.description,
                color: r.color || 0x888888,
                icon: r.icon
            };
        });

        // --- ROW 2: POTIONS ---
        const potItems = [
            { id: 'potion_heal', name: 'Health Potion', cost: 30, type: 'POTION', effect: 'Heal 20 HP', color: 0xff0000, icon: '❤️' },
            { id: 'potion_mana', name: 'Mana Potion', cost: 40, type: 'POTION', effect: 'Gain 10 Mana', color: 0x0000ff, icon: '💧' },
            { id: 'potion_strength', name: 'Strength Potion', cost: 50, type: 'POTION', effect: '+2 Str for Combat', color: 0xffaa00, icon: '💪' }
        ];

        // RENDER ROW 1 (Relics) at Y = 300
        const centerX = this.scale.width / 2;
        const gap = 250;
        const startX = centerX - gap;

        relicItems.forEach((item, index) => {
            // Center one is at X. Left is X-gap, Right is X+gap
            // If we have fewer than 3, center them? Logic below assumes 3 for now, or just centers based on length.
            const xOffset = (index - (relicItems.length - 1) / 2) * gap;
            this.createShopCard(centerX + xOffset, 300, item);
        });

        // RENDER ROW 2 (Potions) at Y = 600
        potItems.forEach((item, index) => {
            const xOffset = (index - (potItems.length - 1) / 2) * gap;
            this.createShopCard(centerX + xOffset, 550, item);
        });
    }

    createShopCard(x, y, item) {
        const container = this.add.container(x, y);

        const h = 220;
        const w = 200;
        const bg = this.add.rectangle(0, 0, w, h, 0x222222).setStrokeStyle(2, 0x666666);

        // Header (Type)
        const typeText = this.add.text(0, -90, item.type, { font: '12px Arial', fill: '#888888' }).setOrigin(0.5);

        const nameText = this.add.text(0, -65, item.name, { font: 'bold 16px Arial', fill: '#ffffff', wordWrap: { width: w - 20 }, align: 'center' }).setOrigin(0.5);

        // Icon Config
        let iconObj;
        if (item.icon && item.icon.length < 5) {
            // Emoji / Text Icon
            // Background circle
            this.add.circle(0, -10, 35, item.color, 0.3).setStrokeStyle(2, item.color); // Add to scene not container first? No, add to container later.
            // Wait, need to add to container.
            const circle = this.add.circle(0, -10, 35, item.color, 0.3).setStrokeStyle(2, item.color);
            const emoji = this.add.text(0, -10, item.icon, { fontSize: '40px' }).setOrigin(0.5);
            container.add([circle, emoji]);
        } else {
            // Default / Sprite placeholder
            const circle = this.add.circle(0, -10, 30, item.color);
            container.add(circle);
        }

        const descText = this.add.text(0, 45, item.effect, { font: '12px Arial', fill: '#aaaaaa', align: 'center', wordWrap: { width: w - 20 } }).setOrigin(0.5);

        const costText = this.add.text(0, 80, `${item.cost} G`, { font: 'bold 20px Arial', fill: '#ffd700' }).setOrigin(0.5);

        const buyBtnBase = this.add.rectangle(0, 110, w - 20, 30, 0x00aa00).setInteractive({ useHandCursor: true });
        const buyBtnText = this.add.text(0, 110, 'BUY', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5);

        // Add remaining elements
        container.add([bg, typeText, nameText, descText, costText, buyBtnBase, buyBtnText]);
        // Note: Icon added conditionally above to be behind text if needed, but z-order in container is purely insertion order.
        // Actually I didn't add the conditionally created icon to container correctly in the `else` block? 
        // Logic above `container.add([circle, emoji])` works.
        // Let's ensure Z-order: BG -> Circle -> Emoji -> Text.
        // My `container.add` at the end adds BG on TOP of emoji if I am not careful.
        // Let's reorder:
        container.sendToBack(bg);

        // Logic
        buyBtnBase.on('pointerdown', () => {
            this.buyItem(item, container, buyBtnBase);
        });

        // Initial Price Check
        if (runManager.player.gold < item.cost) {
            costText.setFill('#ff0000');
        }
    }

    buyItem(item, container, button) {
        if (runManager.player.gold >= item.cost) {
            // Try add to inventory
            let success = false;

            if (item.type === 'POTION') {
                success = runManager.addPotion(item);
            } else if (item.type === 'RELIC') {
                success = runManager.addRelic(item.id);
            }

            if (success) {
                runManager.spendGold(item.cost);
                this.topBar.render();

                // Feedback
                const successText = this.add.text(0, 0, 'SOLD!', { font: '24px Arial', fill: '#00ff00', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
                container.add(successText);

                button.disableInteractive().setFillStyle(0x333333); // Disable button

                // Dim the whole card
                container.setAlpha(0.5);

            } else {
                let msg = 'Inventory Full!';
                if (item.type === 'RELIC') msg = 'Already Owned!'; // addRelic returns false if owned (or failed)
                this.showFeedback(container.x, container.y, msg);
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
