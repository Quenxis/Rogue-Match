/**
 * @file CombatView.js
 * @description Manages all UI/Visuals for combat (Observer Pattern). Decoupled from logic.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, ASSETS, SKILLS, SKILL_DATA, ENTITIES, STATUS_TYPES } from '../core/Constants.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';
import { HEROES } from '../data/heroes.js';

export class CombatView {
    constructor(scene, combatManager) {
        this.scene = scene;
        this.combatManager = combatManager; // Command Pattern: Only for invoking actions!

        this.centerText = null;
        this.skillButtons = {};
        this.endTurnBtn = null;
        this.heroSprite = null;
        this.enemySprite = null;
        this.playerHPBar = null;
        this.enemyHPBar = null;
        this.actionBar = null;
        this.tooltipContainer = null;
        this.intentContainer = null;

        // Visual State
        this.currentTurn = ENTITIES.PLAYER;

        this.createUI();
        this.bindEvents();
    }

    bindEvents() {
        this.updateUIBind = this.updateUI.bind(this);
        this.showNotificationBind = (data) => this.showNotification(data.text, data.color);

        EventBus.on(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.on(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);

        // Animation Events
        EventBus.on(EVENTS.PLAYER_ATTACK, () => {
            this.animateAttack(this.heroSprite, this.enemySprite, 50);
        });
        EventBus.on(EVENTS.ENEMY_ATTACK, (data) => {
            const damage = data ? (data.damage || 0) : 0;
            const tint = damage > 0 ? 0xff0000 : 0x888888; // Red for Damage, Gray for Debuff
            this.animateAttack(this.enemySprite, this.heroSprite, -50, tint);
        });

        // Defensive Events
        EventBus.on(EVENTS.PLAYER_DEFEND, () => this.animateDefend(this.heroSprite));
        EventBus.on(EVENTS.PLAYER_HEAL, () => this.animateHeal(this.heroSprite));
        EventBus.on(EVENTS.ENEMY_DEFEND, () => this.animateDefend(this.enemySprite));
        EventBus.on(EVENTS.ENEMY_HEAL, () => this.animateHeal(this.enemySprite));
    }

    destroy() {
        EventBus.off(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.off(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);
        EventBus.off(EVENTS.PLAYER_ATTACK);
        EventBus.off(EVENTS.ENEMY_ATTACK);
        EventBus.off(EVENTS.PLAYER_DEFEND);
        EventBus.off(EVENTS.PLAYER_HEAL);
        EventBus.off(EVENTS.ENEMY_DEFEND);
        EventBus.off(EVENTS.ENEMY_HEAL);

        if (this.centerText) this.centerText.destroy();
        if (this.endTurnBtn) this.endTurnBtn.destroy();
        if (this.heroSprite) this.heroSprite.destroy();
        if (this.enemySprite) this.enemySprite.destroy();
        if (this.playerHPBar && this.playerHPBar.container) this.playerHPBar.container.destroy();
        if (this.enemyHPBar && this.enemyHPBar.container) this.enemyHPBar.container.destroy();
        if (this.actionBar) this.actionBar.destroy();
        if (this.tooltipContainer) this.tooltipContainer.destroy();
        if (this.intentContainer) this.intentContainer.destroy();
        if (this.movesText) this.movesText.destroy();

        Object.values(this.skillButtons).forEach(btn => {
            if (btn.container) btn.container.destroy();
        });
    }

    createUI() {
        // Layout Constants
        this.groundY = 440;
        this.leftX = 200;
        this.rightX = 1050;

        // 1. Entities & HUD (HP, Shield, Status)
        this.createEntityDisplay(true);  // Player
        this.createEntityDisplay(false); // Enemy

        // 2. Action Bar (Mana + Skills)
        this.createActionBar();

        // 3. Turn Controls (Moves + End Turn)
        this.createTurnControls();

        // Center Notification
        this.centerText = this.scene.add.text(626, 300, '', {
            font: 'bold 40px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setDepth(200).setVisible(false).setResolution(2);

        // --- TOOLTIP ---
        this.createTooltip();
    }

    createTooltip() {
        this.tooltipContainer = this.scene.add.container(0, 0);
        this.tooltipContainer.setDepth(500);
        this.tooltipContainer.setVisible(false);

        // Background
        this.tooltipBg = this.scene.add.rectangle(0, 0, 200, 30, 0x000000, 0.85);
        this.tooltipBg.setStrokeStyle(1, 0xffffff, 0.5);

        // Text
        this.tooltipText = this.scene.add.text(0, 0, '', {
            font: '13px Arial',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 190 }
        }).setOrigin(0.5).setResolution(2);

        this.tooltipContainer.add([this.tooltipBg, this.tooltipText]);
    }

    showTooltip(x, y, text) {
        if (!this.tooltipContainer) return;

        this.tooltipText.setText(text);

        // Resize background to fit text
        const padding = 10;
        const w = Math.max(100, this.tooltipText.width + padding * 2);
        const h = this.tooltipText.height + padding;
        this.tooltipBg.setSize(w, h);

        // Position (offset up-left from cursor)
        this.tooltipContainer.setPosition(x, y - 25);
        this.tooltipContainer.setVisible(true);
    }

    hideTooltip() {
        if (this.tooltipContainer) {
            this.tooltipContainer.setVisible(false);
        }
    }

    createEntityDisplay(isPlayer) {
        const x = isPlayer ? this.leftX : this.rightX;
        const config = isPlayer ? (HEROES['warrior'] || {}) : (ENEMIES['slime'] || {}); // Placeholder config

        // Sprite
        let sprite;
        if (isPlayer) {
            if (this.scene.textures.exists(ASSETS.HERO)) {
                sprite = this.scene.add.image(x, this.groundY, ASSETS.HERO);
                sprite.setOrigin(0.5, 1);
                this.fitSprite(sprite, 300, 280, config.scale || 1);
                sprite.y += (config.yOffset || 0);
                sprite.x += (config.xOffset || 0);
            } else {
                sprite = this.scene.add.rectangle(x, this.groundY - 50, 100, 100, 0x6666ff);
            }
            this.heroSprite = sprite;
        } else {
            sprite = this.scene.add.sprite(x, this.groundY, ASSETS.ENEMY_PLACEHOLDER);
            sprite.setOrigin(0.5, 1);
            this.fitSprite(sprite, 350, 280);
            this.enemySprite = sprite;

            // --- INTENT DISPLAY (Above Enemy Head) ---
            const intentY = this.groundY - 260; // Closer to sprite
            this.intentContainer = this.scene.add.container(x, intentY);
            this.intentContainer.setDepth(150);

            // Icon (no background)
            this.intentIcon = this.scene.add.image(0, 0, ASSETS.ICON_SWORD).setDisplaySize(32, 32).setOrigin(0.5);
            this.intentIcon.setInteractive({ useHandCursor: true });

            // Tooltip on hover
            this.intentIcon.on('pointerover', (pointer) => {
                if (this.currentIntentTooltip) {
                    this.showTooltip(pointer.x, pointer.y, this.currentIntentTooltip);
                }
            });
            this.intentIcon.on('pointerout', () => this.hideTooltip());
            this.intentIcon.on('pointermove', (pointer) => {
                if (this.tooltipContainer && this.tooltipContainer.visible) {
                    this.tooltipContainer.setPosition(pointer.x, pointer.y - 25);
                }
            });

            // Value Text (next to icon)
            this.intentText = this.scene.add.text(12, 0, '', {
                font: 'bold 16px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
            }).setOrigin(0, 0.5).setResolution(2);

            this.intentContainer.add([this.intentIcon, this.intentText]);
        }
        sprite.setDepth(100);

        // HP Bar & Overlay
        const barY = 455;
        const barObj = this.createHealthBar(x, barY, 150, 20, 0xff4444, isPlayer);

        if (isPlayer) this.playerHPBar = barObj;
        else this.enemyHPBar = barObj;
    }

    createActionBar() {
        // === MODERN ACTION BAR ===
        const centerX = 550;
        const y = 560;

        this.actionBar = this.scene.add.container(centerX, y);
        this.actionBar.setDepth(100);

        // --- MANA DISPLAY (no background box) ---
        const manaContainer = this.scene.add.container(-100, 0);
        this.manaIcon = this.scene.add.image(0, -5, ASSETS.ICON_MANA)
            .setDisplaySize(36, 36).setOrigin(0.5);
        this.manaText = this.scene.add.text(0, 20, '0', {
            font: 'bold 18px Arial', fill: '#44ffff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);
        manaContainer.add([this.manaIcon, this.manaText]);
        this.actionBar.add(manaContainer);

        // --- SEPARATOR ---
        const separator = this.scene.add.rectangle(-50, 0, 2, 45, 0x555555);
        this.actionBar.add(separator);

        // --- SPELL ICONS ---
        this.createSpellIcon(SKILLS.FIREBALL, 10, 0);
        this.createSpellIcon(SKILLS.HEAL, 75, 0);
    }

    createSpellIcon(skillId, x, y) {
        const data = SKILL_DATA[skillId];
        if (!data) return;

        const size = 50;
        const container = this.scene.add.container(x, y);

        // Glow (for Focus buff)
        const glow = this.scene.add.rectangle(0, 0, size + 8, size + 8, 0xaa66ff, 0)
            .setStrokeStyle(3, 0xaa66ff, 0);

        // Background
        const bg = this.scene.add.rectangle(0, 0, size, size, data.color, 0.9)
            .setStrokeStyle(2, 0xffffff, 0.6);
        bg.setInteractive({ useHandCursor: true });

        // Icon (Emoji)
        const icon = this.scene.add.text(0, 0, data.icon, { font: '24px Arial' }).setOrigin(0.5);

        // Mana badge (top-right)
        const badgeX = size / 2 - 10;
        const badgeY = -size / 2 + 10;
        const badge = this.scene.add.circle(badgeX, badgeY, 11, 0x2244aa).setStrokeStyle(2, 0x44aaff);
        const badgeText = this.scene.add.text(badgeX, badgeY, `${data.cost}`, {
            font: 'bold 10px Arial', fill: '#ffffff'
        }).setOrigin(0.5);

        // Disabled overlay
        const disabledOverlay = this.scene.add.rectangle(0, 0, size, size, 0x000000, 0);

        container.add([glow, bg, icon, badge, badgeText, disabledOverlay]);
        this.actionBar.add(container);

        // Interaction
        // Interaction
        bg.on('pointerdown', () => {
            // Reset visual state immediately on click
            bg.setStrokeStyle(2, 0xffffff, 0.6);
            this.scene.tweens.add({ targets: container, scale: 1, duration: 100 });
            this.hideTooltip();

            this.combatManager.tryUseSkill(skillId);
        });

        bg.on('pointerover', () => {
            if (container.getData('enabled')) {
                bg.setStrokeStyle(2, 0xffff00, 1);
                this.scene.tweens.add({ targets: container, scale: 1.1, duration: 100 });
                this.showTooltip(this.actionBar.x + x, this.actionBar.y - 50, `${data.name} (${data.cost} Mana)\n${data.desc}`);
            }
        });

        bg.on('pointerout', () => {
            bg.setStrokeStyle(2, 0xffffff, 0.6);
            this.scene.tweens.add({ targets: container, scale: 1, duration: 100 });
            this.hideTooltip();
        });

        container.setData('enabled', true);
        container.setData('skillId', skillId);
        container.setData('originalColor', data.color);
        this.skillButtons[skillId] = { container, bg, glow, disabledOverlay, icon };
    }

    createTurnControls() {
        const x = this.rightX;
        const y = 550;

        // Moves Counter
        this.movesText = this.scene.add.text(x - 100, y, 'Moves: 3/3', {
            font: '18px Arial', fill: '#ffffff'
        }).setOrigin(1, 0.5).setDepth(100).setResolution(2);

        // End Turn Button
        this.endTurnBtn = this.scene.add.text(x, y, 'END TURN', {
            font: 'bold 18px Arial',
            fill: '#ffffff',
            backgroundColor: '#cc0000',
            padding: { x: 20, y: 12 }
        })
            .setOrigin(0.5)
            .setResolution(2)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.combatManager.endTurn())
            .setDepth(100);

        this.endTurnBtn.on('pointerover', () => this.endTurnBtn.setTint(0xffcccc));
        this.endTurnBtn.on('pointerout', () => this.endTurnBtn.clearTint());
    }

    createHealthBar(x, y, width, height, color, isPlayer = false) {
        const container = this.scene.add.container(x, y);
        container.setDepth(100);

        // Background
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0.5);
        bg.setStrokeStyle(2, 0xffffff);

        // Fill
        const fill = this.scene.add.rectangle(-width / 2 + 2, 0, width - 4, height - 4, color).setOrigin(0, 0.5);

        // --- SHIELD OVERLAY ---
        // Blue outline around bar + icon
        const shieldRect = this.scene.add.rectangle(0, 0, width + 4, height + 4, 0x000000, 0).setOrigin(0.5);
        shieldRect.setStrokeStyle(3, 0x33ccff); // Blue Glow
        shieldRect.setVisible(false);

        // Position shield icon: RIGHT for player, LEFT for enemy
        const shieldX = isPlayer ? (width / 2 + 20) : (-width / 2 - 20);
        const shieldIcon = this.scene.add.image(shieldX, 0, ASSETS.ICON_SHIELD).setDisplaySize(38, 38).setOrigin(0.5);
        shieldIcon.setVisible(false);

        const shieldText = this.scene.add.text(shieldX, 0, '0', {
            font: 'bold 12px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setResolution(2).setVisible(false);

        // --- STATUS LINE ---
        // Below the bar
        const statusContainer = this.scene.add.container(0, height + 10);

        // Text
        const text = this.scene.add.text(0, 0, '', {
            font: 'bold 13px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5).setResolution(2);

        container.add([bg, fill, text, shieldRect, shieldIcon, shieldText, statusContainer]);

        return {
            container, fill, text, maxWidth: width - 4, currentVal: -1,
            shieldRect, shieldIcon, shieldText, statusContainer
        };
    }

    updateHealthBar(bar, current, max, block = 0, statusManager = null) {
        if (!bar) return;

        // Text
        bar.text.setText(`${current}/${max}`);

        // Animation
        if (bar.currentVal !== current) {
            bar.currentVal = current;
            const percent = Math.max(0, Math.min(1, current / max));
            const newWidth = bar.maxWidth * percent;

            this.scene.tweens.add({
                targets: bar.fill,
                width: newWidth,
                duration: 300,
                ease: 'Power2'
            });
        }

        // --- SHIELD OVERLAY ---
        if (block > 0) {
            bar.shieldRect.setVisible(true);
            bar.shieldIcon.setVisible(true);
            bar.shieldText.setVisible(true).setText(`${block}`);
        } else {
            bar.shieldRect.setVisible(false);
            bar.shieldIcon.setVisible(false);
            bar.shieldText.setVisible(false);
        }

        // --- STATUS ICONS ---
        if (bar.statusContainer && statusManager) {
            bar.statusContainer.removeAll(true);

            // Get simplified items { icon, text } from helper
            // We need to adapt getStatusItems to return data, not just text strings if we want custom rendering
            // For now, let's parse the Emoji text or update getStatusItems. 
            // Better: update getStatusItems below to return objects.

            const items = this.getStatusItemsData(statusManager);

            let xPos = -75; // Left align relative to center (width 150 -> -75)
            const yPos = 0;
            const spacing = 35;

            items.forEach(item => {
                // Icon (Emoji or Sprite)
                const icon = this.scene.add.text(xPos, yPos, item.icon, { font: '20px Verdana' }).setOrigin(0, 0.5);
                icon.setInteractive({ useHandCursor: true });

                // Tooltip on hover
                icon.on('pointerover', (pointer) => {
                    this.showTooltip(pointer.x, pointer.y, item.tooltip || item.icon);
                });
                icon.on('pointerout', () => this.hideTooltip());
                icon.on('pointermove', (pointer) => {
                    if (this.tooltipContainer && this.tooltipContainer.visible) {
                        this.tooltipContainer.setPosition(pointer.x, pointer.y - 25);
                    }
                });

                // Counter
                const counter = this.scene.add.text(xPos + 18, yPos + 8, `${item.count}`, {
                    font: 'bold 12px Verdana', fill: '#ffffff', stroke: '#000000', strokeThickness: 3
                }).setOrigin(0.5);

                bar.statusContainer.add([icon, counter]);
                xPos += spacing;
            });
        }
    }

    animateButton(btn) {
        if (!btn || !btn.active || !this.scene) return;
        this.scene.tweens.killTweensOf(btn);
        btn.setScale(1);
        this.scene.tweens.add({
            targets: btn,
            scale: 0.9,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                if (btn && btn.active) btn.setScale(1);
            }
        });
    }

    /**
     * @param {Object} state - { player, enemy, turn, currentMoves, maxMoves }
     */
    updateUI(state) {
        if (!state) return;
        const { player, enemy, turn, currentMoves, maxMoves } = state;
        this.currentTurn = turn;

        // Update TopBar
        EventBus.emit(EVENTS.UI_REFRESH_TOPBAR);

        // --- PLAYER HUD ---
        if (this.playerHPBar) {
            this.updateHealthBar(this.playerHPBar, player.currentHP, player.maxHP, player.block, player.statusManager);
        }

        // --- ENEMY HUD ---
        // Update Sprite if needed (texture switch + sizing)
        if (enemy && enemy.name) {
            const foundId = Object.keys(ENEMIES).find(key => ENEMIES[key].name === enemy.name);
            if (foundId) {
                const data = ENEMIES[foundId];
                const texture = data ? data.texture : null;
                const customScale = (data && data.scale) ? data.scale : 1;
                const yOffset = (data && data.yOffset) ? data.yOffset : 0;
                const xOffset = (data && data.xOffset) ? data.xOffset : 0;

                if (texture && this.scene.textures.exists(texture)) {
                    this.enemySprite.setTexture(texture);
                    this.fitSprite(this.enemySprite, 350, 280, customScale);

                    this.enemySprite.y = this.groundY + yOffset;
                    this.enemySprite.x = this.rightX + xOffset;
                }
            }
        }

        if (this.enemyHPBar) {
            this.updateHealthBar(this.enemyHPBar, enemy.currentHP, enemy.maxHP, enemy.block, enemy.statusManager);
        }

        // --- ENEMY INTENT ---
        if (this.intentContainer && enemy) {
            const intent = enemy.currentIntent;
            if (intent) {
                this.intentContainer.setVisible(true);

                // Update Icon based on type
                let iconKey = ASSETS.ICON_SWORD; // Default: Attack
                let tintColor = 0xff4444; // Red for attack
                let tooltipText = 'Attack';

                if (intent.type === 'DEFEND' || intent.type === 'BLOCK') {
                    iconKey = ASSETS.ICON_SHIELD;
                    tintColor = 0x44aaff; // Blue
                    tooltipText = 'Defend';
                } else if (intent.type === 'BUFF') {
                    iconKey = ASSETS.ICON_SWORD;
                    tintColor = 0xffaa44; // Orange
                    tooltipText = intent.effect || 'Buff';
                } else if (intent.type === 'DEBUFF') {
                    // Specific icons for Lock and Trash - no tint, use icon as-is
                    if (intent.effect === 'LOCK') {
                        iconKey = ASSETS.ICON_LOCK;
                        tintColor = null; // No tint - use original icon colors
                        tooltipText = 'Lock: Locks random gems';
                    } else if (intent.effect === 'TRASH') {
                        iconKey = ASSETS.ICON_TRASH;
                        tintColor = null; // No tint - use original icon colors
                        tooltipText = 'Trash: Turns gems into junk';
                    } else {
                        iconKey = ASSETS.ICON_MANA;
                        tintColor = 0xaa44ff;
                        tooltipText = intent.effect || 'Debuff';
                    }
                } else if (intent.type === 'ATTACK') {
                    tooltipText = `Attack: ${intent.value} damage`;
                }

                this.intentIcon.setTexture(iconKey);
                if (tintColor !== null) {
                    this.intentIcon.setTint(tintColor);
                } else {
                    this.intentIcon.clearTint();
                }

                // Store tooltip text for hover
                this.currentIntentTooltip = tooltipText;

                // Show value if applicable
                if (intent.value !== undefined && intent.value > 0) {
                    this.intentText.setText(`${intent.value}`);
                } else {
                    this.intentText.setText('');
                }
            } else {
                this.intentContainer.setVisible(false);
            }
        }

        // --- ACTION BAR ---
        if (this.actionBar) {
            // Mana
            this.manaText.setText(`${player.mana}`);
            if (player.mana === 0) {
                this.manaIcon.setAlpha(0.5);
                this.manaText.setAlpha(0.5);
            } else {
                this.manaIcon.setAlpha(1);
                this.manaText.setAlpha(1);
                // Check Focus Glow
                const focus = player.statusManager ? player.statusManager.getStack(STATUS_TYPES.FOCUS) : 0;
                if (focus > 0) {
                    // Slight purple tint or glow
                    this.manaIcon.setTint(0xcc99ff);
                } else {
                    this.manaIcon.clearTint();
                }
            }

            // Skill Buttons State
            const canAct = turn === ENTITIES.PLAYER;
            const focus = player.statusManager ? player.statusManager.getStack(STATUS_TYPES.FOCUS) : 0;

            const fireballEnabled = canAct && player.mana >= SKILL_DATA.FIREBALL.cost;
            const healEnabled = canAct && player.mana >= SKILL_DATA.HEAL.cost;

            this.updateSkillButton(SKILLS.FIREBALL, fireballEnabled, focus);
            this.updateSkillButton(SKILLS.HEAL, healEnabled, focus);
        }

        // --- TURN CONTROLS ---
        if (this.movesText) {
            this.movesText.setText(`Moves: ${currentMoves}/${maxMoves}`);
        }
        if (this.endTurnBtn) {
            const canEnd = turn === ENTITIES.PLAYER && (!this.scene.gridView || !this.scene.gridView.isAnimating);
            this.updateEndTurnButton(canEnd);
        }
    }




    /**
     * Updates spell icon visual state based on mana availability.
     * @param {string} id - Skill ID
     * @param {boolean} isEnabled - Whether player can cast this spell
     * @param {number} focusStacks - Current Focus buff stacks (for glow effect)
     */
    updateSkillButton(id, isEnabled, focusStacks = 0) {
        const btn = this.skillButtons[id];
        if (!btn) return;

        btn.container.setData('enabled', isEnabled);

        if (isEnabled) {
            // ACTIVE STATE: Full color, interactive
            btn.container.setAlpha(1);
            btn.bg.setInteractive({ useHandCursor: true });
            // Restore original color
            const origColor = btn.container.getData('originalColor') || 0xff4400;
            btn.bg.setFillStyle(origColor, 0.9);
            btn.disabledOverlay.setAlpha(0);

            // FOCUS GLOW: Pulsing effect when player has Focus buff
            if (focusStacks > 0 && !btn.glowTween) {
                btn.glow.setStrokeStyle(3, 0xaa66ff, 1);
                btn.glowTween = this.scene.tweens.add({
                    targets: btn.glow,
                    alpha: { from: 0.3, to: 1 },
                    duration: 600,
                    yoyo: true,
                    repeat: -1
                });
            } else if (focusStacks === 0 && btn.glowTween) {
                btn.glowTween.stop();
                btn.glowTween = null;
                btn.glow.setStrokeStyle(3, 0xaa66ff, 0);
                btn.glow.setAlpha(1);
            }
        } else {
            // DISABLED STATE: Dim, grayscale, non-interactive
            btn.container.setAlpha(0.5);
            btn.container.setScale(1); // Force reset scale if stuck
            btn.bg.disableInteractive();
            btn.bg.setFillStyle(0x555555, 0.9);
            btn.disabledOverlay.setAlpha(0.3);

            // Stop glow when disabled
            if (btn.glowTween) {
                btn.glowTween.stop();
                btn.glowTween = null;
                btn.glow.setStrokeStyle(3, 0xaa66ff, 0);
            }
        }
    }

    updateEndTurnButton(isEnabled) {
        if (!this.endTurnBtn) return;
        if (isEnabled) {
            this.endTurnBtn.setAlpha(1).setInteractive();
        } else {
            this.endTurnBtn.setAlpha(0.5).disableInteractive();
        }
    }

    showNotification(text, color) {
        this.centerText.setText(text);
        this.centerText.setColor('#' + color.toString(16));
        this.centerText.setVisible(true);
        this.centerText.setScale(0);
        this.centerText.setAlpha(1);

        this.scene.tweens.add({
            targets: this.centerText,
            scale: 1.5,
            duration: 500,
            ease: 'Back.out',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this.centerText,
                    alpha: 0,
                    scale: 2.0,
                    duration: 300,
                    delay: 500, // Hold for 500ms
                    onComplete: () => {
                        this.centerText.setVisible(false);
                    }
                });
            }
        });
    }

    animateAttack(attacker, target, offset, tint = 0xff0000) {
        if (!attacker || !target || !this.scene) return;

        const startX = attacker.x;

        // Lunge Tween
        this.scene.tweens.add({
            targets: attacker,
            x: startX + offset,
            duration: 150,
            yoyo: true,
            ease: 'Power1',
            onYoyo: () => {
                // Impact point - trigger Hit on target
                this.animateHit(target, tint);
            },
            onComplete: () => {
                attacker.x = startX; // Reset safety
            }
        });
    }

    animateHit(target, tint = 0xff0000) {
        if (!target || !this.scene) return;

        // Flash Tint
        if (target.setTint) target.setTint(tint);
        this.scene.time.delayedCall(200, () => {
            target.clearTint();
        });

        // Shake Effect
        this.scene.tweens.add({
            targets: target,
            x: '+=5', // Relative shake
            yoyo: true,
            duration: 50,
            repeat: 3
        });
    }

    animateDefend(target) {
        if (!target || !this.scene) return;

        // Blue Bounce
        const startScaleX = target.scaleX;
        const startScaleY = target.scaleY;

        if (target.setTint) target.setTint(0x4444ff);
        this.scene.tweens.add({
            targets: target,
            scaleY: startScaleY * 0.9,
            scaleX: startScaleX * 1.1,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                target.setScale(startScaleX, startScaleY); // Reset to ORIGINAL
                target.clearTint();
            }
        });
    }

    animateHeal(target) {
        if (!target || !this.scene) return;

        // Green Pulse
        const startScaleX = target.scaleX;
        const startScaleY = target.scaleY;

        if (target.setTint) target.setTint(0x44ff44);
        this.scene.tweens.add({
            targets: target,
            scaleX: startScaleX * 1.2,
            scaleY: startScaleY * 1.2,
            duration: 200,
            yoyo: true,
            onComplete: () => {
                target.setScale(startScaleX, startScaleY);
                target.clearTint();
            }
        });
    }



    // Helper: Scales sprite to fit within maxW/maxH while preserving Aspect Ratio
    fitSprite(sprite, maxW, maxH, customScale = 1) {
        if (!sprite || !sprite.width || !sprite.height) return;

        // Reset scale to 1 first to get true dimensions
        sprite.setScale(1);

        const scaleX = maxW / sprite.width;
        const scaleY = maxH / sprite.height;

        // Scale Down Only: If image is smaller than box, keep it 1:1. Only shrink if too big.
        let finalScale = Math.min(scaleX, scaleY, 1);

        // Apply Manual Override (allows intentionally breaking the safety limits)
        finalScale *= customScale;

        sprite.setScale(finalScale);
    }

    getStatusItemsData(statusManager) {
        if (!statusManager) return [];
        const items = [];

        const bleed = statusManager.getStack(STATUS_TYPES.BLEED);
        if (bleed > 0) items.push({ icon: '🩸', count: bleed, tooltip: 'Bleed: Deals damage at turn start' });

        const regen = statusManager.getStack(STATUS_TYPES.REGEN);
        if (regen > 0) items.push({ icon: '💚', count: regen, tooltip: 'Regen: Heals at turn start' });

        const thorns = statusManager.getStack(STATUS_TYPES.THORNS);
        if (thorns > 0) items.push({ icon: '🌵', count: thorns, tooltip: 'Thorns: Reflects damage to attacker' });

        const focus = statusManager.getStack(STATUS_TYPES.FOCUS);
        if (focus > 0) items.push({ icon: '🔮', count: focus, tooltip: 'Focus: Reduces spell cost (1=50%, 2=free)' });

        const crit = statusManager.getStack(STATUS_TYPES.CRITICAL);
        if (crit > 0) items.push({ icon: '🎯', count: crit, tooltip: 'Critical: Increases critical hit chance' });

        return items;
    }
}
