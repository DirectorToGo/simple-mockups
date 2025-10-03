# Simple Mockups

A modern Angular application for creating and managing document mockups with AI-powered features.

## Tech Stack

- **Frontend**: Angular 20 with TypeScript
- **Styling**: TailwindCSS
- **AI Integration**: Google Gemini AI API
- **Build Tool**: Angular Build with Vite
- **Type Safety**: TypeScript 5.8

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

This repository is ready to publish to GitHub Pages at `https://DirectorToGo.github.io/simple-mockups/`.

1. Push your changes to the `main` branch on GitHub.
2. In GitHub, navigate to **Settings → Pages** and ensure “GitHub Actions” is the selected source.
3. A workflow named **Deploy to GitHub Pages** (defined in `.github/workflows/deploy.yml`) will automatically:
   - install dependencies (`npm ci`)
   - build with the correct base href (`npm run build:gh`)
   - deploy the contents of `dist/` to the `gh-pages` environment

To trigger a manual deployment at any time, go to the **Actions** tab, open **Deploy to GitHub Pages**, and use **Run workflow**.
# simple-mockups
# simple-mockups
