import { EventBus } from '../core/EventBus.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { ITEM_TYPES } from '../logic/GridDetails.js';
import { EVENTS, ENTITIES, ASSETS, SKILLS, SKILL_DATA, GAME_SETTINGS, MOVESET_TYPES, STATUS_TYPES, POTION_DATA, MATCH_MASTERY } from '../core/Constants.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';
import { logManager } from '../core/LogManager.js';
import { masteryManager, TRIGGERS } from '../logic/MasteryManager.js';
import { settingsManager } from '../core/SettingsManager.js';


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
        this.enemyId = enemyId;
        const nodeType = data.nodeType || 'BATTLE';

        // Load Player State from Global RunManager
        const savedPlayer = runManager.player;
        // console.log(`[CombatManager] Init: Loading Player from RunManager. Global Gold: ${savedPlayer.gold}`);
        this.player = new Player(savedPlayer.maxHP);
        this.player.currentHP = savedPlayer.currentHP;
        this.player.gold = savedPlayer.gold;
        this.player.gold = savedPlayer.gold;
        this.player.mana = 0; // Reset Mana per battle
        this.player.skills = savedPlayer.deck ? [...savedPlayer.deck] : [];
        // console.log(`[CombatManager] Player Skills Loaded: ${this.player.skills.join(', ')}`);

        // Load Enemy Data
        const enemyData = ENEMIES[enemyId] || ENEMIES['slime'];

        // Setup Enemy
        if (nodeType === 'BOSS') {
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP);
        } else {
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP);
        }
        this.enemy.moveset = enemyData.moveset;
        this.enemy.strengthMagnitude = enemyData.strengthMagnitude || 5;
        this.enemy.manaDevourConfig = enemyData.manaDevourConfig || {};

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
        this.onPotionUse = this.handlePotionUse.bind(this);
        this.onUIAnimComplete = this.emitState.bind(this);
        this.onEntityDied = this.handleEntityDied.bind(this);

        this.bindEvents();
    }

    init() {
        // Reset Turn State for first turn
        this.turnState = {
            goldCollected: false
        };
        this.hasDefended = false; // For Cracked Shield relic

        this.generateEnemyIntent();
        EventBus.emit(EVENTS.TURN_START, { combat: this }); // Trigger Start of Battle Relics BEFORE View Update
        this.emitState(); // Initial State (now includes Relic effects)
    }

    bindEvents() {
        EventBus.on(EVENTS.MATCHES_FOUND, this.onMatchesFound);
        EventBus.on(EVENTS.ITEM_SWAPPED, this.onSwap);
        EventBus.on(EVENTS.ITEM_SWAP_REVERTED, this.onSwapRevert);
        EventBus.on(EVENTS.POTION_USE_REQUESTED, this.onPotionUse);
        EventBus.on(EVENTS.UI_ANIMATION_COMPLETE, this.onUIAnimComplete);
        EventBus.on(EVENTS.ENTITY_DIED, this.onEntityDied);
        EventBus.on(EVENTS.GRID_REFILLED, this.onUIAnimComplete); // Reuse emitState binding

        window.combat = this;
    }

    destroy() {
        EventBus.off(EVENTS.MATCHES_FOUND, this.onMatchesFound);
        EventBus.off(EVENTS.ITEM_SWAPPED, this.onSwap);
        EventBus.off(EVENTS.ITEM_SWAP_REVERTED, this.onSwapRevert);
        EventBus.off(EVENTS.POTION_USE_REQUESTED, this.onPotionUse);
        EventBus.off(EVENTS.UI_ANIMATION_COMPLETE, this.onUIAnimComplete);
        EventBus.off(EVENTS.ENTITY_DIED, this.onEntityDied);

        if (this.turnTimer) {
            this.turnTimer.remove(false);
            this.turnTimer = null;
        }

        // UI cleanup handled by View
    }

    /**
     * Called when ANY entity dies (from status effects, thorns, direct damage, etc.)
     * This ensures win/lose conditions are always checked.
     */
    handleEntityDied(data) {
        // Delegate all victory/defeat logic to checkWinCondition to ensure proper scene transitions
        this.checkWinCondition();
    }

    handlePotionUse(index) {
        if (this.turn !== ENTITIES.PLAYER) return;

        const potion = runManager.player.potions[index];
        if (!potion || potion.type !== 'POTION') return;

        console.log(`CombatManager: Using potion ${potion.id}`);

        let used = false;
        if (potion.id === 'potion_heal') {
            if (this.player.currentHP < this.player.maxHP) {
                this.player.heal(POTION_DATA.HEAL.value);
                used = true;
            } else {
                logManager.log("Health is already full!", 'warning');
            }
        } else if (potion.id === 'potion_mana') {
            this.player.addMana(POTION_DATA.MANA.value);
            used = true;
        } else if (potion.id === 'potion_strength') {
            this.player.statusManager.applyStack(STATUS_TYPES.STRENGTH, POTION_DATA.STRENGTH.value);
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

        // Auto End Turn Check
        this.checkAutoEndTurn();
    }

    checkAutoEndTurn(retryCount = 0) {
        // 1. Check Setting
        if (!settingsManager.get('autoEndTurn', false)) return;

        // 2. Conditions
        if (this.turn !== ENTITIES.PLAYER) return;

        // Wait for Grid to be idle (animations complete)
        const visualBusy = (this.scene && this.scene.gridView && this.scene.gridView.isAnimating);
        const logicBusy = (window.grid && window.grid.isAnimating);

        if (visualBusy || logicBusy) {
            // Retry in 500ms
            if (retryCount < 20) {
                // if (retryCount % 5 === 0) console.log(`[AutoRun] Busy (Vis:${visualBusy}), Retrying ${retryCount}...`);
                this.scene.time.delayedCall(500, () => this.checkAutoEndTurn(retryCount + 1));
            }
            return;
        }

        if (this.currentMoves > 0) return; // Still has moves
        if (this.canUseAnySkill()) return; // Still has playable skills

        // Debounce: If timer exists, cancel it and restart
        if (this.autoturnTimer) {
            this.autoturnTimer.remove(false);
            this.autoturnTimer = null;
        }

        // console.log('CombatManager: Auto End Turn Scheduled (0.3s)...');

        // 3. Trigger with Delay (Reduced to 300ms)
        if (this.scene && this.scene.time) {
            this.autoturnTimer = this.scene.time.delayedCall(300, () => {
                this.autoturnTimer = null;
                // Double check conditions
                if (this.turn === ENTITIES.PLAYER && this.currentMoves <= 0 && !this.canUseAnySkill()) {
                    this.endTurn();
                }
            });
        }
    }

    canUseAnySkill() {
        if (!this.player) return false;

        // Helper to check standard cost
        const check = (data) => {
            const cost = Math.floor(data.cost * (this.player.statusManager.getStack(STATUS_TYPES.FOCUS) > 0 ? 0.5 : 1));
            if (this.player.mana >= cost) {
                // console.log(`[AutoEndTurn] Blocked by Usable Skill: ${data.name} (Mana ${this.player.mana}/${cost})`);
                return true;
            }
            return false;
        };

        const p = this.player;
        const multiplier = p.statusManager.getStack(STATUS_TYPES.FOCUS) > 0 ? 0.5 : 1;

        // 1. Iterate Owned Skills
        for (const skillId of this.player.skills) {
            const data = SKILL_DATA[skillId];
            if (!data) continue;

            // Special handling for SHIELD_SLAM (Block check)
            if (skillId === 'SHIELD_SLAM') {
                const cost = Math.floor(data.cost * multiplier);
                if (p.mana >= cost && p.block >= (data.shieldCost || 0)) {
                    // console.log(`[AutoEndTurn] Blocked by Usable Skill: Shield Slam`);
                    return true;
                }
                continue;
            }

            // Special handling for AIMED_SHOT (Sword check)
            if (skillId === 'AIMED_SHOT') {
                const cost = Math.floor(data.cost * multiplier);
                if (p.mana >= cost) {
                    // Must check swords
                    let swordCount = 0;
                    if (this.scene && this.scene.gridView) {
                        this.scene.gridView.tokenContainer.list.forEach(sprite => {
                            if (sprite.type === 'Container') return;
                            const type = sprite.texture.key;
                            const isTrash = sprite.getData('isTrash');
                            // Need to check Constants/GridDetails logic if key matches?
                            // Typically textures are mapped. Let's assume ASSETS or direct comparison.
                            // Actually GridView uses 'SWORD' texture key?
                            // Let's rely on ITEM_TYPES logic if possible or check key.
                            // Better: Use GridData if possible? no, gridView is safer for "what's visible" 
                            // BUT CombatView used 'ASSETS.SWORD'.
                            if ((type === 'SWORD' || type === ASSETS.SWORD) && !isTrash) swordCount++; // Use ASSETS
                        });
                    } else if (window.grid && window.grid.grid) {
                        // Fallback Logic
                        window.grid.grid.forEach(row => {
                            row.forEach(tile => {
                                if (tile && tile.type === 'SWORD' && !tile.isTrash) swordCount++;
                            });
                        });
                    }

                    if (swordCount <= (data.maxSwords || 9)) {
                        // console.log(`[AutoEndTurn] Blocked by Usable Skill: Aimed Shot (Swords ${swordCount}/${data.maxSwords})`);
                        return true;
                    }
                }
                continue;
            }

            // Special handling for EXTRACTION (Toxin check)
            if (skillId === SKILLS.EXTRACTION) {
                const cost = Math.floor(data.cost * multiplier);
                const toxin = this.enemy.statusManager.getStack(STATUS_TYPES.TOXIN);

                if (p.mana >= cost && toxin > 0) {
                    // console.log(`[AutoEndTurn] Blocked by Usable Skill: Extraction`);
                    return true;
                }
                continue;
            }

            // Standard Skills (Fireball, Heal, Outbreak, etc.)
            if (check(data)) return true;
        }

        return false;
    }

    tryUseSkill(skillName) {
        if (!this.canInteract()) {
            logManager.log('Cannot use skill while busy!', 'warning');
            return;
        }
        const p = this.player;
        const e = this.enemy;
        const sm = p.statusManager;

        // Calculate Cost with Focus
        const focus = sm.getStack(STATUS_TYPES.FOCUS);
        let multiplier = 1.0;
        if (focus === 1) multiplier = 0.5;
        if (focus >= 2) multiplier = 0.0;

        const useSkill = (baseCost, action) => {
            const finalCost = Math.floor(baseCost * multiplier);
            if (p.mana >= finalCost) {
                p.mana -= finalCost;
                action();

                // Consume Focus if used
                if (focus > 0) {
                    sm.consumeStacks(STATUS_TYPES.FOCUS);
                    logManager.log('Focus consumed for skill!', 'info');
                }

                this.emitState();
                if (skillName === SKILLS.FIREBALL) this.checkWinCondition();
                return true;
            }
            return false;
        };

        if (skillName === SKILLS.FIREBALL) {
            const data = SKILL_DATA.FIREBALL;
            useSkill(data.cost, () => {
                e.takeDamage(data.damage, p, { type: 'SKILL', skill: 'FIREBALL' });
            });
        } else if (skillName === SKILLS.HEAL) {
            const data = SKILL_DATA.HEAL;
            useSkill(data.cost, () => {
                p.heal(data.heal);
            });
        } else if (skillName === SKILLS.SHIELD_SLAM) {
            const data = SKILL_DATA.SHIELD_SLAM;
            const shieldCost = data.shieldCost || 0;

            // Custom check because we need Block AND Mana
            const finalCost = Math.floor(data.cost * multiplier); // Configurable Mana Cost

            if (p.mana >= finalCost && p.block >= shieldCost) {
                p.mana -= finalCost;

                // Remove Block
                p.addBlock(-shieldCost);

                // Effect
                e.takeDamage(data.damage, p, { type: 'SKILL', skill: 'SHIELD_SLAM' });

                // Consume Focus if used
                if (focus > 0) {
                    sm.consumeStacks(STATUS_TYPES.FOCUS);
                    logManager.log('Focus consumed for skill!', 'info');
                }

                this.emitState();
                logManager.log(`Shield Slam! -${finalCost} Mana, -${shieldCost} Block`, 'info');
                this.checkWinCondition();
            }
        } else if (skillName === SKILLS.AIMED_SHOT) {
            const data = SKILL_DATA.AIMED_SHOT;
            const maxSwords = data.maxSwords || 5;

            // Check Sword Count on Grid
            let swordCount = 0;
            if (window.grid && window.grid.grid) {
                window.grid.grid.forEach(row => row.forEach(tile => {
                    if (tile && tile.type === ITEM_TYPES.SWORD) swordCount++;
                }));
            }

            const finalCost = Math.floor(data.cost * multiplier);

            if (p.mana >= finalCost && swordCount <= maxSwords) {
                p.mana -= finalCost;

                // Deal Damage FIRST
                // Assuming takeDamage supports options object as 3rd arg based on previous context
                e.takeDamage(data.damage, p, { isPiercing: true, type: 'SKILL', skill: 'AIMED_SHOT' });

                // Effect: Vulnerable AFTER damage
                if (data.vulnerable > 0) {
                    e.statusManager.applyStack(STATUS_TYPES.VULNERABLE, data.vulnerable);
                }

                // Consume Focus if used
                if (focus > 0) {
                    sm.consumeStacks(STATUS_TYPES.FOCUS);
                    logManager.log('Focus consumed for skill!', 'info');
                }

                this.emitState();
                logManager.log(`Aimed Shot! ${data.damage} Piercing DMG.`, 'info');
                this.checkWinCondition();
            } else {
                if (swordCount > maxSwords) {
                    logManager.log(`Cannot use Aimed Shot! Too many swords (${swordCount}/${maxSwords})`, 'warning');
                }
            }
        } else if (skillName === SKILLS.EXTRACTION) {
            const data = SKILL_DATA.EXTRACTION;

            // Validate Requirement (Server-side check)
            const currentStacks = e.statusManager.getStack(STATUS_TYPES.TOXIN);
            if (currentStacks <= 0) {
                logManager.log('Extraction requires Toxin present on enemy.', 'warning');
                return;
            }

            useSkill(data.cost, () => {
                // 1. Get Stacks (Again, to be safe or reuse var)
                const stacks = currentStacks;
                if (stacks > 0) {
                    // 2. Consume
                    e.statusManager.stacks[STATUS_TYPES.TOXIN] = 0; // Clear all

                    // Trigger Custom Visuals
                    EventBus.emit(EVENTS.EXTRACTION_CAST, { stacks: stacks });

                    // 3. Deal Damage
                    const dmg = stacks * data.damagePerStack;
                    // Skip standard Lunge animation because we have a custom visuals
                    // EventBus.emit(EVENTS.PLAYER_ATTACK, { damage: dmg, type: 'SKILL', skill: 'EXTRACTION', skipAnimation: true });
                    e.takeDamage(dmg, p, { type: 'SKILL', skill: 'EXTRACTION', skipAnimation: true });

                    // 4. Heal
                    const heal = Math.floor(dmg * data.healRatio);
                    // EventBus.emit(EVENTS.PLAYER_HEAL, { value: heal, type: 'SKILL', skipAnimation: true });
                    p.heal(heal);

                    logManager.log(`Extraction: Consumed ${stacks} Toxin. Dealt ${dmg} DMG, Healed ${heal} HP.`, 'info');

                    this.checkWinCondition(); // Check for kill or end turn state
                } else {
                    logManager.log('Extraction cast on 0 Toxin! Wasted.', 'warning');
                }
            });
        } else if (skillName === SKILLS.OUTBREAK) {
            const data = SKILL_DATA.OUTBREAK;

            // Capture Toxin Stacks IMMEDIATELY
            const currentToxin = e.statusManager.getStack(STATUS_TYPES.TOXIN);
            const shouldGrantMove = currentToxin >= data.threshold;

            useSkill(data.cost, async () => {
                // Grant Move Immediately if condition was met at start
                if (shouldGrantMove) {
                    this.currentMoves++;
                    logManager.log(`Outbreak: Threshold met (${currentToxin}), +1 Action!`, 'skill');
                    this.emitState(); // Update UI immediately
                } else {
                    logManager.log(`Outbreak: Threshold not met (${currentToxin}/${data.threshold})`, 'info');
                }

                // 1. Transmute Gems
                if (window.grid && window.grid.transmuteRandomGems) {
                    const count = await window.grid.transmuteRandomGems(data.transmuteCount, ITEM_TYPES.POTION, {
                        preModificationCallback: async (targets) => {
                            await new Promise(resolve => {
                                EventBus.emit(EVENTS.OUTBREAK_CAST, {
                                    targets,
                                    onComplete: resolve
                                });
                                // Safety fallback
                                setTimeout(resolve, 3000);
                            });
                        }
                    });
                    logManager.log(`Outbreak: Transmuted ${count} gems to Potions.`, 'info');
                } else {
                    console.error('[DEBUG] Outbreak Failed: window.grid or transmuteRandomGems missing!', window.grid);
                }

                this.checkWinCondition(); // Ensure turn ends if moves = 0
            });
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
        // Prevent interaction if Grid is animating (cascading/swapping/matching)
        let isGridBusy = false;

        // Check Scene GridView first (Visual State)
        let visualBusy = false;
        if (this.scene && this.scene.gridView && this.scene.gridView.isAnimating) {
            visualBusy = true;
            isGridBusy = true;
        }
        // Fallback to window.grid if scene unavailable (though CombatManager expects scene)
        else if (window.grid && window.grid.isAnimating) {
            // Logic busy?
            isGridBusy = true;
        }

        // Return true if Player Turn and Grid is Idle (regardless of moves)
        // Skills can be used with 0 moves if Mana allows.
        return this.turn === ENTITIES.PLAYER && !isGridBusy;
    }

    handleMatches(data) {
        if (this.turn === ENTITIES.ENDED || this.enemy.isDead || this.player.isDead) {
            this.checkWinCondition();
            return;
        }

        const { matches } = data;

        // 1. Group by Type
        const byType = {};
        matches.forEach(m => {
            let type = m.type;
            if (!type && window.grid) {
                type = window.grid.grid[m.r][m.c].type;
            }
            if (!byType[type]) byType[type] = [];
            byType[type].push(m);
        });

        // 2. Resolve Groups (Connected Components)
        Object.entries(byType).forEach(([type, tiles]) => {
            const groups = this.findConnectedGroups(tiles);
            groups.forEach(group => {
                this.resolveMatchGroup(type, group.length);
            });
        });

        this.emitState();
        this.checkWinCondition();
    }

    findConnectedGroups(tiles) {
        const groups = [];
        const visited = new Set();

        // Map for fast lookups: "r,c" -> {r,c}
        const tileMap = new Set(tiles.map(t => `${t.r},${t.c}`));

        tiles.forEach(tile => {
            const key = `${tile.r},${tile.c}`;
            if (visited.has(key)) return;

            // Start BFS
            const group = [];
            const queue = [tile];
            visited.add(key);

            while (queue.length > 0) {
                const current = queue.shift();
                group.push(current);

                const neighbors = [
                    { r: current.r - 1, c: current.c },
                    { r: current.r + 1, c: current.c },
                    { r: current.r, c: current.c - 1 },
                    { r: current.r, c: current.c + 1 }
                ];

                neighbors.forEach(n => {
                    const nKey = `${n.r},${n.c}`;
                    if (tileMap.has(nKey) && !visited.has(nKey)) {
                        visited.add(nKey);
                        queue.push(n);
                    }
                });
            }
            groups.push(group);
        });

        return groups;
    }

    resolveMatchGroup(type, size) {
        const p = this.player;
        const e = this.enemy;
        const sm = p.statusManager;

        // Context for Traits
        const context = {
            player: p,
            enemy: e,
            combatManager: this,
            matchSize: size,
            hasCorruptedFlask: runManager.hasRelic('corrupted_flask')
        };
        const traits = runManager.traits || [];

        // 0. Trigger Passive/Global trait modifiers (Optional, usually stats are pre-calced)
        // We might want `triggerTraits(TRIGGERS.ON_MATCH, type)` here if we had that trigger.

        // Tier Logic
        // Tier 1: Size 3
        // Tier 2: Size 4
        // Tier 3: Size 5+

        switch (type) {
            case ITEM_TYPES.SWORD:
                // Base Dmg
                if (this.turnState) this.turnState.damageDealt = true;

                // Execute Traits: Passive Dmg Mod?
                // For now, hardcoded base formula + traits
                let dmg = size * (2 + p.strength + sm.getStack(STATUS_TYPES.STRENGTH));

                // UNCOMMON TRAIT: Sharpening Stone (+1 Base) logic finding? 
                // Getting passive stats from traits is inefficient to do every match.
                // Should be cached in Player stats. But for now, let's iterate.
                const passiveSwordTraits = masteryManager.triggerTraits(TRIGGERS.PASSIVE, type, traits, context);
                passiveSwordTraits.forEach(res => {
                    if (res.damageMod) dmg += res.damageMod;
                });

                // Consume Strength (One-Use)
                sm.consumeStacks(STATUS_TYPES.STRENGTH);

                // Critical Check
                const critStacks = sm.getStack(STATUS_TYPES.CRITICAL);
                let isCrit = false;
                if (critStacks === 1) isCrit = Math.random() < 0.5;
                if (critStacks >= 2) isCrit = true;

                if (isCrit) {
                    dmg = Math.floor(dmg * 1.5);
                    logManager.log("CRITICAL HIT!", 'damage');
                    sm.consumeStacks(STATUS_TYPES.CRITICAL);
                }

                // Match 4+ Traits
                if (size >= 4) {
                    const res = masteryManager.triggerTraits(TRIGGERS.MATCH_4, type, traits, context);
                    res.forEach(r => {
                        if (r.damageMult) dmg = Math.floor(dmg * r.damageMult);
                    });
                }
                // Match 5+ Traits
                if (size >= 5) {
                    // Also trigger Match 4 traits for size 5? NO, design usually separates tiers.
                    // But if I want "Serrated Edge" (Match 4) to trigger on Match 5, I explicitly need to say so or allow fallback.
                    // New Design: Traits have specific triggers. Match-5 doesn't auto-trigger Match-4 traits unless specified.
                    // BUT, typically a match 5 IS a match 4 mathematically?
                    // Let's stick to EXACT trigger for now OR allow >= logic.
                    // Design says: "Common/Rare Match-4". "Epic Match-5".
                    // If I have Serrated Edge (Match-4), does a Match-5 trigger it?
                    // User expectation: Yes, better match should include lower tier bonuses usually.
                    // Let's Trigger Match-4 traits on size >= 4.

                    if (size >= 5) {


                        const res = masteryManager.triggerTraits(TRIGGERS.MATCH_5, type, traits, context);
                        res.forEach(r => {
                            if (r.damageMult) dmg = Math.floor(dmg * r.damageMult);
                        });
                    }
                }

                // Relic: Blood Tipped Edge (Kept for legacy compat, or move to Trait?)
                if (runManager.hasRelic('blood_tipped_edge')) {
                    e.statusManager.applyStack(STATUS_TYPES.BLEED, 1);
                }

                e.takeDamage(dmg, p);
                break;

            case ITEM_TYPES.SHIELD:
                let block = size * 2;

                // Passives
                const passiveShieldTraits = masteryManager.triggerTraits(TRIGGERS.PASSIVE, type, traits, context);
                passiveShieldTraits.forEach(res => {
                    if (res.blockMod) block += res.blockMod;
                });

                if (size >= 4) {
                    const res = masteryManager.triggerTraits(TRIGGERS.MATCH_4, type, traits, context);
                    res.forEach(r => {
                        if (r.blockMult) block = Math.floor(block * r.blockMult);
                    });
                }

                if (size >= 5) {
                    // Trigger Match 4 effects on 5?
                    // Generally yes.


                    masteryManager.triggerTraits(TRIGGERS.MATCH_5, type, traits, context);
                }

                // Cracked Shield Relic
                if (runManager.hasRelic('cracked_shield') && !this.hasDefended) {
                    block = Math.floor(block * 1.5);
                    this.hasDefended = true;
                    logManager.log('Cracked Shield: +50% Block!', 'relic');
                }

                p.addBlock(block);
                break;

            case ITEM_TYPES.POTION:
                if (context.hasCorruptedFlask) {
                    // CORRUPTED FLASK LOGIC (Base Toxin)
                    let toxinStacks = 0;
                    if (size === 3) toxinStacks = 3;
                    if (size >= 4) toxinStacks = 5; // Simplified base scaling
                    // Note: Traits might add more toxin via "Regen -> Toxin" conversion in MasteryManager logic.

                    // Healing Herb Synergy
                    if (runManager.hasRelic('healing_herb') && size >= 3) {
                        // Herb Dmg
                        e.takeDamage(2, p);
                    }

                    // Trigger Traits (They will see hasCorruptedFlask = true)
                    // Passives
                    const passivePotionTraits = masteryManager.triggerTraits(TRIGGERS.PASSIVE, type, traits, context);
                    // e.g. Larger Flasks (+2 HP -> ??? Maybe +2 Toxin?) - Implemented in MasteryManager to handle context?
                    // Currently 'execute' returns { healMod: 2 }.
                    let extraToxin = 0;
                    passivePotionTraits.forEach(res => {
                        if (res.healMod) extraToxin += res.healMod; // Convert Heal Mod to Toxin
                    });
                    toxinStacks += extraToxin;

                    if (size >= 4) masteryManager.triggerTraits(TRIGGERS.MATCH_4, type, traits, context);
                    if (size >= 5) {

                        masteryManager.triggerTraits(TRIGGERS.MATCH_5, type, traits, context);
                    }

                    e.statusManager.applyStack(STATUS_TYPES.TOXIN, toxinStacks);
                    logManager.log(`Corrupted Flask: Applied ${toxinStacks} Toxin!`, 'relic');

                    EventBus.emit(EVENTS.PLAYER_ATTACK, { damage: 0, type: 'VISUAL_ONLY' });
                    EventBus.emit(EVENTS.TOXIN_APPLIED);
                    this.emitState();
                    this.checkToxinOverdose();
                } else {
                    // STANDARD LOGIC
                    let heal = size * 1;

                    // Passives
                    const passivePotionTraits = masteryManager.triggerTraits(TRIGGERS.PASSIVE, type, traits, context);
                    passivePotionTraits.forEach(res => {
                        if (res.healMod) heal += res.healMod;
                    });

                    // Healing Herb Relic
                    if (runManager.hasRelic('healing_herb') && size >= 3) {
                        heal += 2;
                    }

                    if (size >= 4) masteryManager.triggerTraits(TRIGGERS.MATCH_4, type, traits, context);
                    if (size >= 5) {

                        masteryManager.triggerTraits(TRIGGERS.MATCH_5, type, traits, context);
                        // Base Match 5 Bonus (if any left? We moved +5 heal to... nowhere? 
                        // Spec design said: "Standard bonuses remove". 
                        // So only traits apply. Base is just size*1.
                    }

                    p.heal(heal);
                }
                break;

            case ITEM_TYPES.MANA:
                let mana = size;
                // Passives
                const passiveManaTraits = masteryManager.triggerTraits(TRIGGERS.PASSIVE, type, traits, context);
                passiveManaTraits.forEach(res => {
                    if (res.manaMod) mana += res.manaMod;
                });
                p.addMana(mana);

                if (size >= 4) masteryManager.triggerTraits(TRIGGERS.MATCH_4, type, traits, context);
                if (size >= 5) {

                    masteryManager.triggerTraits(TRIGGERS.MATCH_5, type, traits, context);
                }
                break;

            case ITEM_TYPES.COIN:
                let goldAmount = size;

                // Passives
                const passiveCoinTraits = masteryManager.triggerTraits(TRIGGERS.PASSIVE, type, traits, context);
                passiveCoinTraits.forEach(res => {
                    if (res.goldMod) goldAmount += res.goldMod;
                });

                // Greed Pact: 3x Gold
                if (runManager.hasRelic('greed_pact')) {
                    goldAmount *= 3;
                }

                p.addGold(goldAmount);
                logManager.log(`Collected ${goldAmount} Gold!`, 'gold');

                // Track for Turn End Punishment
                if (this.turnState) this.turnState.goldCollected = true;

                if (size >= 4) masteryManager.triggerTraits(TRIGGERS.MATCH_4, type, traits, context);
                if (size >= 5) {

                    masteryManager.triggerTraits(TRIGGERS.MATCH_5, type, traits, context);
                }
                break;

            case ITEM_TYPES.BOW:
                // Piercing Damage (Ignores Shield)
                let pierceDmg = 3; // Tier 1

                // Splintered Arrowhead Relic
                if (runManager.hasRelic('splintered_arrowhead')) {
                    pierceDmg += 1;
                }

                // TODO: Add Bow Traits to Match Mastery Logic (placeholder for now)

                if (size >= 4) {
                    pierceDmg += 1; // Base scaling
                    masteryManager.triggerTraits(TRIGGERS.MATCH_4, type, traits, context);
                }
                if (size >= 5) {
                    pierceDmg += 1; // Base scaling

                    masteryManager.triggerTraits(TRIGGERS.MATCH_5, type, traits, context);
                }

                logManager.log(`Piercing Shot!`, 'damage');
                // Pass isPiercing option
                // Pass isPiercing option
                e.takeDamage(pierceDmg, p, { isPiercing: true });
                break;
        }

        this.emitState(); // Refresh UI after match resolution (traits/statuses)
    }

    endTurn() {
        if (this.turn !== ENTITIES.PLAYER) return;
        if (this.player.isDead || this.enemy.isDead) return;

        // --- PLAGUE DOCTOR: OVERDOSE MECHANIC ---
        this.checkToxinOverdose();

        // Trigger Turn End Events (Relics etc)
        // This allows relics like Greed Pact to trigger punishment before turn swap
        EventBus.emit(EVENTS.TURN_END, { combat: this });

        if (this.scene.gridView) {
            this.scene.gridView.skipAnimations();
        }
        if (window.grid) {
            window.grid.setFastForward(true);
        }

        this.turn = ENTITIES.ENEMY;

        // Player Turn End - Decay Statuses
        this.player.statusManager.onTurnEnd();

        // Status Effects (Turn Start for Enemy: Bleed/Regen)
        this.enemy.statusManager.onTurnStart();

        this.emitState();
        logManager.log("-- ENEMY TURN --", 'turn');

        if (this.turnTimer) this.turnTimer.remove(false);
        this.turnTimer = this.scene.time.delayedCall(800, () => {
            if (this.turn === ENTITIES.ENDED) return;
            this.enemy.resetBlock();

            const intent = this.enemy.currentIntent;

            // DEPRECATED MANUAL EMISSIONS:
            // ENEMY_DEFEND -> Handled by Enemy.addBlock -> ENTITY_DEFENDED
            // ENEMY_ATTACK -> Handled by Player.takeDamage -> ENTITY_DAMAGED
            // ENEMY_HEAL -> Handled by Enemy.heal -> ENTITY_HEALED

            // Buffs might be special if they don't call heal/block? 
            // e.g. Strength Up. Enemy.addStatus calls? No generic event for status add yet.
            // But intent 'BUFF' usually does something.

            if (intent && intent.type === 'BUFF') {
                if (intent.effect === 'HEAL') {
                    // Handled by heal() called in execute
                } else {
                    // Strength etc. - View might want to know? 
                    // For now, let's keep specific event or rely on status update UI?
                    // View listens to UI_UPDATE.
                    // But we want "Animation" for Buff.
                    // Let's leave BUFF manual emission if it's NOT just heal.
                }
            }

            // NOTE: ENEMY_ATTACK is NOT emitted here anymore. 
            // It is handled GENERICALLY by Entity.takeDamage() -> EVENTS.ENTITY_DAMAGED inside executeEnemyIntent()
            // except for DEBUFFS which might need special handling if they don't deal damage?
            // If DEBUFF deals 0 damage, Entity.takeDamage emits ENTITY_DAMAGED with 0 value.
            // But we might want specific animations for Debuffs.
            // Current Logic: DEBUFF triggers special effects via intent.effect check in CombatView (which listens to what?)
            // CombatView listens to specific events like ENEMY_LOCK.
            // If it's a generic debuff (weakness etc), we might miss it if we don't emit something?
            // But the double animation issue was specifically for ATTACK.

            this.executeEnemyIntent();

            if (this.player.isDead) {
                this.checkWinCondition();
                return;
            }

            // Decay Enemy Statuses
            this.enemy.statusManager.onTurnEnd();

            // Wait for animations (e.g. Attacks) to finish before giving control back
            this.waitForEnemyTurnComplete();
        });
    }

    checkToxinOverdose() {
        if (!this.enemy || this.enemy.isDead) return;

        if (runManager.hasRelic('corrupted_flask')) {
            let stacks = this.enemy.statusManager.getStack(STATUS_TYPES.TOXIN);
            while (stacks >= 12) {
                console.log(`[CombatManager] CheckToxinOverdose: ${stacks} stacks. BOOM!`);
                logManager.log(`OVERDOSE! Exploded for 25 True Damage!`, 'relic');
                const damage = 25;

                // Visuals for Explosion
                EventBus.emit(EVENTS.PLAYER_ATTACK, { damage: damage, type: 'CRIT' }); // Reuse crit visual for generic impact

                this.enemy.takeDamage(damage, this.player, { isPiercing: true });

                // Reduce stacks by 12 (preserving overflow)
                stacks -= 12;
                this.enemy.statusManager.stacks[STATUS_TYPES.TOXIN] = stacks;

                this.emitState(); // UI Update per explosion

                // Safety break for infinite loops (unlikely but good practice)
                if (stacks < 0) { stacks = 0; break; }
            }
        }
    }

    executeEnemyIntent() {
        if (!this.enemy.currentIntent) return;

        const intent = this.enemy.currentIntent;
        logManager.log(`Enemy executes: ${intent.text || intent.type}`, 'combat');

        switch (intent.type) {
            case MOVESET_TYPES.ATTACK:
                // Handle Special Attack Effects first (e.g., Shuffle from Earthquake)
                if (intent.effect === 'SHUFFLE') {
                    if (window.grid) {
                        EventBus.emit('visual:shake', { duration: 400, intensity: 0.005 }); // Earthquake
                        window.grid.reshuffle(true);
                        logManager.log('Earthquake! Board Shuffled.', 'warning');
                    }
                } else if (intent.effect === 'MANA_CONVERT') {
                    // Prismatic Resonance: Deal Damage + Convert Gems
                    // Damage is handled below by standard flow (since it's ATTACK now)
                    if (window.grid) {
                        const count = intent.count || 3;
                        window.grid.transmuteRandomGems(count, ITEM_TYPES.MANA, {
                            preModificationCallback: async (targets) => {
                                await new Promise(resolve => {
                                    EventBus.emit('enemy:prismatic_resonance', {
                                        targets,
                                        onComplete: resolve
                                    });
                                    // Safety fallback
                                    setTimeout(resolve, 3000);
                                });
                            }
                        }).then(c => logManager.log(`Prismatic Resonance: ${c} gems became MANA!`, 'warning'));
                    }
                }

                // Standard Damage Application
                const totalDmg = intent.value + this.enemy.getStrength();
                this.player.takeDamage(totalDmg, this.enemy);
                logManager.log(`Enemy attacks for ${totalDmg} (Base ${intent.value} + Str ${this.enemy.getStrength()})`, 'combat');

                break;
            case MOVESET_TYPES.DEFEND:
                this.enemy.addBlock(intent.value);
                break;
            case MOVESET_TYPES.BUFF:
                if (intent.effect === 'STRENGTH') {
                    // Compensation for Turn-End Decay: Add +1 Silent Stack
                    this.enemy.statusManager.applyStack(STATUS_TYPES.STRENGTH, 1, true);
                    this.enemy.statusManager.applyStack(STATUS_TYPES.STRENGTH, intent.value);
                    logManager.log(`Enemy gains ${intent.value} Strength!`, 'warning');

                    // SCRIPTED AI: Force 2 Attacks after Buff
                    const attackMove = this.enemy.moveset.find(m => m.type === MOVESET_TYPES.ATTACK);
                    if (attackMove) {
                        this.enemy.forcedIntents.push(attackMove);
                        this.enemy.forcedIntents.push(attackMove);
                    }
                } else if (intent.effect === 'HEAL') {
                    this.enemy.heal(intent.value);
                }
                break;
            case MOVESET_TYPES.DEBUFF:
                if (intent.effect === 'LOCK') {
                    if (window.grid) {
                        const targets = window.grid.lockRandomGems(intent.value, true);
                        logManager.log(`Enemy Locked ${targets.length} Gems!`, 'warning');
                        EventBus.emit(EVENTS.ENEMY_LOCK, { value: intent.value, targets: targets });
                    }
                } else if (intent.effect === 'TRASH') {
                    if (window.grid) {
                        const targets = window.grid.trashRandomGems(intent.value, true);
                        logManager.log(`Enemy Trashed ${targets.length} Gems!`, 'warning');
                        EventBus.emit(EVENTS.ENEMY_TRASH, { value: intent.value, targets: targets });
                    }
                } else if (intent.effect === 'MANA_DEVOUR') {
                    // Mana Devour Logic
                    if (window.grid) {
                        const manaType = ITEM_TYPES.MANA;
                        let manaCount = 0;
                        const targets = [];

                        window.grid.grid.forEach((row, r) => row.forEach((item, c) => {
                            if (item.type === manaType && !item.isTrash) {
                                manaCount++;
                                targets.push({ item, r, c });
                            }
                        }));

                        logManager.log(`Mana Devour: Consumed ${manaCount} Mana Gems!`, 'warning');

                        // trigger Visuals FIRST - Pass outcome data AND config
                        // We must wait for animation "Pop Up" phase before clearing grid
                        (async () => {
                            await new Promise(resolve => {
                                EventBus.emit('enemy:mana_devour', {
                                    targets: targets,
                                    manaCount: manaCount,
                                    config: this.enemy.manaDevourConfig || {},
                                    onComplete: resolve
                                });
                                // Safety fallback
                                setTimeout(resolve, 3000);
                            });

                            // Delayed Removal (After Pop Up)
                            targets.forEach(wrapper => {
                                wrapper.item.type = ITEM_TYPES.EMPTY;
                                EventBus.emit(EVENTS.GRID_ITEM_UPDATED, { item: wrapper.item, silent: true });
                            });

                            window.grid.applyGravity();
                            window.grid.refill();

                            // Re-enable Cascades (Propady)
                            const matches = window.grid.findMatches();
                            if (matches.length > 0) {
                                window.grid.handleMatchResolution(matches);
                            }

                            const devConfig = this.enemy.manaDevourConfig || {};
                            const threshold = devConfig.threshold || 6;

                            if (manaCount <= threshold) {
                                logManager.log('Mana Devour: Low Mana! Boss takes damage + Vulnerable!', 'positive');

                                // 1. Take Damage
                                const dmgPer = devConfig.damagePerGem || 5;
                                const selfDmg = manaCount * dmgPer;
                                if (selfDmg > 0) {
                                    this.enemy.takeDamage(selfDmg, null, { isPiercing: true });
                                }

                                // 2. Apply Vulnerable
                                const vulnStacks = devConfig.vulnerableStacks || 3;
                                this.enemy.statusManager.applyStack(STATUS_TYPES.VULNERABLE, vulnStacks);
                            } else {
                                logManager.log('Mana Devour: High Mana! Boss Heals + Strength!', 'negative');

                                // 1. Heal
                                const healPer = devConfig.healPerGem || 3;
                                const healAmount = manaCount * healPer;
                                this.enemy.heal(healAmount);

                                // 2. Apply Strength
                                const strStacks = devConfig.strengthStacks || 3;
                                // Apply +1 silent (decay compensation) + Visible Stacks
                                this.enemy.statusManager.applyStack(STATUS_TYPES.STRENGTH, 1, true);
                                this.enemy.statusManager.applyStack(STATUS_TYPES.STRENGTH, strStacks);
                            }
                        })();
                    }
                }
                break;
        }
    }

    waitForEnemyTurnComplete(retryCount = 0) {
        if (this.turn === ENTITIES.ENDED) return;

        // 1. Check if View is animating
        const isAnimating = (this.scene && this.scene.combatView && this.scene.combatView.isAnimating);

        if (!isAnimating) {
            // Done! Start Player Turn
            this.startPlayerTurn();
        } else {
            // Still animating, wait for event or timeout

            // Failsafe: If we are stuck waiting for too long (e.g. 5 seconds), force proceed
            if (retryCount > 50) { // 50 * 100ms = 5s
                console.warn('[CombatManager] Enemy Turn Wait Timed Out! Forcing Turn Start.');
                this.startPlayerTurn();
                return;
            }

            // Ideally we wait for EVENT, but a polling fallback is robust against missed events
            this.scene.time.delayedCall(100, () => this.waitForEnemyTurnComplete(retryCount + 1));
        }
    }

    startPlayerTurn() {
        if (this.turn === ENTITIES.ENDED) return;
        this.turn = ENTITIES.PLAYER;

        // Reset Turn State
        this.turnState = {
            goldCollected: false
        };

        // Status Effects (Turn Start)
        this.player.statusManager.onTurnStart();

        if (window.grid) window.grid.setFastForward(false);

        // Check for Deadlock (if enemy locked everything)
        if (this.scene && this.scene.gridLogic) {
            this.scene.gridLogic.checkDeadlock();
        }

        this.currentMoves = this.maxMoves;
        this.player.resetBlock();

        // Generate Next Intent
        this.generateEnemyIntent();

        EventBus.emit(EVENTS.TURN_START, { combat: this });

        // Emit State immediately to clear any potential 'disabled' UI from animation locks
        this.emitState();

        logManager.log("-- PLAYER TURN --", 'turn');
    }

    generateEnemyIntent() {
        // 1. Check Forced/Scripted Intents
        if (this.enemy.forcedIntents && this.enemy.forcedIntents.length > 0) {
            const next = this.enemy.forcedIntents.shift(); // Pop first
            this.enemy.currentIntent = { ...next };

            // Dynamic Update for Strength
            // Dynamic Update for Strength
            if (this.enemy.currentIntent.type === 'ATTACK') {
                const currentStr = this.enemy.getStrength();
                if (currentStr > 0) {
                    const totalDmg = this.enemy.currentIntent.value + currentStr;
                    if (this.enemy.currentIntent.effect === 'MANA_CONVERT') {
                        this.enemy.currentIntent.text = `Prismatic Resonance (${totalDmg} Dmg + Spawn Mana)`;
                    } else if (this.enemy.currentIntent.effect === 'SHUFFLE') {
                        this.enemy.currentIntent.text = `Earthquake (${totalDmg} Dmg + Shuffle)`;
                    } else {
                        this.enemy.currentIntent.text = `Attack (${totalDmg})`;
                    }
                }
            }
            console.log(`Enemy Intent (Forced): ${this.enemy.currentIntent.text}`);
            return;
        }

        const moveset = this.enemy.moveset;
        if (!moveset || moveset.length === 0) {
            // Fallback
            this.enemy.currentIntent = { type: 'ATTACK', value: 5, text: 'Attack (5)' };
            return;
        }

        // --- BOSS LOGIC: CRYSTAL BURROWER (4-Turn Loop) ---
        if (this.enemyId === 'crystal_burrower') {
            if (typeof this.enemy.patternIndex === 'undefined') {
                this.enemy.patternIndex = 0;
            }

            // Fixed Loop: 0 -> 1 -> 2 -> 3 -> 0
            const moveIndex = this.enemy.patternIndex % 4;
            const selectedMove = moveset[moveIndex];

            this.enemy.currentIntent = { ...selectedMove };

            // Advance pattern for NEXT turn
            this.enemy.patternIndex++;

            console.log(`Crystal Burrower Intent: Index ${moveIndex} (${this.enemy.currentIntent.text})`);
        } else {
            // Standard Weighted Random Selection
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
            this.enemy.currentIntent = { ...selectedMove };
        }

        // Update Text for ATTACK to show Strength
        // Update Text for ATTACK to show Strength
        if (this.enemy.currentIntent.type === 'ATTACK') {
            const currentStr = this.enemy.getStrength();
            if (currentStr > 0) {
                const totalDmg = this.enemy.currentIntent.value + currentStr;
                // Special naming for known moves
                if (this.enemy.currentIntent.effect === 'MANA_CONVERT') {
                    this.enemy.currentIntent.text = `Prismatic Resonance (${totalDmg} Dmg + Spawn Mana)`;
                } else if (this.enemy.currentIntent.effect === 'SHUFFLE') {
                    this.enemy.currentIntent.text = `Earthquake (${totalDmg} Dmg + Shuffle)`;
                } else {
                    this.enemy.currentIntent.text = `Attack (${totalDmg})`;
                }
            }
        }

    }


    checkWinCondition() {
        if (this.turn === ENTITIES.ENDED) return;

        // 1. Check Player Death
        if (this.player.isDead) {
            // Phoenix Feather Relic Check
            if (runManager.hasRelic('phoenix_feather')) {
                logManager.log('Phoenix Feather activates!', 'relic');

                // Revive
                const reviveHP = Math.floor(this.player.maxHP * 0.5);
                this.player.currentHP = reviveHP;
                this.player.isDead = false; // CRITICAL FIX: Clear death flag

                // Update Global State immediately to prevent sync issues
                runManager.updatePlayerState(this.player.currentHP, this.player.gold);

                // Remove Relic
                runManager.removeRelic('phoenix_feather');

                this.emitState(); // Update UI

                // Optional: Emit specific resurrection event for specialized UI
                // EventBus.emit(EVENTS.PLAYER_RESURRECTED); 

                return; // Prevent Game Over
            }

            this.turn = ENTITIES.ENDED;
            logManager.log('DEFEAT! Player has died.', 'turn');
            EventBus.emit(EVENTS.GAME_OVER, { combat: this });
            return;
        }


        if (this.enemy.isDead) {
            this.turn = ENTITIES.ENDED;
            logManager.log('VICTORY! Enemy defeated!', 'turn');
            EventBus.emit(EVENTS.VICTORY, { combat: this });

            // RewardScene handles Gold Reward application now!
            const currentGold = this.player.gold;

            // SYNCHRONIZE LOCAL STATE
            runManager.updatePlayerState(this.player.currentHP, currentGold);

            // Navigation is handled by BattleScene (handleVictory) via EVENTS.VICTORY
            return;
            return;
        }
    }

    log(message, type = 'info') {
        logManager.log(message, type);
    }
}
