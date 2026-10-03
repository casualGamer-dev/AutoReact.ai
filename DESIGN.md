---
name: AutoReact.ai
description: A typeset galley marked up in pencil; paper sketches become code through proofreading.
colors:
  primary: "#1F4FD1"
  primary-dark: "#173C9E"
  primary-light: "#E3EAFB"
  background: "#F3F5F8"
  surface: "#E7EBF1"
  border: "rgba(18,21,28,0.14)"
  text-primary: "#12151C"
  text-secondary: "#566070"
  text-on-primary: "#FFFFFF"
  error: "#BE2525"
  overlay: "rgba(18,21,28,0.45)"
  dark-primary: "#8FAAFF"
  dark-primary-dark: "#6C8CF5"
  dark-primary-light: "#1D2744"
  dark-background: "#0F1218"
  dark-surface: "#1A1F29"
  dark-border: "rgba(232,235,241,0.16)"
  dark-text-primary: "#E8EBF1"
  dark-text-secondary: "#A3ABBA"
  dark-text-on-primary: "#0F1218"
  dark-error: "#FF8A8A"
  dark-overlay: "rgba(0,0,0,0.6)"
  mark-text: "#0B6E78"
  mark-textfield: "#2F7A1F"
  mark-button: "#9A5A00"
  mark-image: "#6B33B8"
  mark-switch: "#A1226F"
  code-background: "#0E1117"
  code-text: "#E6EAF2"
  code-gutter: "#8A93A6"
  code-keyword: "#8FAAFF"
  code-string: "#F2C94C"
  code-tag: "#FF9A9A"
  code-number: "#8FDB74"
typography:
  heading:
    fontFamily: "Roboto"
    fontSize: "22px"
    fontWeight: 700
  body:
    fontFamily: "Roboto"
    fontSize: "16px"
    fontWeight: 500
  caption:
    fontFamily: "Roboto"
    fontSize: "14px"
    fontWeight: 400
  slug:
    fontFamily: "System-code"
    fontSize: "12px"
    letterSpacing: "0.6px"
  code:
    fontFamily: "System-code"
    fontSize: "13px"
    lineHeight: "20px"
rounded:
  sm: "6px"
  md: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "10px 24px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    height: "48px"
    padding: "10px 8px"
  text-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "10px 16px"
  mark-chip:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 14px"
  button-code-share:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.code-background}"
    rounded: "{rounded.md}"
    height: "48px"
---

# Design System: AutoReact.ai

## Overview

**Creative North Star: "Proof Marks"**

Review is proofreading. A machine sets a first proof, the user marks corrections in pencil, and the marks are typeset into code. The interface is the galley: a cool proof-white ground (or its ink-dark twin), near-black ink for text, and two pencils. Blue pencil means "you can tap this." Red pencil means "correct or delete." Nothing else carries those meanings.

Density is calm and one-handed: flat sheets divided by hairlines, 48dp targets, a tiny mono slug line for status. The user's own sketch is the hero of the review screen; hairline boxes sit on it like margin marks. The code screen is always ink, a "clean proof" read on dark whatever the app scheme.

**Key Characteristics:**
- Two schemes (proof-white, ink) resolved once at launch from `Appearance`; role names are identical in both.
- Blue = action, red = correct/delete, each exclusive to that meaning.
- Five detected element classes are five pencil marks, each with a 3-letter abbreviation so class is never color alone.
- Mono "slug line" voice for status, counts, labels, and code; Roboto for everything spoken.
- Flat by default; a hairline is the primary divider.

## Colors

Cool blue-grey paper, ink text, one action blue, one correction red, and five hue-separated class marks that stay clear of both pencils.

### Primary
- **Blue Pencil** (primary; dark scheme dark-primary): the only "tappable" color. Primary button fill, secondary/ghost text and outline, selected segment, text selection, small action links ("Done", "Restore N").
- **Blue Pencil Deep / Wash** (primary-dark, primary-light): pressed and tinted companions defined in the theme.

### Secondary
- **Red Pencil** (error; dark-error): correction and deletion only. Field error text and the "Remove" chip.

### Neutral
- **Proof White** (background) and **Sheet Grey** (surface): page ground and the raised-by-tone layer (inputs, tray).
- **Ink** (text-primary) and **Pencil Grey** (text-secondary): text and quiet text.
- **Hairline** (border): 14% ink in light, 16% paper in dark; every divider and field stroke.
- **Scrim** (overlay): modal dimming.

### Class Marks
Light-scheme values are in the frontmatter; the dark scheme swaps to lighter equivalents of the same hue. Each is paired with an abbreviation.
- **Text** TXT (teal), **Textfield** FLD (green), **Button** BTN (amber), **Image** IMG (violet), **Switch** SWT (magenta). Dark values: #4FD1D9, #8FDB74, #FFB84D, #C9A2FF, #FF8FD0.

### Clean-proof ink (code screen)
Code background, text, gutter, and syntax hues (keyword in dark-primary blue, string yellow, tag pink, number green, comments in gutter grey) are fixed and independent of the app scheme.

### Named Rules
**The Two Pencils Rule.** Blue is only for what can be tapped; red is only for correcting or removing. Never use either for decoration or for a class mark.

**The Mark Never Alone Rule.** A class is always color plus abbreviation (and its word in the tray). Selected chips are filled, not only recolored.

**The Always-Ink Code Rule.** Code is read on the fixed ink palette, whatever the OS scheme.

## Typography

**Display/Body Font:** Roboto (platform default fallback)
**Label/Mono Font:** System-code (the platform mono voice)

**Character:** A plain, legible sans for instruction and a small mono for the proofreader's slug lines and code.

### Hierarchy
- **Heading** (700, 22px): screen titles.
- **Body** (500, 16px): default text; buttons raise it to 17px / 600, tray chips use 15px / 600.
- **Caption** (400, 14px, text-secondary): hints, errors.
- **Slug** (System-code, 12px, 0.6 letter-spacing; 13px for action links and segments; uppercase for field labels and actions): status ("7 marks · 2 corrected"), counts, mark flags, labels.
- **Code** (System-code, 13px / 20px line): code lines and gutter.

### Named Rules
**The Slug Line Rule.** Machine-ish facts (counts, status, labels) are set in the mono slug; human sentences in Roboto.

## Layout

Single-column, full-width phone screens. Spacing scale is 4 / 8 / 16 / 24 / 32; screen gutters are 16, button horizontal padding 24, field and chip gaps 8. Every interactive element has at least 48dp height (some also 48dp width); small marks over the photo extend with a 12dp hit slop. The review screen runs the photo full-bleed at device width with a slug bar above, a bottom tray of mark chips when a box is selected, and the confirm button pinned below with 16 margin.

## Elevation & Depth

Flat sheets, not floating cards. Depth is a hairline (stroke at the border token) and tonal steps between background and surface. The only shadow in the theme is a soft `raised` lift (black, 10% opacity, 8 radius, 3 down, elevation 2); the `header` shadow is explicitly none.

### Named Rules
**The Hairline First Rule.** Separate regions with a hairline or a tonal step before reaching for the raised shadow.

## Shapes

Small, even radii: 6 (sm) and 12 (md). Everything interactive (buttons, fields, chips, segmented control) is 12. Pills are not used; the old `pill` key is aliased to 12. Detection boxes are square-cornered 1.5px strokes in the class color (3px when selected), with a flag in the top-left of the same color.

## Components

### Buttons
- **Shape:** 12 radius, 48 min height, 24 horizontal padding.
- **Primary:** Blue Pencil fill, on-primary text, 17px / 600.
- **Secondary:** transparent with 1.5px blue outline and blue text. **Ghost:** transparent, 8 horizontal padding, blue text.
- **Pressed:** scale to 0.96 over 100ms, springing back (damping 15, stiffness 300); disabled drops to 50% opacity.
- **Code share:** the one button recolored to the ink palette (code accent blue fill, ink text).

### Inputs / Fields
- Sheet Grey fill, 1px hairline stroke, 12 radius, 48 min height, 16 horizontal padding. Label above in uppercase slug. Error line below in red caption. Selection color is blue.

### Mark Chips (tray)
- 48 high, 12 radius, 1.5px stroke in the class color, abbreviation in slug plus class name. Selected: filled with the class color and on-primary text. The Remove chip uses the red outline and text.

### Segmented Control
- Bordered 12 radius, 48 high, 96 min width items, uppercase slug labels. Selected is a filled blue segment (accent blue on ink via `tone="ink"`).

### Detection Box and Margin Flag (signature)
- Hairline box over the user's photo; flag is mono 12px abbreviation on a class-color fill. Marks fade in 250ms, staggered 70ms each.

### Code Viewer (signature)
- Ink screen, line-number gutter right-aligned with a rule, 13/20 mono, regex-colored tokens, horizontal scroll, slug line above, actions bar divided by a hairline.

## Do's and Don'ts

### Do:
- **Do** draw colors from the resolved `colors`, `marks`, and `code` exports; never hardcode hex in screens.
- **Do** keep 48dp minimum for anything tappable.
- **Do** pair every class color with its abbreviation.
- **Do** keep the code screen on the ink palette.

### Don't:
- **Don't** use blue for anything that is not an action, or red for anything that is not correct/delete.
- **Don't** use the pastel-green pill utility look; no pill shapes.
- **Don't** convey state by color alone; selection is also filled or ruled.
- **Don't** add elevation to regions that a hairline can separate.

## Known Gaps (build, not rules)

- Legacy raster illustrations sit on a light sheet and are not re-skinned for the ink scheme.
- No device screenshots were captured; the system is recorded from source.
- Marks-resolve-into-code motion, ripple, and haptics were not built.
- `typography` colors are resolved at module load, so the scheme cannot change mid-session (by design, activity recreates on OS change).
- The detection flag reuses on-primary text over class colors; contrast of that pairing was not measured.
