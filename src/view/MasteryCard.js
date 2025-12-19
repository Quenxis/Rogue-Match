import { RichTextHelper } from './RichTextHelper.js';

export class MasteryCard extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene 
     * @param {number} x 
     * @param {number} y 
     * @param {object} traitData - Expected { name, type, rarity, description, title? }
     * @param {number} width 
     * @param {number} height 
     */
    constructor(scene, x, y, traitData, width = 230, height = 320) {
        super(scene, x, y);
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.trait = traitData;

        // Ensure we add existing to scene if needed, but usually caller adds container
        // this.scene.add.existing(this); 

        // Hit Area Config: Delegate to Background for perfect alignment
        // this.setSize(width, height);
        // this.setInteractive(...) -> Removed to use BG interaction

        this._build();
    }

    _build() {
        const cardW = this.width;
        const cardH = this.height;

        // Rarity Colors
        let borderColor = 0x444444;
        let bgColor = 0x222222;
        let rarityTextColor = '#aaaaaa';

        // Normalize rarity string
        const rarity = (this.trait.rarity || 'COMMON').toUpperCase();

        if (rarity === 'UNCOMMON') {
            borderColor = 0x66ff66;
            rarityTextColor = '#66ff66';
        }
        if (rarity === 'RARE') {
            borderColor = 0x44ccff;
            rarityTextColor = '#44ccff';
        }
        if (rarity === 'EPIC') {
            borderColor = 0xd066ff;
            bgColor = 0x2a1a2a;
            rarityTextColor = '#d066ff';
        }
        if (rarity === 'LEGENDARY') {
            borderColor = 0xffcc00;
            bgColor = 0x332200;
            rarityTextColor = '#ffcc00';
        }

        // --- Background ---
        const bg = this.scene.add.rectangle(0, 0, cardW, cardH, bgColor)
            .setStrokeStyle(4, borderColor);

        // Make BG Interactive
        bg.setInteractive({ useHandCursor: true });
        this.add(bg);

        // Expose background
        this.bg = bg;

        // --- Icon ---
        // Trait type usually maps to asset key (SWORD, SHIELD, etc.)
        // Force Upper Case to match BootScene keys
        let iconKey = (this.trait.type || this.trait.gemType || 'TRASH').toUpperCase();

        // Handle specific cases if needed
        if (iconKey === 'HEAL') iconKey = 'POTION';
        if (iconKey === 'MAX_HP') iconKey = 'POTION';
        if (iconKey === 'GOLD') iconKey = 'COIN';

        if (!this.scene.textures.exists(iconKey)) {
            console.warn(`MasteryCard: Icon '${iconKey}' not found, falling back to trash.`);
            iconKey = 'TRASH'; // Uppercase TRASH
            // In BootScene: this.load.image('trash', ...) is lowercase usually?
            // Actually BootScene has: this.load.image('trash', 'assets/items/trash.png');
            // So if uppercase check fails, try lowercase 'trash'.
            if (!this.scene.textures.exists(iconKey) && this.scene.textures.exists('trash')) {
                iconKey = 'trash';
            }
        }

        const icon = this.scene.add.image(0, -cardH / 2 + 60, iconKey)
            .setDisplaySize(90, 90)
            .setOrigin(0.5);
        this.add(icon);

        // --- Name ---
        const titleText = (this.trait.name || this.trait.title || 'Unknown').toUpperCase();
        const name = this.scene.add.text(0, -cardH / 2 + 120, titleText, {
            font: `bold 20px Arial`, fill: '#ffffff', wordWrap: { width: cardW - 20 }, align: 'center'
        }).setOrigin(0.5);
        this.add(name);

        // --- Rarity Label ---
        const rarityLabel = this.scene.add.text(0, -cardH / 2 + 145, rarity, {
            font: `italic 14px Arial`, fill: rarityTextColor
        }).setOrigin(0.5);
        this.add(rarityLabel);

        // --- Description ---
        const descY = -cardH / 2 + 170;
        const descMaxWidth = cardW - 30;

        // Center the rich text container
        const descContainer = this.scene.add.container(-descMaxWidth / 2, descY);

        RichTextHelper.renderRichText(this.scene, descContainer, this.trait.description || '', {
            fontSize: `16px`,
            color: '#cccccc',
            maxWidth: descMaxWidth,
            center: true,
            iconSize: 22
        });
        this.add(descContainer);
    }

    disableInteractive() {
        if (this.bg) this.bg.disableInteractive();
        return this;
    }
}
