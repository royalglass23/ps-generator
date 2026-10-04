---
name: Royal Glass PS1 Application
description: A focused architectural project-review workspace that carries Royal Glass identity into a calm, task-first form.
colors:
  charcoal: "#272c2e"
  ink: "#3a3a3a"
  muted: "#62676d"
  teal: "#1a848b"
  teal-dark: "#126b71"
  teal-soft: "#78b3b7"
  teal-pale: "#edf7f7"
  ground: "#fafafb"
  white: "#ffffff"
  line: "#dfe4e5"
  line-strong: "#bbc7c9"
  success: "#2f765a"
  success-pale: "#eef7f2"
  warning-pale: "#fff8ea"
  danger: "#a3443c"
  danger-pale: "#fff4f3"
typography:
  display:
    fontFamily: "Kumbh Sans, Arial, sans-serif"
    fontSize: "clamp(2.6rem, 5.8vw, 4.75rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Kumbh Sans, Arial, sans-serif"
    fontSize: "clamp(1.65rem, 3vw, 2.15rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Kumbh Sans, Arial, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Kumbh Sans, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Kumbh Sans, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  image: "2px"
  control: "3px"
  surface: "4px"
  circle: "50%"
spacing:
  xs: "0.35rem"
  sm: "0.7rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "2.35rem"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1.15rem"
    height: "2.85rem"
  button-primary-hover:
    backgroundColor: "{colors.teal-dark}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.charcoal}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1.15rem"
    height: "2.85rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.teal-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1.15rem"
    height: "2.85rem"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.72rem 0.8rem"
    height: "3rem"
  choice:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.surface}"
    padding: "0.95rem"
    height: "4.65rem"
  choice-selected:
    backgroundColor: "{colors.teal-pale}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.surface}"
    padding: "0.95rem"
    height: "4.65rem"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
---

# Design System: Royal Glass PS1 Application

## Overview

**Creative North Star: "The Architectural Review Desk"**

The Royal Glass PS1 Application feels like a focused project-review workspace inside the established Royal Glass world. Architectural photography and the official white logo establish provenance in the masthead, then recede so broad white surfaces, clear labels, and one decision at a time can carry the task.

The system is restrained, direct, and human-reviewed rather than software-branded. Kumbh Sans, charcoal text, precise teal state changes, cool neutral rules, and flat compact controls give applicants confidence without implying that submission is approval.

**Key Characteristics:**

- Official Royal Glass imagery introduces the journey, while the working area stays quiet and operational.
- Teal carries action, focus, selection, and progress; it is never decorative noise.
- Flat white surfaces, thin cool rules, and restrained 3–4px corners create architectural discipline.
- Progress is visible in both the masthead and step rail, with simple checkmarks marking completed work.
- Responsive layouts preserve the task sequence, converting the vertical rail into a horizontal scrollable rail.

## Colors

The palette is a cool architectural neutral field animated by a single Royal Glass teal family and reserved semantic feedback colors.

### Primary

- **Royal Glass Teal** (`teal`): The primary action, selected-state, progress, caret, checkbox, radio, and focus color.
- **Deep Teal** (`teal-dark`): Hovered actions, compact progress labels, and restrained text actions.

### Secondary

- **Soft Teal** (`teal-soft`): A lighter brand expression for progress against dark photography.
- **Pale Teal** (`teal-pale`): Selected choices, notices, subtle hover fills, and reference panels.

### Neutral

- **Architectural Charcoal** (`charcoal`): High-emphasis headings and the masthead fallback ground.
- **Working Ink** (`ink`): Default body and control text.
- **Measured Grey** (`muted`): Supporting explanations, metadata, and secondary labels.
- **Cool Ground** (`ground`): The application-page background behind white working surfaces.
- **Gallery White** (`white`): Cards, fields, buttons, logo contrast, and masthead type.
- **Fine Rule** (`line`): Dividers and quiet container boundaries.
- **Strong Rule** (`line-strong`): Interactive control boundaries before focus or selection.

### Named Rules

**The Teal Means State Rule.** Reserve teal for action, progress, focus, and selection so every appearance communicates something useful.

**The White Working Plane Rule.** Keep task surfaces white on the cool ground; use pale teal only to explain or confirm state.

## Typography

**Display Font:** Kumbh Sans (with Arial and sans-serif fallbacks)
**Body Font:** Kumbh Sans (with Arial and sans-serif fallbacks)

**Character:** One geometric sans-serif voice keeps the journey contemporary and coherent with Royal Glass. Weight and scale—not font switching—separate architectural brand moments from practical form copy.

### Hierarchy

- **Display** (600, fluid 2.6–4.75rem, 1.02): Short masthead statements over the hero photograph.
- **Headline** (600, fluid 1.65–2.15rem, 1.15): The current form-step title and major completion heading.
- **Title** (600, 1.02rem, 1.5): Form section prompts and compact card headings.
- **Body** (400, 15px, 1.5): Inputs, decisions, explanations, and operational copy; masthead introductions may open to a 1.7 line-height.
- **Label** (600, 0.8rem, 1.5): Field labels, progress metadata, buttons, and compact state text.

### Named Rules

**The One Voice Rule.** Use Kumbh Sans throughout and create hierarchy with disciplined weight, scale, and spacing.

## Layout

The primary container is capped at 1180px with 1.5rem desktop gutters. The photo masthead spans the surface; a three-column primer band overlaps its lower edge, then the application becomes a 252px sticky step rail beside a flexible form card with a 2rem gap. Form fields use a two-column grid, while choices expand from two or four columns according to their content.

At 850px, the primer stacks, the workspace becomes one column, and the step rail becomes a horizontal, overflow-safe sequence above the form. At 560px, content gutters tighten, all major field and choice grids become one column, form actions become a two-column grid with the primary action first and full width, and the official logo scales from 150px to 122px. The horizontal rail preserves complete step labels instead of collapsing them to ambiguous dots.

**The Task-First Reflow Rule.** Responsive changes preserve labels, state, and sequence before preserving the desktop composition.

## Elevation & Depth

The system is flat by default. Depth comes from photography, overlap, tonal layering, and thin rules rather than floating cards. The primer band is the one ambient lift (`0 14px 34px rgb(39 44 46 / 10%)`), and a selected choice uses a quiet inset teal reinforcement instead of an external shadow.

### Shadow Vocabulary

- **Primer Lift** (`0 14px 34px rgb(39 44 46 / 10%)`): Separates the introductory band where it bridges the photo masthead and working ground.
- **Selected Inset** (`inset 0 0 0 1px #1a848b`): Reinforces an active choice without making it appear elevated.

### Named Rules

**The Flat-by-Default Rule.** Do not add card shadows to the working area; borders and state fills carry structure.

## Shapes

The form language is architectural and restrained: 3px corners on controls and buttons, 4px corners on working surfaces and notices, and 2px clipping on photographs inside choices. Circles are reserved for numbered steps, completion marks, and the success symbol. One-pixel cool borders provide most containment; the upload target uses a dashed border to signal a different interaction.

**The Restrained Corner Rule.** Keep rectangles almost square; reserve full circles for status and sequence markers.

## Components

### Photo Masthead

- **Identity:** Use the official white logo and official architectural hero photograph from `web/public/assets/brand/`.
- **Treatment:** A charcoal 68% shade keeps white type and progress legible while preserving the glass architecture.
- **Content:** Pair one short title and explanatory sentence with the current step and a 3px advancing progress track.

### Primer Band

- **Character:** Three concise facts answer the biggest pre-application questions before the working form begins.
- **Surface:** White with 4px corners, fine internal rules, and the system's only ambient shadow.
- **Responsive:** Stack the facts into one column and convert vertical rules to horizontal dividers.

### Buttons

- **Shape:** Compact, lightly rounded controls (3px) with a minimum 2.85rem height.
- **Primary:** Royal Glass teal with white label text; darken to deep teal on hover.
- **Secondary:** White with a strong cool rule; shift the border and text to teal on hover.
- **Ghost:** Transparent with deep-teal text; introduce pale teal only on hover.
- **Focus / Disabled:** Apply a 3px translucent teal outline with 3px offset; disabled controls remain visible at 48% opacity and lose the pointer cursor.

### Inputs / Fields

- **Style:** White 3rem controls, 3px corners, strong cool borders, compact 600-weight labels, and teal caret or native selection accents.
- **Focus:** The shared 3px translucent teal outline is always visible for keyboard focus, including labelled checkbox and radio groups.
- **Error / Status:** Use pale semantic surfaces with one-pixel semantic borders and concise, role-labelled messages.

### Choice Cards

- **Character:** Flat decision surfaces that can carry text alone or a tightly cropped project image.
- **State:** Hover lifts by 2px and changes the border to teal; selection replaces the white ground with pale teal and adds a teal inset rule plus checkmark.
- **Shape:** 4px card corners and 2px image corners preserve the restrained geometry.

### Step Rail

- **Desktop:** A sticky vertical list connects numbered circles with a one-pixel rule; the teal segment advances through completed distance and completed steps resolve into simple checkmarks.
- **Active:** Pale teal row, deep-teal label, and a filled teal step marker.
- **Responsive:** At 850px and below, the rail becomes a horizontally scrollable row with full labels and no connector line.

### Upload Zone

- **Character:** A large, centered, dashed target that reads as an action rather than another card.
- **State:** Hover uses a teal border and pale-teal ground; disabled state remains legible at reduced opacity.

## Do's and Don'ts

### Do:

- **Do** use the official white Royal Glass logo and approved architectural photography for branded mastheads.
- **Do** keep the form workspace broad, white, flat, and bordered with cool one-pixel rules.
- **Do** let teal communicate actions, focus, selected decisions, and progress.
- **Do** preserve complete step names when the rail becomes horizontal on smaller screens.
- **Do** retain the visible 3px focus outline and disable transitions under reduced-motion preferences.

### Don't:

- **Don't** reproduce global website navigation or a footer inside the application workspace.
- **Don't** replace the teal system with generic navy SaaS styling.
- **Don't** introduce generous pill radii, soft floating cards, or decorative shadows.
- **Don't** let photography compete with the form after the masthead and evidence choices.
- **Don't** animate progress or hover movement when the user requests reduced motion.
