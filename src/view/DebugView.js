
import { EventBus } from '../core/EventBus.js';
import { runManager } from '../core/RunManager.js';
import { masteryManager } from '../logic/MasteryManager.js';
import { RELICS } from '../data/relics.js';
import { ACTS } from '../data/acts.js';
import { STATUS_TYPES, EVENTS } from '../core/Constants.js';
import { logManager } from '../core/LogManager.js';

/**
 * @file DebugView.js
 * @description DOM-based Debug Console for absolute persistence and stability.
 */
export class DebugView {
    constructor() {
        this.visible = false;
        this.currentTab = 'CHEATS';
        this.refreshInterval = null;

        this._initDOM();
        this._initListeners();
        this.render();
    }

    _initDOM() {
        // Remove existing if any
        const existing = document.getElementById('debug-console-root');
        if (existing) existing.remove();

        // Create Root
        this.root = document.createElement('div');
        this.root.id = 'debug-console-root';
        Object.assign(this.root.style, {
            position: 'absolute',
            top: '50px',
            left: '50px',
            width: '600px',
            height: '500px',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            border: '2px solid #00ff00',
            borderRadius: '8px',
            color: '#00ff00',
            fontFamily: 'monospace',
            zIndex: '10000',
            display: 'none',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 0 20px rgba(0, 255, 0, 0.2)',
            userSelect: 'none'
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '10px',
            backgroundColor: '#111',
            borderBottom: '1px solid #00ff00',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'move'
        });
        header.innerHTML = '<span style="font-weight: bold; letter-spacing: 2px;">DEBUG CONSOLE</span>';

        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '[X]';
        Object.assign(closeBtn.style, { color: '#ff4444', cursor: 'pointer', fontWeight: 'bold', padding: '0 5px' });
        closeBtn.onclick = () => this.toggle();
        header.appendChild(closeBtn);
        this.root.appendChild(header);

        // Dragging Logic
        let isDragging = false;
        let startX, startY;
        header.onmousedown = (e) => {
            isDragging = true;
            startX = e.clientX - this.root.offsetLeft;
            startY = e.clientY - this.root.offsetTop;
        };
        window.onmousemove = (e) => {
            if (!isDragging) return;
            this.root.style.left = (e.clientX - startX) + 'px';
            this.root.style.top = (e.clientY - startY) + 'px';
        };
        window.onmouseup = () => isDragging = false;

        // Tabs
        const tabRow = document.createElement('div');
        Object.assign(tabRow.style, {
            padding: '5px 10px',
            backgroundColor: '#050505',
            borderBottom: '1px solid #333',
            display: 'flex',
            gap: '15px'
        });

        ['CHEATS', 'MASTERIES', 'RELICS', 'STATS'].forEach(tab => {
            const t = document.createElement('div');
            t.className = 'debug-tab';
            t.dataset.tab = tab;
            t.innerHTML = `[ ${tab} ]`;
            Object.assign(t.style, {
                cursor: 'pointer',
                color: '#888',
                fontSize: '14px'
            });
            t.onclick = () => this.switchTab(tab);
            tabRow.appendChild(t);
        });
        this.root.appendChild(tabRow);

        // Content Area
        this.content = document.createElement('div');
        Object.assign(this.content.style, {
            padding: '15px',
            flex: '1',
            overflowY: 'auto'
        });
        this.root.appendChild(this.content);

        document.body.appendChild(this.root);
    }

    _initListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '`' || (e.shiftKey && e.code === 'KeyD')) {
                this.toggle();
            }
        });
        window.toggleDebug = () => this.toggle();

        // Refresh on scene changes
        EventBus.on(EVENTS.SCENE_READY, () => {
            if (this.visible) this.render();
        });

        // Global EventBus listener
        EventBus.on('debug:toggle', () => this.toggle());
    }

    toggle() {
        this.visible = !this.visible;
        this.root.style.display = this.visible ? 'flex' : 'none';

        if (this.visible) {
            this.render();
            // Start auto-refresh for stats/relics
            this.refreshInterval = setInterval(() => this.renderPartial(), 500);
        } else {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        this.render();
    }

    /**
     * Partial render for real-time stats without rebuilding the whole DOM
     */
    renderPartial() {
        if (!this.visible) return;

        // For now, full render is fine for performance, but we can optimize later
        // The most important is that STATS and MASTERIES/RELICS update if something changed
        if (this.currentTab === 'STATS') {
            this.renderStats();
        }
    }

    render() {
        if (!this.root) return;

        // Update Tabs
        this.root.querySelectorAll('.debug-tab').forEach(t => {
            const isActive = t.dataset.tab === this.currentTab;
            t.style.color = isActive ? '#00ff00' : '#888';
            t.style.fontWeight = isActive ? 'bold' : 'normal';
        });

        // Clear Content (Full rebuild for simplicity and safety)
        this.content.innerHTML = '';

        if (this.currentTab === 'CHEATS') this.renderCheats();
        else if (this.currentTab === 'MASTERIES') this.renderMasteries();
        else if (this.currentTab === 'RELICS') this.renderRelics();
        else if (this.currentTab === 'STATS') this.renderStats();
    }

    renderCheats() {
        const addCheat = (label, callback) => {
            const btn = document.createElement('div');
            btn.innerHTML = `> ${label}`;
            Object.assign(btn.style, {
                padding: '5px 0',
                cursor: 'pointer',
                color: '#fff',
                borderBottom: '1px solid #222'
            });
            btn.onmouseover = () => btn.style.color = '#ffff00';
            btn.onmouseout = () => btn.style.color = '#fff';
            btn.onclick = () => {
                // Fetch context at click time!
                const activeCombatScene = this._getActiveCombatScene();
                const cm = activeCombatScene ? activeCombatScene.combatManager : null;

                callback(cm);
                logManager.log(`Cheat: ${label}`, 'warning');
            };
            this.content.appendChild(btn);
        };

        addCheat('Add 100 Gold', () => {
            runManager.player.gold += 100;
            EventBus.emit('ui:refresh_topbar');
        });

        addCheat('Heal 20 HP', (cm) => {
            if (cm && cm.player) cm.player.heal(20);
            else runManager.player.currentHP = Math.min(runManager.player.maxHP, runManager.player.currentHP + 20);
            EventBus.emit('ui:refresh_topbar');
        });

        addCheat('Full Heal', (cm) => {
            if (cm && cm.player) cm.player.heal(999);
            else runManager.player.currentHP = runManager.player.maxHP;
            EventBus.emit('ui:refresh_topbar');
        });

        addCheat('Gain 10 Mana', (cm) => {
            if (cm && cm.player) {
                cm.player.addMana(10);
                cm.emitState();
            }
        });

        addCheat('Kill Enemy', (cm) => {
            if (cm && cm.enemy) cm.enemy.takeDamage(999999);
        });

        addCheat('Win Combat', (cm) => {
            if (cm && cm.enemy) {
                cm.enemy.currentHP = 0;
                cm.enemy.isDead = true;
                cm.checkWinCondition();
            }
        });

        addCheat('+1 Move', (cm) => {
            if (cm) {
                cm.currentMoves++;
                cm.emitState();
            }
        });

        addCheat('Unlock All Masteries', () => {
            masteryManager.traits.forEach((t, id) => runManager.unlockMastery(id));
            this.render();
        });

        addCheat('Jump to Next Act', () => {
            if (runManager.currentActIndex < ACTS.length - 1) {
                runManager.startNextAct();
                if (window.game) {
                    // Stop any active gameplay scenes
                    window.game.scene.getScenes(true).forEach(s => {
                        window.game.scene.stop(s.scene.key);
                    });
                    // Start Map Scene
                    window.game.scene.start('MapScene');
                    this.toggle(); // Close debug console
                }
            } else {
                logManager.log('Already in final Act', 'error');
            }
        });
    }

    renderMasteries() {
        const traits = Array.from(masteryManager.traits.values());
        const byType = {};
        traits.forEach(t => {
            if (!byType[t.type]) byType[t.type] = [];
            byType[t.type].push(t);
        });

        for (const type in byType) {
            const h = document.createElement('div');
            h.innerHTML = `--- ${type} ---`;
            Object.assign(h.style, { color: '#aaaaff', marginTop: '10px', fontWeight: 'bold' });
            this.content.appendChild(h);

            byType[type].forEach(t => {
                const owned = runManager.hasMastery(t.id);
                const btn = document.createElement('div');
                btn.innerHTML = `[${owned ? 'X' : ' '}] ${t.name}`;
                Object.assign(btn.style, {
                    padding: '2px 10px',
                    cursor: 'pointer',
                    color: owned ? '#00ff00' : '#444',
                    fontSize: '13px'
                });
                btn.onclick = () => {
                    if (owned) runManager.removeMastery(t.id);
                    else runManager.unlockMastery(t.id);
                    this.render();
                };
                this.content.appendChild(btn);
            });
        }
    }

    renderRelics() {
        Object.keys(RELICS).forEach(id => {
            const data = RELICS[id];
            const owned = runManager.hasRelic(id);
            const btn = document.createElement('div');
            btn.innerHTML = `[${owned ? 'X' : ' '}] ${data.name}`;
            Object.assign(btn.style, {
                padding: '2px 0',
                cursor: 'pointer',
                color: owned ? '#da70d6' : '#444',
                fontSize: '13px'
            });
            btn.onclick = () => {
                if (owned) runManager.removeRelic(id);
                else runManager.addRelic(id);
                this.render();
            };
            this.content.appendChild(btn);
        });
    }

    renderStats() {
        // Find latest context
        const p = runManager.player;
        const activeCombatScene = this._getActiveCombatScene();
        const cm = activeCombatScene ? activeCombatScene.combatManager : null;

        // If we are just refreshing and NOT rebuilding the whole tab, we can update specific elements
        // For simplicity, we clear and rebuild but it's very fast in DOM
        this.content.innerHTML = '';

        const addStat = (label, val) => {
            const s = document.createElement('div');
            s.innerHTML = `${label}: <span style="color: #fff">${val}</span>`;
            Object.assign(s.style, { padding: '2px 0', color: '#00ff00' });
            this.content.appendChild(s);
        };

        addStat('Scene', activeCombatScene ? activeCombatScene.scene.key : 'Global/Map');
        addStat('HP', `${p.currentHP}/${p.maxHP}`);
        addStat('Gold', p.gold);

        if (cm && cm.player) {
            addStat('Mana', cm.player.mana);
            addStat('Strength', cm.player.statusManager.getStack(STATUS_TYPES.STRENGTH));
            addStat('Focus', cm.player.statusManager.getStack(STATUS_TYPES.FOCUS));

            if (cm.enemy) {
                addStat('Enemy HP', `${cm.enemy.currentHP}/${cm.enemy.maxHP}`);
            }
        }
    }

    _getActiveCombatScene() {
        if (!window.game) return null;
        // In newer Phaser, we check scene manager
        const scenes = window.game.scene.getScenes(true); // Get only active scenes
        return scenes.find(s => s.scene.key === 'BattleScene') || null;
    }
}
