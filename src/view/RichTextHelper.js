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

        // Tokenize (Split by Newlines first, then Icons)
        const lines = text.split('\n');

        lines.forEach((line) => {
            if (!line) {
                // Empty line (double newline)
                cursorX = 10;
                cursorY += lineHeight;
                return;
            }

            // Split line by Icons
            const parts = line.split(/(\[icon:[a-zA-Z0-9_]+\])/g);

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
                        cursorX += iconSize + 2; // Minimal space after icon (let text spaces handle the rest)
                    }
                } else {
                    // --- TEXT HANDLING ---
                    // Tokenize by keeping spaces (matched as separate tokens)
                    const tokens = part.match(/(\S+|\s+)/g) || [];

                    tokens.forEach(token => {
                        // Is it purely whitespace?
                        if (/^\s+$/.test(token)) {
                            // Add Space Width (approx 4px per space char)
                            cursorX += 4 * token.length;
                            return;
                        }

                        // It's a word
                        const word = token;

                        // Create temp text to measure
                        const tempText = scene.add.text(0, 0, word, { font: font, fill: color }).setVisible(false);
                        const w = tempText.width;
                        tempText.destroy();

                        // Check Wrap
                        if (cursorX + w > maxWidth) {
                            cursorX = 10;
                            cursorY += lineHeight;
                        }

                        // Add Text
                        const txt = scene.add.text(cursorX, cursorY + (lineHeight - parseInt(fontSize) - 2) / 2, word, {
                            font: font, fill: color
                        }).setOrigin(0, 0).setResolution(2);
                        container.add(txt);

                        cursorX += w; // No extra padding forced
                    });
                }
            });

            // End of Line (Explicit \n)
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
}
