import { EventBus } from '../core/EventBus.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { ITEM_TYPES } from '../logic/GridDetails.js';
import { EVENTS, ENTITIES, ASSETS, SKILLS, GAME_SETTINGS, MOVESET_TYPES } from '../core/Constants.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';
import { logManager } from '../core/LogManager.js';


export class CombatManager {
    constructor(scene, data = {}) {
        // Scene no longer stored! Logic only.
        // Wait, some logic like 'delayedCall' used scene.time. 
        // We will need a Time Manager or pass scene context for Timers ONLY?
        // Or better: Use standard setTimeout/setInterval wrapped? 
        // Phaser's delayedCall is tied to game loop (pauses when game pauses). 
        // For now, I will keep 'scene' ONLY for timer/tweens if absolutely necessary, 
        // BUT ideally we should inject a 'timerProvider'.
        // User said: "Headless" -> "No Phaser Imports". 
        // But the scene argument is Phaser Scene. 
        // Let's store logicScene for timers, but NOT for rendering.
        this.scene = scene; // Kept strictly for .time (Timers)

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
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP);
        } else {
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP);
        }
        this.enemy.moveset = enemyData.moveset;

        // Store reward info
        this.goldReward = enemyData.goldReward || 10;

        this.turn = ENTITIES.PLAYER;

        this.maxMoves = GAME_SETTINGS.MAX_MOVES;
        this.currentMoves = GAME_SETTINGS.MAX_MOVES;

        // NO UI OBJECTS HERE

        // Store bound handlers for cleanup
        this.onMatchesFound = this.handleMatches.bind(this);
        this.onSwap = this.handleSwap.bind(this);
        this.onSwapRevert = this.handleSwapRevert.bind(this);

        this.bindEvents();
    }

    init() {
        this.generateEnemyIntent();
        this.emitState();
    }

    bindEvents() {
        EventBus.on(EVENTS.MATCHES_FOUND, this.onMatchesFound);
        EventBus.on(EVENTS.ITEM_SWAPPED, this.onSwap);
        EventBus.on(EVENTS.ITEM_SWAP_REVERTED, this.onSwapRevert);
        EventBus.on(EVENTS.POTION_USE_REQUESTED, (index) => this.handlePotionUse(index));
        EventBus.on(EVENTS.UI_ANIMATION_COMPLETE, () => this.emitState());

        window.combat = this;
    }

    destroy() {
        EventBus.off(EVENTS.MATCHES_FOUND, this.onMatchesFound);
        EventBus.off(EVENTS.ITEM_SWAPPED, this.onSwap);
        EventBus.off(EVENTS.ITEM_SWAP_REVERTED, this.onSwapRevert);
        EventBus.off(EVENTS.POTION_USE_REQUESTED);

        if (this.turnTimer) {
            this.turnTimer.remove(false);
            this.turnTimer = null;
        }

        // UI cleanup handled by View
    }

    handlePotionUse(index) {
        if (this.turn !== ENTITIES.PLAYER) return;

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
            // EventBus.emit(EVENTS.UI_REFRESH_TOPBAR); -> Handled by View/RunManager
            this.emitState();
            logManager.log(`Used ${potion.name}!`, 'info');
        }
    }



    emitState() {
        // Sync to global
        runManager.player.currentHP = this.player.currentHP;
        runManager.player.gold = this.player.gold;

        EventBus.emit(EVENTS.UI_UPDATE, {
            player: this.player,
            enemy: this.enemy,
            turn: this.turn,
            currentMoves: this.currentMoves,
            maxMoves: this.maxMoves
        });
    }



    tryUseSkill(skillName) {
        if (this.turn !== ENTITIES.PLAYER) return;
        const p = this.player;
        const e = this.enemy;

        if (skillName === SKILLS.FIREBALL) {
            if (p.mana >= 5) {
                p.mana -= 5;
                // Emit Attack Animation Event (Skill)
                EventBus.emit(EVENTS.PLAYER_ATTACK, { damage: 15, type: 'SKILL', skill: 'FIREBALL' });
                e.takeDamage(15);
                this.emitState();
                this.checkWinCondition();
            }
        } else if (skillName === SKILLS.HEAL) {
            if (p.mana >= 8) {
                p.mana -= 8;
                EventBus.emit(EVENTS.PLAYER_HEAL, { value: 20, type: 'SKILL' });
                p.heal(20);
                this.emitState();
            }
        }
    }

    handleSwap() {
        if (this.turn === ENTITIES.PLAYER) {
            this.currentMoves--;
            this.emitState();
        }
    }

    handleSwapRevert() {
        if (this.turn === ENTITIES.PLAYER) {
            this.currentMoves++;
            this.emitState();
        }
    }

    canInteract() {
        return this.turn === ENTITIES.PLAYER && this.currentMoves > 0;
    }

    handleMatches(data) {
        if (this.turn === ENTITIES.ENDED) return;
        if (this.turn === ENTITIES.ENDED) return;
        if (this.enemy.isDead || this.player.isDead) {
            console.warn('CombatManager: Dead entity detected, logic somehow missed it. Re-checking win condition.');
            this.checkWinCondition();
            return;
        }

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
            this.applyEffect(type, count);
        });

        this.emitState();
        this.checkWinCondition();
    }



    applyEffect(type, count) {
        switch (type) {
            case ITEM_TYPES.SWORD:
                const dmg = count * (2 + this.player.strength);
                // Emit Attack Animation Event
                EventBus.emit(EVENTS.PLAYER_ATTACK, { damage: dmg, type: 'NORMAL' });
                this.enemy.takeDamage(dmg);
                break;
            case ITEM_TYPES.SHIELD:
                const block = count * 2;
                EventBus.emit(EVENTS.PLAYER_DEFEND, { value: block });
                this.player.addBlock(block);
                break;
            case ITEM_TYPES.POTION:
                const heal = count * 1;
                EventBus.emit(EVENTS.PLAYER_HEAL, { value: heal });
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
        if (this.turn !== ENTITIES.PLAYER) return;
        if (this.player.isDead || this.enemy.isDead) return;

        if (this.scene.gridView) {
            this.scene.gridView.skipAnimations();
        }
        if (window.grid) {
            window.grid.setFastForward(true);
        }

        this.turn = ENTITIES.ENEMY;
        this.emitState();
        this.turn = ENTITIES.ENEMY;
        this.emitState(); // Emits UI_UPDATE
        logManager.log("-- ENEMY TURN --", 'turn');

        if (this.turnTimer) this.turnTimer.remove(false);
        this.turnTimer = this.scene.time.delayedCall(800, () => {
            if (this.turn === ENTITIES.ENDED) return;
            this.enemy.resetBlock();

            const intent = this.enemy.currentIntent;

            // Emit Attack Event BEFORE damage is applied (so Relics like Spiked Shield see current Block)
            if (intent && intent.type === 'ATTACK') {
                EventBus.emit(EVENTS.ENEMY_ATTACK, {
                    damage: intent.value,
                    intent: intent
                });
            }

            if (intent && intent.type === 'DEFEND') {
                EventBus.emit(EVENTS.ENEMY_DEFEND, { value: intent.value });
            } else if (intent && intent.type === 'BUFF') {
                // Placeholder Animation: Use HEAL animation for Buffs (e.g. Roar)
                EventBus.emit(EVENTS.ENEMY_HEAL, { value: intent.value });

            } else if (intent && intent.type === 'DEBUFF') {
                // Placeholder Animation: Use ATTACK animation for Debuffs (e.g. Lock, Trash)
                EventBus.emit(EVENTS.ENEMY_ATTACK, {
                    damage: 0, // No damage, just animation
                    intent: intent
                });
            }

            this.executeEnemyIntent();

            if (this.player.isDead) {
                this.checkWinCondition();
                return;
            }
            this.startPlayerTurn();
        });
    }

    executeEnemyIntent() {
        if (!this.enemy.currentIntent) return;

        const intent = this.enemy.currentIntent;
        logManager.log(`Enemy executes: ${intent.text || intent.type}`, 'combat');

        switch (intent.type) {
            case MOVESET_TYPES.ATTACK:
                // Calculate damage including strength
                // If value is base damage from moveset, we add strength here or in Enemy class?
                // Enemy data has 'value': 6.
                // We should add this.enemy.getStrength() - but wait, getStrength includes base?
                // No, getStrength currently returns buff total. Base is 0.
                // Re-reading Enemy.js: getStrength returns (this.strength || 0) + buffs.
                // So we add that to the attack value.
                const totalDmg = intent.value + this.enemy.getStrength();
                this.player.takeDamage(totalDmg);
                logManager.log(`Enemy attacks for ${totalDmg} (Base ${intent.value} + Str ${this.enemy.getStrength()})`, 'combat');
                break;
            case MOVESET_TYPES.DEFEND:
                this.enemy.addBlock(intent.value);
                break;
            case MOVESET_TYPES.BUFF:
                if (intent.effect === 'STRENGTH') {
                    // Apply temporary buff (Duration: 2 turns default as requested)
                    const duration = 2; // Default
                    this.enemy.addBuff('STRENGTH', intent.value, duration);
                    // this.enemy.strength = (this.enemy.strength || 0) + intent.value;
                    logManager.log(`Enemy gains ${intent.value} Strength for ${duration} turns!`, 'warning');
                } else if (intent.effect === 'HEAL') {
                    this.enemy.heal(intent.value);
                }
                break;
            case MOVESET_TYPES.DEBUFF:
                if (intent.effect === 'LOCK') {
                    if (window.grid) {
                        const count = window.grid.lockRandomGems(intent.value);
                        logManager.log(`Enemy Locked ${count} Gems!`, 'warning');
                        EventBus.emit(EVENTS.SHOW_NOTIFICATION, { text: 'LOCKED!', color: 0x9900cc });
                    }
                } else if (intent.effect === 'TRASH') {
                    if (window.grid) {
                        const count = window.grid.trashRandomGems(intent.value);
                        logManager.log(`Enemy Trashed ${count} Gems!`, 'warning');
                        EventBus.emit(EVENTS.SHOW_NOTIFICATION, { text: 'TRASHED!', color: 0x333333 });
                    }
                }
        }
    }

    startPlayerTurn() {
        if (this.turn === ENTITIES.ENDED) return;
        this.turn = ENTITIES.PLAYER;
        if (window.grid) window.grid.setFastForward(false);

        // Check for Deadlock (if enemy locked everything)
        if (this.scene && this.scene.gridLogic) {
            this.scene.gridLogic.checkDeadlock();
        }

        this.currentMoves = this.maxMoves;
        this.player.resetBlock();
        // Tick Buffs (Duration Based)
        this.enemy.tickBuffs();

        // Generate Next Intent
        // Ideally this logic lives in Enemy class, but for "data-driven" centralization:
        this.generateEnemyIntent();

        this.emitState();
        logManager.log("-- PLAYER TURN --", 'turn');
    }

    generateEnemyIntent() {
        const moveset = this.enemy.moveset;
        if (!moveset || moveset.length === 0) {
            // Fallback
            this.enemy.currentIntent = { type: 'ATTACK', value: 5, text: 'Attack (5)' };
            return;
        }

        // Weighted Random Selection
        const totalWeight = moveset.reduce((sum, move) => sum + (move.weight || 1), 0);
        let random = Math.random() * totalWeight;

        let selectedMove = moveset[0];
        for (const move of moveset) {
            random -= (move.weight || 1);
            if (random <= 0) {
                selectedMove = move;
                break;
            }
        }

        this.enemy.currentIntent = selectedMove;
        console.log(`Enemy Intent Generated: ${selectedMove.text}`);
    }

    checkWinCondition() {
        if (this.turn === ENTITIES.ENDED) return;

        console.log(`CombatManager: Checking Win Condition. Enemy Dead? ${this.enemy.isDead} (${this.enemy.currentHP}), Player Dead? ${this.player.isDead}`);

        if (this.enemy.isDead) {
            this.turn = ENTITIES.ENDED;

            EventBus.emit(EVENTS.VICTORY, { combat: this });

            runManager.updatePlayerState(this.player.currentHP, this.player.gold + this.goldReward);
            runManager.completeLevel();

            this.scene.time.delayedCall(1500, () => {
                this.scene.scene.start('RewardScene', {
                    rewards: { gold: this.goldReward }
                });
            });
            return;
        }
        if (this.player.isDead) {
            this.turn = ENTITIES.ENDED;
            EventBus.emit(EVENTS.SHOW_NOTIFICATION, { text: 'DEFEAT', color: 0xff0000 });

            this.scene.time.delayedCall(3000, () => {
                runManager.startNewRun();
                this.scene.scene.start('MapScene');
            });
            return;
        }
    }

    log(message, type = 'info') {
        logManager.log(message, type);
    }
}
