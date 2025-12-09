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
        this.guideCurrentPage = 0;
        this.guidePages = [];

        // Dark Overlay (clicking here closes the guide)
        const overlay = this.scene.add.rectangle(626, 300, 1252, 600, 0x000000, 0.85).setInteractive();
        overlay.on('pointerdown', () => this.toggleGuide());
        this.guideContainer.add(overlay);

        // Window Box (make interactive to BLOCK clicks from reaching overlay)
        // Window Box (make interactive to BLOCK clicks from reaching overlay)
        const winW = 800; // Increased width (was 680)
        const winH = 550; // Increased height (was 480)
        // Background color matched to TopBar (0x222222)
        const windowBg = this.scene.add.rectangle(626, 300, winW, winH, 0x222222).setStrokeStyle(3, 0x444466);
        windowBg.setInteractive(); // Block clicks from falling through to overlay
        const innerBorder = this.scene.add.rectangle(626, 300, winW - 8, winH - 8, 0x222222, 0).setStrokeStyle(1, 0x333344);
        this.guideContainer.add([windowBg, innerBorder]);

        // Close Button (only way to close besides clicking dark overlay)
        // Close Button (only way to close besides clicking dark overlay)
        const closeBtn = this.scene.add.text(626 + winW / 2 - 28, 300 - winH / 2 + 24, '✕', {
            font: 'bold 20px Arial', fill: '#ff6666'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleGuide());
        this.guideContainer.add(closeBtn);

        // Title
        const centerX = 626;
        const startY = 300 - winH / 2 + 30;
        const title = this.scene.add.text(centerX, startY, "ADVENTURER'S GUIDE", {
            font: 'bold 22px Arial', fill: '#ffd700', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5);
        this.guideContainer.add(title);

        // Page Content Container
        this.guidePageContainer = this.scene.add.container(0, 0);
        this.guideContainer.add(this.guidePageContainer);

        // --- TAB BUTTONS (evenly distributed) ---
        const tabY = startY + 42;
        const tabNames = ['Tiles', 'Mechanics', 'Combat'];
        const tabGap = 12; // Consistent gap between tabs
        const tabPadX = 20;
        const tabPadY = 8;
        this.guideTabs = [];

        // Calculate total width needed and center
        const tabWidths = tabNames.map(name => name.length * 10 + tabPadX * 2);
        const totalTabWidth = tabWidths.reduce((a, b) => a + b, 0) + tabGap * (tabNames.length - 1);
        let tabX = centerX - totalTabWidth / 2;

        tabNames.forEach((name, index) => {
            const thisTabW = tabWidths[index];
            const tab = this.scene.add.text(tabX + thisTabW / 2, tabY, name, {
                font: 'bold 14px Arial', fill: '#888888', backgroundColor: '#2a2a3e',
                padding: { x: tabPadX, y: tabPadY }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            tab.on('pointerdown', () => this.showGuidePage(index));
            tab.on('pointerover', () => { if (this.guideCurrentPage !== index) tab.setStyle({ fill: '#cccccc' }); });
            tab.on('pointerout', () => { if (this.guideCurrentPage !== index) tab.setStyle({ fill: '#888888' }); });

            this.guideContainer.add(tab);
            this.guideTabs.push(tab);
            tabX += thisTabW + tabGap;
        });

        // Create all pages (hidden initially)
        this.createGuidePage0(); // Tiles
        this.createGuidePage1(); // Mechanics (Status + Tiers combined)
        this.createGuidePage2(); // Combat/Stats

        // Show first page
        this.showGuidePage(0);
    }

    createGuidePage0() {
        // PAGE 0: TILES
        const page = this.scene.add.container(0, 0);
        const startX = 626 - 280;
        const rowH = 42;
        let y = 155;

        // TILES
        page.add(this.createGuideHeader(startX, y, 'TILES'));
        y += 40;
        page.add(this.createGuideRow(startX, y, 'SWORD', 'Sword', 'Deals Damage (2 + Strength per tile)', 0xff4400)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'SHIELD', 'Shield', 'Gains Block (2 per tile)', 0x4488ff)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'POTION', 'Potion', 'Heals 1 HP per tile', 0x44ff44)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'MANA', 'Mana', 'Gains 1 Mana per tile', 0x44ffff)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'COIN', 'Coin', 'Gains 1 Gold per tile', 0xffd700)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'BOW', 'Bow', 'Deals Piercing DMG (Ignore Shield)', 0xcccccc)); y += rowH * 1.3;

        // HAZARDS
        page.add(this.createGuideHeader(startX, y, 'HAZARDS'));
        y += 40;
        page.add(this.createGuideRow(startX, y, 'lock', 'Lock', 'Cannot be moved. Match 3 to break.', 0xaa44ff)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'trash', 'Trash', 'Useless tile. Match nearby to remove.', 0x888888));

        this.guidePages.push(page);
        this.guidePageContainer.add(page);
    }

    createGuidePage1() {
        // PAGE 1: MECHANICS (Status Effects + Match Tiers combined)
        const page = this.scene.add.container(0, 0);
        const startX = 626 - 310;
        let y = 140;

        // --- STATUS EFFECTS (compact) ---
        page.add(this.createGuideHeader(startX, y, 'STATUS EFFECTS'));
        y += 32;

        const effects = [
            { icon: '🩸', name: 'Bleed', desc: 'Damage at turn start. Decay -1', color: 0xff4444 },
            { icon: '💚', name: 'Regen', desc: 'Heals at turn start. Decay -1', color: 0x44ff44 },
            { icon: '🌵', name: 'Thorns', desc: 'Reflects damage to attacker', color: 0x88cc44 },
            { icon: '🔮', name: 'Focus', desc: '1=50% cost, 2+=free spells', color: 0xaa88ff },
            { icon: '🎯', name: 'Critical', desc: '1=50% crit, 2+=guaranteed', color: 0xffaa44 },
            { icon: '☠️', name: 'Vulnerable', desc: 'Takes +25% damage (1.25x)', color: 0xffffff }
        ];

        effects.forEach((eff, idx) => {
            // Zebra striping
            if (idx % 2 === 1) {
                page.add(this.scene.add.rectangle(startX + 250, y, 520, 26, 0x2a2a3a, 0.4));
            }
            const iconT = this.scene.add.text(startX, y, eff.icon, { font: '16px Arial' }).setOrigin(0, 0.5);
            const nameT = this.scene.add.text(startX + 30, y, eff.name, {
                font: 'bold 14px Arial', fill: '#' + eff.color.toString(16).padStart(6, '0')
            }).setOrigin(0, 0.5);
            const descT = this.scene.add.text(startX + 110, y, eff.desc, {
                font: '13px Arial', fill: '#bbbbbb'
            }).setOrigin(0, 0.5);
            page.add([iconT, nameT, descT]);
            y += 26;
        });

        y += 16;

        // --- MATCH TIERS ---
        page.add(this.createGuideHeader(startX, y, 'MATCH TIER BONUSES'));
        y += 32;

        // Column headers with FIXED positions for better alignment
        const col1 = startX + 95;   // Match 3 column
        const col2 = startX + 210;  // Match 4 column
        const col3 = startX + 360;  // Match 5+ column
        page.add(this.scene.add.text(col1, y, 'Match 3', { font: 'bold 13px Arial', fill: '#888888' }));
        page.add(this.scene.add.text(col2, y, 'Match 4', { font: 'bold 13px Arial', fill: '#ffaa44' }));
        page.add(this.scene.add.text(col3, y, 'Match 5+', { font: 'bold 13px Arial', fill: '#ff6644' }));
        y += 26;

        // Tier data: [iconKey, name, color, m3, m4, m5]
        const tiers = [
            ['SWORD', 'Sword', 0xff4400, '2 DMG + Str / tile', '+Bleed (2)', '+Bleed (4), 1.5x'],
            ['SHIELD', 'Shield', 0x4488ff, '2 Block / tile', '+Thorns (3)', '+Thorns (6), 1.5x'],
            ['POTION', 'Potion', 0x44ff44, '1 Heal / tile', '+Regen (3)', '+Regen (4), Cleanse, +5 HP'],
            ['MANA', 'Mana', 0x44ffff, '1 Mana / tile', '+Focus (1)', '+Focus (2)'],
            ['COIN', 'Coin', 0xffd700, '1 Gold / tile', '+Critical (1)', '+Critical (2)'],
            ['BOW', 'Bow', 0xcccccc, '2 Piercing DMG', '+Vuln (1), Pierce (3)', '+Vuln (2), Pierce (4)']
        ];

        tiers.forEach(([icon, name, color, m3, m4, m5], idx) => {
            // Zebra striping
            if (idx % 2 === 1) {
                page.add(this.scene.add.rectangle(startX + 250, y, 520, 28, 0x2a2a3a, 0.4));
            }
            const i = this.scene.add.image(startX + 14, y, icon).setDisplaySize(22, 22).setOrigin(0.5);
            const n = this.scene.add.text(startX + 34, y, name, {
                font: 'bold 13px Arial', fill: '#' + color.toString(16).padStart(6, '0')
            }).setOrigin(0, 0.5);
            const t3 = this.scene.add.text(col1, y, m3, { font: '13px Arial', fill: '#aaaaaa' }).setOrigin(0, 0.5);
            const t4 = this.scene.add.text(col2, y, m4, { font: '13px Arial', fill: '#dddddd' }).setOrigin(0, 0.5);
            const t5 = this.scene.add.text(col3, y, m5, { font: '13px Arial', fill: '#ffffff' }).setOrigin(0, 0.5);
            page.add([i, n, t3, t4, t5]);
            y += 28;
        });

        this.guidePages.push(page);
        this.guidePageContainer.add(page);
    }

    createGuidePage2() {
        // PAGE 2: COMBAT & STATS
        const page = this.scene.add.container(0, 0);
        const startX = 626 - 280;
        let y = 150;

        page.add(this.createGuideHeader(startX, y, 'STATS'));
        y += 38;
        page.add(this.createGuideLine(startX, y, '• Strength: Bonus damage per Sword tile.')); y += 28;
        page.add(this.createGuideLine(startX, y, '• Block: Absorbs damage. Resets each turn.')); y += 28;
        page.add(this.createGuideLine(startX, y, '• Mana: Resource for casting Skills.')); y += 45;

        page.add(this.createGuideHeader(startX, y, 'SKILLS'));
        y += 38;

        // Custom Layout for Skills with Images
        const iconSize = 32;

        // Fireball
        const fbIcon = this.scene.add.image(startX + 16, y, 'ability_1').setDisplaySize(iconSize, iconSize);
        const fbText = this.scene.add.text(startX + 45, y, 'Fireball (6 Mana): Deal 8 damage.', {
            font: '14px Arial', fill: '#ffaa88'
        }).setOrigin(0, 0.5);
        page.add([fbIcon, fbText]);
        y += 40;

        // Heal
        const healIcon = this.scene.add.image(startX + 16, y, 'ability_2').setDisplaySize(iconSize, iconSize);
        const healText = this.scene.add.text(startX + 45, y, 'Heal (6 Mana): Restore 10 HP.', {
            font: '14px Arial', fill: '#88ff88'
        }).setOrigin(0, 0.5);
        page.add([healIcon, healText]);
        y += 45;

        page.add(this.createGuideHeader(startX, y, 'TURN FLOW'));
        y += 38;
        page.add(this.createGuideLine(startX, y, '• You have 3 Moves per turn.')); y += 28;
        page.add(this.createGuideLine(startX, y, '• Swap gems, use skills, then End Turn.')); y += 28;
        page.add(this.createGuideLine(startX, y, '• Enemy acts after you end your turn.')); y += 28;

        this.guidePages.push(page);
        this.guidePageContainer.add(page);
    }

    showGuidePage(index) {
        this.guideCurrentPage = index;

        // Hide all pages
        this.guidePages.forEach((page, i) => page.setVisible(i === index));

        // Update tab styles
        this.guideTabs.forEach((tab, i) => {
            if (i === index) {
                tab.setStyle({ fill: '#ffffff', backgroundColor: '#4a4a6a' });
            } else {
                tab.setStyle({ fill: '#888888', backgroundColor: '#2a2a3e' });
            }
        });
    }

    createGuideHeader(x, y, text) {
        const t = this.scene.add.text(x, y, text, {
            font: 'bold 16px Arial', fill: '#ffd700'
        });
        const line = this.scene.add.rectangle(x + 75, y + 20, 150, 2, 0x555555);
        return [t, line];
    }

    createGuideRow(x, y, iconKey, name, desc, color, zebra = false) {
        const elements = [];

        // Zebra striping background
        if (zebra) {
            const bg = this.scene.add.rectangle(x + 250, y, 520, 32, 0x2a2a3a, 0.5);
            elements.push(bg);
        }

        const i = this.scene.add.image(x + 16, y, iconKey).setDisplaySize(26, 26).setOrigin(0.5);
        const n = this.scene.add.text(x + 42, y, name, {
            font: 'bold 14px Arial', fill: '#' + color.toString(16).padStart(6, '0')
        }).setOrigin(0, 0.5);
        const d = this.scene.add.text(x + 130, y, desc, {
            font: '13px Arial', fill: '#aaaaaa'
        }).setOrigin(0, 0.5);

        elements.push(i, n, d);
        return elements;
    }

    createGuideLine(x, y, text) {
        return this.scene.add.text(x, y, text, {
            font: '14px Arial', fill: '#cccccc'
        });
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
