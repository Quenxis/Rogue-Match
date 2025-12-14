import { runManager } from '../core/RunManager.js';
import { RELICS } from '../data/relics.js';

export class RewardScene extends Phaser.Scene {
    constructor() {
        super('RewardScene');
    }

    init(data) {
        // data.rewards expected: { gold: number, choices: [ {type:'RELIC', id:string}, {type:'GOLD', value:number} ] }
        this.rewards = data.rewards || { gold: 0, choices: [] };
    }

    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Overlay Background
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.95);

        // Title
        this.add.text(centerX, this.scale.height * 0.1, 'VICTORY!', {
            font: 'bold 48px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // --- GOLD REWARD ---
        const goldY = this.scale.height * 0.2;
        this.add.text(centerX, goldY, `Base Loot: 💰 +${this.rewards.gold}`, {
            font: '24px Arial', fill: '#ffff00'
        }).setOrigin(0.5);

        // Add base gold immediately (visual only, logic handled on click?)
        // BattleScene passed gold here, but did we ADD it? 
        // BattleScene code: "runManager.addGold(gold)" was in ELSE block.
        // In IF block (Special), we just passed data.
        // So we must ADD gold here when scene starts or when claiming.
        // Let's add it immediately to be safe, or upon any exit.
        // Safest: Add immediately, but visually show it.
        // Actually, user might crash/close. Let's add immediately.
        if (!this.goldAdded) {
            runManager.addGold(this.rewards.gold);
            this.goldAdded = true;
        }

        // --- CHOICES ---
        const choices = this.rewards.choices || [];

        if (choices.length > 0) {
            this.add.text(centerX, this.scale.height * 0.3, 'CHOOSE A REWARD', {
                font: 'bold 28px Arial', fill: '#ffffff'
            }).setOrigin(0.5);

            const startY = this.scale.height * 0.55;
            const gapX = 220;
            const startX = centerX - ((choices.length - 1) * gapX) / 2;

            choices.forEach((choice, index) => {
                this.createRewardCard(startX + (index * gapX), startY, choice);
            });

        } else {
            // No choices (Normal Battle fallback if we routed here?)
            // Just Continue Button
            this.createContinueButton(centerX, this.scale.height * 0.85);
        }
    }

    createRewardCard(x, y, choice) {
        const cardW = 200;
        const cardH = 280;

        // Container
        const container = this.add.container(x, y);

        // Background
        const bg = this.add.rectangle(0, 0, cardW, cardH, 0x222222)
            .setStrokeStyle(4, 0x555555)
            .setInteractive({ useHandCursor: true });

        container.add(bg);

        // Content
        if (choice.type === 'RELIC') {
            const data = RELICS[choice.id];
            // Let's import RELICS in this file to be safe.
            // Or assume runManager has it? It doesn't.
            // We need to import RELICS at top.

            // Icon
            const icon = this.add.text(0, -50, data ? data.icon : '❓', { fontSize: '64px' }).setOrigin(0.5);
            container.add(icon);

            // Name
            const name = this.add.text(0, 10, data ? data.name : choice.id, {
                font: 'bold 18px Arial', fill: '#ffffff', wordWrap: { width: cardW - 20 }, align: 'center'
            }).setOrigin(0.5, 0);
            container.add(name);

            // Desc
            const desc = this.add.text(0, 60, data ? data.description : 'Unknown Relic', {
                font: '14px Arial', fill: '#cccccc', wordWrap: { width: cardW - 20 }, align: 'center'
            }).setOrigin(0.5, 0);
            container.add(desc);

        } else if (choice.type === 'GOLD') {
            const icon = this.add.text(0, -50, '💰', { fontSize: '64px' }).setOrigin(0.5);
            container.add(icon);

            const text = this.add.text(0, 20, `+${choice.value} GOLD`, {
                font: 'bold 24px Arial', fill: '#ffff00'
            }).setOrigin(0.5);
            container.add(text);
        }

        // Hover Effect
        bg.on('pointerover', () => {
            bg.setStrokeStyle(4, 0xffd700);
            this.tweens.add({ targets: container, scale: 1.05, duration: 100 });
        });
        bg.on('pointerout', () => {
            bg.setStrokeStyle(4, 0x555555);
            this.tweens.add({ targets: container, scale: 1.0, duration: 100 });
        });

        // Click Action
        bg.on('pointerdown', () => {
            this.handleChoice(choice);
        });
    }

    handleChoice(choice) {
        if (choice.type === 'RELIC') {
            runManager.addRelic(choice.id);
        } else if (choice.type === 'GOLD') {
            runManager.addGold(choice.value);
        }

        // Proceed
        runManager.completeLevel(); // Move to next node
        this.scene.start('MapScene');
    }

    createContinueButton(x, y) {
        const btn = this.add.text(x, y, 'Continue >>', {
            font: '28px Arial', fill: '#ffffff', backgroundColor: '#00aa00', padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                runManager.completeLevel();
                this.scene.start('MapScene');
            });
    }
}
