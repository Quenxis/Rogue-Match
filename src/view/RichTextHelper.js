export class RichTextHelper {
    /**
     * Renders text with inline icons into a container.
     * Supported format: "Text [icon:texture_key] Text"
     * 
     * @param {Phaser.Scene} scene 
     * @param {Phaser.GameObjects.Container} container 
     * @param {string} text 
     * @param {object} options 
     */
    static renderRichText(scene, container, text, options = {}) {
        const maxWidth = options.maxWidth || 500;
        const lineHeight = options.lineHeight || 29;
        const iconSize = options.iconSize || 29;
        const fontSize = options.fontSize || '20px';
        const color = options.color || '#ffffff';
        const font = options.font || `${fontSize} Verdana`;

        // Clear previous content (safely, sparing optional background if passed, but usually container is cleared by caller or we append)
        // Helper assumes it appends to container. Caller handles clearing.

        let cursorX = 10;
        let cursorY = 10;
        let currentColor = color;

        // Tokenize (Split by Newlines first, then Icons)
        const lines = text.split('\n');

        lines.forEach((line) => {
            if (!line) {
                // Empty line (double newline)
                cursorX = 10;
                cursorY += lineHeight;
                return;
            }

            // Regex to split by Icons AND Color Tags
            // Catch groups: 
            // 1. [icon:key]
            // 2. [c:color]
            // 3. [/c]
            const parts = line.split(/(\[icon:[^\]]+\]|\[c:[^\]]+\]|\[\/c\])/g);

            parts.forEach(part => {
                if (!part) return;

                if (part.startsWith('[icon:')) {
                    // --- ICON HANDLING ---
                    const key = part.replace('[icon:', '').replace(']', '');
                    if (scene.textures.exists(key)) {
                        // Check Wrap
                        if (cursorX + iconSize > maxWidth) {
                            cursorX = 10;
                            cursorY += lineHeight;
                        }

                        const icon = scene.add.image(cursorX + iconSize / 2, cursorY + lineHeight / 2, key)
                            .setDisplaySize(iconSize, iconSize)
                            .setOrigin(0.5);
                        container.add(icon);
                        cursorX += iconSize + 2;
                    }
                } else if (part.startsWith('[c:')) {
                    // --- START COLOR ---
                    // Format: [c:#ff0000]
                    const hex = part.replace('[c:', '').replace(']', '');
                    currentColor = hex;
                } else if (part === '[/c]') {
                    // --- END COLOR ---
                    currentColor = options.color || '#ffffff';
                } else {
                    // --- TEXT HANDLING ---
                    const tokens = part.match(/(\S+|\s+)/g) || [];

                    tokens.forEach(token => {
                        if (/^\s+$/.test(token)) {
                            cursorX += 4 * token.length;
                            return;
                        }

                        const word = token;
                        // Use original word logic without text variant hacks, relying on setTint
                        let displayWord = word;

                        const tempText = scene.add.text(0, 0, displayWord, { font: font }).setVisible(false);
                        const w = tempText.width;
                        tempText.destroy();

                        if (cursorX + w > maxWidth) {
                            cursorX = 10;
                            cursorY += lineHeight;
                        }

                        // Create text object first
                        const txt = scene.add.text(cursorX, cursorY + (lineHeight - parseInt(fontSize) - 2) / 2, displayWord, {
                            font: font,
                            fill: '#ffffff' // Default white fill base for tinting
                        }).setOrigin(0, 0).setResolution(2);

                        // Apply Color
                        if (currentColor !== (options.color || '#ffffff')) {
                            // Parse hex string to number for setTint (0xRRGGBB)
                            // Assumes format is always #RRGGBB or #RGB
                            const colorNum = parseInt(currentColor.replace('#', '0x'), 16);
                            txt.setTint(colorNum);
                        } else {
                            if (options.color) {
                                // Apply default color if not white
                                txt.setTint(parseInt(options.color.replace('#', '0x'), 16));
                            } else {
                                txt.clearTint();
                            }
                        }

                        container.add(txt);
                        cursorX += w;
                    });
                }
            });

            // End of Line
            cursorX = 10;
            cursorY += lineHeight;
        });

        // Return dimensions for background sizing
        let maxUsedW = 0;
        container.each(child => {
            const r = child.x + (child.width * child.scaleX * (1 - child.originX)); // Approx right edge
            // child.x is usually left or center. 
            // If Text (origin 0,0): x + width
            // If Image (origin 0.5): x + width/2
            let right = 0;
            if (child.originX === 0) right = child.x + child.width;
            else if (child.originX === 0.5) right = child.x + child.displayWidth / 2;

            if (right > maxUsedW) maxUsedW = right;
        });

        const totalW = Math.max(200, Math.min(maxUsedW + 10, maxWidth + 20));
        const totalH = cursorY + 10; // Extra padding at bottom

        return { width: totalW, height: totalH };
    }

    /**
     * Generates a standardized tooltip text for skills.
     * @param {object} data - Skill data object (name, cost, shieldCost, desc)
     * @returns {string} Formatted rich text string
     */
    static getSkillTooltipText(data) {
        // Format Cost: "6[icon:icon_shield], 5[icon:icon_mana]"
        let costString = '';

        if (data.shieldCost > 0) {
            costString += `${data.shieldCost}[icon:icon_shield], `;
        }

        // Mana cost is usually standard, but check if exists (0 cost skills possible)
        if (data.cost !== undefined) {
            costString += `${data.cost}[icon:icon_mana]`;
        }

        // Combine: "Fireball + 6[icon:icon_mana]\nDescription"
        // Note: The previous code had " + " separator. Keeping it consistent.
        return `${data.name} -> ${costString}\n${data.desc}`;
    }
}
