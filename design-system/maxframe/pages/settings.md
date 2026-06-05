# Settings Page Overrides

> **PROJECT:** Maxframe
> **Generated:** 2026-06-05 14:10:50
> **Page Type:** Settings / Profile

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

> **Curated from ui-ux-pro-max** — ignore light-mode cyan/green palette from skill; inherit MASTER dark OLED only.

### Layout Overrides

- **Max Width:** 960px
- **Layout:** Simple settings card inside `AppShell`
- **Sections:** 1. Debug mode toggle, 2. Log path (when debug on), 3. Back/nav via tab bar (Phase 2)
- **Palette:** MASTER dark only — no light `#ECFEFF` backgrounds from skill output

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Dark/light matching app store feel. Star ratings in gold. Screenshots with device frames.

### Component Overrides

- Avoid: Ignore accessibility motion settings

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white emission, high readability, visible focus
- Animation: Check prefers-reduced-motion media query
- CTA Placement: Download buttons prominent (App Store + Play Store) throughout
