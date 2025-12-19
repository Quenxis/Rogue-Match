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
        const center = options.center || false;

        let cursorX = 10;
        let cursorY = 10;
        let currentColor = color;
        let currentLineObjs = []; // Track objects for centering

        // Function to flush line and center it
        const flushLine = () => {
            if (center && currentLineObjs.length > 0) {
                // Calculate actual line width used (from 10 to cursorX)
                // cursorX starts at 10. So width is cursorX - 10.
                // Or we can find minX and maxX of objects.
                // Objects are placed at X.
                // Let's rely on cursorX being the end of the line.
                // Wait, if we wrap, cursorX resets.
                // So at this point cursorX is the end position of the last element.

                const contentWidth = cursorX - 10;
                const shiftX = (maxWidth - contentWidth) / 2;

                if (shiftX > 0) {
                    currentLineObjs.forEach(obj => obj.x += shiftX);
                }
            }
            currentLineObjs = [];
        };

        const lines = text.split('\n');

        lines.forEach((line) => {
            if (!line) {
                flushLine();
                cursorX = 10;
                cursorY += lineHeight;
                return;
            }

            const parts = line.split(/(\[icon:[^\]]+\]|\[c:[^\]]+\]|\[\/c\])/g);

            parts.forEach(part => {
                if (!part) return;

                if (part.startsWith('[icon:')) {
                    const key = part.replace('[icon:', '').replace(']', '');
                    if (scene.textures.exists(key)) {
                        if (cursorX + iconSize > maxWidth) {
                            flushLine();
                            cursorX = 10;
                            cursorY += lineHeight;
                        }

                        const icon = scene.add.image(cursorX + iconSize / 2, cursorY + lineHeight / 2, key)
                            .setDisplaySize(iconSize, iconSize)
                            .setOrigin(0.5);
                        container.add(icon);
                        currentLineObjs.push(icon);
                        cursorX += iconSize + 2;
                    }
                } else if (part.startsWith('[c:')) {
                    const hex = part.replace('[c:', '').replace(']', '');
                    currentColor = hex;
                } else if (part === '[/c]') {
                    currentColor = options.color || '#ffffff';
                } else {
                    const tokens = part.match(/(\S+|\s+)/g) || [];

                    tokens.forEach(token => {
                        // Whitespace handling
                        if (/^\s+$/.test(token)) {
                            // If starting a line, ignore leading whitespace? Maybe. for now keep it.
                            cursorX += 4 * token.length;
                            return;
                        }

                        const word = token;
                        // Temp text for measure
                        const tempText = scene.add.text(0, 0, word, { font: font }).setVisible(false);
                        const w = tempText.width;
                        tempText.destroy();

                        if (cursorX + w > maxWidth) {
                            flushLine();
                            cursorX = 10;
                            cursorY += lineHeight;
                        }

                        const txt = scene.add.text(cursorX, cursorY + (lineHeight - parseInt(fontSize) - 2) / 2, word, {
                            font: font,
                            fill: '#ffffff'
                        }).setOrigin(0, 0).setResolution(2);

                        if (currentColor !== (options.color || '#ffffff')) {
                            const colorNum = parseInt(currentColor.replace('#', '0x'), 16);
                            txt.setTint(colorNum);
                        } else {
                            if (options.color) {
                                txt.setTint(parseInt(options.color.replace('#', '0x'), 16));
                            } else {
                                txt.clearTint();
                            }
                        }

                        container.add(txt);
                        currentLineObjs.push(txt);
                        cursorX += w;
                    });
                }
            });

            // End of Line (Explicit newline in text)
            flushLine();
            cursorX = 10;
            cursorY += lineHeight;
        });

        // Final flush just in case
        flushLine();

        // Measure Total
        let maxUsedW = 0;
        container.each(child => {
            const r = child.x + (child.displayWidth * (1 - child.originX));
            if (r > maxUsedW) maxUsedW = r;
        });

        const totalW = Math.max(200, Math.min(maxUsedW + 10, maxWidth + 20));
        const totalH = cursorY + 10;

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
