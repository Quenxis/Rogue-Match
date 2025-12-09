# ⚔️ Rogue-Match

> **A Strategic Match-3 Roguelike Adventure**

**Rogue-Match** blends the addictive puzzle mechanics of match-3 games with the depth and progression of a roguelike RPG. Battle enemies, collect powerful relics, and traverse dangerous maps—all by mastering the grid.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.3.2-green.svg)
![Tech](https://img.shields.io/badge/tech-Phaser%203-orange.svg)

## 🎮 Game Overview

In **Rogue-Match**, your puzzle grid is your battlefield. Every match counts:
*   **⚔️ Swords (Attack):** Deal direct damage to the enemy.
*   **🛡️ Shields (Defense):** Build up armor to block incoming attacks.
*   **🧪 Potions (Heal):** Restore your health points.
*   **💰 Coins (Gold):** Earn currency to spend in the shop.

The game features dynamic runs where no two playthroughs are the same. Choose your path wisely, manage your resources, and build a synergy of powerful Relics to defeat the bosses.

## ✨ Key Features

*   **Turn-Based Combat:** Strategic match-3 gameplay where you plan your moves to counter enemy attacks.
*   **Procedural Map:** Navigate a branching path system inspired by classic roguelikes (e.g., *Slay the Spire*). Encounter Battles, Elites, Shops, Events, and Treasures.
*   **Relic System:** Collect unique artifacts that passively boost your abilities or change the rules of the game.
*   **Economy & Shop:** Earn gold from matches and battles to buy potions, relics, or card removals/upgrades (planned).
*   **Audio & Atmosphere:** Immersive background music and sound effects with a dedicated Settings menu.
*   **RPG Progression:** Level up your hero and face increasingly difficult enemies.

## 🛠️ Technology Stack

Built with modern web technologies:
*   **Engine:** [Phaser 3](https://phaser.io/)
*   **Language:** Vanilla JavaScript (ES6 Modules)
*   **Styling:** CSS3 for UI overlays

## 🚀 How to Run

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/rogue-match.git
    cd rogue-match
    ```

2.  **Run a local server:**
    Due to browser security policies (CORS) regarding audio and asset loading, the game must be run through a local web server, not by opening `index.html` directly.

    *   **VS Code:** Install "Live Server" extension and click "Go Live".
    *   **Python:** `python -m http.server 8000`
    *   **Node:** `npx http-server .`

3.  **Play:**
    Open your browser at `http://localhost:8000` (or your specific port).

## 🔮 Future Roadmap

*   New Hero Classes with unique abilities.
*   Expanded enemy roster and complex boss mechanics.
*   More Relics and interactive Events.
*   Visual polish and animations.

---
*Created by Bíďa*
