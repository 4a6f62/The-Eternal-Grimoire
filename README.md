# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Roll20 Integration (JS Mod)

This application supports two-way character synchronization with **Roll20** using a custom Roll20 API Script (JS Mod).

### Requirements
* A Roll20 **Pro** subscription (required to install custom API Scripts).
* A game using the **"5th Edition by Roll20"** character sheet.

### Installation
1. Go to your Roll20 Game Details page.
2. Click **Settings** and select **API Scripts**.
3. Click **New Script**, name it `DnDCharsIntegration.js`, and paste the contents of the integration script.
   * You can download this script from the Character Sheet **Export** menu in the web app under **Roll20 API Script (.js)**, or copy the file directly from [public/roll20-mod.js](file:///home/kali/projects/dndchars/public/roll20-mod.js).
4. Click **Save Script**.

### Importing a Character into Roll20
To import a character file downloaded from this manager (`.json` or `.dndchar` formats):
1. In your Roll20 game, create a new **Handout** named exactly `Import Character`.
2. Paste the contents of your downloaded character JSON file into the **Notes** section of that handout and save it.
3. In the Roll20 chat, type:
   ```text
   !dndchar import
   ```
4. The JS Mod will automatically locate the handout, clean the formatting, parse the data, and create or update the character sheet in your Journal.

### Exporting a Character from Roll20
To export a Roll20 character to load it back into the Character Manager:
1. Select the character's token on the map, or prepare its name.
2. In the Roll20 chat, type:
   ```text
   !dndchar export
   ```
   *(Or target a character by name: `!dndchar export "Grog Strongjaw"`)*
3. The script will gather all stats, inventory, levels, and spells, and write them as a JSON block in a new Handout named `Export - <Character Name>` in your Journal. It will also print the output to the Roll20 API console.
4. Copy the JSON block from the handout, save it as a `.json` file, and click **Import Hero** on the Character Vault dashboard of this app!

