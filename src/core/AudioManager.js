/**
 * @file AudioManager.js
 * @description Global Audio Manager for handling Background Music (BGM) and Sound Effects (SFX).
 * @dependencies Phaser
 */

export class AudioManager {
    constructor() {
        this.bgm = null;
        this.currentKey = null;
        this.volume = 0.5;
        this.muted = false;
        this.scene = null; // Reference to a scene to access sound manager
    }

    /**
     * Initialize with a scene reference (usually BootScene or the first active scene).
     * Phaser Sound Manager is global, so any scene reference works.
     * @param {Phaser.Scene} scene 
     */
    init(scene) {
        this.scene = scene;
        console.log('AudioManager initialized');
    }

    playBGM(key, scene = null) {
        if (scene) {
            this.scene = scene;
        }
        if (!this.scene) return;

        this.currentKey = key;

        // Browser Autoplay Policy: If locked, wait for unlock event
        if (this.scene.sound.locked) {
            console.log(`AudioManager: Audio locked. Waiting to play '${key}'...`);
            this.scene.sound.once('unlocked', () => {
                console.log('AudioManager: Unlocked. Resuming playback.');
                this.playBGM(this.currentKey);
            });
            return;
        }

        // If same music is playing, do nothing
        if (this.currentKey === key && this.bgm && this.bgm.isPlaying) return;

        // Stop previous
        this.stopBGM();

        // Play new
        this.currentKey = key;
        // Check if cache has it
        if (this.scene.cache.audio.exists(key)) {
            this.bgm = this.scene.sound.add(key, {
                loop: true,
                volume: this.volume
            });

            // Only play if allowed
            if (!this.muted) {
                this.bgm.play({ loop: true, volume: this.volume });
            }
        } else {
            console.warn(`AudioManager: Audio key '${key}' not found in cache.`);
        }
    }

    stopBGM() {
        if (this.bgm) {
            this.bgm.stop();
            this.bgm.destroy();
            this.bgm = null;
        }
        this.currentKey = null;
    }

    playSFX(key, config = {}) {
        if (!this.scene || this.muted) return;
        if (this.scene.cache.audio.exists(key)) {
            this.scene.sound.play(key, {
                volume: (config.volume || 1.0) * this.volume,
                ...config
            });
        }
    }

    setVolume(value) {
        this.volume = Phaser.Math.Clamp(value, 0, 1);
        if (this.bgm) {
            this.bgm.setVolume(this.volume);
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.bgm) {
            if (this.muted) this.bgm.pause();
            else this.bgm.resume();
        }
        return this.muted;
    }
}

export const audioManager = new AudioManager();
