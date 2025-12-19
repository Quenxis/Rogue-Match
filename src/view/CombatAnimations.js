/**
 * @file CombatAnimations.js
 * @description Handles all combat visual effects and animations.
 * Decoupled from CombatView state - functions are stateless or take dependencies as args.
 */

import { ASSETS, GAME_SETTINGS } from '../core/Constants.js';

export class CombatAnimations {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Generic tween for a button press effect.
     * @param {Phaser.GameObjects.Container|Sprite} btn 
     */
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
     * Animates an attack lunge and recoil.
     * @param {Phaser.GameObjects.Sprite} attacker 
     * @param {Phaser.GameObjects.Sprite} target 
     * @param {number} offset - Distance to lunge (positive for player, negative for enemy usually)
     * @param {number} tint - Tint to apply to target on hit
     * @param {Function} onComplete 
     */
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

    /**
     * Visual feedback for being hit.
     * @param {Phaser.GameObjects.Sprite} target 
     * @param {number} tint 
     */
    animateHit(target, tint = 0xff0000) {
        if (!target || !this.scene) return;

        // Flash Tint
        if (target.setTint) target.setTint(tint);
        this.scene.time.delayedCall(200, () => {
            if (target.clearTint) target.clearTint();
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
        // Use getCenter if available, else fallback
        shieldCircle.y = (target.getCenter) ? target.getCenter().y : target.y - (target.displayHeight / 2);
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

    animateToxicApply(target, onComplete = null) {
        if (!target || !this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. VISUAL EFFECT: RISING TOXIC BUBBLES
        const particles = this.scene.add.graphics();
        particles.setDepth(target.depth + 1);
        particles.blendMode = Phaser.BlendModes.NORMAL;

        // Toxic Green / Black palette
        particles.fillStyle(0x111111, 1); // Start Black

        const w = target.displayWidth || target.width;

        // Draw 5-8 random bubbles
        for (let i = 0; i < 8; i++) {
            const offsetX = (Math.random() - 0.5) * w * 0.6;
            const offsetY = (Math.random() * -30);
            const radius = 2 + Math.random() * 5;

            // Mix Neon Green and Black
            const color = Math.random() > 0.5 ? 0x39ff14 : 0x000000;
            particles.fillStyle(color, 1); // Opaque for black to be visible
            particles.fillCircle(offsetX, offsetY, radius);
        }

        particles.x = target.x;
        particles.y = target.y - 10;

        // Animate Floating Up
        this.scene.tweens.add({
            targets: particles,
            y: particles.y - 100,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 1200, // Slower, more viscous
            ease: 'Sine.Out',
            onComplete: () => {
                particles.destroy();
            }
        });

        // 2. CHARACTER PULSE (Sickly Green Tint)
        const startScaleX = target.scaleX;
        const startScaleY = target.scaleY;

        if (target.setTint) target.setTint(0x88ff88); // Sickly Green

        this.scene.tweens.add({
            targets: target,
            scaleX: startScaleX * 1.05, // Subtle shudder
            scaleY: startScaleY * 1.05,
            yoyo: true,
            duration: 500,
            onComplete: () => {
                if (target.clearTint) target.clearTint();
                if (onComplete) onComplete();
            }
        });
    }

    showTurnBanner() {
        if (!this.scene) return;
        const cx = this.scene.scale.width / 2;
        const cy = this.scene.scale.height / 2;

        const container = this.scene.add.container(cx, cy);
        container.setDepth(100); // Top layer

        const bg = this.scene.add.rectangle(0, 0, 800, 100, 0x000000, 0.7);
        const text = this.scene.add.text(0, 0, "-- YOUR TURN --", {
            font: 'bold 48px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        container.add([bg, text]);
        container.setAlpha(0);
        container.setScale(0.8);

        this.scene.tweens.add({
            targets: container,
            alpha: 1,
            scale: 1,
            duration: 300,
            ease: 'Back.out',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: container,
                    alpha: 0,
                    scale: 1.2,
                    duration: 500,
                    delay: 800, // Stay on screen for bit
                    ease: 'Power2',
                    onComplete: () => {
                        container.destroy();
                    }
                });
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

        const w = target.displayWidth || target.width;

        // Draw 5-8 random bubbles
        for (let i = 0; i < 8; i++) {
            // Spread horizontally around center
            const offsetX = (Math.random() - 0.5) * w * 0.6;
            // Spread vertically slightly (start/stagger)
            const offsetY = (Math.random() * -30);

            const radius = 2 + Math.random() * 5;

            particles.fillCircle(offsetX, offsetY, radius);
        }

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

    animateGridShake(sourceSprite, onComplete = null) {
        if (!this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 0. Enemy Lunge Animation (Visual Feedback that Enemy is doing it)
        // If sourceSprite is provided (e.g. Enemy), animate it.
        const enemy = sourceSprite;
        const startX = enemy ? enemy.x : 0;

        const performShake = () => {
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
                    if (!enemy && onComplete) onComplete();
                }
            });
        };

        if (enemy) {
            // Move forward slightly
            this.scene.tweens.add({
                targets: enemy,
                x: startX - 50, // Move left (towards grid center usually)
                duration: 200,
                yoyo: true,
                ease: 'Power1',
                onYoyo: () => {
                    performShake();
                },
                onComplete: () => {
                    enemy.x = startX; // Reset Position
                    // Do NOT call onComplete here. Wait for shake.
                }
            });

            // Wait for Shake (starts at 200ms, lasts ~600ms -> ends at ~800ms)
            // Add safety buffer -> 900ms
            this.scene.time.delayedCall(900, () => {
                if (onComplete) onComplete();
            });
        } else {
            performShake();
        }
    }

    animateGridLock(sourceSprite, targets = [], onComplete = null) {
        if (!this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. Hide Grid Overlays IMMEDIATELY (so they don't appear before projectile lands)
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
        const enemy = sourceSprite;
        const startX = enemy ? enemy.x : 0;
        const startY = enemy ? enemy.y - (enemy.height * 0.5) : 0; // Chest height

        const spawnProjectiles = () => {
            // SPAWN PROJECTILES (LOCKS)
            // Use actual targets or fallback to random count if missing (safeguard)
            const lockCount = (targets && targets.length > 0) ? targets.length : 3;

            // Grid Metrics for targeting
            let getTargetPos;
            if (this.scene.gridView && window.grid) {
                const gv = this.scene.gridView;
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
                let lock;
                if (this.scene.textures.exists(ASSETS.ICON_LOCK)) {
                    lock = this.scene.add.image(enemy ? enemy.x - 20 : 0, startY, ASSETS.ICON_LOCK);
                    lock.setDisplaySize(40, 40);
                } else {
                    lock = this.scene.add.text(enemy ? enemy.x - 20 : 0, startY, '🔒', { fontSize: '32px' }).setOrigin(0.5);
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
                    duration: 200,
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
                                // IMPACT VISUAL: 1. Expand Projectile (Lock) to cover
                                this.scene.tweens.add({
                                    targets: lock,
                                    scale: 1.2, // Go slightly bigger than grid item
                                    duration: 100,
                                    ease: 'Quad.Out',
                                    onComplete: () => {
                                        // 2. REVEAL GRID OVERLAY (Now covered by projectile)
                                        if (currentTargetId && targetOverlays[currentTargetId]) {
                                            const overlay = targetOverlays[currentTargetId];
                                            overlay.setAlpha(1);
                                            // Pop the overlay itself
                                            this.scene.tweens.add({
                                                targets: overlay,
                                                scaleX: 1.0,
                                                scaleY: 1.0,
                                                yoyo: true,
                                                duration: 200
                                            });
                                        }

                                        // 3. Fade Out / Destroy Projectile
                                        this.scene.tweens.add({
                                            targets: lock,
                                            scale: 0.6,
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
                });
            }

            // Wait for longest flight (1000ms approx timeline)
            this.scene.time.delayedCall(1200, () => {
                // Always signal completion here, ensuring projectiles are done.
                if (onComplete) onComplete();
            });
        };

        if (enemy) {
            this.scene.tweens.add({
                targets: enemy,
                x: startX - 50,
                duration: 200,
                yoyo: true,
                ease: 'Power1',
                onYoyo: () => {
                    spawnProjectiles();
                },
                onComplete: () => {
                    enemy.x = startX;
                    // Do NOT call onComplete here. Wait for projectiles.
                }
            });
        } else {
            spawnProjectiles();
        }
    }

    animateOutbreak(sourceSprite, data, onComplete = null) {
        if (!this.scene) return;
        const targets = data.targets || [];

        // 1. Source: Player
        const player = sourceSprite;
        const startX = player ? player.x : 0;
        const startY = player ? player.y - (player.height * 0.5) : 0;

        const spawnPotions = () => {
            // SPAWN POTIONS
            const count = (targets && targets.length > 0) ? targets.length : 3;
            let completedCount = 0;

            // Grid Helper
            let getTargetPos;
            if (this.scene.gridView && window.grid) {
                const gv = this.scene.gridView;
                getTargetPos = (r, c) => ({
                    x: gv.offsetX + c * gv.tileSize,
                    y: gv.offsetY + r * gv.tileSize
                });
            } else {
                if (data.onComplete) data.onComplete();
                if (onComplete) onComplete();
                return;
            }

            for (let i = 0; i < count; i++) {
                // Create Potion Sprite (Using Grid Texture)
                let potion;
                const tex = ASSETS.POTION || 'POTION';
                if (this.scene.textures.exists(tex)) {
                    const size = 50 * GAME_SETTINGS.GRID_SCALE;
                    potion = this.scene.add.image(player ? player.x + 20 : 0, startY, tex);
                    potion.setDisplaySize(size, size);
                } else {
                    potion = this.scene.add.image(player ? player.x + 20 : 0, startY, 'icon_potion');
                    potion.setDisplaySize(40, 40);
                }
                potion.setDepth(500);
                potion.scale = 0;

                // Target
                let tx, ty;
                if (targets && targets[i]) {
                    const pos = getTargetPos(targets[i].r, targets[i].c);
                    tx = pos.x;
                    ty = pos.y;
                } else {
                    tx = this.scene.scale.width / 2;
                    ty = this.scene.scale.height / 2;
                }

                // Timeline: Pop In -> Fly -> Impact (Lock Style)
                this.scene.tweens.add({
                    targets: potion,
                    scale: 0.6,
                    duration: 100,
                    delay: i * 50,
                    onComplete: () => {
                        // Fly
                        this.scene.tweens.add({
                            targets: potion,
                            x: tx,
                            y: ty,
                            rotation: Math.PI * 4,
                            duration: 250,
                            ease: 'Quad.Out',
                            onComplete: () => {
                                // IMPACT: 1. Expand to cover grid cell
                                this.scene.tweens.add({
                                    targets: potion,
                                    scale: 1.0, // Expand to cover
                                    duration: 150,
                                    ease: 'Quad.Out',
                                    onComplete: () => {
                                        // 2. TIMING: Trigger Logic NOW (Grid updates under the covered sprite)
                                        completedCount++;
                                        if (completedCount >= count) {
                                            if (data.onComplete) data.onComplete();
                                        }

                                        // 3. Visual "Settling" (Fade Out or Shrink slightly then vanish)
                                        this.scene.tweens.add({
                                            targets: potion,
                                            scale: 1.0,
                                            alpha: 0,
                                            duration: 250,
                                            onComplete: () => {
                                                potion.destroy();
                                                // Only trigger if this matches total count (regardless of player existence)
                                                if (completedCount >= count && onComplete) onComplete();
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        };

        if (player) {
            // Lunge Animation
            this.scene.tweens.add({
                targets: player,
                x: startX + 50, // Move Right (towards grid)
                duration: 200,
                yoyo: true,
                ease: 'Power1',
                onYoyo: () => {
                    spawnPotions();
                },
                onComplete: () => {
                    player.x = startX;
                    // Do NOT call onComplete here. Wait for potions.
                }
            });
        } else {
            spawnPotions();
        }
    }

    animateExtraction(sourceSprite, targetSprite, data, onComplete = null) {
        if (!this.scene) return;

        const enemy = sourceSprite;
        const player = targetSprite;

        if (!enemy || !player) {
            if (onComplete) onComplete(); // Fail safe
            return;
        }

        const startX = enemy.x;
        const startY = enemy.y - (enemy.height * 0.5);
        const targetX = player.x;
        const targetY = player.y - (player.height * 0.5);

        // 1. Create Particles (Energy Blobs) - SWARM EFFECT (Restored)
        const particleCount = 25;

        for (let i = 0; i < particleCount; i++) {
            // Mix Neon Green and Black
            const color = Math.random() > 0.5 ? 0x39ff14 : 0x000000;
            // Spawn randomly around enemy body
            const w = enemy.displayWidth || 100;
            const h = enemy.displayHeight || 100;
            const spawnX = startX + (Math.random() - 0.5) * w;
            const spawnY = startY + (Math.random() - 0.5) * h;

            const blob = this.scene.add.circle(spawnX, spawnY, 4 + Math.random() * 6, color);
            blob.setDepth(200);
            blob.setAlpha(0.8);

            this.scene.tweens.add({
                targets: blob,
                x: targetX,
                y: targetY,
                scale: { from: 1, to: 0.2 }, // Shrink as absorbed
                // Randomize flight time for chaotic "swarm" feel
                duration: 600 + Math.random() * 600,
                delay: i * 20, // Staggered start (stream effect)
                ease: 'Quad.In', // Accelerate towards player
                onComplete: () => {
                    blob.destroy();
                }
            });
        }

        // 2. Flash Player (Absorption)
        const startScaleX = player.scaleX;
        const startScaleY = player.scaleY;

        // Delay flash until some particles arrive
        this.scene.time.delayedCall(600, () => {
            if (player.setTint) player.setTint(0x39ff14);
            this.scene.tweens.add({
                targets: player,
                scaleX: startScaleX * 1.05,
                scaleY: startScaleY * 1.05,
                yoyo: true,
                duration: 200,
                onComplete: () => {
                    player.setScale(startScaleX, startScaleY); // Reset to ensure safety
                    if (player.clearTint) player.clearTint();
                }
            });
        });

        // 3. Wait for ALL animations (Particles take max ~1200ms)
        this.scene.time.delayedCall(1300, () => {
            if (onComplete) onComplete();
        });
    }

    createPotionSplash(x, y) {
        // Mini splash effect
        const particles = this.scene.add.graphics();
        particles.setDepth(200);

        for (let j = 0; j < 6; j++) {
            const color = Math.random() > 0.5 ? 0x00ff00 : 0x8800ff; // Green/Purple
            particles.fillStyle(color, 1);
            particles.fillCircle(x, y, 2 + Math.random() * 4);
        }

        this.scene.tweens.add({
            targets: particles,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => particles.destroy()
        });
    }

    animatePrismaticResonance(sourceSprite, data, onComplete) {
        if (!this.scene) return;
        const targets = data.targets || [];

        // 1. Source: Boss
        const source = sourceSprite;
        const startX = source ? source.x : 0;
        const startY = source ? source.y - (source.height * 0.5) : 0;

        // Grid Helper
        let getTargetPos;
        if (this.scene.gridView && window.grid) {
            const gv = this.scene.gridView;
            getTargetPos = (r, c) => ({
                x: gv.offsetX + c * gv.tileSize,
                y: gv.offsetY + r * gv.tileSize
            });
        } else {
            if (onComplete) onComplete();
            return;
        }

        // 2. Animate Projectiles (Mana Crystals)
        let completedCount = 0;
        const total = targets.length;
        if (total === 0) {
            if (data.onComplete) data.onComplete(); // Ensure logic proceeds even if no targets
            if (onComplete) onComplete();
            return;
        }

        targets.forEach((t, i) => {
            // Create Mana Crystal Sprite (Using Grid Texture)
            let crystal;
            if (this.scene.textures.exists(ASSETS.MANA)) {
                const size = 50 * GAME_SETTINGS.GRID_SCALE;
                crystal = this.scene.add.image(startX, startY, ASSETS.MANA).setDisplaySize(size, size);
            } else {
                crystal = this.scene.add.text(startX, startY, '💎', { fontSize: '32px' }).setOrigin(0.5);
            }
            crystal.setDepth(500);
            crystal.scale = 0; // Start small for Pop In

            const pos = getTargetPos(t.r, t.c);

            // Timeline: Pop In -> Fly -> Impact (Lock Style)
            this.scene.tweens.add({
                targets: crystal,
                scale: 0.6, // Pop In
                duration: 100,
                delay: i * 50,
                onComplete: () => {
                    // Fly
                    this.scene.tweens.add({
                        targets: crystal,
                        x: pos.x,
                        y: pos.y,
                        rotation: Math.PI * 4,
                        duration: 400,
                        ease: 'Quad.Out',
                        onComplete: () => {
                            // IMPACT: 1. Expand to cover grid cell
                            this.scene.tweens.add({
                                targets: crystal,
                                scale: 1.0, // Expand to cover
                                duration: 100,
                                ease: 'Quad.Out',
                                onComplete: () => {
                                    // 2. TIMING: Trigger Logic NOW
                                    completedCount++;
                                    if (completedCount >= total) {
                                        if (data.onComplete) data.onComplete();
                                    }

                                    // 3. Visual "Settling"
                                    this.scene.tweens.add({
                                        targets: crystal,
                                        scale: 1.0,
                                        alpha: 0,
                                        duration: 200,
                                        onComplete: () => {
                                            crystal.destroy();
                                            if (completedCount >= total && onComplete) onComplete();
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    animateManaDevour(sourceSprite, data, onComplete) {
        if (!this.scene) return;
        const targets = data.targets || [];
        const manaCount = data.manaCount || 0;
        const config = data.config || {};

        // 1. Source: Boss (Devouring)
        const source = sourceSprite;
        const bossX = source ? source.x : this.scene.scale.width * 0.8;
        const bossY = source ? source.y - (source.height * 0.5) : this.scene.scale.height * 0.5;

        // Grid Helper
        let getTargetPos;
        if (this.scene.gridView && window.grid) {
            const gv = this.scene.gridView;
            getTargetPos = (r, c) => ({
                x: gv.offsetX + c * gv.tileSize,
                y: gv.offsetY + r * gv.tileSize
            });
        } else {
            console.error('Missing GridView');
            if (data.onComplete) data.onComplete();
            if (onComplete) onComplete();
            return;
        }

        // 2. STAGE 1: Pop Up Mana Gems (Visual Focus)
        // Optimization: Cap visual particles to prevent freeze on full board (64 gems)
        const maxVisuals = 20;
        let visualTargets = targets;

        if (targets.length > maxVisuals) {
            // Randomly select subset for "Swarm" look without performance hit
            visualTargets = [...targets].sort(() => 0.5 - Math.random()).slice(0, maxVisuals);
        }

        let processed = 0;
        let completedCount = 0;
        const total = visualTargets.length;

        if (total === 0) {
            if (data.onComplete) data.onComplete();
            if (onComplete) onComplete();
            return;
        }

        visualTargets.forEach((t, i) => {
            // Create "Ghost" Gem that lifts up
            const pos = getTargetPos(t.r, t.c); // t.item, t.r, t.c

            let ghost;
            if (this.scene.textures.exists(ASSETS.MANA)) {
                const size = 50 * GAME_SETTINGS.GRID_SCALE;
                ghost = this.scene.add.image(pos.x, pos.y, ASSETS.MANA).setDisplaySize(size, size);
            } else {
                ghost = this.scene.add.text(pos.x, pos.y, '💎', { fontSize: '32px' }).setOrigin(0.5);
            }
            ghost.setDepth(600);
            ghost.setAlpha(1); // Start fully opaque

            // Animate: Pulse (Pop Up) - No floating
            this.scene.tweens.add({
                targets: ghost,
                scale: 0.8,
                duration: 400,
                ease: 'Back.out',
                delay: i * 30,
                onComplete: () => {
                    // STAGE 2: If this was the last one, signal LOGIC to clear grid
                    processed++;
                    if (processed === total) {
                        if (data.onComplete) data.onComplete(); // Logic clears grid now
                    }

                    // Fly to Boss
                    this.scene.tweens.add({
                        targets: ghost,
                        x: bossX,
                        y: bossY,
                        scale: 0.2, // Shrink
                        alpha: 1, // Keep opaque while flying
                        duration: 600,
                        ease: 'Quad.In',
                        delay: 50,
                        onComplete: () => {
                            // Completed counting for final effect
                            completedCount++; // Using a local var for flight completion

                            if (completedCount === total) {
                                // Final Absorb Effect on Boss & Outcome
                                const count = data.manaCount || 0;
                                const threshold = (data.config && data.config.threshold) || 6;

                                if (source) {
                                    if (count > threshold) {
                                        // HIGH MANA: Power Up (Purple)
                                        this.scene.tweens.add({
                                            targets: source,
                                            scaleX: source.scaleX * 1.15,
                                            scaleY: source.scaleY * 1.15,
                                            duration: 300,
                                            yoyo: true,
                                            ease: 'Sine.InOut',
                                            onStart: () => source.setTint(0xaa44ff),
                                            onComplete: () => {
                                                source.clearTint();
                                                if (onComplete) onComplete();
                                            }
                                        });

                                        this.showFloatingText(bossX, bossY - 80, "STRENGTH", 0xaa44ff);
                                    } else {
                                        // LOW MANA: Weakened (Gray)
                                        this.scene.tweens.add({
                                            targets: source,
                                            x: '+=6',
                                            duration: 50,
                                            yoyo: true,
                                            repeat: 5,
                                            onStart: () => source.setTint(0x888888),
                                            onComplete: () => {
                                                source.clearTint();
                                                if (onComplete) onComplete();
                                            }
                                        });

                                        this.showFloatingText(bossX, bossY - 80, "VULNERABLE", 0xff4444);
                                    }
                                } else {
                                    // Fallback if no source sprite
                                    if (onComplete) onComplete();
                                }
                            }
                            // DESTROY SPRITE ALWAYS
                            ghost.destroy();
                        }
                    });
                }
            });
        });
    }

    // Helper: Show floating text (Ported from CombatView)
    showFloatingText(x, y, text, color = 0xffffff) {
        if (!this.scene) return;

        const txt = this.scene.add.text(x, y, text, {
            fontFamily: 'Verdana',
            fontSize: '24px',
            color: typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color,
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);
        txt.setDepth(1000);

        this.scene.tweens.add({
            targets: txt,
            y: y - 50,
            alpha: 0,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => txt.destroy()
        });
    }

}
