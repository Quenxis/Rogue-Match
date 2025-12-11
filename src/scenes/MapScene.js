import { runManager } from '../core/RunManager.js';
import { createVersionWatermark } from '../view/UIHelper.js';
import { TopBar } from '../view/TopBar.js';
import { EventBus } from '../core/EventBus.js';
import { audioManager } from '../core/AudioManager.js';
import { GAME_SETTINGS } from '../core/Constants.js';

export class MapScene extends Phaser.Scene {
    constructor() {
        super('MapScene');
    }

    create() {
        // Play BGM
        audioManager.playBGM('bgm_main', this);

        // If no run matches, start one
        if (!runManager.map.length) {
            console.log('[MapScene] No existing run, starting new.');
            runManager.startNewRun();
        }

        console.log(`[MapScene] Create. RunManager Gold: ${runManager.player.gold}`);

        // --- SINGLE SCREEN CONFIGURATION ---
        const mapWidth = this.scale.width;
        const mapHeight = this.scale.height;
        // No Bounds needed if fitting perfectly, or match width
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        // UI: TopBar
        this.topBar = new TopBar(this);
        this.topBar.setTitle('THE MAP');

        // Listen for Potion Use (Map context)
        EventBus.on('potion:use_requested', (index) => this.handlePotionUse(index));

        const tiers = runManager.map;
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Background
        // Background
        const bg = this.add.image(centerX, centerY, 'map_bg').setDepth(-10);
        // Ensure it covers the screen (scaler)
        const scaleX = mapWidth / bg.width;
        const scaleY = mapHeight / bg.height;
        const scale = Math.max(scaleX, scaleY);
        bg.setScale(scale);

        // Optional: Keep grid for debugging or structure? 
        // this.add.grid(centerX, centerY, mapWidth, mapHeight, 50, 50, 0x222222, 1, 0x333333, 0.2).setDepth(-9);

        // CHECK IF RUN COMPLETED
        if (runManager.currentTier >= tiers.length) {
            this.showVictoryScreen(centerX, centerY);
            return;
        }

        // --- CALC POSITIONS & DRAW LINES ---
        const paddingX = 100 * GAME_SETTINGS.MAP_SCALE;
        const availableWidth = mapWidth - (paddingX * 2);
        const gapX = availableWidth / (Math.max(tiers.length - 1, 1));
        const startX = paddingX;

        // Store visual positions for drawing lines
        const nodePositions = []; // [tier][index] = {x, y}

        tiers.forEach((tierNodes, tierIndex) => {
            const x = startX + (tierIndex * gapX);
            const gapY = 100 * GAME_SETTINGS.MAP_SCALE; // Vertical gap
            const totalHeight = (tierNodes.length - 1) * gapY;
            const startY = centerY - (totalHeight / 2);

            nodePositions[tierIndex] = [];

            tierNodes.forEach((node, nodeIndex) => {
                const offsetY = ((nodeIndex + tierIndex) % 2 === 0) ? 15 : -15;
                const y = startY + (nodeIndex * gapY) + offsetY;
                nodePositions[tierIndex][nodeIndex] = { x, y };
            });
        });

        // DRAW LINES
        const graphics = this.add.graphics();
        graphics.lineStyle(4, 0x3b2d23, 0.8); // Dark Brown Ink, slightly transparent

        tiers.forEach((tierNodes, tierIndex) => {
            tierNodes.forEach((node, nodeIndex) => {
                if (node.next && node.next.length > 0) {
                    const startPos = nodePositions[tierIndex][nodeIndex];

                    node.next.forEach(nextIndex => {
                        if (nodePositions[tierIndex + 1] && nodePositions[tierIndex + 1][nextIndex]) {
                            const endPos = nodePositions[tierIndex + 1][nextIndex];
                            graphics.beginPath();
                            graphics.moveTo(startPos.x, startPos.y);
                            graphics.lineTo(endPos.x, endPos.y);
                            graphics.strokePath();
                        }
                    });
                }
            });
        });

        // DRAW NODES
        tiers.forEach((tierNodes, tierIndex) => {
            tierNodes.forEach((node, nodeIndex) => {
                const pos = nodePositions[tierIndex][nodeIndex];
                this.drawNode(pos.x, pos.y, node, tierIndex);
            });
        });

        // Center Camera
        this.cameras.main.centerOn(centerX, centerY);

        createVersionWatermark(this);
    }

    drawNode(x, y, node, tierIndex) {
        // 1. Determine Type Color (Parchment/Ink Palette)
        let color = 0x5c5c5c; // Battle: Dark Grey/Ink
        let label = '⚔️';
        let radius = 18 * GAME_SETTINGS.MAP_SCALE;
        let fontSize = `${Math.floor(20 * GAME_SETTINGS.MAP_SCALE)}px`;

        if (node.type === 'BOSS') { color = 0x8b0000; label = '💀'; radius = 24 * GAME_SETTINGS.MAP_SCALE; fontSize = `${Math.floor(24 * GAME_SETTINGS.MAP_SCALE)}px`; } // Deep Red
        else if (node.type === 'SHOP') { color = 0xc5a000; label = '💰'; } // Ochre/Gold
        else if (node.type === 'TREASURE') { color = 0x4682b4; label = '💎'; } // Steel Blue
        else if (node.type === 'ELITE') { color = 0xa03000; label = '😈'; radius = 20 * GAME_SETTINGS.MAP_SCALE; } // Rust
        else if (node.type === 'EVENT') { color = 0x6a0dad; label = '❓'; } // Muted Purple
        else if (node.type === 'BATTLE') { color = 0x5c5c5c; } // Standard Battle

        // 2. Status Overrides
        if (node.status === 'COMPLETED') {
            color = 0x333333; // Dark Grey for visited
            // Optional: Change alpha?
        } else if (node.status === 'LOCKED') {
            // Keep Type Color but maybe dimmer? 
            // Actually, showing the Type Color for future nodes is standard Slay the Spire UI.
            // We just don't add the glow.
        }

        // Container
        const container = this.add.container(x, y);

        // Glow for Available (Strict: Current Tier Only)
        if (node.status === 'AVAILABLE' && node.tier === runManager.currentTier) {
            const glow = this.add.circle(0, 0, radius + 5, 0xffffff, 0.4);
            this.tweens.add({
                targets: glow,
                scale: 1.2,
                alpha: 0,
                duration: 1000,
                repeat: -1
            });
            container.add(glow);
        }

        const circle = this.add.circle(0, 0, radius, color);
        circle.setStrokeStyle(3, 0x2a1d10); // Ink Black stroke

        const text = this.add.text(0, 0, label, {
            fontSize: fontSize,
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Alpha for Locked or "Past Available" to push them back visually
        if (node.status === 'LOCKED' || (node.status === 'AVAILABLE' && node.tier !== runManager.currentTier)) {
            circle.setAlpha(0.6);
            text.setAlpha(0.6);
        }

        container.add([circle, text]);

        // Interaction: STRICT (Current Tier Only)
        if (node.status === 'AVAILABLE' && node.tier === runManager.currentTier) {
            circle.setInteractive({ useHandCursor: true });
            circle.on('pointerdown', () => {
                this.handleNodeClick(node);
            });
        }
    }

    handleNodeClick(node) {
        console.log('Entering node', node);
        runManager.enterNode(node);

        if (node.type === 'SHOP') {
            this.scene.start('ShopScene');
        } else if (node.type === 'TREASURE') {
            this.scene.start('TreasureScene');
        } else if (node.type === 'EVENT') {
            this.scene.start('EventScene', { eventId: null });
        } else {
            // Battle / Elite / Boss
            this.scene.start('BattleScene', {
                nodeType: node.type,
                enemyId: node.enemyId
            });
        }
    }

    showVictoryScreen(centerX, centerY) {
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000).setScrollFactor(0);
        this.add.text(centerX, centerY, 'VICTORY ROYALE!', { font: '48px Arial', fill: '#ffd700' }).setOrigin(0.5).setScrollFactor(0);
        this.add.text(centerX, centerY + 80, `Final Gold: ${runManager.player.gold}`, { font: '24px Arial', fill: '#ffffff' }).setOrigin(0.5).setScrollFactor(0);

        const restartBtn = this.add.text(centerX, centerY + 150, 'START NEW RUN', {
            font: '24px Arial',
            fill: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);

        restartBtn.on('pointerdown', () => {
            runManager.startNewRun();
            this.scene.restart();
        });
    }

    handlePotionUse(index) {
        if (!this.scene.isActive()) return;
        const potion = runManager.player.potions[index];
        if (!potion) return;

        if (potion.type === 'POTION') {
            if (potion.id === 'potion_heal') {
                runManager.removePotion(index);
                runManager.player.currentHP = Math.min(runManager.player.currentHP + 20, runManager.player.maxHP);
                EventBus.emit('ui:refresh_topbar');
            }
        }
    }
}
