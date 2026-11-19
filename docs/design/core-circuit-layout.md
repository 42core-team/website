# Core Circuit layout guidelines

Every route uses the site navigation, a single main content landmark, and the site footer. The event bar adds event context below site navigation. Short pages let the shell fill the viewport so the footer sits at the bottom. Long pages scroll to the footer after the content.

## Findings from the layout audit

| Area | What varied | Shared pattern |
| --- | --- | --- |
| Public and account pages | About added a second set of gutters, Settings centered its title, and legal titles inherited prose styling. | Align the title and the first section to the same frame. Use a narrow measure for prose and forms. |
| Event pages | Some routes wrapped the heading and tabs in extra spacing, and Teams put its title inside the results card. The event shell also reserved a second viewport height. | Keep the event bar separate from the page. Start each tool with its heading and controls, then use one section gap before the content. |
| Admin and status screens | Several loading states rendered a bare spinner. Profile and team errors had their own wrappers. | Use the shared main landmark for loading, access, empty, and error states, including when they replace the entire page. |
| Wiki and media | Wiki sized its pane against a different viewport height than the site shell. Replay sized its stage using a hard-coded header height. | Share the site header height and page gutters. Give each workspace the scroll behavior its content needs. |

## Page frames

Use [PageLayout](../../frontend/src/layouts/page-layout.tsx) once per rendered route. Parent routes that render an outlet can add navigation around it. The frame owns the main landmark, its skip-link target, gutters, and default vertical spacing.

| Frame | Width | Pages |
| --- | --- | --- |
| Standard | 72 rem maximum including gutters | About, event list and overview, Match Making, Gambling, team and player profiles, and Rush. |
| Form | 48 rem maximum including gutters | Settings, Create event, GitHub setup, and centered access and error states. |
| Reading | 72 ch content measure plus gutters | Changelog, Impressum, and Datenschutz. Wiki uses the same reading measure within its workspace. |
| Workspace | 80 rem maximum including gutters | Event dashboard, Group Phase, Tournament Tree, Teams, Unit Builder, and site admin pages. |
| Full | Available width | The home page uses framed sections within full-width bands. Match replay uses the available width for its stage and a standard frame for logs. Wiki uses a reading column inside its documentation workspace. |

## Spacing and page headings

- Use 16 px gutters below 768 px, 24 px from 768 px, and 32 px from 1280 px. Keep headings, toolbars, and the panels they describe on the same grid. Apply the gutters once to a framed area.
- Start and end ordinary page content with 24 px of vertical padding on phones and 32 px from 768 px. Keep 24 px between top-level sections, 16–24 px inside panels, and 8–12 px between a label and control or between related actions. Home’s full-width feature bands use 40 px on small screens and 56 px from 768 px.
- Use the shared `PageHeader` for a left-aligned title, optional supporting text, and page-level actions. Actions can sit beside the title when space allows and wrap below it on narrower screens. Home and event mastheads and team and player cover panels place the page title within the feature. Replay announces its title to assistive technology while the match header identifies the teams.
- Put empty states and inline errors in the same frame as the content they replace. For route-level loading, use `PageLoader` and choose the matching frame. Use `PageError` for a route-level error with a message and a recovery action where available.

## Navigation and scrolling

- Keep the site header at the top and align the header, event bar, wiki workspace, and footer to the shared 80 rem workspace boundary. The main landmark is the first keyboard skip target after bypassing navigation.
- Keep the event bar below the site header. Use its route menu on phones and allow the tabs to wrap on wider screens when they need more room. Measure the event bar so skip links and sticky tools clear both rows of navigation.
- Let normal routes scroll with the document. On the wiki, keep the search toolbar visible and let the article and sidebar scroll independently. On phones the sidebar opens from the navigation button. Match replay uses its match header and gives the stage initial focus for playback shortcuts. Its logs remain in document flow below the stage.
- Stack multi-column tools on narrow screens and keep min-width constraints local. Contain sideways scrolling within tables, code blocks, graphs, and media so the page and footer stay within the viewport.

## Review a route

Check the content and loading or access states at phone and desktop widths in both themes. Verify one main landmark, a page title, alignment between title and content, consistent gutters and section gaps, wrapping actions, and access to the footer. Test the skip link and exercise local scrolling on tables, code, the wiki, and replay.
