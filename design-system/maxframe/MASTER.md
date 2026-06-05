# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/maxframe/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Maxframe
**Generated:** 2026-06-05 14:10:50
**Evolved:** 2026-06-05 (purple brand + ui-ux-pro-max curation rules)
**Category:** Desktop video downloader (Electron utility)

---

## Brand Overrides (always win over skill output)

Skill-generated landing-page patterns (hero video, app-store sections, light palettes) are **not applicable** to Maxframe. When using ui-ux-pro-max, extract only:

- UX guidelines (`--domain ux`)
- Anti-patterns and pre-delivery checklist
- Spacing, shadow, transition timing
- Stack guidelines (`--stack react` for Chakra patterns)

**Locked brand palette:**

| Role | Hex | Chakra token |
|------|-----|--------------|
| Brand / CTA | `#A855F7` | `purple.500` → `brand.primary` |
| Secondary accent | `#00f0ff` | `cyan.400` → `brand.secondary` |
| Canvas | `#070b12` | `surface.canvas` |
| Panel | `#0f141c` | `surface.panel` |
| Elevated surface | `#1E1B4B` | `surface.elevated` |
| Text | `#F8FAFC` | `fg` |
| Best quality highlight | `#4ADE80` | `green.400` → `accent.best` |

**Rejected from skill auto-output:** `#E11D48` rose CTA, light-mode palettes, landing-page section orders.

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Brand / CTA | `#A855F7` | `--color-brand` |
| Secondary accent | `#00f0ff` | `--color-secondary` |
| Elevated surface | `#1E1B4B` | `--color-elevated` |
| Background | `#070b12` | `--color-background` |
| Panel | `#0f141c` | `--color-panel` |
| Text | `#F8FAFC` | `--color-text` |

**Color Notes:** Purple-led OLED dark + cyan progress accents

### Typography

- **Heading Font:** Inter
- **Body Font:** Inter
- **Mood:** Bold + Engaging typography

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #E11D48;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #0F0F23;
  border: 2px solid #0F0F23;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #000000;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #0F0F23;
  outline: none;
  box-shadow: 0 0 0 3px #0F0F2320;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Dark Mode (OLED)

**Keywords:** Dark theme, low light, high contrast, deep black, midnight blue, eye-friendly, OLED, night mode, power efficient

**Best For:** Night-mode apps, coding platforms, entertainment, eye-strain prevention, OLED devices, low-light

**Key Effects:** Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white emission, high readability, visible focus

### Page Pattern

**Pattern Name:** Video-First Hero

- **Conversion Strategy:** 86% higher engagement with video. Add captions for accessibility. Compress video for performance.
- **CTA Placement:** Overlay on video (center/bottom) + Bottom section
- **Section Order:** 1. Hero with video background, 2. Key features overlay, 3. Benefits section, 4. CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Static layout
- ❌ Slow video player

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
