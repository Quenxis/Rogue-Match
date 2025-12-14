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
            runManager.startNewRun();
        }

        // console.log(`[MapScene] Create. RunManager Gold: ${runManager.player.gold}`);

        // --- SINGLE SCREEN CONFIGURATION ---
        const mapWidth = this.scale.width;
        const mapHeight = this.scale.height;
        // No Bounds needed if fitting perfectly, or match width
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        // UI: TopBar
        this.topBar = new TopBar(this);
        this.topBar.setTitle('The Cave');

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

        // Calculate visual positions
        const nodePositions = []; // [tier][index] = {x, y}

        tiers.forEach((tierNodes, tierIndex) => {
            nodePositions[tierIndex] = [];

            // Dynamic Vertical Spacing
            // We want to use most of the screen height, but center the cluster.
            // Max density is usually 4 or 5. Let's assume max spacing needed is for 5.
            // Actually, better to spread freely.
            const paddingY = 80 * GAME_SETTINGS.MAP_SCALE; // Top/Bottom padding
            const availableHeight = mapHeight - (paddingY * 2);

            // Calculate gapY for THIS tier specifically to spread them out?
            // Or uniform gapY? Uniform looks cleaner. 
            // If we have 4 nodes, we have 3 gaps.
            // Let's settle on a generous gap that fits 4-5 nodes.
            // If we force full height usage, 2 nodes might be too far apart.
            // Let's stick to a robust standard gap, but larger than before.
            // Old gap: 100. New goal: ~150-180?
            // Or, distribute evenly in vertical space:
            const count = tierNodes.length;
            const gapY = (count > 1) ? availableHeight / (count + 1) : 0;
            // Wait, "distribute evenly" means different gaps for different column sizes.
            // That might make lines look chaotic.
            // Better: Fixed gap, but centered.
            // Max nodes = 4. 
            const fixedGapY = availableHeight / 5; // Space for 5 slots (creates 4 nodes + margins)

            const totalHeight = (count - 1) * fixedGapY;
            const startY = centerY - (totalHeight / 2);

            const x = startX + (tierIndex * gapX);

            tierNodes.forEach((node, nodeIndex) => {
                // Jitter
                const seed = (tierIndex * 1337) + (nodeIndex * 73);
                const jitterX = Math.sin(seed) * 10;
                const jitterY = Math.cos(seed * 0.5) * 15;

                const nodeX = x + jitterX;
                const nodeY = startY + (nodeIndex * fixedGapY) + jitterY;
                nodePositions[tierIndex][nodeIndex] = { x: nodeX, y: nodeY };
            });
        });

        // DRAW LINES (Dashed & Offset)
        const graphics = this.add.graphics();
        const lineThickness = 3;
        const lineColor = 0x3b2d23; // Dark Brown Ink
        const dashLength = 10;
        const gapLength = 8;
        const nodeRadius = 22 * GAME_SETTINGS.MAP_SCALE; // Avg radius to offset

        tiers.forEach((tierNodes, tierIndex) => {
            tierNodes.forEach((node, nodeIndex) => {
                if (node.next && node.next.length > 0) {
                    const startPos = nodePositions[tierIndex][nodeIndex];

                    node.next.forEach(nextIndex => {
                        if (nodePositions[tierIndex + 1] && nodePositions[tierIndex + 1][nextIndex]) {
                            const endPos = nodePositions[tierIndex + 1][nextIndex];

                            // Calculate Offset Points
                            const angle = Phaser.Math.Angle.Between(startPos.x, startPos.y, endPos.x, endPos.y);
                            const offsetX = Math.cos(angle) * nodeRadius;
                            const offsetY = Math.sin(angle) * nodeRadius;

                            const x1 = startPos.x + offsetX;
                            const y1 = startPos.y + offsetY;
                            const x2 = endPos.x - offsetX;
                            const y2 = endPos.y - offsetY;

                            // Draw Dashed Line manually
                            const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);
                            const steps = dist / (dashLength + gapLength);

                            for (let i = 0; i < steps; i++) {
                                const t1 = i / steps;
                                const t2 = (i + 0.6) / steps; // draw 60% of the segment (dash)

                                const lx1 = Phaser.Math.Linear(x1, x2, t1);
                                const ly1 = Phaser.Math.Linear(y1, y2, t1);
                                const lx2 = Phaser.Math.Linear(x1, x2, t2);
                                const ly2 = Phaser.Math.Linear(y1, y2, t2);

                                graphics.lineStyle(lineThickness, lineColor, 0.6);
                                graphics.beginPath();
                                graphics.moveTo(lx1, ly1);
                                graphics.lineTo(lx2, ly2);
                                graphics.strokePath();
                            }
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
        else if (node.type === 'REST') { color = 0xff4500; label = '🔥'; radius = 20 * GAME_SETTINGS.MAP_SCALE; } // Orange Red
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
        console.log(`[MapScene] Clicked Node: ${node.id} (Tier ${node.tier}, ${node.type}) - Status: ${node.status}`);
        runManager.enterNode(node);

        if (node.type === 'SHOP') {
            this.scene.start('ShopScene');
        } else if (node.type === 'TREASURE') {
            this.scene.start('TreasureScene');
        } else if (node.type === 'EVENT') {
            this.scene.start('EventScene', { eventId: null });
        } else if (node.type === 'REST') {
            this.scene.start('RestScene');
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
            // Go to Hero Selection instead of immediate restart
            this.scene.start('HeroSelectScene');
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
