import { runManager } from '../core/RunManager.js';
// Removed: import eventData from '../data/events.json'
import { RELICS } from '../data/relics.js';
import { TopBar } from '../view/TopBar.js';

export class EventScene extends Phaser.Scene {
    constructor() {
        super('EventScene');
    }

    init(data) {
        // Load from Cache
        const eventData = this.cache.json.get('events');

        // Find event by ID, or pick random if not specified
        if (data.eventId) {
            this.event = eventData.find(e => e.id === data.eventId);
        } else {
            this.event = eventData[Math.floor(Math.random() * eventData.length)];
        }
    }

    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // UI Setup
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x111111); // Dark BG

        this.topBar = new TopBar(this);
        this.topBar.setTitle('EVENT');

        if (!this.event) {
            this.add.text(centerX, 300, 'Error: Event not found', { font: '32px Arial', fill: '#ff0000' }).setOrigin(0.5);
            this.time.delayedCall(2000, () => this.scene.start('MapScene'));
            return;
        }

        // Title
        this.add.text(centerX, this.scale.height * 0.15, this.event.title, {
            font: 'bold 42px serif',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Image Placeholder
        const imageY = this.scale.height * 0.35;
        this.add.rectangle(centerX, imageY, 400, 200, 0x333333).setStrokeStyle(2, 0x666666);
        this.add.text(centerX, imageY, '[ IMAGE ]', { font: '20px Arial', fill: '#888888' }).setOrigin(0.5);

        // Description
        this.add.text(centerX, this.scale.height * 0.55, this.event.description, {
            font: '24px Arial',
            fill: '#cccccc',
            wordWrap: { width: 800 },
            align: 'center'
        }).setOrigin(0.5);

        // Options container
        this.renderOptions(centerX, this.scale.height * 0.65);
    }

    renderOptions(x, startY) {
        this.optionButtons = [];
        this.event.options.forEach((opt, index) => {
            const btnY = startY + (index * 80);

            // Check Requirements (future proof)

            const btn = this.createButton(x, btnY, opt.text, () => {
                this.selectOption(opt);
            });
            this.optionButtons.push(btn);
        });
    }

    createButton(x, y, text, callback) {
        const container = this.add.container(x, y);

        const bg = this.add.rectangle(0, 0, 800, 60, 0x222222).setStrokeStyle(1, 0xaaaaaa)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => bg.setFillStyle(0x444444))
            .on('pointerout', () => bg.setFillStyle(0x222222))
            .on('pointerdown', callback);

        const txt = this.add.text(0, 0, text, { font: '20px Arial', fill: '#ffffff' }).setOrigin(0.5);

        container.add([bg, txt]);
        return container;
    }

    selectOption(option) {
        // Disable buttons
        this.optionButtons.forEach(btn => btn.destroy());

        // Apply Effects
        const result = runManager.applyEffect(option.effects);

        let finalText = option.resultText;

        // Custom Logic for 'gamble_relic' from RunManager
        if (result.gambleWon) {
            const keys = Object.keys(RELICS);
            const playerRelics = runManager.getRelics();
            const available = keys.filter(id => !playerRelics.includes(id));

            if (available.length > 0) {
                const randomId = available[Math.floor(Math.random() * available.length)];
                const relic = RELICS[randomId];
                runManager.addRelic(randomId);
                finalText += `\n\nReward: ${relic.name}\n${relic.description}`;
            } else {
                finalText += `\n\n(All relics collected! +50 Gold)`;
                runManager.addGold(50);
            }
        }

        // Custom Logic for 'start_battle'
        if (option.effects.start_battle) {
            // Delay and start battle
            this.time.delayedCall(1000, () => {
                this.scene.start('BattleScene', { enemyId: option.effects.start_battle });
            });
            return;
        }

        const centerX = this.scale.width / 2;

        // Show Result
        this.add.text(centerX, this.scale.height * 0.6, finalText, {
            font: '24px Arial',
            fill: '#ffffff',
            wordWrap: { width: 800 },
            align: 'center'
        }).setOrigin(0.5);

        // Continue Button
        this.time.delayedCall(1000, () => {
            this.createButton(centerX, this.scale.height * 0.8, "Continue", () => { // Fixed Y position
                runManager.completeLevel();
                this.scene.start('MapScene');
            });
        });

        // Update TopBar
        this.topBar.render();
    }
}
