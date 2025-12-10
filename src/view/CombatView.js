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

        // Store references for cleanup
        this.onPlayerAttack = () => this.animateAttack(this.heroSprite, this.enemySprite, 50);
        this.onEnemyAttack = (data) => {
            const damage = data ? (data.damage || 0) : 0;
            const tint = damage > 0 ? 0xff0000 : 0x888888;
            this.animateAttack(this.enemySprite, this.heroSprite, -50, tint);
        };
        this.onPlayerDefend = () => this.animateDefend(this.heroSprite);
        this.onPlayerHeal = () => this.animateHeal(this.heroSprite);
        this.onEnemyDefend = () => this.animateDefend(this.enemySprite);
        this.onEnemyHeal = () => this.animateHeal(this.enemySprite);

        EventBus.on(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.on(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);
        EventBus.on(EVENTS.PLAYER_ATTACK, this.onPlayerAttack);
        EventBus.on(EVENTS.ENEMY_ATTACK, this.onEnemyAttack);
        EventBus.on(EVENTS.PLAYER_DEFEND, this.onPlayerDefend);
        EventBus.on(EVENTS.PLAYER_HEAL, this.onPlayerHeal);
        EventBus.on(EVENTS.ENEMY_DEFEND, this.onEnemyDefend);
        EventBus.on(EVENTS.ENEMY_HEAL, this.onEnemyHeal);
    }

    destroy() {
        // 1. Unbind Events
        EventBus.off(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.off(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);
        EventBus.off(EVENTS.PLAYER_ATTACK, this.onPlayerAttack);
        EventBus.off(EVENTS.ENEMY_ATTACK, this.onEnemyAttack);
        EventBus.off(EVENTS.PLAYER_DEFEND, this.onPlayerDefend);
        EventBus.off(EVENTS.PLAYER_HEAL, this.onPlayerHeal);
        EventBus.off(EVENTS.ENEMY_DEFEND, this.onEnemyDefend);
        EventBus.off(EVENTS.ENEMY_HEAL, this.onEnemyHeal);

        // 2. Destroy UI Elements
        if (this.centerText) this.centerText.destroy();
        if (this.endTurnBtn) this.endTurnBtn.destroy();
        if (this.heroSprite) this.heroSprite.destroy();
        if (this.enemySprite) this.enemySprite.destroy();
        if (this.actionBar) this.actionBar.destroy();
        if (this.tooltipContainer) this.tooltipContainer.destroy();
        if (this.intentContainer) this.intentContainer.destroy();
        if (this.movesText) this.movesText.destroy();

        // HP Bars (Complex objects)
        if (this.playerHPBar) this.playerHPBar.container.destroy();
        if (this.enemyHPBar) this.enemyHPBar.container.destroy();

        this.skillButtons = {};
    }

    createUI() {
        // Layout Constants (Dynamic 1080p)
        const w = this.scene.scale.width;
        const h = this.scene.scale.height;
        const centerX = w * 0.5;
        const centerY = h * 0.5;

        // Ground/Entity Level (Approx 70% down)
        this.groundY = h * 0.72;

        // Entity Positions
        this.leftX = w * 0.19;  // Player
        this.rightX = w * 0.8; // Enemy

        // 1. Entities & HUD (HP, Shield, Status)
        this.createEntityDisplay(true);  // Player
        this.createEntityDisplay(false); // Enemy

        // 2. Action Bar (Mana + Skills) - Bottom Center
        this.createActionBar(centerX, h * 0.85);

        // 3. Turn Controls (Moves + End Turn) - Bottom Right
        this.createTurnControls(w * 0.9, h * 0.85);

        // Center Notification
        this.centerText = this.scene.add.text(centerX, centerY, '', {
            font: 'bold 60px Arial', // Larger font for 1080p
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

        this.tooltipText.setStyle({
            font: '22px Arial', // Slightly larger font (was 24px)
            fill: '#ffffff',
            wordWrap: { width: 450 } // Slightly wider wrap
        });
        this.tooltipText.setText(text);

        // Resize background to fit text
        const padding = 9; // Slightly increased padding (was 20/Custom)
        const w = Math.max(180, this.tooltipText.width + padding * 2);
        const h = this.tooltipText.height + padding * 2;
        this.tooltipBg.setSize(w, h);


        // Position (offset up-left from cursor)
        this.tooltipContainer.setPosition(x, y - 50); // Slightly more offset
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

        // 1. Sprite
        let sprite;
        const maxDim = 410; // Increased sprite size (was 300/350)

        if (isPlayer) {
            if (this.scene.textures.exists(ASSETS.HERO)) {
                sprite = this.scene.add.image(x, this.groundY, ASSETS.HERO);
                sprite.setOrigin(0.5, 1);
                this.fitSprite(sprite, maxDim, maxDim, config.scale || 1);
                sprite.y += (config.yOffset || 0);
                sprite.x += (config.xOffset || 0);
            } else {
                sprite = this.scene.add.rectangle(x, this.groundY - 50, 100, 100, 0x6666ff);
            }
            this.heroSprite = sprite;
        } else {
            sprite = this.scene.add.sprite(x, this.groundY, ASSETS.ENEMY_PLACEHOLDER);
            sprite.setOrigin(0.5, 1);
            this.fitSprite(sprite, maxDim, maxDim);
            this.enemySprite = sprite;

            // --- INTENT DISPLAY (Above Enemy Head) ---
            // Calculate top of sprite approx
            const spriteTop = this.groundY - (sprite.displayHeight || 200);
            const intentY = spriteTop - 10; // Moved UP above the head (was +90 overlapping)

            this.intentContainer = this.scene.add.container(x, intentY);
            this.intentContainer.setDepth(150);

            // Icon (Larger)
            this.intentIcon = this.scene.add.image(0, 0, ASSETS.ICON_SWORD).setDisplaySize(48, 48).setOrigin(0.5);
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
            this.intentText = this.scene.add.text(28, 0, '', {
                font: 'bold 24px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
            }).setOrigin(0, 0.5).setResolution(2);

            this.intentContainer.add([this.intentIcon, this.intentText]);
        }
        sprite.setDepth(100);

        // 2. HP Bar & Overlay (Moved BELOW sprite)
        // groundY is where feet are. Move down by ~20px padding.
        const barY = this.groundY + 30;
        const barObj = this.createHealthBar(x, barY, 250, 30, 0xff4444, isPlayer); // Even larger bars

        if (isPlayer) this.playerHPBar = barObj;
        else this.enemyHPBar = barObj;
    }

    createActionBar(x, y) {
        // Position: Align Left with Grid
        // Grid is approx 600px wide centered at screen width/2 (960). 
        // Left edge ~= 960 - 300 = 660.
        // We want the Mana Crystal (which is at -40 relative) to start roughly there.
        // So Container X = 660 + 50 = 710.

        const gridLeftX = this.scene.scale.width / 2 - 320; // Approx left edge of grid frame
        const bottomY = this.scene.scale.height - 140; // Lowered (was -150)

        this.actionBar = this.scene.add.container(gridLeftX, bottomY);
        this.actionBar.setDepth(100);

        // Mana
        // Mana (Text centered ON the crystal)
        if (this.scene.textures.exists(ASSETS.ICON_MANA)) {
            this.manaIcon = this.scene.add.image(-40, 0, ASSETS.ICON_MANA).setDisplaySize(80, 80).setOrigin(0.5);
        } else {
            this.manaIcon = this.scene.add.text(-40, 0, '💎', { fontSize: '64px' }).setOrigin(0.5);
        }

        this.manaText = this.scene.add.text(-40, 0, '0', {
            font: 'bold 32px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.actionBar.add([this.manaIcon, this.manaText]);

        // --- SPELL ICONS ---
        // Increased spacing and size
        this.createSpellIcon(SKILLS.FIREBALL, 80, 0); // Shifted right
        this.createSpellIcon(SKILLS.HEAL, 250, 0); // Spaced out more for 130px size
    }







    createTurnControls(x, y) {


        // Moves Counter
        this.movesText = this.scene.add.text(x - 140, y, 'Moves: 3/3', {
            font: '24px Arial', fill: '#ffffff' // Larger Font
        }).setOrigin(1, 0.5).setDepth(100).setResolution(2);

        // End Turn Button
        this.endTurnBtn = this.scene.add.text(x, y, 'END TURN', {
            font: 'bold 24px Arial', // Larger Font
            fill: '#ffffff',
            backgroundColor: '#cc0000',
            padding: { x: 30, y: 16 } // Larger Padding
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
        const shieldX = isPlayer ? (width / 2 + 25) : (-width / 2 - 25);
        const shieldIcon = this.scene.add.image(shieldX, 0, ASSETS.ICON_SHIELD).setDisplaySize(48, 48).setOrigin(0.5);
        shieldIcon.setVisible(false);

        const shieldText = this.scene.add.text(shieldX, 0, '0', {
            font: 'bold 20px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setResolution(2).setVisible(false);

        // --- STATUS LINE ---
        // Below the bar
        const statusContainer = this.scene.add.container(0, height + 10);

        // Text
        // Text
        const text = this.scene.add.text(0, 0, '', {
            font: 'bold 20px Arial', // Larger Font for HP
            fill: '#ffffff',
            stroke: '#000000', strokeThickness: 3
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

            let xPos = -130; // Left align relative to center (width increased)
            const yPos = 5;
            const spacing = 50; // Increased Status Spacing

            items.forEach(item => {
                // Icon (Emoji or Sprite)
                const icon = this.scene.add.text(xPos, yPos, item.icon, { font: '28px Verdana' }).setOrigin(0, 0.5);
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
                    font: 'bold 16px Verdana', fill: '#ffffff', stroke: '#000000', strokeThickness: 3
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

            const getRealCost = (baseCost) => {
                if (focus >= 2) return 0;
                if (focus === 1) return Math.floor(baseCost * 0.5);
                return baseCost;
            };

            const fireballCost = getRealCost(SKILL_DATA.FIREBALL.cost);
            const healCost = getRealCost(SKILL_DATA.HEAL.cost);

            const fireballEnabled = canAct && player.mana >= fireballCost;
            const healEnabled = canAct && player.mana >= healCost;

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

        // --- GLOBAL CALCULATION (Run first) ---
        // Calculate Discounted Cost
        const baseCost = SKILL_DATA[id].cost;
        let finalCost = baseCost;
        let isDiscounted = false;

        if (focusStacks === 1) {
            finalCost = Math.floor(baseCost * 0.5);
            isDiscounted = true;
        } else if (focusStacks >= 2) {
            finalCost = 0;
            isDiscounted = true;
        }

        btn.container.setData('enabled', isEnabled);

        if (isEnabled) {
            // ACTIVE STATE: Full color, interactive
            btn.container.setAlpha(1);
            btn.container.setScale(1);
            btn.bg.setInteractive({ useHandCursor: true });

            // Restore Original Look
            btn.icon.setTint(0xffffff); // Clear tint
            btn.disabledOverlay.setAlpha(0);

            // FOCUS VISUALS: Pulse specific elements (Badge + Text)
            if (isDiscounted) {
                // Green Text for discount
                btn.badgeText.setColor('#00ff00');

                if (!btn.pulseTween) {
                    btn.pulseTween = this.scene.tweens.add({
                        targets: [btn.badge, btn.badgeText],
                        scale: { from: 1, to: 1.3 },
                        duration: 600,
                        yoyo: true,
                        repeat: -1
                    });
                }
            } else {
                // Normal Text
                btn.badgeText.setColor('#ffffff');

                if (btn.pulseTween) {
                    btn.pulseTween.stop();
                    btn.pulseTween = null;
                    btn.badge.setScale(1); // Reset scale using direct reference since display size was set
                    btn.badge.setDisplaySize(24, 24); // Reset to original display size
                    btn.badgeText.setScale(1);
                }
            }
        } else {
            // DISABLED STATE: Grayscale/Darkened, non-interactive
            btn.container.setAlpha(1); // Keep container visible, just dim content
            btn.container.setScale(1);
            btn.bg.disableInteractive();

            // Dim and Grayscale Effect
            btn.icon.setTint(0x555555);
            btn.disabledOverlay.setAlpha(0); // Overlay not needed if we tint icon directly

            // Stop pulse when disabled
            if (btn.pulseTween) {
                btn.pulseTween.stop();
                btn.pulseTween = null;
                btn.badge.setDisplaySize(24, 24); // Reset to original display size
                btn.badgeText.setScale(1);
            }
        }

        // Update Badge Text
        btn.badgeText.setText(`${finalCost}`);

        // Update Text Color based on discount status (even if disabled, show "price")
        if (isDiscounted) {
            btn.badgeText.setColor('#00ff00');
        } else {
            btn.badgeText.setColor('#ffffff');
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

    createSpellIcon(skillId, x, y) {
        const data = SKILL_DATA[skillId];
        if (!data) return;

        const size = 130; // Increased size (Requested "trochu zvětšit")
        const container = this.scene.add.container(x, y);

        // Background (Transparent - NO BORDER)
        const bg = this.scene.add.rectangle(0, 0, size, size, 0x000000, 0.01);
        bg.setInteractive({ useHandCursor: true });

        // Icon
        let icon;
        if (this.scene.textures.exists(data.icon)) {
            icon = this.scene.add.image(0, 0, data.icon).setDisplaySize(120, 120); // Larger icon
        } else {
            icon = this.scene.add.text(0, 0, data.icon || '?', { fontSize: '72px' }).setOrigin(0.5);
        }

        const disabledOverlay = this.scene.add.rectangle(0, 0, size, size, 0x000000, 0.6);
        disabledOverlay.setAlpha(0);

        // --- MANA COST (Top-Right Crystal) ---
        const badgeX = size / 2 - 15;
        const badgeY = -size / 2 + 15;

        // Crystal Icon
        const badge = this.scene.add.image(badgeX, badgeY, ASSETS.ICON_MANA)
            .setDisplaySize(40, 40).setOrigin(0.5); // Larger badge

        // Cost Number
        const badgeText = this.scene.add.text(badgeX, badgeY, `${data.cost}`, {
            font: 'bold 22px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        container.add([bg, icon, disabledOverlay, badge, badgeText]);

        if (this.actionBar) {
            this.actionBar.add(container);
        }

        // Tooltip
        bg.on('pointerover', () => {
            this.scene.tweens.add({ targets: container, scale: 1.1, duration: 100 });
            const worldMatrix = container.getWorldTransformMatrix();
            this.showTooltip(worldMatrix.tx, worldMatrix.ty - 80, `${data.name} (${data.cost} Mana)\n${data.desc}`);
        });

        // FIX: Hover Out Animation
        bg.on('pointerout', () => {
            this.scene.tweens.add({ targets: container, scale: 1, duration: 100 });
            this.hideTooltip();
        });

        // Click
        bg.on('pointerdown', () => {
            this.scene.tweens.add({ targets: container, scale: 0.9, duration: 50, yoyo: true });
            this.combatManager.tryUseSkill(skillId);
            this.hideTooltip();
        });

        container.setData('skillId', skillId);
        container.setData('originalColor', data.color);
        this.skillButtons[skillId] = { container, bg, disabledOverlay, icon, badge, badgeText };
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

        const vuln = statusManager.getStack(STATUS_TYPES.VULNERABLE);
        if (vuln > 0) items.push({ icon: '☠️', count: vuln, tooltip: 'Vulnerable: Takes 25% extra damage' });

        return items;
    }
}
