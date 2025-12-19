import { runManager } from '../core/RunManager.js';
import { masteryManager } from '../logic/MasteryManager.js';
import { MasteryCard } from './MasteryCard.js';

export class MasteryDeckOverlay extends Phaser.GameObjects.Container {
    constructor(scene) {
        super(scene, 0, 0);
        this.scene = scene;
        this.setDepth(3000);
        this.setScrollFactor(0);
        this.setVisible(false);

        this.page = 0;
        this.cards = []; // Track active card objects

        this._buildLayout();
        this.scene.add.existing(this);
    }

    _buildLayout() {
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        const centerX = width / 2;
        const centerY = height / 2;

        // Overlay BG
        const overlay = this.scene.add.rectangle(centerX, centerY, width, height, 0x000000, 0.95).setInteractive();
        this.add(overlay);

        // Border
        const border = this.scene.add.rectangle(centerX, centerY, width - 10, height - 10, 0x000000, 0).setStrokeStyle(4, 0x00aaff);
        this.add(border);

        // Title
        const title = this.scene.add.text(centerX, 40, 'MASTERY DECK', {
            font: 'bold 40px Arial', fill: '#00aaff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.add(title);

        // Close Button
        const closeBtn = this.scene.add.text(width - 50, 50, '✕', {
            font: 'bold 50px Arial', fill: '#ff4444'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggle(false));
        this.add(closeBtn);

        // Content Container for Cards
        this.cardContainer = this.scene.add.container(0, 0);
        this.add(this.cardContainer);
    }

    toggle(forceState = null) {
        const newState = forceState !== null ? forceState : !this.visible;
        this.setVisible(newState);

        if (this.visible) {
            this.page = 0;
            this.refresh();
        }
    }

    refresh() {
        this.cardContainer.removeAll(true);
        this.cards = [];

        const traitsIds = Array.from(runManager.matchMasteries) || [];
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        const centerX = width / 2;

        if (traitsIds.length === 0) {
            this.cardContainer.add(this.scene.add.text(centerX, height / 2, 'No Traits collected yet.', {
                font: 'italic 32px Arial', fill: '#888888'
            }).setOrigin(0.5));
            return;
        }

        // --- GRID CONFIG ---
        const cardW = 230;
        const cardH = 320;
        const gap = 20;
        const startY = 120;

        const availableW = width - 100;
        const availableH = height - 200;

        let cols = Math.floor(availableW / (cardW + gap));
        let rows = Math.floor(availableH / (cardH + gap));
        cols = Math.max(1, cols);
        rows = Math.max(1, rows);

        const itemsPerPage = cols * rows;
        const totalPages = Math.ceil(traitsIds.length / itemsPerPage);

        // Clamp Page
        if (this.page < 0) this.page = 0;
        if (this.page >= totalPages) this.page = totalPages - 1;

        // Slice Data
        const startIdx = this.page * itemsPerPage;
        const pageTraitsIds = traitsIds.slice(startIdx, startIdx + itemsPerPage);

        // Render Cards
        const totalGridW = cols * cardW + (cols - 1) * gap;
        const startX = centerX - totalGridW / 2 + cardW / 2;
        const renderStartY = startY + cardH / 2;

        pageTraitsIds.forEach((id, index) => {
            const trait = masteryManager.traits.get(id);
            if (!trait) return;

            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = startX + col * (cardW + gap);
            const y = renderStartY + row * (cardH + gap);

            const card = new MasteryCard(this.scene, x, y, trait, cardW, cardH);
            card.disableInteractive(); // Deck is view-only, no hand cursor needed
            this.cardContainer.add(card);
            this.cards.push(card);
        });

        // --- PAGINATION ---
        if (totalPages > 1) {
            const controlsY = height - 60;

            // Page Indicator
            this.cardContainer.add(this.scene.add.text(centerX, controlsY, `Page ${this.page + 1} / ${totalPages}`, {
                font: 'bold 24px Arial', fill: '#ffffff'
            }).setOrigin(0.5));

            // Prev
            if (this.page > 0) {
                const prev = this.scene.add.text(centerX - 120, controlsY, '◄ Prev', {
                    font: 'bold 24px Arial', fill: '#00aaff', backgroundColor: '#222222', padding: { x: 10, y: 5 }
                }).setOrigin(0.5).setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => {
                        this.page--;
                        this.refresh();
                    });
                this.cardContainer.add(prev);
            }

            // Next
            if (this.page < totalPages - 1) {
                const next = this.scene.add.text(centerX + 120, controlsY, 'Next ►', {
                    font: 'bold 24px Arial', fill: '#00aaff', backgroundColor: '#222222', padding: { x: 10, y: 5 }
                }).setOrigin(0.5).setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => {
                        this.page++;
                        this.refresh();
                    });
                this.cardContainer.add(next);
            }
        }
    }
}
