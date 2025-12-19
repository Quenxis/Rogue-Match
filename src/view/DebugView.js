
import { EventBus } from '../core/EventBus.js';
import { runManager } from '../core/RunManager.js';
import { masteryManager } from '../logic/MasteryManager.js';
import { RELICS } from '../data/relics.js';
import { STATUS_TYPES } from '../core/Constants.js';
import { logManager } from '../core/LogManager.js';

export class DebugView {
    constructor(scene) {
        this.scene = scene;
        this.width = 600;
        this.height = 500;
        this.x = 50;
        this.y = 50;
        this.visible = false;

        this.currentTab = 'CHEATS'; // CHEATS, MASTERIES, RELICS, STATS

        this.container = this.scene.add.container(this.x, this.y).setDepth(3000).setVisible(false).setScrollFactor(0);

        // Background
        this.bg = this.scene.add.rectangle(0, 0, this.width, this.height, 0x000000, 0.85)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x00ff00)
            .setInteractive();

        this.scene.input.setDraggable(this.bg);
        this.bg.on('drag', (pointer, dragX, dragY) => {
            this.container.x += (pointer.x - pointer.prevPosition.x);
            this.container.y += (pointer.y - pointer.prevPosition.y);
        });

        this.container.add(this.bg);

        // Header
        this.headerText = this.scene.add.text(10, 10, 'DEBUG CONSOLE', { font: 'bold 20px monospace', fill: '#00ff00' });
        this.container.add(this.headerText);

        // Close Button
        this.closeBtn = this.scene.add.text(this.width - 30, 10, 'X', { font: 'bold 20px monospace', fill: '#ff0000' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggle());
        this.container.add(this.closeBtn);

        // Tabs
        this.tabs = ['CHEATS', 'MASTERIES', 'RELICS', 'STATS'];
        this.tabBtns = [];
        let tabX = 10;
        this.tabs.forEach(tab => {
            const btn = this.scene.add.text(tabX, 40, `[ ${tab} ]`, { font: '16px monospace', fill: '#cccccc' })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.switchTab(tab));
            this.container.add(btn);
            this.tabBtns.push({ name: tab, btn: btn });
            tabX += btn.width + 15;
        });

        // Content Area (Scrollable)
        this.contentContainer = this.scene.add.container(0, 80);

        // Mask
        this.maskShape = this.scene.make.graphics();
        this.maskShape.fillStyle(0xffffff);
        this.maskShape.fillRect(this.x, this.y + 80, this.width, this.height - 90); // Initial pos, will update on drag?
        // Actually masks with containers in Phaser are tricky if container moves.
        // Better to limit rendering or use scroll Rect. 
        // For simplicity, let's implement pagination or simple render first. Scroll is better.
        // Let's attach mask to the container's WORLD position.

        const mask = this.maskShape.createGeometryMask();
        this.contentContainer.setMask(mask);
        this.container.add(this.contentContainer);

        // Update mask on drag
        this.bg.on('drag', () => {
            this.maskShape.clear();
            this.maskShape.fillStyle(0xffffff);
            this.maskShape.fillRect(this.container.x, this.container.y + 80, this.width, this.height - 90);
        });

        // Scroll Input
        this.bg.on('wheel', (pointer, deltaX, deltaY, deltaZ) => {
            this.contentContainer.y -= deltaY * 0.5;
            if (this.contentContainer.y > 80) this.contentContainer.y = 80;
            // Lower bound check left for later
        });

        this.render();

        // Global Access
        window.toggleDebug = () => this.toggle();
    }

    toggle() {
        this.visible = !this.visible;
        this.container.setVisible(this.visible);
        if (this.visible) this.render();
    }

    switchTab(tab) {
        this.currentTab = tab;
        this.render();
    }

    render() {
        this.contentContainer.removeAll(true);
        this.contentContainer.y = 80; // Reset scroll

        // Update Tabs
        this.tabBtns.forEach(t => {
            t.btn.setColor(t.name === this.currentTab ? '#00ff00' : '#cccccc');
        });

        if (this.currentTab === 'CHEATS') this.renderCheats();
        if (this.currentTab === 'MASTERIES') this.renderMasteries();
        if (this.currentTab === 'RELICS') this.renderRelics();
        if (this.currentTab === 'STATS') this.renderStats();
    }

    renderCheats() {
        let y = 0;
        const addCheat = (text, callback) => {
            const btn = this.scene.add.text(20, y, `> ${text}`, { font: '16px monospace', fill: '#ffffff' })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    callback();
                    logManager.log(`Cheat: ${text}`, 'warning');
                })
                .on('pointerover', () => btn.setColor('#ffff00'))
                .on('pointerout', () => btn.setColor('#ffffff'));
            this.contentContainer.add(btn);
            y += 25;
        };

        const cm = this.scene ? this.scene.combatManager : null;

        addCheat('Add 100 Gold', () => {
            runManager.player.gold += 100;
            if (cm) cm.emitState(); // Refresh UI
        });

        addCheat('Heal 20 HP', () => {
            if (cm && cm.player) cm.player.heal(20);
            else runManager.player.currentHP = Math.min(runManager.player.maxHP, runManager.player.currentHP + 20);
        });

        addCheat('Full Heal', () => {
            if (cm && cm.player) cm.player.heal(999);
            else runManager.player.currentHP = runManager.player.maxHP;
        });

        addCheat('Gain 10 Mana', () => {
            if (cm && cm.player) {
                cm.player.addMana(10);
                cm.emitState();
            }
        });

        addCheat('Kill Enemy', () => {
            if (cm && cm.enemy) {
                cm.enemy.takeDamage(9999, cm.player);
            }
        });

        addCheat('Win Combat', () => {
            if (cm && cm.enemy) {
                // Force Kill + Win Condition
                cm.enemy.currentHP = 0;
                cm.enemy.isDead = true;
                cm.checkWinCondition();
            }
        });

        addCheat('+1 Move', () => {
            if (cm) {
                cm.currentMoves++;
                cm.emitState();
            }
        });

        addCheat('Unlock All Masteries', () => {
            masteryManager.traits.forEach((t, id) => runManager.unlockMastery(id));
            this.render();
        });
    }

    renderMasteries() {
        let y = 0;
        const traits = Array.from(masteryManager.traits.values());

        // Group by Type
        const byType = {};
        traits.forEach(t => {
            if (!byType[t.type]) byType[t.type] = [];
            byType[t.type].push(t);
        });

        for (const type in byType) {
            const header = this.scene.add.text(10, y, `--- ${type} ---`, { font: 'bold 16px monospace', fill: '#aaaaff' });
            this.contentContainer.add(header);
            y += 25;

            byType[type].forEach(t => {
                const owned = runManager.hasMastery(t.id);
                const color = owned ? '#00ff00' : '#444444';
                const text = `[${owned ? 'X' : ' '}] ${t.name} (${t.rarity})`;

                const btn = this.scene.add.text(20, y, text, { font: '14px monospace', fill: color })
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => {
                        if (owned) {
                            runManager.removeMastery(t.id);
                        } else {
                            runManager.unlockMastery(t.id);
                        }
                        this.renderMasteries(); // Re-render
                    });
                this.contentContainer.add(btn);
                y += 20;
            });
            y += 10;
        }
    }

    renderRelics() {
        let y = 0;
        for (const id in RELICS) {
            const r = RELICS[id];
            const owned = runManager.hasRelic(id);
            const color = owned ? '#da70d6' : '#444444';
            const text = `[${owned ? 'X' : ' '}] ${r.name}`;

            const btn = this.scene.add.text(20, y, text, { font: '14px monospace', fill: color })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (owned) {
                        runManager.removeRelic(id);
                    } else {
                        runManager.addRelic(id);
                    }
                    this.renderRelics();
                });
            this.contentContainer.add(btn);
            y += 20;
        }
    }

    renderStats() {
        let y = 0;
        const p = runManager.player;
        const addStat = (label, val) => {
            this.contentContainer.add(this.scene.add.text(20, y, `${label}: ${val}`, { font: '14px monospace', fill: '#ffffff' }));
            y += 20;
        };

        addStat('HP', `${p.currentHP}/${p.maxHP}`);
        addStat('Gold', p.gold);

        // Mana is on Entity, but maybe RunManager tracks it?
        // Actually RunManager checks 'mana' usually? No, RunManager player init state didn't show mana.
        // Mana is combat-only.
        const cm = this.scene ? this.scene.combatManager : null;
        const mana = (cm && cm.player) ? cm.player.mana : 0;
        addStat('Mana', mana);

        const strength = (cm && cm.player) ? cm.player.statusManager.getStack(STATUS_TYPES.STRENGTH) : 0;
        const focus = (cm && cm.player) ? cm.player.statusManager.getStack(STATUS_TYPES.FOCUS) : 0;

        addStat('Strength', strength);
        addStat('Focus', focus);
    }
}
