import { EventBus } from '../core/EventBus.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { ITEM_TYPES } from '../logic/GridDetails.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';
import { logManager } from '../core/LogManager.js';
import { RELICS } from '../data/relics.js';

export class CombatManager {
    constructor(scene, data = {}) {
        this.scene = scene;
        const enemyId = data.enemyId || 'slime';
        const nodeType = data.nodeType || 'BATTLE';

        // Load Player State from Global RunManager
        const savedPlayer = runManager.player;
        this.player = new Player(savedPlayer.maxHP);
        this.player.currentHP = savedPlayer.currentHP;
        this.player.gold = savedPlayer.gold;
        this.player.mana = 0; // Reset Mana per battle

        // Load Enemy Data
        const enemyData = ENEMIES[enemyId] || ENEMIES['slime'];

        // Setup Enemy
        if (nodeType === 'BOSS') {
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP); // Override if boss specific logic needed later
        } else {
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP);
        }

        // Store reward info
        this.goldReward = enemyData.goldReward || 10;

        this.turn = 'PLAYER'; // 'PLAYER' | 'ENEMY' | 'ENDED'

        this.maxMoves = 3;
        this.currentMoves = 3;

        this.playerUI = null;
        this.enemyUI = null;
        this.centerText = null; // For Victory/Defeat

        // Skill Buttons (Phaser Objects)
        this.skillButtons = {};

        // Store bound handlers for cleanup
        this.onMatchesFound = this.handleMatches.bind(this);
        this.onSwap = this.handleSwap.bind(this);
        this.onSwapRevert = this.handleSwapRevert.bind(this);

        this.bindEvents();
        this.createUI();
        this.updateUI();

        logManager.log(`Combat Started vs ${this.enemy.name}!`, 'turn');
    }

    bindEvents() {
        EventBus.on('matches:found', this.onMatchesFound);
        EventBus.on('item:swapped', this.onSwap);
        EventBus.on('item:swap_reverted', this.onSwapRevert);
        EventBus.on('potion:use_requested', (index) => this.handlePotionUse(index));

        window.combat = this;
    }

    destroy() {
        // Clean up events
        EventBus.off('matches:found', this.onMatchesFound);
        EventBus.off('item:swapped', this.onSwap);
        EventBus.off('item:swap_reverted', this.onSwapRevert);
        EventBus.off('potion:use_requested');

        // Clean up UI
        if (this.playerUI) this.playerUI.destroy();
        if (this.enemyUI) this.enemyUI.destroy();
        if (this.centerText) this.centerText.destroy();
        if (this.endTurnBtn) this.endTurnBtn.destroy();

        Object.values(this.skillButtons).forEach(btn => {
            if (btn.container) btn.container.destroy();
        });
    }

    handlePotionUse(index) {
        if (this.turn !== 'PLAYER') return;

        const potion = runManager.player.potions[index];
        if (!potion || potion.type !== 'POTION') return;

        console.log(`CombatManager: Using potion ${potion.id}`);

        let used = false;

        if (potion.id === 'potion_heal') {
            this.player.heal(20);
            used = true;
        } else if (potion.id === 'potion_mana') {
            this.player.addMana(10);
            used = true;
        } else if (potion.id === 'potion_strength') {
            this.player.addStrength(2);
            used = true;
        }

        if (used) {
            runManager.removePotion(index);
            EventBus.emit('ui:refresh_topbar'); // Refresh HUD
            this.updateUI(); // Refresh Stats
            logManager.log(`Used ${potion.name}!`, 'info');
        }
    }

    createUI() {
        const style = { font: '18px Arial', fill: '#ffffff', backgroundColor: '#000000', padding: { x: 5, y: 5 } };

        // Player UI (Left Side) - Shifted to 100
        this.playerUI = this.scene.add.text(50, 150, '', style);
        this.playerUI.setDepth(100);

        // Enemy UI (Right Side) - Shifted to 800 for clearance
        this.enemyUI = this.scene.add.text(800, 150, '', style);
        this.enemyUI.setDepth(100);

        // Center Notification Text (Victory/Defeat)
        // Center of Grid is 500, visible center is 550. Let's use 550.
        this.centerText = this.scene.add.text(550, 300, '', {
            font: '48px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setDepth(200).setVisible(false);

        // Create Skill Buttons (Phaser Graphics + Text)
        // Shifted to 50
        this.createSkillButton(0, 'FIREBALL', '🔥 Fireball\n(5 Mana)', 0xff4400, () => this.tryUseSkill('FIREBALL'));
        this.createSkillButton(1, 'HEAL', '💚 Heal\n(8 Mana)', 0x00cc44, () => this.tryUseSkill('HEAL'));

        // End Turn Button - Shifted to 50
        this.endTurnBtn = this.scene.add.text(50, 500, 'END TURN', {
            font: '24px Arial',
            fill: '#ffffff',
            backgroundColor: '#ff0000',
            padding: { x: 10, y: 10 }
        })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.tweens.add({
                    targets: this.endTurnBtn,
                    scale: 0.9,
                    duration: 100,
                    yoyo: true
                });
                this.endTurn();
            })
            .setDepth(100);
    }

    createSkillButton(index, id, label, color, callback) {
        const x = 50;
        const y = 300 + (index * 70);
        const w = 140;
        const h = 50;

        const container = this.scene.add.container(x, y);
        container.setDepth(100);

        // Background
        const bg = this.scene.add.rectangle(0, 0, w, h, color)
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);

        // Hover effect
        bg.on('pointerover', () => bg.setAlpha(0.8));
        bg.on('pointerout', () => bg.setAlpha(1));

        // Text
        const text = this.scene.add.text(w / 2, h / 2, label, {
            font: '14px Arial',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: w - 10 }
        }).setOrigin(0.5);

        container.add([bg, text]);

        this.skillButtons[id] = { container, bg, text, color };
    }

    updateUI() {
        if (!this.playerUI || !this.enemyUI) return;

        const p = this.player;
        const e = this.enemy;

        this.playerUI.setText(`
PLAYER
HP: ${p.currentHP}/${p.maxHP}
Block: ${p.block}
Mana: ${p.mana}
Str: ${p.strength}
Gold: ${p.gold}
MOVES: ${this.currentMoves}/${this.maxMoves}
        `.trim());

        this.enemyUI.setText(`
${e.name.toUpperCase()}
HP: ${e.currentHP}/${e.maxHP}
Block: ${e.block}
Intent:
${e.currentIntent ? e.currentIntent.text : 'None'}
        `.trim());

        // Update Skill Button States
        const canAct = this.turn === 'PLAYER';

        this.updateSkillButton('HEAL', canAct && p.mana >= 8);
        this.updateSkillButton('FIREBALL', canAct && p.mana >= 5);
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

    tryUseSkill(skillName) {
        if (this.turn !== 'PLAYER') return;
        const p = this.player;
        const e = this.enemy;

        if (skillName === 'FIREBALL') {
            if (p.mana >= 5) {
                p.mana -= 5;
                e.takeDamage(15);
                this.updateUI();
                this.checkWinCondition();
            }
        } else if (skillName === 'HEAL') {
            if (p.mana >= 8) {
                p.mana -= 8;
                p.heal(20);
                this.updateUI();
            }
        }
    }

    handleSwap() {
        if (this.turn === 'PLAYER') {
            this.currentMoves--;
            this.updateUI();
        }
    }

    handleSwapRevert() {
        if (this.turn === 'PLAYER') {
            this.currentMoves++;
            this.updateUI();
        }
    }

    canInteract() {
        return this.turn === 'PLAYER' && this.currentMoves > 0;
    }

    handleMatches(data) {
        if (this.turn === 'ENDED') return;

        // If enemy is dead or player dead, stop processing
        if (this.enemy.isDead || this.player.isDead) return;

        const { matches } = data;

        const matchCounts = {};

        matches.forEach(m => {
            let type = m.type;
            if (!type) {
                const item = window.grid.grid[m.r][m.c];
                type = item.type;
            }

            matchCounts[type] = (matchCounts[type] || 0) + 1;
        });

        Object.entries(matchCounts).forEach(([type, count]) => {
            // Trigger Hooks for Matches
            this.triggerHooks('onMatch', count, type);

            this.applyEffect(type, count);
        });

        this.updateUI();
        this.checkWinCondition();
    }

    triggerHooks(hookName, ...args) {
        const relicIds = runManager.getRelics();
        relicIds.forEach(id => {
            const relic = RELICS[id];
            if (relic && relic.hooks && relic.hooks[hookName]) {
                try {
                    relic.hooks[hookName](this, ...args);
                } catch (e) {
                    console.error(`Error in relic hook ${id}.${hookName}:`, e);
                }
            }
        });
    }

    applyEffect(type, count) {
        switch (type) {
            case ITEM_TYPES.SWORD:
                const dmg = count * (2 + this.player.strength);
                this.enemy.takeDamage(dmg);
                // logManager handled by Entity
                break;
            case ITEM_TYPES.SHIELD:
                const block = count * 2;
                this.player.addBlock(block);
                break;
            case ITEM_TYPES.POTION:
                const heal = count * 1;
                this.player.heal(heal);
                break;
            case ITEM_TYPES.MANA:
                this.player.addMana(count);
                logManager.log(`Player gained ${count} Mana.`, 'info');
                break;
            case ITEM_TYPES.COIN:
                this.player.addGold(count);
                logManager.log(`Found ${count} Gold.`, 'gold');
                break;
        }
    }

    endTurn() {
        if (this.turn !== 'PLAYER') return;
        this.turn = 'ENEMY';
        this.updateUI();
        logManager.log("-- ENEMY TURN --", 'turn');

        this.scene.time.delayedCall(800, () => {
            if (this.turn === 'ENDED') return;
            this.enemy.resetBlock(); // Reset block before new action

            const intent = this.enemy.currentIntent;
            this.enemy.executeIntent(this.player);

            // Hook: onDefend (Thorns)
            if (intent && intent.type === 'ATTACK') {
                this.triggerHooks('onDefend', intent.value);
            }

            if (this.player.isDead) {
                this.checkWinCondition();
                return;
            }
            this.startPlayerTurn();
        });
    }

    startPlayerTurn() {
        if (this.turn === 'ENDED') return;
        this.turn = 'PLAYER';
        this.currentMoves = this.maxMoves;
        this.player.resetBlock();
        this.enemy.generateIntent();
        this.updateUI();
        logManager.log("-- PLAYER TURN --", 'turn');
    }

    checkWinCondition() {
        if (this.turn === 'ENDED') return;

        if (this.enemy.isDead) {
            this.turn = 'ENDED';

            // Trigger Hooks for Victory (e.g. Golden Idol)
            const relicIds = runManager.getRelics();
            relicIds.forEach(id => {
                const relic = RELICS[id];
                if (relic && relic.hooks && relic.hooks.onVictory) {
                    relic.hooks.onVictory(runManager);
                }
            });

            // SAVE STATE
            runManager.updatePlayerState(this.player.currentHP, this.player.gold + this.goldReward);
            runManager.completeLevel();

            // DELAY THEN REWARD SCENE
            this.scene.time.delayedCall(1500, () => {
                this.scene.scene.start('RewardScene', {
                    rewards: { gold: this.goldReward }
                });
            });
            return;
        }
        if (this.player.isDead) {
            this.turn = 'ENDED';
            this.showNotification('DEFEAT', 0xff0000);

            // RESTART
            this.scene.time.delayedCall(3000, () => {
                runManager.startNewRun();
                this.scene.scene.start('MapScene');
            });
            return;
        }
    }

    showNotification(text, color) {
        this.centerText.setText(text);
        this.centerText.setColor('#' + color.toString(16));
        this.centerText.setVisible(true);
        this.centerText.setScale(0);

        this.scene.tweens.add({
            targets: this.centerText,
            scale: 1.5,
            duration: 500,
            ease: 'Back.out'
        });
    }

    log(message, type = 'info') {
        logManager.log(message, type);
    }
}
