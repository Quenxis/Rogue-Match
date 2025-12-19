import { runManager } from '../core/RunManager.js';
import { rewardService, REWARD_TYPES } from '../logic/RewardService.js';
import { masteryManager } from '../logic/MasteryManager.js';
import { TopBar } from '../view/TopBar.js';
import { RichTextHelper } from '../view/RichTextHelper.js';

export class RewardScene extends Phaser.Scene {
    constructor() {
        super('RewardScene');
    }

    init(data) {
        this.baseGold = data.rewards ? data.rewards.gold : 10;
        this.tier = data.tier || runManager.currentTier || 1;
    }

    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Overlay Background (Opaque to hide potential visual artifacts)
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 1.0);

        // UI: Top Bar
        this.topBar = new TopBar(this);

        // Title
        this.add.text(centerX, this.scale.height * 0.15, 'VICTORY!', {
            font: 'bold 48px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Base Gold
        const goldY = this.scale.height * 0.22;
        this.add.text(centerX, goldY, `Base Loot: 💰 +${this.baseGold}`, {
            font: '24px Arial', fill: '#ffff00'
        }).setOrigin(0.5);

        // Add base gold immediately
        if (!this.goldAdded) {
            runManager.addGold(this.baseGold);
            this.goldAdded = true;
        }

        // GENERATE REWARDS
        this.add.text(centerX, this.scale.height * 0.3, 'CHOOSE A MASTERY', {
            font: 'bold 28px Arial', fill: '#ffffff'
        }).setOrigin(0.5);

        // Check if draft already generated this session? 
        // For now, generate new.
        const rewards = rewardService.generateRewards(this.tier);

        const startY = this.scale.height * 0.58;
        const gapX = 260; // Slightly wider for larger cards
        const startX = centerX - ((rewards.length - 1) * gapX) / 2;

        rewards.forEach((choice, index) => {
            this.createRewardCard(startX + (index * gapX), startY, choice);
        });
    }

    createRewardCard(x, y, choice) {
        const cardW = 240; // Wider
        const cardH = 360; // Taller

        // Container
        const container = this.add.container(x, y);

        // Background
        // Color based on Rarity?
        let borderColor = 0x555555;
        if (choice.rarity === 'UNCOMMON') borderColor = 0x00ff00;
        if (choice.rarity === 'RARE') borderColor = 0x00aaff;
        if (choice.rarity === 'EPIC') borderColor = 0xaa00aa;
        if (choice.rarity === 'LEGENDARY') borderColor = 0xffaa00;

        if (choice.type === REWARD_TYPES.GOLD) borderColor = 0xffff00;
        if (choice.type === REWARD_TYPES.HEAL) borderColor = 0xff5555;
        if (choice.type === REWARD_TYPES.MAX_HP) borderColor = 0xff5555;

        const bg = this.add.rectangle(0, 0, cardW, cardH, 0x222222)
            .setStrokeStyle(4, borderColor)
            .setInteractive({ useHandCursor: true });

        container.add(bg);

        // Icon
        let iconText = '❓';

        if (choice.type === REWARD_TYPES.TRAIT) {
            // Look up gem icon
            if (choice.gemType === 'SWORD') iconText = '⚔️';
            if (choice.gemType === 'SHIELD') iconText = '🛡️';
            if (choice.gemType === 'POTION') iconText = '🧪';
            if (choice.gemType === 'MANA') iconText = '🔮';
            if (choice.gemType === 'COIN') iconText = '💰';
            if (choice.gemType === 'BOW') iconText = '🏹';
        } else if (choice.type === REWARD_TYPES.GOLD) {
            iconText = '💰';
        } else if (choice.type === REWARD_TYPES.HEAL || choice.type === REWARD_TYPES.MAX_HP) {
            iconText = '❤️';
        }

        const icon = this.add.text(0, -90, iconText, { fontSize: '72px' }).setOrigin(0.5);
        container.add(icon);

        // Name
        const name = this.add.text(0, -20, choice.title.toUpperCase(), {
            font: 'bold 20px Arial', fill: '#ffffff', wordWrap: { width: cardW - 20 }, align: 'center'
        }).setOrigin(0.5, 0);
        container.add(name);

        // Rarity Label
        if (choice.rarity) {
            const rarityText = this.add.text(0, 25, choice.rarity, {
                font: 'italic 14px Arial', fill: '#' + borderColor.toString(16).padStart(6, '0')
            }).setOrigin(0.5);
            container.add(rarityText);
        }

        // Desc (Using RichTextHelper for Icons)
        // Position relative to Rarity or Name
        const descY = choice.rarity ? 55 : 35;

        // Create a temporary container for rich text to center it?
        // RichTextHelper renders to a container. Use a sub-container?
        const descContainer = this.add.container(0, descY);
        const { height: textH } = RichTextHelper.renderRichText(this, descContainer, choice.description, {
            fontSize: '16px',
            color: '#dddddd',
            maxWidth: cardW - 30,
            center: true
        });

        // Since renderRichText adds children to descContainer at (0,0) and flows down, 
        // and we want it centered horizontally (handled by center:true helper update or manual offset).
        // RichTextHelper default usually aligns left. I might need to check if it supports centering.
        // Assuming I need to center the container manually if the helper doesn't.
        // But if I pass 'center: true' I assume I might have implemented it or need to check.
        // Let's check RichTextHelper.js to be sure. OR just center the container X.
        // Actually, RichTextHelper adds objects. If I want them centered, I need to know the width.
        // Let's assume standard behavior for now but shift X to start left.
        descContainer.x = -(cardW / 2) + 15; // Start from left padding

        container.add(descContainer);

        // Hover Effect
        bg.on('pointerover', () => {
            this.tweens.add({ targets: container, scale: 1.05, duration: 100 });
            bg.setFillStyle(0x333333);
        });
        bg.on('pointerout', () => {
            this.tweens.add({ targets: container, scale: 1.0, duration: 100 });
            bg.setFillStyle(0x222222);
        });

        // Click Action
        bg.on('pointerdown', () => {
            this.handleChoice(choice);
        });
    }

    handleChoice(choice) {
        if (choice.type === REWARD_TYPES.TRAIT) {
            // Add Trait Logic
            if (!runManager.traits) runManager.traits = [];
            runManager.traits.push(choice.id);
            console.log(`[Reward] Gained Trait: ${choice.title}`);
        } else if (choice.type === REWARD_TYPES.GOLD) {
            runManager.addGold(choice.value);
        } else if (choice.type === REWARD_TYPES.HEAL) {
            runManager.player.currentHP = Math.min(runManager.player.maxHP, runManager.player.currentHP + choice.value);
            this.topBar.render(); // Refresh UI
        } else if (choice.type === REWARD_TYPES.MAX_HP) {
            runManager.player.maxHP += choice.value;
            runManager.player.currentHP = Math.min(runManager.player.maxHP, runManager.player.currentHP + choice.value);
            this.topBar.render(); // Refresh UI
        }

        // Proceed
        runManager.completeLevel(); // Move to next node
        this.scene.start('MapScene');
    }
}
