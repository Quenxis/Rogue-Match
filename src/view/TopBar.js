import { runManager } from '../core/RunManager.js';
import { EventBus } from '../core/EventBus.js';
import { RELICS } from '../data/relics.js';
import { audioManager } from '../core/AudioManager.js';

export class TopBar {
    constructor(scene) {
        this.scene = scene;
        this.width = 1252;
        this.height = 40;

        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(1000); // High depth
        this.container.setScrollFactor(0); // Fix to camera

        // Background Strip
        this.bg = this.scene.add.rectangle(0, 0, this.width, this.height, 0x222222).setOrigin(0, 0);
        this.container.add(this.bg);

        // --- Guide Button (?) ---
        this.guideBtn = this.scene.add.text(1220, 21, '?', {
            font: 'bold 20px Verdana',
            fill: '#ffffff',
            padding: { x: 8, y: 4 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleGuide());
        this.container.add(this.guideBtn);

        // --- Settings Button (⚙️) ---
        this.settingsBtn = this.scene.add.text(1170, 21, '⚙️', {
            font: '20px Verdana',
            fill: '#ffffff',
            padding: { x: 6, y: 4 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleSettings());
        this.container.add(this.settingsBtn);

        this.createSettingsOverlay();

        this.createGuideOverlay();

        // --- HP Display ---
        this.hpText = this.scene.add.text(20, 10, '', { font: 'bold 15px Verdana', fill: '#ff4444' }).setResolution(2);

        // --- Gold Display ---
        this.goldText = this.scene.add.text(200, 10, '', { font: 'bold 15px Verdana', fill: '#ffd700' }).setResolution(2);

        this.container.add([this.hpText, this.goldText]);

        // --- Relics (Dynamic) ---
        this.relicContainer = this.scene.add.container(400, 20);
        this.container.add(this.relicContainer);
        this.relicIcons = [];
        this.relicTooltip = this.scene.add.text(0, 0, '', { font: '13px Verdana', fill: '#ffffff', backgroundColor: '#000000', padding: 4 })
            .setDepth(2001)
            .setVisible(false)
            .setResolution(2)
            .setScrollFactor(0);
        this.container.add(this.relicTooltip);

        // --- Potions (Right Side) ---
        // Slots at x=800, 850, 900
        this.potionSlots = [];
        this.createPotionSlots(700);

        // Initial Render
        this.render();

        // Listen for updates? 
        // Ideally we update on specific events, or just providing a .refresh() method that CombatManager calls.
        // Or we subscribe to 'player:updated' if we had that.
        // For now, let's expose refresh().

        // --- Scene Title (Top Right) ---
        this.titleText = this.scene.add.text(1080, 20, '', {
            font: 'bold 18px Verdana', // Monospace/Tech look
            fill: '#ffffff',
            align: 'right'
        }).setOrigin(1, 0.5).setResolution(2);
        this.container.add(this.titleText);

        // Invoked is better.

        // Listen for updates
        this.render = this.render.bind(this);
        EventBus.on('ui:refresh_topbar', this.render);

        // Cleanup on scene shutdown
        if (this.scene.events) {
            this.scene.events.once('shutdown', this.destroy, this);
            this.scene.events.once('destroy', this.destroy, this);
        }
    }

    destroy() {
        EventBus.off('ui:refresh_topbar', this.render);
        if (this.container) this.container.destroy();
    }

    setTitle(text) {
        this.titleText.setText(text.toUpperCase());
    }

    createPotionSlots(startX) {
        this.scene.add.text(startX - 60, 12, 'Potions:', { font: '13px Verdana', fill: '#aaaaaa' }).setResolution(2);

        for (let i = 0; i < 3; i++) {
            const x = startX + (i * 50);
            const y = 20;

            const slotBg = this.scene.add.circle(x, y, 16, 0x000000).setStrokeStyle(1, 0x666666);
            this.container.add(slotBg);

            // Container for item sprite
            const icon = this.scene.add.circle(x, y, 12, 0x888888).setVisible(false);
            const btn = this.scene.add.circle(x, y, 16, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.usePotion(i));

            // Tooltip (simple)
            btn.on('pointerover', () => {
                const p = runManager.player.potions[i];
                if (p) this.showTooltip(x, y + 30, `${p.name}\n${p.effect}`);
            });
            btn.on('pointerout', () => this.hideTooltip());

            this.container.add([icon, btn]);
            this.potionSlots.push({ bg: slotBg, icon: icon, btn: btn });
        }

        // Tooltip Text
        this.tooltip = this.scene.add.text(0, 0, '', { font: '13px Verdana', fill: '#ffffff', backgroundColor: '#000000', padding: 4 })
            .setDepth(2000)
            .setVisible(false)
            .setResolution(2)
            .setScrollFactor(0); // Fix to HUD
        // Note: Adding to container usually handles scroll factor, BUT if MapScene camera moves, 
        // global position calculations might be off if we rely on container relative pos?
        // Actually, container is factor 0. Children inherit. 
        // But let's be explicit.
        this.container.add(this.tooltip);
    }

    render() {
        // Update Stats
        const p = runManager.player;
        this.hpText.setText(`HP: ${p.currentHP}/${p.maxHP}`);
        this.goldText.setText(`Gold: ${p.gold}`);

        // --- Render Relics ---
        this.relicIcons.forEach(icon => {
            if (icon.destroy) icon.destroy();
        });
        this.relicIcons = [];
        this.relicContainer.removeAll(true);

        const relics = runManager.getRelics();
        relics.forEach((relicId, index) => {
            const data = RELICS[relicId];
            if (!data) return;

            const x = index * 40;
            const y = 0;

            const icon = this.scene.add.text(x, y, data.icon, { fontSize: '24px' }).setOrigin(0, 0.5);

            // Interaction for Tooltip
            const hitArea = this.scene.add.rectangle(x + 12, y, 30, 30, 0x000000, 0).setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0); // Ensure input works with camera scroll

            hitArea.on('pointerover', () => {
                // Ensure tooltip is top-most
                this.relicTooltip.setDepth(9999);
                this.relicTooltip.setText(`${data.name}\n${data.description}`);
                // Position relative to container (which is 0,0 fixed)
                this.relicTooltip.setPosition(400 + x, 50);
                this.relicTooltip.setVisible(true);
            });
            hitArea.on('pointerout', () => {
                this.relicTooltip.setVisible(false);
            });

            this.relicContainer.add([icon, hitArea]);
            this.relicIcons.push(icon); // Keep track if needed, but removeAll handles container
        });


        // Update Potions
        this.potionSlots.forEach((slot, index) => {
            const potion = p.potions[index];
            if (potion) {
                slot.icon.setVisible(true);
                slot.icon.setFillStyle(potion.color || 0xffffff);
                slot.btn.setInteractive();
            } else {
                slot.icon.setVisible(false);
                slot.btn.disableInteractive();
            }
        });
    }

    usePotion(index) {
        this.hideTooltip(); // Fix: Force hide tooltip immediately on use
        console.log(`TopBar: Clicked Potion ${index}`);
        // Emit event for CombatManager to handle
        EventBus.emit('potion:use_requested', index);
    }

    showTooltip(x, y, text) {
        this.tooltip.setPosition(x, y);
        this.tooltip.setText(text);
        this.tooltip.setVisible(true);
    }

    hideTooltip() {
        this.tooltip.setVisible(false);
    }

    createGuideOverlay() {
        // Fullscreen Container
        this.guideContainer = this.scene.add.container(0, 0).setDepth(3000).setScrollFactor(0).setVisible(false);

        // Dark Overlay
        const overlay = this.scene.add.rectangle(626, 300, 1252, 600, 0x000000, 0.85).setInteractive();
        this.guideContainer.add(overlay);

        // Window Box
        const winW = 900;
        const winH = 500;
        const windowBg = this.scene.add.rectangle(626, 300, winW, winH, 0x222222).setStrokeStyle(4, 0x3b2d23);
        this.guideContainer.add(windowBg);

        // Close Button
        const closeBtn = this.scene.add.text(626 + winW / 2 - 30, 300 - winH / 2 + 30, 'X', {
            font: 'bold 24px Verdana', fill: '#ff4444'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleGuide());
        this.guideContainer.add(closeBtn);

        // Overlay close on click outside (already handled by overlay blocker, but maybe close on overlay click?)
        overlay.on('pointerdown', () => this.toggleGuide());

        // --- CONTENT ---
        const startX = 626 - winW / 2 + 50;
        const startY = 300 - winH / 2 + 50;

        const title = this.scene.add.text(626, startY, 'ADVENTURER\'S GUIDE', {
            font: 'bold 28px Verdana', fill: '#ffd700', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.guideContainer.add(title);

        // 1. ITEMS (Left Column)
        const col1X = startX;
        const rowH = 40;
        let y = startY + 60;

        this.addGuideHeader(col1X, y, 'TILES & EFFECTS');
        y += 40;

        this.addGuideItem(col1X, y, 'SWORD', 'Sword', 'Deals Damage (2 + Strength)', 0xff4400); y += rowH;
        this.addGuideItem(col1X, y, 'SHIELD', 'Shield', 'Gains Block (2)', 0x4444ff); y += rowH;
        this.addGuideItem(col1X, y, 'POTION', 'Potion', 'Heals 1 HP', 0x44ff44); y += rowH;
        this.addGuideItem(col1X, y, 'MANA', 'Mana', 'Gains 1 Mana', 0x00ffff); y += rowH;
        this.addGuideItem(col1X, y, 'COIN', 'Coin', 'Gains 1 Gold', 0xffd700); y += rowH * 1.5;

        this.addGuideItem(col1X, y, 'lock', 'Lock', 'Cannot move. Match to break.', 0x9900cc); y += rowH;
        this.addGuideItem(col1X, y, 'trash', 'Trash', 'Useless. Match nearby to destroy.', 0x888888); y += rowH;


        // 2. MECHANICS (Right Column)
        const col2X = startX + 450;
        y = startY + 60;

        this.addGuideHeader(col2X, y, 'MECHANICS');
        y += 40;

        this.addGuideText(col2X, y, '• Match 3: Basic effect.'); y += 30;
        this.addGuideText(col2X, y, '• Match 4+: No extra turn yet (WIP).'); y += 40; // Honest desc

        this.addGuideHeader(col2X, y, 'STATS & SKILLS');
        y += 40;
        this.addGuideText(col2X, y, '• Strength: Adds to Sword damage.'); y += 30;
        this.addGuideText(col2X, y, '• Mana: Used for Skills (Fireball, Heal).'); y += 30;
        this.addGuideText(col2X, y, '• Moves: 3 per turn. Swapping costs 1.'); y += 30;
        this.addGuideText(col2X, y, '• Potions: Use from top bar (Instant).'); y += 30;

    }

    addGuideHeader(x, y, text) {
        const t = this.scene.add.text(x, y, text, {
            font: 'bold 20px Verdana', fill: '#ffffff', border: '1px solid white'
        });
        const line = this.scene.add.rectangle(x + 100, y + 25, 200, 2, 0x666666);
        this.guideContainer.add([t, line]);
    }

    addGuideItem(x, y, iconKey, name, desc, color) {
        // Use Image instead of Text for Icon
        const i = this.scene.add.image(x, y, iconKey).setDisplaySize(32, 32).setOrigin(0.5);
        // Adjust text X position slightly
        const n = this.scene.add.text(x + 40, y, name, { font: 'bold 16px Verdana', fill: '#' + color.toString(16) }).setOrigin(0, 0.5);
        const d = this.scene.add.text(x + 140, y, desc, { font: '14px Verdana', fill: '#cccccc' }).setOrigin(0, 0.5);
        this.guideContainer.add([i, n, d]);
    }

    addGuideText(x, y, text) {
        const t = this.scene.add.text(x, y, text, { font: '14px Verdana', fill: '#dddddd' });
        this.guideContainer.add(t);
    }

    toggleGuide() {
        if (!this.guideContainer) return;
        this.guideContainer.setVisible(!this.guideContainer.visible);
        if (this.settingsContainer) this.settingsContainer.setVisible(false); // Close other
    }

    createSettingsOverlay() {
        // Container
        this.settingsContainer = this.scene.add.container(0, 0).setDepth(3000).setScrollFactor(0).setVisible(false);

        // Dark Overlay
        const overlay = this.scene.add.rectangle(626, 300, 1252, 600, 0x000000, 0.85).setInteractive();
        overlay.on('pointerdown', () => this.toggleSettings());
        this.settingsContainer.add(overlay);

        // Window
        const winW = 400;
        const winH = 300;
        const windowBg = this.scene.add.rectangle(626, 300, winW, winH, 0x222222).setStrokeStyle(4, 0x3b2d23);
        this.settingsContainer.add(windowBg);

        // Title
        const title = this.scene.add.text(626, 300 - winH / 2 + 40, 'SETTINGS', {
            font: 'bold 24px Verdana', fill: '#ffd700'
        }).setOrigin(0.5);
        this.settingsContainer.add(title);

        // Close Button
        const closeBtn = this.scene.add.text(626 + winW / 2 - 30, 300 - winH / 2 + 30, 'X', {
            font: 'bold 24px Verdana', fill: '#ff4444'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleSettings());
        this.settingsContainer.add(closeBtn);

        // --- VOLUME CONTROL ---
        const volY = 300;
        this.settingsContainer.add(this.scene.add.text(626, volY - 40, 'MASTER VOLUME', { font: '16px Verdana', fill: '#aaaaaa' }).setOrigin(0.5));

        // Volume Bar Background
        const barW = 200;
        const barH = 10;
        const barBg = this.scene.add.rectangle(626, volY, barW, barH, 0x444444).setInteractive({ useHandCursor: true });
        this.settingsContainer.add(barBg);

        // Volume Bar Fill
        this.volFill = this.scene.add.rectangle(626 - barW / 2, volY, 0, barH, 0x00ff00).setOrigin(0, 0.5);
        this.settingsContainer.add(this.volFill);

        // Knob
        this.volKnob = this.scene.add.circle(626 - barW / 2, volY, 10, 0xffffff).setInteractive({ useHandCursor: true, draggable: true });
        this.scene.input.setDraggable(this.volKnob);
        this.settingsContainer.add(this.volKnob);

        // Update Volume Visuals
        this.updateVolumeVisuals(0.5); // Default init

        // Interaction
        barBg.on('pointerdown', (pointer) => {
            this.setVolumeFromPointer(pointer, barW);
        });

        this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (gameObject === this.volKnob) {
                this.setVolumeFromPointer(pointer, barW);
            }
        });

        // Load initial volume from manager?
        // Ideally we read audioManager.volume
    }

    setVolumeFromPointer(pointer, barW) {
        if (!this.settingsContainer.visible) return;

        const startX = 626 - barW / 2;
        let value = (pointer.x - startX) / barW;
        value = Phaser.Math.Clamp(value, 0, 1);

        this.updateVolumeVisuals(value, barW);

        // Update Audio Manager
        // Need dynamic import or use global if available? 
        // We imported it in BootScene/MapScene but not here.
        // Let's import it at top of file.
        audioManager.setVolume(value);
    }

    updateVolumeVisuals(value, barW = 200) {
        if (!this.volFill || !this.volKnob) return;
        this.volFill.width = value * barW;
        this.volKnob.x = (626 - barW / 2) + (value * barW);
    }

    toggleSettings() {
        if (!this.settingsContainer) return;
        this.settingsContainer.setVisible(!this.settingsContainer.visible);
        if (this.guideContainer) this.guideContainer.setVisible(false); // Close other

        // Sync visuals when opening
        if (this.settingsContainer.visible) {
            this.updateVolumeVisuals(audioManager.volume);
        }
    }
}
