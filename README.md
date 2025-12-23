# Portfolio Website

A React-based personal portfolio showcasing projects, skills, and an interactive assistant called KoltBot.

## Overview

This app is built with Create React App and uses a small component library in `src/components/ui`, themeing in `src/theme`, and pages in `src/pages`. It also includes an AI integrations folder (`src/ai`) with serverless functions used by KoltBot.

### Key Features
- Responsive portfolio homepage (`src/pages/Home.js` / `Home.css`)
- Theming and color mode toggles (`src/components/ui/color-mode.jsx`, `src/theme/theme.js`)
- Reusable UI like LiquidGlassBox components
- KoltBot: an on-site assistant with GitHub-integrations

## KoltBot

KoltBot is an interactive assistant component rendered via `src/components/koltBot.jsx` (and a fixed-position variant `koltBot_fixed.jsx`). It communicates with serverless functions under `src/ai/functions` to enable actions like searching GitHub and fetching files.

### How it works
- Frontend: React components (`koltBot.jsx`, `koltBot_fixed.jsx`) provide the chat UI.
- Backend (serverless):
	- `src/ai/functions/githubSearch/` – search repos/files on GitHub
	- `src/ai/functions/githubGetFile/` – fetch a file by path from GitHub
	- `src/ai/functions/connect/` and `disconnect/` – lifecycle hooks
	- `src/ai/functions/sendMessage/` – message relay
	- `src/ai/functions/koltBotSign/` – signing/verification helper

## Project Structure

```
public/             Static assets and index.html
src/
	pages/            Page-level components (e.g., Home)
	components/       UI components and KoltBot
		ui/             Reusable UI primitives (color mode, tooltip, toaster)
	ai/               Assistant tools and serverless functions
	theme/            Theme configuration
```

## Setup

Prerequisites: Node.js LTS and npm.

Install dependencies and start the dev server:

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

## Build

Create a production build:

```bash
npm run build
```

Outputs to the `build/` folder.

## Tests

Run tests in watch mode:

```bash
npm test
```

## Deployment

Any static hosting provider that serves the `build/` folder will work (e.g., Netlify, Vercel, GitHub Pages). Ensure secrets for KoltBot's GitHub features are configured in the host.

## License

This is a personal portfolio project. If you plan to reuse parts of KoltBot or the UI components, please credit the author and review any third-party license requirements.
