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

        // Animation Queue Logic
        this.animationQueue = [];
        this.isAnimating = false;

        this.createUI();
        this.bindEvents();
    }

    /**
     * Queues an animation function to be played sequentially.
     * @param {Function} animationTask - Function that accepts a 'done' callback.
     */
    queueAnimation(animationTask) {
        this.animationQueue.push(animationTask);
        this.processQueue();
    }

    processQueue() {
        if (this.isAnimating) return;
        if (this.animationQueue.length === 0) return;

        this.isAnimating = true;
        const nextTask = this.animationQueue.shift();

        // Execute task, passing a callback to signal completion
        nextTask(() => {
            this.isAnimating = false;
            // Small delay between animations for clarity?
            // this.scene.time.delayedCall(50, () => this.processQueue());
            this.processQueue();
        });
    }

    bindEvents() {
        this.updateUIBind = this.updateUI.bind(this);
        this.showNotificationBind = (data) => this.showNotification(data.text, data.color);

        // Store references for cleanup
        // Store references for cleanup
        this.onPlayerAttack = () => {
            this.queueAnimation(done => this.animateAttack(this.heroSprite, this.enemySprite, 50, 0xff0000, done));
        };
        this.onEnemyAttack = (data) => {
            const damage = data ? (data.damage || 0) : 0;
            const tint = damage > 0 ? 0xff0000 : 0x888888; // Red if dmg, Gray if blocked
            this.queueAnimation(done => this.animateAttack(this.enemySprite, this.heroSprite, -50, tint, done));
        };
        this.onPlayerDefend = () => {
            this.queueAnimation(done => this.animateDefend(this.heroSprite, done));
        };
        this.onPlayerHeal = () => {
            this.queueAnimation(done => this.animateHeal(this.heroSprite, done));
        };
        this.onEnemyDefend = () => {
            this.queueAnimation(done => this.animateDefend(this.enemySprite, done));
        };
        this.onEnemyHeal = () => {
            this.queueAnimation(done => this.animateHeal(this.enemySprite, done));
        };

        EventBus.on(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.on(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);
        this.onEnemyLock = (data) => {
            // data contains { value, targets }
            this.queueAnimation(done => this.animateGridLock(done, data.targets));
        };
        this.onEnemyTrash = () => {
            this.queueAnimation(done => this.animateGridShake(done));
        };


        EventBus.on(EVENTS.PLAYER_ATTACK, this.onPlayerAttack);
        EventBus.on(EVENTS.ENEMY_ATTACK, this.onEnemyAttack);
        EventBus.on(EVENTS.PLAYER_DEFEND, this.onPlayerDefend);
        EventBus.on(EVENTS.PLAYER_HEAL, this.onPlayerHeal);
        EventBus.on(EVENTS.ENEMY_DEFEND, this.onEnemyDefend);
        EventBus.on(EVENTS.ENEMY_HEAL, this.onEnemyHeal);
        EventBus.on(EVENTS.ENEMY_LOCK, this.onEnemyLock);
        EventBus.on(EVENTS.ENEMY_TRASH, this.onEnemyTrash);
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
        EventBus.off(EVENTS.ENEMY_LOCK, this.onEnemyLock);
        EventBus.off(EVENTS.ENEMY_TRASH, this.onEnemyTrash);

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
        this.leftX = w * 0.18;  // Player
        this.rightX = w * 0.82; // Enemy (Symmetrical to 0.19)

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

                // Ensure Intent Emoji exists
                if (!this.intentEmoji) {
                    this.intentEmoji = this.scene.add.text(0, -5, '', { fontSize: '48px' }).setOrigin(0.5);
                    this.intentContainer.add(this.intentEmoji);
                    this.intentEmoji.setInteractive({ useHandCursor: true });
                    this.intentEmoji.on('pointerover', () => {
                        if (this.currentIntentTooltip) {
                            this.showTooltip(this.intentContainer.x, this.intentContainer.y - 60, this.currentIntentTooltip);
                        }
                    });
                    this.intentEmoji.on('pointerout', () => this.hideTooltip());
                }

                if (intent.type === 'DEFEND' || intent.type === 'BLOCK') {
                    iconKey = ASSETS.ICON_SHIELD;
                    tintColor = 0x44aaff; // Blue
                    tooltipText = 'Defend';
                    this._showIntentIcon(iconKey, tintColor);
                } else if (intent.type === 'BUFF') {
                    if (intent.effect === 'STRENGTH') {
                        this.intentIcon.setVisible(false);
                        this.intentEmoji.setVisible(true).setText('💪');
                        tooltipText = `Roar: Increases strength by ${intent.value}`;
                    } else {
                        iconKey = ASSETS.ICON_SWORD;
                        tintColor = 0xffaa44; // Orange
                        tooltipText = intent.effect || 'Buff';
                        this._showIntentIcon(iconKey, tintColor);
                    }
                } else if (intent.type === 'DEBUFF') {
                    this._showIntentIcon(iconKey, tintColor); // Reset defaults
                    // Specific icons for Lock and Trash - no tint, use icon as-is
                    if (intent.effect === 'LOCK') {
                        iconKey = ASSETS.ICON_LOCK;
                        tintColor = null; // No tint - use original icon colors
                        tooltipText = 'Lock: Locks random gems';
                        this._showIntentIcon(iconKey, tintColor);
                    } else if (intent.effect === 'TRASH') {
                        iconKey = ASSETS.ICON_TRASH;
                        tintColor = null; // No tint - use original icon colors
                        tooltipText = 'Trash: Turns gems into junk';
                        this._showIntentIcon(iconKey, tintColor);
                    } else {
                        iconKey = ASSETS.ICON_MANA;
                        tintColor = 0xaa44ff;
                        tooltipText = intent.effect || 'Debuff';
                        this._showIntentIcon(iconKey, tintColor);
                    }
                } else {
                    // Attack
                    this._showIntentIcon(ASSETS.ICON_SWORD, 0xff4444);
                }

                // ... text update logic ...

                // Apply Text (with Strength calculation for Attack)
                if (intent.type === 'ATTACK') {
                    const str = enemy.getStrength ? enemy.getStrength() : 0;
                    const val = intent.value + str;
                    tooltipText = `Attack: ${val} damage`;
                    this.intentText.setText(`${val}`);
                } else if (intent.value !== undefined && intent.value > 0) {
                    this.intentText.setText(`${intent.value}`);
                } else {
                    this.intentText.setText('');
                }

                this.currentIntentTooltip = tooltipText;
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

            // RELIC VISUAL: Crimson Hourglass Warning
            // If moves == 1 and relic active, Pulse Red.
            if (currentMoves === 1 && runManager.hasRelic('crimson_hourglass')) {
                // Trigger Warning State (Once)
                if (!this.movesPulse) {
                    this.movesText.setColor('#d80909ff'); // White Core
                    this.movesText.setFont('bold 32px Arial'); // Make it huge and bold
                    this.movesText.setShadow(0, 0, '#000000', 0, false, false); // NO Shadow

                    this.movesPulse = this.scene.tweens.add({
                        targets: this.movesText,
                        scale: { from: 1, to: 1.25 },
                        alpha: { from: 1, to: 0.8 },
                        duration: 1200,
                        yoyo: true,
                        repeat: -1
                    });
                }

                // Active Blood & Mist
                this.manageBloodEffect(true);
                this.manageMistEffect(true);
            } else {
                // Reset State (Once)
                this.manageBloodEffect(false);
                this.manageMistEffect(false); // Stop Mist

                this.movesText.setColor('#ffffff');
                this.movesText.setShadow(0, 0, '#000000', 0, false, false);

                if (this.movesPulse) {
                    this.movesPulse.stop();
                    this.movesPulse = null;

                    this.movesText.setScale(1);
                    this.movesText.setAlpha(1);
                    this.movesText.setFont('24px Arial');
                } else {
                    if (this.movesText.style.fontSize !== '24px') {
                        this.movesText.setFont('24px Arial');
                    }
                }
            }
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

    animateAttack(attacker, target, offset, tint = 0xff0000, onComplete = null) {
        if (!attacker || !this.scene) {
            if (onComplete) onComplete();
            return;
        }

        const startX = attacker.x;

        // Windup
        this.scene.tweens.add({
            targets: attacker,
            x: startX - (offset * 0.5),
            duration: 100,
            yoyo: true,
            ease: 'Power1',
            onComplete: () => {
                // Lunge
                this.scene.tweens.add({
                    targets: attacker,
                    x: startX + offset,
                    duration: 150,
                    yoyo: true, // Go back to start
                    ease: 'Power1',
                    onYoyo: () => {
                        // Impact point - trigger Hit on target
                        this.animateHit(target, tint);
                    },
                    onComplete: () => {
                        attacker.x = startX; // Reset safety
                        if (onComplete) onComplete();
                    }
                });
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

    animateDefend(target, onComplete = null) {
        if (!target || !this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. CREATE SHIELD CIRCLE (FORCEFIELD)
        const shieldCircle = this.scene.add.graphics();
        shieldCircle.blendMode = Phaser.BlendModes.ADD;
        shieldCircle.setDepth(target.depth + 1);

        shieldCircle.lineStyle(7, 0x00ffff, 1);
        shieldCircle.strokeCircle(0, 0, 70);

        shieldCircle.x = target.x;
        shieldCircle.y = target.getCenter().y;
        shieldCircle.setScale(0.5);

        // 2. EXPANSION ANIMATION (Shockwave)
        this.scene.tweens.add({
            targets: shieldCircle,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 400,
            ease: 'Quad.Out',
            onComplete: () => {
                shieldCircle.destroy();
            }
        });

        // 3. CHARACTER "POWER UP" ANIMATION
        if (target.setTint) target.setTint(0x88ccff);

        this.scene.tweens.add({
            targets: target,
            scaleX: target.scaleX * 1.15,
            scaleY: target.scaleY * 1.15,
            duration: 150,
            yoyo: true,
            ease: 'Sine.InOut',
            onComplete: () => {
                if (target.clearTint) target.clearTint();
                if (onComplete) onComplete(); // Signal DONE
            }
        });
    }

    animateHeal(target, onComplete = null) {
        if (!target || !this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. VISUAL EFFECT: RISING BUBBLES
        const particles = this.scene.add.graphics();
        particles.setDepth(target.depth + 1);
        particles.blendMode = Phaser.BlendModes.ADD; // Make them glow!
        particles.fillStyle(0x44ff44, 1);

        // Use display dimensions for accurate positioning regardless of scaling
        const w = target.displayWidth || target.width;
        // const h = target.displayHeight || target.height; 

        // Draw 5-8 random bubbles
        for (let i = 0; i < 8; i++) {
            // Spread horizontally around center
            const offsetX = (Math.random() - 0.5) * w * 0.6;
            // Spread vertically slightly (start/stagger)
            const offsetY = (Math.random() * -30);

            const radius = 2 + Math.random() * 5;

            particles.fillCircle(offsetX, offsetY, radius);
        }

        // Set initial position at target's feet (assuming Origin is 0.5, 1)
        // If Origin is Center, we would need target.y + h/2.
        // But for CombatView entities usually OriginY=1 (Feet).
        particles.x = target.x;
        particles.y = target.y - 10; // Start slightly above effective "ground"

        // Animate Floating Up
        this.scene.tweens.add({
            targets: particles,
            y: particles.y - 100, // Float up higher
            alpha: 0,
            scaleX: 0.5, // Shrink
            scaleY: 0.5,
            duration: 1000,
            ease: 'Sine.Out',
            onComplete: () => {
                particles.destroy();
            }
        });

        // 2. CHARACTER PULSE
        const startScaleX = target.scaleX;
        const startScaleY = target.scaleY;

        if (target.setTint) target.setTint(0x44ff44);

        this.scene.tweens.add({
            targets: target,
            scaleX: startScaleX * 1.05,
            scaleY: startScaleY * 1.05,
            duration: 300,
            yoyo: true,
            ease: 'Sine.InOut',
            onComplete: () => {
                target.setScale(startScaleX, startScaleY);
                if (target.clearTint) target.clearTint();
                if (onComplete) onComplete();
            }
        });
    }

    animateGridShake(onComplete = null) {
        if (!this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 0. Enemy Lunge Animation (Visual Feedback that Enemy is doing it)
        const enemy = this.enemySprite;
        const startX = enemy.x;

        // Move forward slightly
        this.scene.tweens.add({
            targets: enemy,
            x: startX - 50, // Move left (towards grid center usually)
            duration: 200,
            yoyo: true,
            ease: 'Power1',
            onYoyo: () => {
                // TRIGGER EFFECT AT IMPACT POINT

                // 1. Grid Shake (Target the Grid Container directly)
                // Assuming GridView is exposed on scene
                if (window.grid && this.scene.gridView && this.scene.gridView.container) {
                    const gridCont = this.scene.gridView.container;
                    const originalX = gridCont.x;

                    this.scene.tweens.add({
                        targets: gridCont,
                        x: '+=10',
                        duration: 50,
                        yoyo: true,
                        repeat: 5,
                        onComplete: () => {
                            gridCont.x = originalX; // Reset safety
                        }
                    });
                } else {
                    // Fallback if container not found: Shake Camera slightly
                    this.scene.cameras.main.shake(200, 0.005);
                }

                // 2. Dust/Smoke Effect
                const cx = this.scene.scale.width / 2;
                const cy = this.scene.scale.height / 2;

                const dust = this.scene.add.graphics();
                dust.setDepth(200);
                dust.fillStyle(0x8855aa, 0.6);

                for (let i = 0; i < 10; i++) {
                    const r = 5 + Math.random() * 10;
                    const ox = (Math.random() - 0.5) * 300;
                    const oy = (Math.random() - 0.5) * 300;
                    dust.fillCircle(ox, oy, r);
                }
                dust.x = cx;
                dust.y = cy;
                dust.setScale(0);

                this.scene.tweens.add({
                    targets: dust,
                    scaleX: 1.5,
                    scaleY: 1.5,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        dust.destroy();
                    }
                });
            },
            onComplete: () => {
                enemy.x = startX; // Reset Position
                if (onComplete) onComplete();
            }
        });
    }

    animateGridLock(onComplete = null, targets = []) {
        if (!this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. Hide Grid Overlays IMMEDIATELY (so they don't appear before projectile lands)
        // We track which overlays we hid to reveal them later on impact.
        const targetOverlays = {};
        if (this.scene.gridView && this.scene.gridView.overlays && targets) {
            targets.forEach(t => {
                if (t.id && this.scene.gridView.overlays[t.id]) {
                    const sprite = this.scene.gridView.overlays[t.id];
                    sprite.setAlpha(0);
                    targetOverlays[t.id] = sprite;
                }
            });
        }

        // 2. Enemy Lunge Animation
        const enemy = this.enemySprite;
        const startX = enemy.x;
        const startY = enemy.y - (enemy.height * 0.5); // Chest height

        this.scene.tweens.add({
            targets: enemy,
            x: startX - 50,
            duration: 200,
            yoyo: true,
            ease: 'Power1',
            onYoyo: () => {
                // SPAWN PROJECTILES (LOCKS)
                // Use actual targets or fallback to random count if missing (safeguard)
                const lockCount = (targets && targets.length > 0) ? targets.length : 3;

                // Grid Metrics for targeting
                let getTargetPos;
                if (this.scene.gridView && window.grid) {
                    const gv = this.scene.gridView;
                    // Center of tile logic from GridView
                    getTargetPos = (r, c) => {
                        return {
                            x: gv.offsetX + c * gv.tileSize,
                            y: gv.offsetY + r * gv.tileSize
                        };
                    };
                } else {
                    // Fallback (Random)
                    const gridCenterX = this.scene.scale.width * 0.5;
                    const gridCenterY = this.scene.scale.height * 0.6;
                    getTargetPos = () => ({
                        x: gridCenterX + (Math.random() - 0.5) * 300,
                        y: gridCenterY + (Math.random() - 0.5) * 300
                    });
                }

                for (let i = 0; i < lockCount; i++) {
                    // 1. Create Lock Sprite/Image
                    // Use ASSETS.ICON_LOCK if available, else text or shape
                    let lock;
                    if (this.scene.textures.exists(ASSETS.ICON_LOCK)) {
                        lock = this.scene.add.image(enemy.x - 20, startY, ASSETS.ICON_LOCK);
                        lock.setDisplaySize(40, 40); // Reasonable icon size
                    } else {
                        // Text Fallback (🔒)
                        lock = this.scene.add.text(enemy.x - 20, startY, '🔒', { fontSize: '32px' }).setOrigin(0.5);
                    }
                    lock.setDepth(500); // Very high
                    lock.scale = 0;

                    // 2. Determine Target
                    let tx, ty;
                    let currentTargetId = null;

                    if (targets && targets[i]) {
                        const t = targets[i];
                        const pos = getTargetPos(t.r, t.c);
                        tx = pos.x;
                        ty = pos.y;
                        currentTargetId = t.id;
                    } else {
                        const pos = getTargetPos();
                        tx = pos.x;
                        ty = pos.y;
                    }

                    // Timeline replacement: Nested Tweens
                    // 1. Pop In
                    this.scene.tweens.add({
                        targets: lock,
                        scale: 1,
                        duration: 100,
                        delay: i * 50, // Stagger
                        onComplete: () => {
                            // 2. Fly to Target
                            this.scene.tweens.add({
                                targets: lock,
                                x: tx,
                                y: ty,
                                rotation: Math.PI * 2,
                                duration: 400, // Fast
                                ease: 'Quad.Out',
                                onComplete: () => {
                                    // IMPACT VISUAL
                                    // REVEAL GRID OVERLAY
                                    if (currentTargetId && targetOverlays[currentTargetId]) {
                                        const overlay = targetOverlays[currentTargetId];
                                        overlay.setAlpha(1);
                                        // Optional: Shake/Pop the overlay itself
                                        this.scene.tweens.add({
                                            targets: overlay,
                                            scaleX: 1.2,
                                            scaleY: 1.2,
                                            yoyo: true,
                                            duration: 100
                                        });
                                    }

                                    // Small Shake of the lock itself before disappearing
                                    this.scene.tweens.add({
                                        targets: lock,
                                        scale: 1.5,
                                        alpha: 0,
                                        duration: 300,
                                        onComplete: () => {
                                            lock.destroy();
                                        }
                                    });
                                }
                            });
                        }
                    });
                }

                // Wait for longest flight
                this.scene.time.delayedCall(1000, () => {
                    if (onComplete) onComplete();
                });
            },
            onComplete: () => {
                enemy.x = startX;
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

        const str = statusManager.getStack(STATUS_TYPES.STRENGTH);
        if (str > 0) items.push({ icon: '💪', count: str, tooltip: 'Strength: Increases damage by stack amount' });

        return items;
    }

    _showIntentIcon(key, tint) {
        if (this.intentEmoji) this.intentEmoji.setVisible(false);
        this.intentIcon.setVisible(true).setTexture(key);
        if (tint !== null) this.intentIcon.setTint(tint);
        else this.intentIcon.clearTint();
    }

    // --- BLOOD EFFECT (Crimson Hourglass) ---
    manageBloodEffect(active) {
        if (active) {
            if (!this.bloodTimer) {
                // Spawn a drop every 100-300ms
                this.bloodTimer = this.scene.time.addEvent({
                    delay: 150,
                    callback: this.spawnBloodDrop,
                    callbackScope: this,
                    loop: true
                });
                // Initial burst
                for (let i = 0; i < 3; i++) this.spawnBloodDrop();
            }
        } else {
            if (this.bloodTimer) {
                this.bloodTimer.remove();
                this.bloodTimer = null;
            }
        }
    }

    spawnBloodDrop() {
        if (!this.movesText || !this.movesText.visible) return;

        // Get bounds of the text
        const bounds = this.movesText.getBounds();

        // Random layout within text width
        const x = bounds.x + Math.random() * bounds.width;
        const y = bounds.y + bounds.height * 0.6; // Start slightly near bottom of text

        const drop = this.scene.add.circle(x, y, 4, 0xaa0000); // Dark Red
        drop.setDepth(150);

        // Physics-ish animation
        this.scene.tweens.add({
            targets: drop,
            y: y + 40 + Math.random() * 40, // Fall down 40-80px
            scaleX: { from: 1, to: 0.5 }, // Thin out
            scaleY: { from: 1, to: 1.5 }, // Stretch
            alpha: { from: 1, to: 0 },
            duration: 800 + Math.random() * 400,
            onComplete: () => drop.destroy()
        });
    }

    // --- MIST BACKDROP (Replacing Shadow) ---
    createMistTexture() {
        if (this.scene.textures.exists('red_mist_glow')) return;

        const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        // Draw a soft radial gradient using concentric circles
        // Center 64,64, Radius 64
        for (let r = 64; r > 0; r -= 2) {
            const alpha = 0.05 * (1 - (r / 64)); // Very low alpha stacking up
            graphics.fillStyle(0xff0000, alpha);
            graphics.fillCircle(64, 64, r);
        }
        graphics.generateTexture('red_mist_glow', 128, 128);
    }

    manageMistEffect(active) {
        if (active) {
            this.createMistTexture(); // Ensure texture exists

            if (!this.mistSprite) {
                // Create the sprite behind the text
                // movesText origin is (1, 0.5), so 'x' is the right edge.
                // Center X = x - width / 2
                // Center Y = y
                const x = this.movesText.x - this.movesText.width / 2;
                const y = this.movesText.y;

                this.mistSprite = this.scene.add.image(x, y, 'red_mist_glow');
                this.mistSprite.setDepth(this.movesText.depth - 1); // Behind text
                this.mistSprite.setAlpha(0);
                this.mistSprite.setBlendMode(Phaser.BlendModes.ADD); // Glowy look

                // Breathe Animation
                this.scene.tweens.add({
                    targets: this.mistSprite,
                    scale: { from: 2.0, to: 2.5 },
                    alpha: { from: 0.4, to: 0.7 },
                    duration: 1200,
                    yoyo: true,
                    repeat: -1
                });
            } else {
                // Ensure position updates if text moves (unlikely but safe)
                this.mistSprite.x = this.movesText.x - this.movesText.width / 2;
                this.mistSprite.y = this.movesText.y;
                this.mistSprite.setVisible(true);
            }
        } else {
            if (this.mistSprite) {
                this.mistSprite.destroy();
                this.mistSprite = null;
            }
        }
    }
}
