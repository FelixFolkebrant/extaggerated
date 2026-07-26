# Extaggerated

Extaggerated is an Obsidian plugin for AI-assisted native tagging and node note generation.

## Local installation

1. Clone this repository and install its dependencies:

   ```sh
   npm install
   ```

2. Build the plugin from the repository root:

   ```sh
   npm run build
   ```

3. In your vault, create `.obsidian/plugins/extaggerated` and copy these built plugin files into it:

   - `main.js`
   - `manifest.json`
   - `styles.css`

4. Open Obsidian, enable Community plugins if necessary, then enable **Extaggerated**.

5. Open **Settings → Community plugins → Extaggerated** and enter your OpenRouter API key. The default model is ready to use; change it only if you want a different OpenRouter model.

To update the installed plugin, run `npm run build` again and replace those same three files in the vault's `extaggerated` plugin folder.
