import { runManager } from '../core/RunManager.js';
import { EventBus } from '../core/EventBus.js';
import { RELICS } from '../data/relics.js';
import { audioManager } from '../core/AudioManager.js';
import { settingsManager } from '../core/SettingsManager.js';
import { RichTextHelper } from './RichTextHelper.js';

export class TopBar {

    constructor(scene) {
        this.scene = scene;
        this.width = this.scene.scale.width;
        this.height = 50; // Increased Height for 1080p

        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(1000); // High depth
        this.container.setScrollFactor(0); // Fix to camera

        // Background Strip
        this.bg = this.scene.add.rectangle(0, 0, this.width, this.height, 0x222222).setOrigin(0, 0);
        this.container.add(this.bg);

        // Center Y for elements
        const cy = this.height / 2;
        const rightEdge = this.width;

        // --- Guide Button (?) ---
        this.guideBtn = this.scene.add.text(rightEdge - 50, cy, '?', {
            font: 'bold 28px Verdana', // Larger Font
            fill: '#ffffff',
            padding: { x: 10, y: 5 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleGuide());
        this.container.add(this.guideBtn);

        // --- Settings Button (⚙️) ---
        this.settingsBtn = this.scene.add.text(rightEdge - 110, cy, '⚙️', {
            font: '28px Verdana', // Larger Font
            fill: '#ffffff',
            padding: { x: 8, y: 5 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleSettings());
        this.container.add(this.settingsBtn);

        this.createSettingsOverlay();
        this.createGuideOverlay();

        // --- HP Display ---
        this.hpText = this.scene.add.text(30, cy, '', { font: 'bold 22px Verdana', fill: '#ff4444' }) // Larger Font & Position
            .setOrigin(0, 0.5)
            .setResolution(2);

        // --- Gold Display ---
        this.goldText = this.scene.add.text(250, cy, '', { font: 'bold 22px Verdana', fill: '#ffd700' }) // Larger Font & Position
            .setOrigin(0, 0.5)
            .setResolution(2);

        this.container.add([this.hpText, this.goldText]);

        // --- Relics (Dynamic) ---
        this.relicContainer = this.scene.add.container(450, cy); // Adjusted X
        this.container.add(this.relicContainer);
        this.relicIcons = [];

        // RICHER TOOLTIP (Container)
        this.relicTooltip = this.scene.add.container(0, 0).setDepth(2001).setVisible(false).setScrollFactor(0);
        this.relicTooltipBg = this.scene.add.rectangle(0, 0, 200, 50, 0x000000, 0.9).setOrigin(0, 0); // Origin Top-Left for easier resizing
        this.relicTooltip.add(this.relicTooltipBg);
        this.container.add(this.relicTooltip);

        // --- Potions (Right Side) ---
        // Center around width * 0.65
        this.potionSlots = [];
        this.createPotionSlots(this.width * 0.65);

        // Initial Render
        this.render();

        // --- Scene Title (Top Right) ---
        this.titleText = this.scene.add.text(rightEdge - 180, cy, '', {
            font: 'bold 24px Verdana', // Larger Font
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

    createPotionSlots(centerX) {
        // Clear existing if any
        this.potionSlots.forEach(slot => {
            if (slot.btn) slot.btn.destroy();
            if (slot.icon) slot.icon.destroy();
            if (slot.bg) slot.bg.destroy();
        });
        this.potionSlots = [];

        const slotSize = 40;
        const spacing = 50;
        const cy = this.height / 2;

        // Start X so that the group is centered around centerX
        // 3 slots: -1, 0, +1 offsets?
        // x positions: centerX - spacing, centerX, centerX + spacing

        for (let i = 0; i < 3; i++) {
            // i=0 -> -1 offset, i=1 -> 0, i=2 -> +1
            const offset = (i - 1) * spacing;
            const x = centerX + offset;

            // Background (Empty Slot) - Lighter Border for Visibility
            // CIRCLE: radius = slotSize / 2
            const radius = slotSize / 2;
            const bg = this.scene.add.circle(x, cy, radius, 0x000000, 0.3)
                .setStrokeStyle(2, 0x888888);

            // Icon (Potion)
            const icon = this.scene.add.text(x, cy, '🧪', { fontSize: '24px' }) // Slightly smaller for circle fit
                .setOrigin(0.5)
                .setVisible(false);

            // Click Area (Circle)
            const btn = this.scene.add.circle(x, cy, radius, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.usePotion(i));

            this.container.add([bg, icon, btn]);
            btn.on('pointerover', () => {
                const p = runManager.player.potions[i];
                if (p) this.showTooltip(x, cy + slotSize / 2 + 5, `${p.name}\n${p.effect}`); // Adjusted Y for tooltip
            });
            btn.on('pointerout', () => this.hideTooltip());

            this.potionSlots.push({ bg: bg, icon: icon, btn: btn });
        }

        // Tooltip Text (Legacy removed - uses unified container)
        // this.tooltip = ... 

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

            if (data.color) {
                // If it's a number (0x...), setTint works perfectly.
                icon.setTint(data.color);
            }

            // Interaction for Tooltip
            const hitArea = this.scene.add.rectangle(x + 12, y, 30, 30, 0x000000, 0).setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0); // Ensure input works with camera scroll

            hitArea.on('pointerover', () => {
                // Ensure tooltip is top-most
                this.relicTooltip.setDepth(9999);

                // Use Rich Text
                this.updateRichTooltip(`${data.name}\n${data.description}`);

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
                // Emoji '🧪' doesn't need coloring, but we can color the border
                const color = potion.color || 0xffffff;
                slot.bg.setStrokeStyle(2, color);
                slot.btn.setInteractive();
            } else {
                slot.icon.setVisible(false);
                slot.bg.setStrokeStyle(2, 0x888888); // Default lighter gray
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

    updateRichTooltip(text) {
        // 1. Clear previous content (Keep BG)
        this.relicTooltip.each(child => {
            if (child !== this.relicTooltipBg) child.destroy();
        });

        // 2. Delegate to Helper with Defaults
        const { width, height } = RichTextHelper.renderRichText(
            this.scene,
            this.relicTooltip,
            text
        );

        // 3. Resize Background
        this.relicTooltipBg.setSize(width, height);
    }

    showTooltip(x, y, text) {
        // Unified tooltip using RichTextHelper (Container)
        this.relicTooltip.setDepth(9999);
        this.updateRichTooltip(text);
        this.relicTooltip.setPosition(x, y);
        this.relicTooltip.setVisible(true);
    }

    hideTooltip() {
        this.relicTooltip.setVisible(false);
    }

    createGuideOverlay() {
        // Fullscreen Container
        this.guideContainer = this.scene.add.container(0, 0).setDepth(3000).setScrollFactor(0).setVisible(false);
        this.guideCurrentPage = 0;
        this.guidePages = [];

        // Dark Overlay (clicking here closes the guide)
        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;

        const overlay = this.scene.add.rectangle(centerX, centerY, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.85).setInteractive();
        overlay.on('pointerdown', () => this.toggleGuide());
        this.guideContainer.add(overlay);

        // Window Box (make interactive to BLOCK clicks from reaching overlay)
        const winW = 1200; // Increased width (was 800)
        const winH = 800; // Increased height (was 550)
        // Background color matched to TopBar (0x222222)
        const windowBg = this.scene.add.rectangle(centerX, centerY, winW, winH, 0x222222).setStrokeStyle(3, 0x444466);
        windowBg.setInteractive(); // Block clicks from falling through to overlay
        const innerBorder = this.scene.add.rectangle(centerX, centerY, winW - 8, winH - 8, 0x222222, 0).setStrokeStyle(1, 0x333344);
        this.guideContainer.add([windowBg, innerBorder]);

        // Close Button (only way to close besides clicking dark overlay)
        const closeBtn = this.scene.add.text(centerX + winW / 2 - 28, centerY - winH / 2 + 24, '✕', {
            font: 'bold 30px Arial', fill: '#ff6666'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleGuide());
        this.guideContainer.add(closeBtn);

        // Title
        // centerX is already defined above
        const startY = centerY - winH / 2 + 40;
        const title = this.scene.add.text(centerX, startY, "ADVENTURER'S GUIDE", {
            font: 'bold 36px Arial', fill: '#ffd700', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5);
        this.guideContainer.add(title);

        // Page Content Container
        this.guidePageContainer = this.scene.add.container(0, 0);
        this.guideContainer.add(this.guidePageContainer);

        // --- TAB BUTTONS (evenly distributed) ---
        const tabY = startY + 50;
        const tabNames = ['Tiles', 'Mechanics', 'Combat'];
        const tabGap = 20; // Consistent gap between tabs
        const tabPadX = 30;
        const tabPadY = 12;
        this.guideTabs = [];

        // Calculate total width needed and center
        // Approx char width 14px for font 20
        const tabWidths = tabNames.map(name => name.length * 14 + tabPadX * 2);
        const totalTabWidth = tabWidths.reduce((a, b) => a + b, 0) + tabGap * (tabNames.length - 1);
        let tabX = centerX - totalTabWidth / 2;

        tabNames.forEach((name, index) => {
            const thisTabW = tabWidths[index];
            const tab = this.scene.add.text(tabX + thisTabW / 2, tabY, name, {
                font: 'bold 20px Arial', fill: '#888888', backgroundColor: '#2a2a3e',
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
        const centerX = this.scene.scale.width / 2;
        const startX = centerX - 500; // Wider start
        const rowH = 60; // Taller rows
        let y = 280; // Start lower due to bigger header

        // TILES
        page.add(this.createGuideHeader(startX, y, 'TILES'));
        y += 50;
        page.add(this.createGuideRow(startX, y, 'SWORD', 'Sword', 'Deals Damage (2 + Strength per tile)', 0xff4400)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'SHIELD', 'Shield', 'Gains Block (2 per tile)', 0x4488ff)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'POTION', 'Potion', 'Heals 1 HP per tile', 0x44ff44)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'MANA', 'Mana', 'Gains 1 Mana per tile', 0x44ffff)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'COIN', 'Coin', 'Gains 1 Gold per tile', 0xffd700)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'BOW', 'Bow', 'Deals Piercing DMG (Ignore Shield)', 0xcccccc)); y += rowH * 1.3;

        // HAZARDS
        page.add(this.createGuideHeader(startX, y, 'HAZARDS'));
        y += 50;
        page.add(this.createGuideRow(startX, y, 'lock', 'Lock', 'Cannot be moved. Match 3 to break.', 0xaa44ff)); y += rowH;
        page.add(this.createGuideRow(startX, y, 'trash', 'Trash', 'Useless tile. Match nearby to remove.', 0x888888));

        this.guidePages.push(page);
        this.guidePageContainer.add(page);
    }

    createGuidePage1() {
        // PAGE 1: MECHANICS (Status Effects + Match Tiers combined)
        const page = this.scene.add.container(0, 0);
        const centerX = this.scene.scale.width / 2;
        const startX = centerX - 500; // Wider start (-500 from center)
        let y = 280;

        // --- STATUS EFFECTS (compact) ---
        page.add(this.createGuideHeader(startX, y, 'STATUS EFFECTS'));
        y += 40;

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
                page.add(this.scene.add.rectangle(startX + 500, y, 1000, 32, 0x2a2a3a, 0.4));
            }
            const iconT = this.scene.add.text(startX + 20, y, eff.icon, { font: '24px Arial' }).setOrigin(0, 0.5);
            const nameT = this.scene.add.text(startX + 60, y, eff.name, {
                font: 'bold 20px Arial', fill: '#' + eff.color.toString(16).padStart(6, '0')
            }).setOrigin(0, 0.5);
            const descT = this.scene.add.text(startX + 200, y, eff.desc, {
                font: '18px Arial', fill: '#bbbbbb'
            }).setOrigin(0, 0.5);
            page.add([iconT, nameT, descT]);
            y += 36;
        });

        y += 30;

        // --- MATCH TIERS ---
        page.add(this.createGuideHeader(startX, y, 'MATCH TIER BONUSES'));
        y += 40;

        // Column headers with FIXED positions - Spaced out for 1000px width
        const col1 = startX + 150;   // Match 3 column
        const col2 = startX + 400;  // Match 4 column
        const col3 = startX + 700;  // Match 5+ column
        page.add(this.scene.add.text(col1, y, 'Match 3', { font: 'bold 18px Arial', fill: '#888888' }));
        page.add(this.scene.add.text(col2, y, 'Match 4', { font: 'bold 18px Arial', fill: '#ffaa44' }));
        page.add(this.scene.add.text(col3, y, 'Match 5+', { font: 'bold 18px Arial', fill: '#ff6644' }));
        y += 35;

        // Tier data: [iconKey, name, color, m3, m4, m5]
        const tiers = [
            ['SWORD', 'Sword', 0xff4400, '2 DMG + Str / tile', '+Bleed (2)', '+Bleed (4), 1.5x'],
            ['SHIELD', 'Shield', 0x4488ff, '2 Block / tile', '+Thorns (3)', '+Thorns (6), 1.5x'],
            ['POTION', 'Potion', 0x44ff44, '1 Heal / tile', '+Regen (3)', '+Regen (4), Cleanse, +5 HP'],
            ['MANA', 'Mana', 0x44ffff, '1 Mana / tile', '+Focus (1)', '+Focus (2)'],
            ['COIN', 'Coin', 0xffd700, '1 Gold / tile', '+Critical (1)', '+Critical (2)'],
            ['BOW', 'Bow', 0xcccccc, '3 Piercing DMG', '+Vuln (1), Pierce (4)', '+Vuln (2), Pierce (5)']
        ];

        tiers.forEach(([icon, name, color, m3, m4, m5], idx) => {
            // Zebra striping
            if (idx % 2 === 1) {
                page.add(this.scene.add.rectangle(startX + 500, y, 1000, 32, 0x2a2a3a, 0.4));
            }
            const i = this.scene.add.image(startX + 20, y, icon).setDisplaySize(42, 42).setOrigin(0.5);
            const n = this.scene.add.text(startX + 45, y, name, {
                font: 'bold 16px Arial', fill: '#' + color.toString(16).padStart(6, '0')
            }).setOrigin(0, 0.5);
            const t3 = this.scene.add.text(col1, y, m3, { font: '16px Arial', fill: '#aaaaaa' }).setOrigin(0, 0.5);
            const t4 = this.scene.add.text(col2, y, m4, { font: '16px Arial', fill: '#dddddd' }).setOrigin(0, 0.5);
            const t5 = this.scene.add.text(col3, y, m5, { font: '16px Arial', fill: '#ffffff' }).setOrigin(0, 0.5);
            page.add([i, n, t3, t4, t5]);
            y += 36;
        });

        this.guidePages.push(page);
        this.guidePageContainer.add(page);
    }

    createGuidePage2() {
        // PAGE 2: COMBAT & STATS
        const page = this.scene.add.container(0, 0);
        const centerX = this.scene.scale.width / 2;
        const startX = centerX - 500; // Wider start
        let y = 280;

        page.add(this.createGuideHeader(startX, y, 'STATS'));
        y += 50;
        page.add(this.createGuideLine(startX, y, '• Strength: Bonus damage per Sword tile.')); y += 35;
        page.add(this.createGuideLine(startX, y, '• Block: Absorbs damage. Resets each turn.')); y += 35;
        page.add(this.createGuideLine(startX, y, '• Mana: Resource for casting Skills.')); y += 55;

        page.add(this.createGuideHeader(startX, y, 'SKILLS'));
        y += 50;

        // Custom Layout for Skills with Images
        const iconSize = 48; // Increased from 32

        // Fireball
        const fbIcon = this.scene.add.image(startX + 24, y, 'ability_1').setDisplaySize(iconSize, iconSize);
        const fbText = this.scene.add.text(startX + 60, y, 'Fireball (6 Mana): Deal 8 damage.', {
            font: '18px Arial', fill: '#ffaa88'
        }).setOrigin(0, 0.5);
        page.add([fbIcon, fbText]);
        y += 50;

        // Heal
        const healIcon = this.scene.add.image(startX + 24, y, 'ability_2').setDisplaySize(iconSize, iconSize);
        const healText = this.scene.add.text(startX + 60, y, 'Heal (6 Mana): Restore 10 HP.', {
            font: '18px Arial', fill: '#88ff88'
        }).setOrigin(0, 0.5);
        page.add([healIcon, healText]);
        y += 55;

        page.add(this.createGuideHeader(startX, y, 'TURN FLOW'));
        y += 50;
        page.add(this.createGuideLine(startX, y, '• You have 3 Moves per turn.')); y += 35;
        page.add(this.createGuideLine(startX, y, '• Swap gems, use skills, then End Turn.')); y += 35;
        page.add(this.createGuideLine(startX, y, '• Enemy acts after you end your turn.')); y += 35;

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

        const i = this.scene.add.image(x + 16, y, iconKey).setDisplaySize(42, 42).setOrigin(0.5);
        const n = this.scene.add.text(x + 42, y, name, {
            font: 'bold 14px Arial', fill: '#' + color.toString(16).padStart(6, '0')
        }).setOrigin(0, 0.5);
        const d = this.scene.add.text(x + 130, y, desc, {
            font: '18px Arial', fill: '#aaaaaa'
        }).setOrigin(0, 0.5);

        elements.push(i, n, d);
        return elements;
    }

    createGuideLine(x, y, text) {
        return this.scene.add.text(x, y, text, {
            font: '18px Arial', fill: '#cccccc'
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

        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;

        // Dark Overlay
        const overlay = this.scene.add.rectangle(centerX, centerY, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.85).setInteractive();
        overlay.on('pointerdown', () => this.toggleSettings());
        this.settingsContainer.add(overlay);

        // Window
        const winW = 400;
        const winH = 300;
        const windowBg = this.scene.add.rectangle(centerX, centerY, winW, winH, 0x222222).setStrokeStyle(4, 0x3b2d23);
        this.settingsContainer.add(windowBg);

        // Title
        const title = this.scene.add.text(centerX, centerY - winH / 2 + 40, 'SETTINGS', {
            font: 'bold 24px Verdana', fill: '#ffd700'
        }).setOrigin(0.5);
        this.settingsContainer.add(title);

        // Close Button
        const closeBtn = this.scene.add.text(centerX + winW / 2 - 30, centerY - winH / 2 + 30, 'X', {
            font: 'bold 24px Verdana', fill: '#ff4444'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleSettings());
        this.settingsContainer.add(closeBtn);

        // --- VOLUME CONTROL ---
        const volY = centerY;
        this.settingsContainer.add(this.scene.add.text(centerX, volY - 40, 'MASTER VOLUME', { font: '16px Verdana', fill: '#aaaaaa' }).setOrigin(0.5));

        // Volume Bar Background
        const barW = 200;
        const barH = 10;
        const barBg = this.scene.add.rectangle(centerX, volY, barW, barH, 0x444444).setInteractive({ useHandCursor: true });
        this.settingsContainer.add(barBg);

        // Volume Bar Fill
        this.volFill = this.scene.add.rectangle(centerX - barW / 2, volY, 0, barH, 0x00ff00).setOrigin(0, 0.5);
        this.settingsContainer.add(this.volFill);

        // Knob
        this.volKnob = this.scene.add.circle(centerX - barW / 2, volY, 10, 0xffffff).setInteractive({ useHandCursor: true, draggable: true });
        this.scene.input.setDraggable(this.volKnob);
        this.settingsContainer.add(this.volKnob);

        // Update Volume Visuals
        this.updateVolumeVisuals(0.5); // Default init

        // Interaction
        barBg.on('pointerdown', (pointer) => {
            this.setVolumeFromPointer(pointer, barW, centerX);
        });

        this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (gameObject === this.volKnob) {
                this.setVolumeFromPointer(pointer, barW, centerX);
            }
        });

        // Load initial volume from manager?
        // Ideally we read audioManager.volume

        // --- AUTO END TURN TOGGLE ---
        const toggleY = volY + 60;
        this.settingsContainer.add(this.scene.add.text(centerX, toggleY - 20, 'AUTO END TURN', { font: '16px Verdana', fill: '#aaaaaa' }).setOrigin(0.5));

        const toggleBg = this.scene.add.rectangle(centerX, toggleY + 10, 60, 30, 0x444444).setInteractive({ useHandCursor: true });
        const toggleKnob = this.scene.add.circle(centerX - 15, toggleY + 10, 14, 0xff0000);

        this.settingsContainer.add([toggleBg, toggleKnob]);

        // State
        let isAutoEndTurn = settingsManager.get('autoEndTurn', false);

        const updateToggleVisuals = () => {
            if (isAutoEndTurn) {
                toggleKnob.x = centerX + 15;
                toggleKnob.setFillStyle(0x00ff00);
            } else {
                toggleKnob.x = centerX - 15;
                toggleKnob.setFillStyle(0xff0000);
            }
        };
        updateToggleVisuals();

        toggleBg.on('pointerdown', () => {
            isAutoEndTurn = !isAutoEndTurn;
            settingsManager.set('autoEndTurn', isAutoEndTurn);
            updateToggleVisuals();
        });

        // Store update function to sync when opening settings
        this.updateAutoRunToggle = () => {
            isAutoEndTurn = settingsManager.get('autoEndTurn', false);
            updateToggleVisuals();
        };
    }

    setVolumeFromPointer(pointer, barW, centerX) {
        if (!this.settingsContainer.visible) return;

        const startX = centerX - barW / 2;
        let value = (pointer.x - startX) / barW;
        value = Phaser.Math.Clamp(value, 0, 1);

        this.updateVolumeVisuals(value, barW, centerX); // Pass centerX

        // Update Audio Manager
        // Need dynamic import or use global if available? 
        // We imported it in BootScene/MapScene but not here.
        // Let's import it at top of file.
        audioManager.setVolume(value);
    }

    updateVolumeVisuals(value, barW = 200, centerX = null) {
        if (!this.volFill || !this.volKnob) return;
        if (centerX === null) centerX = this.scene.scale.width / 2; // Default if not passed

        this.volFill.width = value * barW;
        this.volKnob.x = (centerX - barW / 2) + (value * barW);
    }

    toggleSettings() {
        if (!this.settingsContainer) return;
        this.settingsContainer.setVisible(!this.settingsContainer.visible);
        if (this.guideContainer) this.guideContainer.setVisible(false); // Close other

        // Sync visuals when opening
        if (this.settingsContainer.visible) {
            this.updateVolumeVisuals(audioManager.volume);
            if (this.updateAutoRunToggle) this.updateAutoRunToggle();
        }
    }
}
