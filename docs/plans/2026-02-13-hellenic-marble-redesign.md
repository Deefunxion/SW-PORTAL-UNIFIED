# Hellenic Marble Frontend Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the "Hellenic Marble" design system (Version A from design-concepts.html) to all existing React pages — replacing the current generic blue UI with a refined, rounded, government-branded aesthetic using `#1a3aa3` (gov.gr trademark) as the core color.

**Architecture:** The redesign is purely visual — no functionality changes. We update CSS custom properties in `App.css` for global theming, override shadcn/ui base components (`button`, `card`, `badge`, `input`) for consistent tokens, then restyle each page individually. Fonts change from Inter to Literata (serif headlines) + Fira Sans (body). Background shifts from white to ivory `#f7f4ef`.

**Tech Stack:** Tailwind CSS v4 (via @tailwindcss/vite), shadcn/ui components (Radix UI), CSS custom properties (OKLCH), Google Fonts

**Reference:** The approved mockup lives at `SW_PORTAL_demo/design-concepts.html` — Version A (".va" rules). Open it in a browser and switch to "A. Hellenic Marble" for visual reference.

---

## Design Token Summary

These tokens drive every change below. Refer back here when editing files.

| Token | Value | Replaces |
|-------|-------|----------|
| **Primary** | `#1a3aa3` | `#1e3a8a`, `#2563eb` |
| **Primary Hover** | `#152e82` | `#1e3a8a` (hover) |
| **Gold Accent** | `#b8942e` | — (new) |
| **Background** | `#f7f4ef` | white |
| **Card BG** | `#fff` | (unchanged) |
| **Input BG** | `#faf8f4` | white |
| **Light Blue** | `#eef1f8` | `blue-50` |
| **Border** | `#e8e2d8` | `#e2e8f0`, gray borders |
| **Border Light** | `#e0dbd2` | input borders |
| **Text Primary** | `#2a2520` | `#1f2937`, gray-800 |
| **Text Secondary** | `#8a8580` | `#6b7280`, gray-500 |
| **Text Muted** | `#6b6560` | gray-600 |
| **Heading Font** | `'Literata', serif` | system/Inter |
| **Body Font** | `'Fira Sans', sans-serif` | Inter |
| **Card Radius** | `14px` (rounded-xl) | current rounded-xl |
| **Button Radius** | `10px` | current rounded-xl |
| **Chat Radius** | `18px` (rounded-2xl) | current rounded-3xl |
| **Card Hover Lift** | `translateY(-6px)` | translateY(-2px) or none |
| **Button Hover Lift** | `translateY(-3px)` | none |
| **Card Hover Shadow** | `0 16px 48px rgba(26,58,163,.12)` | `shadow-2xl` |
| **Button Hover Shadow** | `0 8px 24px rgba(26,58,163,.35)` | `shadow-xl` |

---

### Task 1: Global Theme — Fonts, Colors, CSS Variables

**Files:**
- Modify: `frontend/src/index.css` (font imports)
- Modify: `frontend/src/App.css` (CSS custom properties, background)

**Step 1: Update font imports in index.css**

Replace the existing Google Fonts import (Inter) with Literata + Fira Sans. Keep the animation keyframes intact.

In `frontend/src/index.css`, replace the font import line(s) at the top with:

```css
@import url('https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,300;7..72,500;7..72,700;7..72,800&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

**Step 2: Update CSS custom properties in App.css**

In `frontend/src/App.css`, make these changes to the light-mode `:root` block (lines ~44-77):

```css
/* Background: ivory instead of white */
--background: oklch(0.965 0.008 80);      /* #f7f4ef */
--foreground: oklch(0.2 0.01 50);          /* #2a2520 */

/* Primary: gov.gr navy #1a3aa3 */
--primary: oklch(0.37 0.14 265);           /* #1a3aa3 */
--primary-foreground: oklch(0.985 0 0);    /* white */

/* Cards stay white */
--card: oklch(1 0 0);                      /* #fff */
--card-foreground: oklch(0.2 0.01 50);     /* #2a2520 */

/* Borders: warm stone */
--border: oklch(0.92 0.01 70);             /* #e8e2d8 */
--input: oklch(0.90 0.01 70);              /* #e0dbd2 */
--ring: oklch(0.37 0.14 265);              /* #1a3aa3 — focus ring matches primary */

/* Muted: warm gray instead of cool */
--muted: oklch(0.97 0.005 80);             /* warm off-white */
--muted-foreground: oklch(0.58 0.01 50);   /* #8a8580 */

/* Accent: light blue wash */
--accent: oklch(0.96 0.02 265);            /* #eef1f8 */
--accent-foreground: oklch(0.37 0.14 265); /* #1a3aa3 */

/* Increase base radius */
--radius: 0.875rem;  /* 14px, was 0.625rem (10px) */
```

**Step 3: Add body font-family override in base layer**

In the `@layer base` block at the bottom of App.css (~line 113-120), add font-family:

```css
@layer base {
  *,
  ::after,
  ::before,
  ::backdrop {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Fira Sans', sans-serif;
  }
}
```

**Step 4: Build to verify no errors**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds. No CSS errors.

**Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/App.css
git commit -m "style: global theme — Literata + Fira Sans fonts, #1a3aa3 primary, ivory background"
```

---

### Task 2: shadcn/ui Base Components — Button, Card, Badge, Input

**Files:**
- Modify: `frontend/src/components/ui/button.jsx`
- Modify: `frontend/src/components/ui/card.jsx`
- Modify: `frontend/src/components/ui/badge.jsx`
- Modify: `frontend/src/components/ui/input.jsx`

**Step 1: Update button.jsx**

Replace the hardcoded hex colors and add hover lift/shadow effects. The key changes:

- Default variant: `bg-[#2563eb]` → `bg-[#1a3aa3]`, hover → `hover:bg-[#152e82]`
- Add: `hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(26,58,163,.35)]`
- Add: `transition-all duration-250 ease-out` (replaces existing transition)
- Outline variant: border/text `[#2563eb]` → `[#1a3aa3]`, hover fill → `hover:bg-[#1a3aa3]`
- Add: `hover:-translate-y-0.5` to outline
- Secondary: `bg-[#0891b2]` → `bg-[#b8942e]` (gold accent), hover → `hover:bg-[#9a7a24]`
- Ghost: `hover:text-[#1e3a8a]` → `hover:text-[#1a3aa3]`
- Link: `text-[#2563eb]` → `text-[#1a3aa3]`
- Border radius: keep `rounded-xl` (now maps to 14px via updated --radius)

**Step 2: Update card.jsx**

Add hover lift to the base Card component. In the `Card` definition, add transition and hover classes:

```
"transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_16px_48px_rgba(26,58,163,0.12)]"
```

Note: `hover:-translate-y-1.5` = translateY(-6px). This applies globally to all cards. Pages that don't want lift can override with `hover:translate-y-0`.

**Step 3: Update badge.jsx**

- Add: `transition-transform duration-200 hover:scale-105`
- Border-radius: change from `rounded-md` to `rounded-lg` (8px)

**Step 4: Update input.jsx**

- Add `bg-[#faf8f4]` for warm input background
- Focus ring: ensure it uses the ring variable (now #1a3aa3)
- Add: `focus-visible:shadow-[0_0_0_3px_rgba(26,58,163,0.1)]`

**Step 5: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add frontend/src/components/ui/button.jsx frontend/src/components/ui/card.jsx frontend/src/components/ui/badge.jsx frontend/src/components/ui/input.jsx
git commit -m "style: update shadcn base components — #1a3aa3 primary, hover lifts, rounded corners"
```

---

### Task 3: Restyle HomePage

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx`

**Step 1: Replace all color references**

Find-and-replace within the file:

| Find | Replace |
|------|---------|
| `text-[#1e3a8a]` | `text-[#1a3aa3]` |
| `from-blue-600 via-blue-700 to-blue-800` | `from-[#1a3aa3] via-[#2548b8] to-[#152e82]` |
| `from-blue-500 to-blue-600` | `from-[#1a3aa3] to-[#2548b8]` |
| `from-green-500 to-green-600` | `from-[#b8942e] to-[#9a7a24]` |
| `from-purple-500 to-purple-600` | `from-[#3d5cc9] to-[#1a3aa3]` |
| `from-orange-500 to-orange-600` | `from-[#b8942e] to-[#9a7a24]` |
| `from-blue-600 to-blue-800` | `from-[#1a3aa3] to-[#152e82]` |
| `from-green-600 to-green-800` | `from-[#b8942e] to-[#8a6d1b]` |
| `from-purple-600 to-purple-800` | `from-[#3d5cc9] to-[#1a3aa3]` |
| `bg-blue-50` | `bg-[#eef1f8]` |
| `text-blue-800` | `text-[#1a3aa3]` |
| `border-blue-200` | `border-[#d0d8ee]` |
| `bg-green-50` | `bg-[#eef5ee]` |
| `text-green-800` | `text-[#2d6b2d]` |
| `border-green-200` | `border-[#c8dec8]` |
| `bg-purple-50` | `bg-[#eef1f8]` |
| `text-purple-800` | `text-[#1a3aa3]` |
| `border-purple-200` | `border-[#d0d8ee]` |
| `text-gray-700` | `text-[#2a2520]` |
| `text-gray-600` | `text-[#6b6560]` |
| `text-gray-800` | `text-[#2a2520]` |

**Step 2: Add serif font to headings**

Add `font-['Literata',serif]` (Tailwind arbitrary font) to:
- The main h1 "Καλώς ήρθατε" heading
- Stat card numbers (CardTitle with the big numbers)
- "Γρήγορες Ενέργειες" heading

In Tailwind, the class is: `font-[family-name:'Literata',serif]` or more simply, use `style={{fontFamily: "'Literata', serif"}}` on the JSX elements.

**Step 3: Amplify hover effects**

The cards already get hover lift from the updated card.jsx. Add to feature cards:
- `hover:shadow-[0_16px_48px_rgba(26,58,163,0.12)]` (already from card.jsx base)
- Ensure icon containers have: `group-hover:scale-110 transition-transform duration-300`
- Quick action buttons: add `hover:-translate-y-1 hover:shadow-lg transition-all duration-300`

**Step 4: Update gradient background on activity rows**

Change `from-gray-50 to-gray-100` → `from-[#faf8f4] to-[#f0ede6]`
Change `hover:from-blue-50 hover:to-blue-100` → `hover:from-[#eef1f8] hover:to-[#dde4f5]`
Change `hover:border-l-blue-500` → `hover:border-l-[#1a3aa3]`

**Step 5: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add frontend/src/pages/HomePage.jsx
git commit -m "style: restyle HomePage — Hellenic Marble colors, serif headings, amplified hovers"
```

---

### Task 4: Restyle ForumPage

**Files:**
- Modify: `frontend/src/pages/ForumPage.jsx`

**Step 1: Replace all color references**

Find-and-replace within the file:

| Find | Replace |
|------|---------|
| `text-gray-800` | `text-[#2a2520]` |
| `text-gray-600` | `text-[#6b6560]` |
| `text-gray-500` | `text-[#8a8580]` |
| `text-gray-300` | `text-[#c0b89e]` |
| `bg-gray-800` | `bg-[#1a3aa3]` |
| `bg-blue-600` | `text-[#1a3aa3]` (stat number) |
| `text-green-600` | `text-[#b8942e]` (stat number — gold for contrast) |
| `text-purple-600` | `text-[#3d5cc9]` (stat number) |
| `bg-green-600 hover:bg-green-700` | `bg-[#1a3aa3] hover:bg-[#152e82]` (create button) |
| `hover:bg-gray-50` | `hover:bg-[#eef1f8]` |
| `bg-blue-50` | `bg-[#eef1f8]` |
| `border-blue-200` | `border-[#d0d8ee]` |
| `text-blue-800` | `text-[#1a3aa3]` |
| `text-blue-600 hover:text-blue-800` | `text-[#1a3aa3] hover:text-[#152e82]` |

**Step 2: Add serif font to category headers**

The category header (`CardTitle` inside `bg-gray-800` which is now `bg-[#1a3aa3]`) should use Literata:

Add `style={{fontFamily: "'Literata', serif"}}` to:
- Each category header CardTitle
- The "Κυριότερες Κατηγορίες" CardTitle
- Stat numbers

**Step 3: Add discussion row hover effects**

Each discussion Link row currently has `hover:bg-gray-50`. Enhance to:

```
hover:bg-[#eef1f8] hover:pl-8 hover:shadow-[inset_4px_0_0_#1a3aa3] transition-all duration-250
```

This creates the signature left-border slide effect from the mockup.

**Step 4: Style the post count badges**

The Badge showing post count should scale on row hover. Add to the parent Link:

```
group
```

Then on the Badge:

```
group-hover:bg-[#1a3aa3] group-hover:text-white group-hover:scale-110 transition-all duration-200
```

**Step 5: Round the category block headers**

Add `rounded-t-xl` to the category CardHeader (the blue banner).

**Step 6: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add frontend/src/pages/ForumPage.jsx
git commit -m "style: restyle ForumPage — navy headers, row slide hovers, serif typography"
```

---

### Task 5: Restyle ApothecaryPage

**Files:**
- Modify: `frontend/src/pages/ApothecaryPage.jsx`

**Step 1: Replace all color references**

This is the largest page. Find-and-replace:

| Find | Replace |
|------|---------|
| `text-[#1e3a8a]` | `text-[#1a3aa3]` |
| `bg-[#2563eb]` | `bg-[#1a3aa3]` |
| `from-blue-600 to-blue-700` | `from-[#1a3aa3] to-[#152e82]` |
| `from-green-600 to-green-700` | `from-[#2d6b2d] to-[#245a24]` |
| `from-purple-600 to-purple-700` | `from-[#3d5cc9] to-[#1a3aa3]` |
| `from-orange-600 to-orange-700` | `from-[#b8942e] to-[#9a7a24]` |
| `from-teal-600 to-teal-700` | `from-[#1a3aa3] to-[#152e82]` |
| `from-indigo-600 to-indigo-700` | `from-[#3d5cc9] to-[#1a3aa3]` |
| `hover:from-blue-700 hover:to-blue-800` | `hover:from-[#152e82] hover:to-[#0f2260]` |
| `hover:from-green-700 hover:to-green-800` | `hover:from-[#245a24] hover:to-[#1a481a]` |
| `border-blue-200` | `border-[#d0d8ee]` |
| `border-blue-300` | `border-[#b0c0e0]` |
| `bg-blue-50` | `bg-[#eef1f8]` |
| `bg-blue-100` | `bg-[#dde4f5]` |
| `text-blue-600` | `text-[#1a3aa3]` |
| `text-blue-700` | `text-[#152e82]` |
| `text-blue-900` | `text-[#1a3aa3]` |
| `bg-green-50` | `bg-[#eef5ee]` |
| `bg-green-100` | `bg-[#dde8dd]` |
| `border-green-200` | `border-[#c8dec8]` |
| `border-green-300` | `border-[#a8cca8]` |
| `text-green-800` | `text-[#2d6b2d]` |
| `text-green-900` | `text-[#2a2520]` |
| `bg-green-600` | `bg-[#1a3aa3]` |
| `bg-gray-400` | `bg-[#8a8580]` |
| `text-gray-400` | `text-[#8a8580]` |
| `text-gray-500` | `text-[#8a8580]` |
| `text-gray-600` | `text-[#6b6560]` |
| `text-gray-700` | `text-[#2a2520]` |
| `hover:bg-cyan-600` | `hover:bg-[#1a3aa3]` |
| `border-cyan-600` | `border-[#1a3aa3]` |
| `text-cyan-700` | `text-[#1a3aa3]` |
| `from-blue-50 via-indigo-50 to-purple-50` | `from-[#eef1f8] via-[#f0ede6] to-[#eef1f8]` |
| `from-gray-50 via-blue-50 to-indigo-50` | `from-[#faf8f4] via-[#eef1f8] to-[#f0ede6]` |

**Step 2: Add serif font to page header and card titles**

Add `style={{fontFamily: "'Literata', serif"}}` to:
- The main `<h1>` "Αρχειοθήκη"
- Category card `<h3>` titles
- Folder content headers

**Step 3: Amplify category card hovers**

Each category card currently has `hover:scale-105`. Replace with:

```
hover:scale-[1.02] hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(26,58,163,0.14)]
```

Remove `hover:scale-105` and replace with the above for a lift effect instead of pure scale.

**Step 4: Add file row hover slide effect**

In the `renderDropdownContent` function, file rows should get:

```
hover:pl-8 hover:bg-[#eef1f8] transition-all duration-250
```

**Step 5: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "style: restyle ApothecaryPage — Hellenic Marble palette, serif headers, card lifts"
```

---

### Task 6: Restyle AssistantPage

**Files:**
- Modify: `frontend/src/pages/AssistantPage.jsx`

**Step 1: Replace all color references**

| Find | Replace |
|------|---------|
| `text-[#1e3a8a]` | `text-[#1a3aa3]` |
| `bg-[#2563eb]` | `bg-[#1a3aa3]` |
| `from-[#2563eb] to-[#1e3a8a]` | `from-[#1a3aa3] to-[#152e82]` |
| `hover:bg-[#1e3a8a]` | `hover:bg-[#152e82]` |
| `text-[#2563eb]` | `text-[#1a3aa3]` |
| `border-[#e2e8f0]` | `border-[#e8e2d8]` |
| `from-blue-50 to-indigo-50` | `from-[#eef1f8] to-[#f0ede6]` |
| `from-blue-500 to-blue-600` | `from-[#1a3aa3] to-[#2548b8]` |
| `from-green-500 to-green-600` | `from-[#b8942e] to-[#9a7a24]` |
| `from-purple-500 to-purple-600` | `from-[#3d5cc9] to-[#1a3aa3]` |
| `text-[#1f2937]` | `text-[#2a2520]` |
| `text-gray-600` | `text-[#6b6560]` |
| `text-gray-500` | `text-[#8a8580]` |
| `bg-gray-100` | `bg-[#f0ede6]` |
| `text-gray-800` | `text-[#2a2520]` |
| `border-gray-300` | `border-[#e0dbd2]` |
| `bg-gray-400` | `bg-[#8a8580]` |
| `focus:border-[#2563eb]` | `focus:border-[#1a3aa3]` |
| `focus:ring-[#2563eb]/20` | `focus:ring-[#1a3aa3]/10` |
| `border-red-200` | `border-red-200` (keep — error state) |

**Step 2: Add serif font to headings**

Add `style={{fontFamily: "'Literata', serif"}}` to:
- The main `<h1>` "AI Βοηθός"
- The chat header CardTitle "AI Βοηθός"
- Feature card `<h3>` titles

**Step 3: Update message bubble border-radius**

Bot messages: change `rounded-3xl` to custom radius:
```
rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl
```

User messages: change `rounded-3xl` to:
```
rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl
```

This creates the asymmetric bubble shape from the mockup.

**Step 4: Add source tag hover effect**

Source badges currently use shadcn Badge with `variant="secondary"`. Add:
```
hover:bg-[#1a3aa3] hover:text-white transition-colors duration-200 cursor-pointer
```

**Step 5: Style suggested questions**

The suggested question buttons should get:
```
hover:translate-x-1 hover:border-[#1a3aa3] hover:bg-[#eef1f8] hover:text-[#1a3aa3] hover:shadow-md transition-all duration-250
```

**Step 6: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add frontend/src/pages/AssistantPage.jsx
git commit -m "style: restyle AssistantPage — warm chat bubbles, serif headers, source tag hovers"
```

---

### Task 7: Restyle ChatWidget

**Files:**
- Modify: `frontend/src/components/ChatWidget.jsx`

**Step 1: Replace all color references**

Same substitution pattern as AssistantPage:

| Find | Replace |
|------|---------|
| `#2563eb` | `#1a3aa3` |
| `#1e3a8a` | `#152e82` (hovers) or `#1a3aa3` (text) |
| `border-[#e2e8f0]` | `border-[#e8e2d8]` |
| `bg-gray-100` | `bg-[#f0ede6]` |
| `text-gray-*` colors | warm equivalents per token table |

**Step 2: Round the floating button**

The toggle button (floating circle) should keep `rounded-full`. Update its colors:
- Background: `bg-[#1a3aa3]`
- Hover: `hover:bg-[#152e82] hover:shadow-[0_8px_24px_rgba(26,58,163,.35)] hover:scale-110`

**Step 3: Round the widget panel**

The widget panel should use `rounded-2xl` (18px) and warm border `border-[#e8e2d8]`.

**Step 4: Update message bubble shapes**

Same asymmetric bubble radius as AssistantPage (Step 3 of Task 6).

**Step 5: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add frontend/src/components/ChatWidget.jsx
git commit -m "style: restyle ChatWidget — Hellenic Marble colors, warm borders, amplified hovers"
```

---

### Task 8: Restyle Navigation Bar

**Files:**
- Modify: `frontend/src/App.jsx` (Navigation component, ~lines 45-150)

**Step 1: Replace nav bar colors**

The navigation bar uses hardcoded colors. Replace:

| Find | Replace |
|------|---------|
| `bg-white` (nav) | `bg-white` (keep white for contrast) |
| `#1e3a8a` or `#2563eb` | `#1a3aa3` |
| Active link indicators | `bg-[#1a3aa3]` |
| `text-gray-*` | warm gray equivalents |

**Step 2: Add serif to the logo/brand text**

If the nav bar has a brand/logo text, add `style={{fontFamily: "'Literata', serif"}}`.

**Step 3: Style nav links**

Active link: `text-[#1a3aa3] font-semibold`
Hover: `hover:text-[#1a3aa3] transition-colors duration-200`
Add subtle bottom border on active: `border-b-2 border-[#1a3aa3]`

**Step 4: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "style: restyle navigation — #1a3aa3 active states, serif brand, warm colors"
```

---

### Task 9: Restyle Minor Pages — Login, Profile, DiscussionDetail

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx`
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/pages/DiscussionDetail.jsx`

**Step 1: LoginPage — Replace colors**

Same substitution pattern:
- `#2563eb` / `#1e3a8a` → `#1a3aa3`
- Gray text → warm grays
- Add serif to heading if present

**Step 2: ProfilePage — Replace colors**

Same substitution pattern. Role badges should use the updated Badge component (already handled in Task 2).

**Step 3: DiscussionDetail — Replace colors**

- Category header: `bg-[#1a3aa3]` with serif font
- Post thread items: warm backgrounds `bg-[#faf8f4]`
- Reply button: `bg-[#1a3aa3]`
- Reaction buttons: `hover:bg-[#eef1f8]`
- Post hover: subtle lift or left-border effect

**Step 4: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/src/pages/LoginPage.jsx frontend/src/pages/ProfilePage.jsx frontend/src/pages/DiscussionDetail.jsx
git commit -m "style: restyle Login, Profile, DiscussionDetail — Hellenic Marble consistency"
```

---

### Task 10: Restyle Remaining Components + DropZone

**Files:**
- Modify: `frontend/src/components/DropZone.jsx` (line 25: hardcoded `#2563eb`)
- Modify: `frontend/src/components/PostThread.jsx`
- Modify: `frontend/src/components/NotificationBell.jsx`

**Step 1: DropZone**

Replace `borderColor: '#2563eb'` → `borderColor: '#1a3aa3'` on line 25.
Update any other blue references to `#1a3aa3`.

**Step 2: PostThread**

Replace color references to match the warm palette. Reaction buttons should use `hover:bg-[#eef1f8]`.

**Step 3: NotificationBell**

Update any blue references. Bell icon hover: `hover:text-[#1a3aa3]`.

**Step 4: Build to verify**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/src/components/DropZone.jsx frontend/src/components/PostThread.jsx frontend/src/components/NotificationBell.jsx
git commit -m "style: restyle DropZone, PostThread, NotificationBell — consistent Hellenic Marble"
```

---

### Task 11: Final Build, Visual Verification, Frontend Tests

**Step 1: Run frontend build**

Run: `cd frontend && npx pnpm build`
Expected: Build succeeds with no errors.

**Step 2: Run frontend tests**

Run: `cd frontend && npx pnpm test -- --run`
Expected: All tests pass. (Tests check behavior, not styling, so they should all pass.)

**Step 3: Run backend tests**

Run: `python -m pytest tests/ -v`
Expected: All tests pass (no backend changes made).

**Step 4: Visual spot-check**

Start the app (`start.bat`) and check each page in the browser:
- [ ] **HomePage** — Ivory background, #1a3aa3 headings, card hover lifts, serif headings
- [ ] **ForumPage** — Navy category headers with rounded tops, row slide hovers, gold stat accent
- [ ] **ApothecaryPage** — Category cards lift on hover, file rows slide, warm backgrounds
- [ ] **AssistantPage** — Asymmetric chat bubbles, serif header, source tag hovers, warm tones
- [ ] **ChatWidget** — Navy floating button, warm widget panel, consistent message styling
- [ ] **LoginPage** — Navy primary button, warm card
- [ ] **Navigation** — Navy active states, serif brand

**Step 5: Commit any final tweaks**

```bash
git add -A
git commit -m "style: final polish — Hellenic Marble redesign complete"
```

---

## Summary

| Task | Description | Files Modified |
|------|-------------|----------------|
| 1 | Global theme (fonts, CSS vars, background) | index.css, App.css |
| 2 | shadcn base components (button, card, badge, input) | 4 UI components |
| 3 | HomePage restyle | HomePage.jsx |
| 4 | ForumPage restyle | ForumPage.jsx |
| 5 | ApothecaryPage restyle | ApothecaryPage.jsx |
| 6 | AssistantPage restyle | AssistantPage.jsx |
| 7 | ChatWidget restyle | ChatWidget.jsx |
| 8 | Navigation bar restyle | App.jsx |
| 9 | Minor pages (Login, Profile, DiscussionDetail) | 3 page files |
| 10 | Remaining components (DropZone, PostThread, etc.) | 3 component files |
| 11 | Final build, tests, visual verification | — |

**Total: 11 tasks, ~18 files modified, 0 new files created.**
