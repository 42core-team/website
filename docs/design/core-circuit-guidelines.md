# Core Circuit design guidelines

Core Circuit is the chosen design direction for CORE. Use purple for the main action and the current selection, orange to draw attention to featured content, and neutral surfaces for reading and comparing data. The [event draft](core-circuit.html) shows the system in light and dark mode. The [frontend audit](frontend-design-audit.md) records the original route patterns and alternatives.

## Brand colors

| Role | Color | Use |
| --- | --- | --- |
| Primary | Purple `#a214d5` | Filled primary buttons with white text. Use for focus rings and selected indicators on light surfaces. |
| Primary strong | Dark Purple `#4d0e64` | Event mastheads with white text, light-mode link and selected text, and light-mode primary button hover and pressed states. |
| Secondary brand | Orange `#ff8200` | Featured badges with dark text, decorative highlights, and dark-mode callout accents. |
| Secondary brand strong | Dark Orange `#e56000` | Light-mode callout borders and icons. Pair solid fills with dark text. |
| Neutral light | Light Gray `#a2a2a2` | Decorative dividers on light surfaces and secondary text on dark surfaces. |
| Neutral strong | Dark Gray `#747474` | Outlines for secondary controls and strong dividers. |

### Theme tokens

Map these roles to the existing theme variables in [styles.css](../../frontend/src/styles.css). Treat the values below as the implementation targets from the draft.

| Role | Light | Dark |
| --- | --- | --- |
| Page background | `#f7f4f8` | `#17131a` |
| Card and control surface | `#ffffff` | `#231a27` |
| Foreground | `#17131a` | `#faf2fd` |
| Muted foreground | `#626262` | `#a2a2a2` |
| Subtle border | `#e2dae6` | `#44364a` |
| Strong control border | `#747474` | `#747474` |
| Primary action fill | `#a214d5` | `#a214d5` |
| Primary action foreground | `#ffffff` | `#ffffff` |
| Primary action hover | `#4d0e64` | `#8613ad` |
| Link and selected text | `#4d0e64` | `#e4a8f7` |
| Focus ring | `#a214d5` | `#e4a8f7` |
| Selected surface | `#f5e7fa` | `#36213e` |
| Brand highlight fill and text | `#ff8200` and `#17131a` | `#ff8200` and `#17131a` |
| Callout surface and border | `#fff2e5` and `#e56000` | `#392514` and `#ff8200` |

Use `--primary` and `--primary-foreground` for the filled main action. Keep `--secondary` a neutral control surface and give orange its own brand highlight role. Use `--ring` for visible focus and keep link text separate from the primary fill so it can lighten in dark mode. Keep info, active/success, warning, and danger as semantic roles with their own foreground, tint, and border in each theme. Preserve game faction colors, match results, rankings, and chart series as separate data roles. Pair status with a readable label or an icon with an accessible name.

## Layout and typography

| Page frame | Width | Typical use |
| --- | --- | --- |
| Reading | Up to `72ch` for prose | Wiki articles, changelog entries, and legal pages |
| Form | Up to `48rem` | Settings, event creation, and single-column forms |
| Standard | Up to `72rem` | Event overview, team and player profiles, and queue |
| Workspace | Up to `80rem` | Standings, dashboards, and unit builder |
| Immersive | Full available width | Match replay and expanded bracket graphs |

- Use 16 px horizontal gutters on phones, 24 px at medium widths, and 32 px on wide screens. Start with 24 px between sections, 16–24 px inside panels, and 8–12 px between related controls. Use 12 px corners for panels and 6–8 px for everyday controls.
- Use the shared sans-serif for interface and reading text. Start at 28–36 px for page titles, 20–24 px for section headings, 14–16 px for UI text, and 16–18 px for prose. Feature mastheads may use larger titles. Use tabular numerals for timers and standings, and monospace for code, logs, and identifiers.
- Stack side panels on phones. Keep horizontal scrolling inside dense tables and graphs. Use stacked event cards where records can be scanned individually, and keep a table for standings and other cross-row comparisons.

## Component patterns

- **Buttons and links.** Use one filled purple button per action group. Use an outlined neutral button for the supporting action and a text or ghost action for lower priority. Use the shared [button primitive](../../frontend/src/components/ui/button.tsx) for size and states. Underline links in prose.
- **Navigation.** Give the current route a visible indicator and use `aria-current`. Keep route navigation distinct from in-page tabs in markup. Retain the event menu on small screens and make locked-section explanations available on touch and keyboard.
- **Event masthead.** Use dark purple with white text and an optional low-contrast grid or game artwork confined to the masthead. Keep the phase label, timing, and next action visible. An orange badge can highlight the featured phase. Use semantic warning or danger when a deadline or action requires attention.
- **Cards and callouts.** Use flat card surfaces and subtle borders for most content. Use orange-tinted callouts for tips or highlights. Use raised surfaces for menus and dialogs, and a scrim for text over uploaded banners. Keep the replay stage and game art within their media surface.
- **Tables, charts, and forms.** Align numeric columns to the right and label sort states and chart series. Pair selection or qualification tints with a visible label or indicator. Use persistent labels on fields and place validation messages beside the relevant control.
- **Loading, empty, and error states.** Reserve space during loading. Explain what happened, give the next available action, and keep the page heading and surrounding layout in place.

## Review before release

Check the event overview, Groups standings, and a code-heavy wiki article in both themes at phone and desktop widths. Check later rollouts on settings and admin forms, the profile image editor, and the replay shell. For each screen, verify keyboard focus and navigation, text contrast at 4.5:1 for regular text, 3:1 for large text and applicable controls and indicators, reduced motion, and 44 px touch targets for major actions. Include long names, permission states, and loading and error states in the review.
