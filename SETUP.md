# Recipe Box — Setup Guide

A personal recipe management app built with Expo + React Native.
Scan recipe pages with your phone camera, edit and save them, tag and search your collection.

---

## What you need

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node)
- **Expo CLI** and **EAS CLI**
- An **iPhone or Android phone** on the same Wi-Fi as your computer
- A free **Expo account** at [expo.dev](https://expo.dev)

---

## Step 1 — Install dependencies

Open Terminal, navigate to this folder, then run:

```bash
npm install
npm install -g expo-cli eas-cli
```

---

## Step 2 — Log in to Expo

```bash
eas login
```

Follow the prompts to sign in (or create a free account).

---

## Step 3 — Build a Development Client

Because this app uses on-device ML Kit OCR (which requires native code),
you need a custom "development client" build instead of the standard Expo Go app.
This is a one-time step — after it's installed on your phone you won't need to repeat it.

**Build for your phone (choose one):**

```bash
# iPhone:
eas build --profile development --platform ios

# Android:
eas build --profile development --platform android

# Both at once:
eas build --profile development --platform all
```

EAS will build in the cloud (takes ~5–10 minutes). When done:

- **iOS**: you'll get a link to install the `.ipa` via your browser — follow the instructions
- **Android**: download and install the `.apk` directly

> **Tip**: You only need to rebuild if you add new native packages. For all code changes,
> hot-reload works instantly without rebuilding.

---

## Step 4 — Start the development server

```bash
npx expo start --dev-client
```

This opens Expo DevTools in your browser and shows a QR code.

Open the **Recipe Box** app on your phone (the dev client you installed in Step 3),
then **scan the QR code**. Your app will load — and any code changes you make
will instantly refresh on your phone.

---

## Step 5 — You're running!

Your app will open to the **Recipes** tab with two buttons at the bottom right:

| Button | What it does |
|--------|-------------|
| **Scan** (camera) | Take a photo of a recipe page — OCR extracts the text |
| **Type** (pencil) | Enter a recipe manually |

### Scanning tips

- Lay the cookbook flat in good natural light
- Hold the phone parallel to the page, not at an angle
- The app saves your original photo alongside the recipe — so even if OCR misses something, you can always refer back to the original image

---

## App structure

```
app/
  (tabs)/
    index.tsx       ← Recipe list + search
    favourites.tsx  ← Favourited recipes
    planner.tsx     ← Week planner (Phase 2 placeholder)
  ocr.tsx           ← Scan / import photo screen
  recipe/
    new.tsx         ← New recipe form (also receives OCR draft)
    [id].tsx        ← Recipe detail view
    edit/[id].tsx   ← Edit existing recipe

components/
  RecipeCard.tsx    ← Card shown in lists
  RecipeForm.tsx    ← Full add/edit form
  TagPicker.tsx     ← Tag + type selection
  SearchBar.tsx     ← Search input

lib/
  db.ts             ← SQLite database (all CRUD)
  ocr.ts            ← ML Kit OCR + text parser
  types.ts          ← TypeScript types
  theme.ts          ← Colours, typography, spacing
```

---

## Customise the app name / bundle ID

Edit `app.json`:

```json
"name": "Recipe Box",
"ios": { "bundleIdentifier": "com.yourname.recipebox" },
"android": { "package": "com.yourname.recipebox" }
```

Change `yourname` to anything you like.

---

## Phase roadmap

| Phase | Features |
|-------|---------|
| ✅ 1 (now) | Photo scan, OCR, recipe form, tags, search, favourites |
| 🔜 2 | Pantry list, match recipes to what you have |
| 🔜 3 | 7-day meal planner, auto shopping list |

---

## Troubleshooting

**"Camera permission denied"** — Go to phone Settings → Recipe Box → allow Camera and Photos.

**OCR returns empty text** — Try again with better lighting, or import a cleaner photo from the gallery.
The original photo is always saved so you can refer back to it.

**Build fails** — Run `eas build:list` to see build logs. Most issues are fixable by running
`npm install` again and making sure your `eas.json` hasn't been accidentally changed.

**App won't connect after starting server** — Make sure your phone and computer are on the same Wi-Fi network.
