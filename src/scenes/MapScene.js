import { runManager } from '../core/RunManager.js';

export class MapScene extends Phaser.Scene {
    constructor() {
        super('MapScene');
    }

    create() {
        // If no run matches, start one
        if (!runManager.map.length) {
            runManager.startNewRun();
        }

        // Setup World Bounds for Scrolling
        // Height needed: 10 tiers * 150 gap + padding = ~1800px
        this.cameras.main.setBounds(0, 0, 1100, 2000);

        // Fixed UI (Title should stick to top?) 
        // For now, let's make title part of the world (scrolls away) or use a fixed container.
        // Let's use a fixed container for HUD.
        const hud = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

        hud.add(this.add.text(550, 40, 'The Map', { font: 'bold 32px Arial', fill: '#ffffff' }).setOrigin(0.5));
        hud.add(this.add.text(10, 10, `HP: ${runManager.player.currentHP}/${runManager.player.maxHP} | Gold: ${runManager.player.gold}`, { font: '16px Arial', fill: '#ffffff' }));

        const tiers = runManager.map;

        // CHECK IF RUN COMPLETED
        if (runManager.currentTier >= tiers.length) {
            // Victory Screen logic (keep static/no scroll needed usually, or center it)
            this.cameras.main.setScroll(0, 0); // Reset scroll
            this.add.rectangle(550, 300, 1100, 600, 0x000000).setScrollFactor(0);

            this.add.text(550, 300, 'VICTORY ROYALE!', { font: '48px Arial', fill: '#ffd700' }).setOrigin(0.5).setScrollFactor(0);
            this.add.text(550, 380, `Final Gold: ${runManager.player.gold}`, { font: '24px Arial', fill: '#ffffff' }).setOrigin(0.5).setScrollFactor(0);

            const restartBtn = this.add.text(550, 450, 'START NEW RUN', {
                font: '24px Arial',
                fill: '#000000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);

            restartBtn.on('pointerdown', () => {
                runManager.startNewRun();
                this.scene.restart();
            });
            return;
        }

        // Draw Map Nodes (Bottom to Top)
        const startY = 1800; // Bottom of the map
        const gapY = 150;

        tiers.forEach((tierNodes, tierIndex) => {
            const y = startY - (tierIndex * gapY); // Tier 0 at 1800, Tier 9 at 450

            // Center nodes horizontally
            const gapX = 150;
            const totalWidth = (tierNodes.length - 1) * gapX;
            const startX = 550 - (totalWidth / 2);

            // Draw line to next tier logic (optional visuals)

            tierNodes.forEach((node, nodeIndex) => {
                const x = startX + (nodeIndex * gapX);
                this.drawNode(x, y, node, tierIndex);
            });
        });

        // Camera Logic
        // Focus on current tier
        const currentY = startY - (runManager.currentTier * gapY);
        this.cameras.main.centerOn(550, currentY);

        // Drag to scroll
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y);
            }
        });
    }

    drawNode(x, y, node, tierIndex) {
        let color = 0x888888; // Locked
        if (node.status === 'AVAILABLE') color = 0x00ff00; // Available
        if (node.status === 'COMPLETED') color = 0x444444; // Done

        let label = '⚔️'; // Battle
        if (node.type === 'BOSS') { color = 0xff0000; label = '💀'; }
        if (node.type === 'SHOP') { color = 0xffd700; label = '💰'; }
        if (node.type === 'TREASURE') { color = 0x00ffff; label = '💎'; }
        if (node.type === 'ELITE') { color = 0xff4400; label = '😈'; }
        if (node.type === 'EVENT') { color = 0xff00ff; label = '❓'; }

        const circle = this.add.circle(x, y, 30, color);

        // Interaction
        if (tierIndex === runManager.currentTier && node.status !== 'COMPLETED') {
            circle.setInteractive({ useHandCursor: true });
            circle.on('pointerdown', () => {
                this.handleNodeClick(node);
            });

            // Pulse effect for available
            this.tweens.add({
                targets: circle,
                scale: 1.1,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }

        // Icon/Label
        this.add.text(x, y, label, { fontSize: '24px' }).setOrigin(0.5);
    }

    handleNodeClick(node) {
        console.log('Entering node', node);

        if (node.type === 'SHOP') {
            this.scene.start('ShopScene');
        } else if (node.type === 'TREASURE') {
            // For now, instant loot
            runManager.addGold(50);
            runManager.completeLevel();
            this.scene.restart(); // Refresh map
        } else if (node.type === 'EVENT') {
            // Placeholder: Just skip
            runManager.completeLevel();
            this.scene.restart();
        } else {
            // Battle / Elite / Boss
            this.scene.start('BattleScene', {
                nodeType: node.type,
                enemyId: node.enemyId
            });
        }
    }
}
