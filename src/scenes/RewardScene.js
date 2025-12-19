import { runManager } from '../core/RunManager.js';
import { rewardService, REWARD_TYPES } from '../logic/RewardService.js';
import { masteryManager } from '../logic/MasteryManager.js';
import { TopBar } from '../view/TopBar.js';
import { RichTextHelper } from '../view/RichTextHelper.js';
import { MasteryCard } from '../view/MasteryCard.js';

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
        // Adapt data for MasteryCard if needed
        // MasteryCard expects { type (icon), name, rarity, description }

        let cardData = { ...choice };

        // Map types for Assets if not present
        if (choice.type === REWARD_TYPES.GOLD) cardData.type = 'COIN';
        if (choice.type === REWARD_TYPES.HEAL) cardData.type = 'POTION';
        if (choice.type === REWARD_TYPES.MAX_HP) cardData.type = 'POTION'; // Or Heart? logic handles POTION well.

        // FIX: If it is a TRAIT, set type to gemType (e.g. SWORD) so MasteryCard uses the correct icon
        if (choice.type === REWARD_TYPES.TRAIT && choice.gemType) {
            cardData.type = choice.gemType;
        }

        // If it's a TRAIT, choice.gemType is usually set (SWORD etc). 
        // MasteryCard checks `type` OR `gemType`. So it should be fine.

        const card = new MasteryCard(this, x, y, cardData, 240, 360);
        this.add.existing(card);

        // Hover Effect using Tween on Container
        // MasteryCard extends Container.
        // Hover Effect using Tween on Container
        // Listener on BG to ensure hit area matches visual
        card.bg.on('pointerover', () => {
            this.tweens.add({ targets: card, scale: 1.05, duration: 100 });
        })
            .on('pointerout', () => {
                this.tweens.add({ targets: card, scale: 1.0, duration: 100 });
            })
            .on('pointerdown', () => {
                this.handleChoice(choice);
            });
    }

    handleChoice(choice) {
        if (choice.type === REWARD_TYPES.TRAIT) {
            // Add Trait Logic - Use centralized manager method to ensure events fire and sets update
            runManager.unlockMastery(choice.id);
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
