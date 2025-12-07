/**
 * @file CombatView.js
 * @description Manages all UI/Visuals for combat (Observer Pattern). Decoupled from logic.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, ASSETS, SKILLS, ENTITIES } from '../core/Constants.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';

export class CombatView {
    constructor(scene, combatManager) {
        this.scene = scene;
        this.combatManager = combatManager; // Command Pattern: Only for invoking actions!

        this.playerUI = null;
        this.enemyUI = null;
        this.centerText = null;
        this.skillButtons = {};
        this.endTurnBtn = null;
        this.heroSprite = null;
        this.enemySprite = null;

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

        if (this.playerUI) this.playerUI.destroy();
        if (this.enemyUI) this.enemyUI.destroy();
        if (this.centerText) this.centerText.destroy();
        if (this.endTurnBtn) this.endTurnBtn.destroy();
        if (this.heroSprite) this.heroSprite.destroy();
        if (this.enemySprite) this.enemySprite.destroy();

        Object.values(this.skillButtons).forEach(btn => {
            if (btn.container) btn.container.destroy();
        });
    }

    createUI() {
        // --- Refined Slay The Spire Layout ---
        // TopBar: 40px. Playable: 560px. Mid Y: 320.
        // Grid: 626, 320 -> 300. Bounds Y: 80 to 520.

        // Entities Y (Lower Mid - "Standing" feel)
        // Entities Y (Lower Mid - "Standing" feel)
        const ENTITY_Y = 360;
        const HP_BAR_Y = 445;
        const STATS_Y = 470;

        // Left Flank (Player) - Centered in left space (0-406) -> X=200
        const LEFT_X = 200;

        // 1. Hero Sprite
        if (this.scene.textures.exists(ASSETS.HERO)) {
            this.heroSprite = this.scene.add.image(LEFT_X, ENTITY_Y, ASSETS.HERO);
            this.heroSprite.setDisplaySize(150, 150);
            this.heroSprite.setDepth(100);
        } else {
            this.heroSprite = this.scene.add.rectangle(LEFT_X, ENTITY_Y, 100, 100, 0x6666ff).setDepth(100);
        }

        // 2. Player Stats
        // HP Bar
        this.playerHPBar = this.createHealthBar(LEFT_X, HP_BAR_Y, 150, 20, 0xff4444);

        // Other Stats (Container for Sprites + Text)
        this.playerUI = this.scene.add.container(LEFT_X, STATS_Y);
        this.playerUI.setDepth(100);

        // Right Flank (Enemy) - Centered in right space (846-1252) -> X=1050
        const RIGHT_X = 1050;

        // 3. Enemy Sprite
        this.enemySprite = this.scene.add.sprite(RIGHT_X, ENTITY_Y, ASSETS.ENEMY_PLACEHOLDER);
        this.enemySprite.setDisplaySize(150, 150);
        this.enemySprite.setDepth(100);
        this.enemySprite.setFlipX(false);

        // 4. Enemy Stats
        // Name (Above Sprite)
        // Name (Above Sprite)
        this.enemyName = this.scene.add.text(RIGHT_X, ENTITY_Y - 90, '', {
            font: 'bold 13px Verdana',
            fill: '#aaaaaa', // Greyish, less prominent
            align: 'center'
        }).setOrigin(0.5).setResolution(2);

        // HP Bar
        this.enemyHPBar = this.createHealthBar(RIGHT_X, HP_BAR_Y, 150, 20, 0xff4444);

        this.enemyUI = this.scene.add.container(RIGHT_X, STATS_Y);
        this.enemyUI.setDepth(100);

        // Center Notification
        this.centerText = this.scene.add.text(626, 300, '', {
            font: 'bold 40px Verdana',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setDepth(200).setVisible(false).setResolution(2);

        // Skills (Compact Row UNDER Grid)
        // Grid Bottom = 520. Place buttons at Y=560.
        const SKILL_CENTER_X = 626;
        const SKILL_Y = 560;
        const SKILL_SPACING = 170;

        this.createCompactSkillButton(0, SKILLS.FIREBALL, '🔥 Fireball', 0xff4400, SKILL_CENTER_X - (SKILL_SPACING / 2), SKILL_Y, () => this.combatManager.tryUseSkill(SKILLS.FIREBALL));
        this.createCompactSkillButton(1, SKILLS.HEAL, '💚 Heal', 0x00cc44, SKILL_CENTER_X + (SKILL_SPACING / 2), SKILL_Y, () => this.combatManager.tryUseSkill(SKILLS.HEAL));

        // End Turn Button (Right Side, below entity)
        this.endTurnBtn = this.scene.add.text(RIGHT_X, 550, 'END TURN', {
            font: 'bold 18px Verdana',
            fill: '#ffffff',
            backgroundColor: '#cc0000',
            padding: { x: 20, y: 12 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.endTurnBtn && this.endTurnBtn.active) {
                    this.animateButton(this.endTurnBtn);
                    this.combatManager.endTurn();
                }
            })
            .setDepth(100);

        this.endTurnBtn.on('pointerover', () => this.endTurnBtn.setTint(0xffcccc));
        this.endTurnBtn.on('pointerout', () => this.endTurnBtn.clearTint());
    }

    createHealthBar(x, y, width, height, color) {
        const container = this.scene.add.container(x, y);
        container.setDepth(100);

        // Background
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0.5);
        bg.setStrokeStyle(2, 0xffffff);

        // Fill (Left Anchored inside container)
        // Container 0,0 is center. Left edge is -width/2.
        const fill = this.scene.add.rectangle(-width / 2 + 2, 0, width - 4, height - 4, color).setOrigin(0, 0.5);

        // Text
        const text = this.scene.add.text(0, 0, '', {
            font: 'bold 13px Verdana',
            fill: '#ffffff'
        }).setOrigin(0.5).setResolution(2);

        container.add([bg, fill, text]);

        return { container, fill, text, maxWidth: width - 4, currentVal: -1 };
    }

    updateHealthBar(bar, current, max) {
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

            // Color feedback?
            // If healing vs damage?
            // Could tint flash.
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

    createCompactSkillButton(index, id, label, color, x, y, callback) {
        const w = 150;
        const h = 40;

        const container = this.scene.add.container(x, y);
        container.setDepth(100);

        // Background (Pill shape)
        const bg = this.scene.add.rectangle(0, 0, w, h, color)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);

        // Add subtle border
        const border = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0).setStrokeStyle(2, 0xffffff, 0.5);
        border.setOrigin(0.5);

        bg.on('pointerover', () => {
            bg.setAlpha(0.8);
            border.setStrokeStyle(2, 0xffffff, 1);
            this.scene.tweens.add({ targets: container, scale: 1.05, duration: 100 });
        });
        bg.on('pointerout', () => {
            bg.setAlpha(1);
            border.setStrokeStyle(2, 0xffffff, 0.5);
            this.scene.tweens.add({ targets: container, scale: 1, duration: 100 });
        });

        const text = this.scene.add.text(0, 0, label, {
            font: 'bold 14px Verdana',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setResolution(2);

        container.add([bg, border, text]);
        this.skillButtons[id] = { container, bg, text, color };
    }

    // Helper to render icon + text group
    renderStatGroup(container, items) {
        container.removeAll(true);

        let currentX = 0;

        items.forEach((item, index) => {
            // Spacing
            if (index > 0) currentX += 5; // Reduced 8->5

            if (item.icon) {
                const sprite = this.scene.add.image(currentX, 0, item.icon);
                sprite.setDisplaySize(24, 24);
                sprite.setOrigin(0, 0.5);
                container.add(sprite);
                currentX += 26; // Icon width (24) + tiny gap (2) - Reduced 28->26
            }

            if (item.text) {
                const textObj = this.scene.add.text(currentX, 0, item.text, {
                    font: 'bold 16px Verdana',
                    fill: '#ffffff'
                }).setOrigin(0, 0.5).setResolution(2);
                container.add(textObj);
                currentX += textObj.width;
            }

            if (item.separator) {
                currentX += 5; // Reduced 8->5
                const sep = this.scene.add.text(currentX, 0, '|', { font: '16px Verdana', fill: '#888888' }).setOrigin(0, 0.5).setResolution(2);
                container.add(sep);
                currentX += 5; // Reduced 12->5
            }
        });

        // Center the content?
        // Container is at LEFT_X (200) or RIGHT_X
        // If we want it centered on that X, we shift children left by half width
        const width = currentX;
        container.list.forEach(child => {
            child.x -= width / 2;
        });
    }

    /**
     * @param {Object} state - { player, enemy, turn, currentMoves, maxMoves }
     */
    updateUI(state) {
        if (!state) return;
        const { player, enemy, turn, currentMoves, maxMoves } = state;

        this.currentTurn = turn; // Store for local checks if needed

        if (!this.playerUI || !this.playerUI.active || !this.enemyUI || !this.enemyUI.active) return;

        // Update Global TopBar (still coupled to RunManager via EventBus)
        EventBus.emit(EVENTS.UI_REFRESH_TOPBAR);

        // Player Stats
        if (this.playerUI && this.playerUI.active) {
            const block = player.block || 0;
            const mana = player.mana || 0;
            const strength = player.strength || 0;

            const items = [
                { icon: ASSETS.ICON_SHIELD, text: `${block}`, separator: true },
                { icon: ASSETS.ICON_MANA, text: `${mana}`, separator: true }, // Crystal/Mana
                { text: `👟 ${currentMoves}/${maxMoves}` }
            ];

            if (strength > 0) {
                items[2].separator = true;
                items.push({ icon: ASSETS.ICON_SWORD, text: `${strength}` });
            }

            this.renderStatGroup(this.playerUI, items);

            // Update HP Bar
            this.updateHealthBar(this.playerHPBar, player.currentHP, player.maxHP);
        }

        // Enemy Visuals
        // Determine texture - View Logic: Check if asset exists, else placeholder
        if (enemy && enemy.name) {
            const foundId = Object.keys(ENEMIES).find(key => ENEMIES[key].name === enemy.name);
            if (foundId) {
                const texture = ENEMIES[foundId].texture;
                if (this.scene.textures.exists(texture)) {
                    this.enemySprite.setTexture(texture);
                }
            }
        }

        // Enemy Stats
        if (this.enemyUI && this.enemyUI.active && enemy) {
            let intentIconKey = ASSETS.ICON_SWORD; // Default Attack
            let isBlockIntent = false;

            if (enemy.currentIntent && enemy.currentIntent.type === 'DEFEND') { // Or BLOCK? Checked logic earlier, used 'DEFEND' in generated intent but 'BLOCK' constant?
                // Logic: type: 'DEFEND' or 'ATTACK' string literal from Enemy.js
                intentIconKey = ASSETS.ICON_SHIELD;
                isBlockIntent = true;
            } else if (enemy.currentIntent && enemy.currentIntent.type === 'BLOCK') {
                // For safety if legacy
                intentIconKey = ASSETS.ICON_SHIELD;
                isBlockIntent = true;
            }

            // Enemy Name (Updated separately)
            if (this.enemyName) {
                this.enemyName.setText(enemy.name ? enemy.name.toUpperCase() : 'ENEMY');
            }

            const eBlock = enemy.block || 0;
            const intentText = enemy.currentIntent ? enemy.currentIntent.text : 'Thinking...';

            // Simplified Stats (Shield + Intent)
            // If intent is block, we show Shield + Value? 
            // Intent text usually says "Attack (12)" or "Block (5)"

            const items = [
                { icon: ASSETS.ICON_SHIELD, text: `${eBlock}`, separator: true },
            ];

            // Intent Icon
            // For intent, we might want to just show the icon next to text
            if (enemy.currentIntent) {
                // Check if intent is Attack/Defend to choose icon
                // Already determined intentIconKey
                items.push({ icon: intentIconKey, text: intentText });
            } else {
                items.push({ text: 'Thinking...' });
            }

            this.renderStatGroup(this.enemyUI, items);

            // Update HP Bar
            this.updateHealthBar(this.enemyHPBar, enemy.currentHP, enemy.maxHP);
        }

        // Update Buttons
        const canAct = turn === ENTITIES.PLAYER;

        this.updateSkillButton(SKILLS.HEAL, canAct && player.mana >= 8);
        this.updateSkillButton(SKILLS.FIREBALL, canAct && player.mana >= 5);
        this.updateEndTurnButton(canAct && (!this.scene.gridView || !this.scene.gridView.isAnimating));
    }

    updateSkillButton(id, isEnabled) {
        const btn = this.skillButtons[id];
        if (!btn) return;

        if (isEnabled) {
            btn.container.setAlpha(1);
            btn.bg.setInteractive();
        } else {
            btn.container.setAlpha(0.3);
            btn.bg.disableInteractive();
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
}
