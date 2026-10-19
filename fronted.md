# MASTER PROMPT — SignVision Desktop Frontend: Pixel-Accurate UI + Functional Integration

## ROLE

Act as a senior frontend engineer, UI/UX specialist, and product-focused software architect. Your job is to implement the SignVision desktop web interface by faithfully reproducing the attached reference screenshot while preserving and correctly connecting the application's existing functionality.

This is an implementation task, not a design exploration task.

**The attached reference image is the visual source of truth. Reproduce its layout, proportions, colors, typography, spacing, alignment, borders, component hierarchy, and overall appearance as closely as possible.**

Do not redesign the interface, invent extra sections, introduce a different theme, or replace working application functionality with mock data.

The result must feel like a professionally built SaaS product, with simple navigation, an intuitive translation workflow, and consistent visual details.

---

## 1. Inspect the Existing Codebase First

Before changing anything, inspect the repository.

Identify:

- The frontend framework, build system, routing, and component structure.
- The existing SignVision translation page.
- The avatar renderer and animation/playback implementation.
- The current sign-to-English and text/sign-sequence translation workflows.
- The backend API endpoints, request and response formats, and error-handling mechanisms.
- Existing translation-history storage and data-loading logic.
- Current CSS, Tailwind configuration, design tokens, icon libraries, and installed dependencies.

Reuse the existing architecture wherever possible.

Do not rebuild the entire application, replace the avatar engine, rewrite the translation algorithm, or modify the backend unnecessarily.

Make targeted, maintainable changes to the relevant frontend components and styles.

## 2. Exact Desktop Layout

The page must follow the reference screenshot's composition.

### Overall structure

Create a full-width dark desktop dashboard with:

- A compact top header.
- A large left-side avatar workspace.
- A right-side translation and results column.
- Playback controls directly underneath the avatar.
- A clear vertical rhythm between the right-side cards.

Use approximately a 60:40 split between the avatar workspace and the right column, adjusting the proportions to match the reference image.

At a viewport around 1536 × 1024, the layout should closely resemble the reference, with consistent outer margins and card spacing.

Use CSS Grid or Flexbox for the actual layout. Do not use absolute positioning as the primary layout technique.

Do not create a mobile-phone mockup inside the web page. This is the desktop web application.

## 3. Header and Logo

Create a minimal header with the brand aligned on the left and one primary action aligned on the right.

### SignVision wordmark

Render the actual text `SignVision`.

- `Sign` must be light blue.
- `Vision` must be white.
- Use a professional sans-serif font.
- Use consistent font weight and baseline alignment.
- Keep the wordmark compact, with no extra SV badge or decorative symbol.
- Avoid awkward letter spacing or excessively bold typography.

Implement the wordmark as a real text-based component, not as an image generated from the reference.

### Primary CTA: Sign to English Conversion

Place a prominent rounded button on the right side of the header.

Exact label:

`Sign to English Conversion`

Include a recognizable hand/sign-language icon on the left and a right-arrow icon on the right.

Visual requirements:

- Blue-to-cyan horizontal gradient.
- White icon and text.
- Rounded corners.
- Comfortable horizontal padding.
- Consistent icon alignment.
- Subtle hover and focus states.
- No excessive glow or decorative animation.

Functionality:

Connect this button to the existing sign-to-English conversion flow in the application. Reuse the existing route, modal, camera workflow, or component where applicable.

Do not create a button that looks functional but does nothing. If the existing workflow needs adjustment, integrate it properly without disrupting the text-to-sign functionality.

Do not add extra History, Settings, profile, or Camera Ready controls to the header. Keep the header minimal, as shown in the screenshot.

## 4. Left Column: Avatar Workspace

The avatar must be the dominant visual element on the page.

### Avatar viewing panel

Build a large rectangular panel with:

- A pale blue-gray studio background.
- Soft, restrained lighting or an existing compatible background treatment.
- Rounded corners.
- A subtle border.
- A centered, properly scaled full-body avatar.
- Adequate negative space around the character.

The reference character is illustrative. You may use the existing SignVision avatar or character assets; reproducing the exact character is not required.

**The important requirement is to match the reference's composition, background, panel dimensions, and avatar positioning.**

Keep the actual 3D avatar and its signing animation working. Never replace it with a static image just to resemble the screenshot.

### Live Camera indicator

Position a small status chip at the bottom-left of the avatar viewer.

Display a green status dot and the text:

`Live Camera`

Use a dark translucent surface, white text, compact padding, and rounded-pill styling.

The indicator must reflect the real application state. Do not report the camera as active when it is disconnected.

### Fullscreen control

Place the existing fullscreen/expand control at the bottom-right of the avatar panel, matching the reference image.

Make it functional and visually consistent with the screenshot.

### Avatar display requirements

- Preserve aspect ratio.
- Avoid unnecessary cropping.
- Avoid stretching or repositioning the avatar during animation.
- Maintain consistent panel dimensions as signs change.
- Keep the background stable during playback.
- Ensure the avatar viewer does not overflow or overlap adjacent components.

## 5. Playback Controls

Create a dedicated horizontal playback panel immediately beneath the avatar viewer.

It must match the reference's position, proportions, rounded corners, background, and border.

Use three functional playback controls:

1. Previous sign.
2. Play/pause.
3. Next sign.

On the left, display:

`Current Sign`

Below it, show the currently playing sign word, such as `WHO`.

On the right, display a speed selector with the label:

`Speed`

Include the initial value `1.0x`.

### Required behavior

Connect the controls to the existing animation player.

- Previous and next move between the signs in the current sequence.
- Play/pause controls the actual animation state.
- Speed selection updates the animation playback rate if supported by the animation engine.
- The current sign label and position indicator update as playback progresses.
- Controls remain synchronized with the ISL sequence cards.

Do not simulate playback using unrelated timers or pretend the avatar is animating when it is not.

If a specific capability is unsupported by the existing avatar engine, inspect the engine and implement the appropriate supported behavior rather than creating a misleading control.

## 6. Right Column: Sign Sequence Input

Place the input section at the top of the right column.

Use a rounded dark card with the title:

`Enter Sign Sequence`

Inside the card, place a single horizontal search/input component.

The input must include:

- A search icon on the left.
- An editable text field.
- A clear-input icon.
- A circular cyan submit button with a right arrow.

Use the same proportions, spacing, borders, background, and rounded corners as the reference screenshot.

Use this sample phrase for initial visual comparison:

`who are they are those are you friends`

This phrase is sample content, not a fixed production value.

### Backend integration

This input must use the application's existing translation architecture.

1. Read the actual input value.
2. Validate and normalize input as the existing API expects.
3. Call the correct translation endpoint.
4. Parse the actual response.
5. Update the displayed sign sequence from the returned result.
6. Update relevant translation history.
7. Display a clear loading state while the request is in progress.
8. Display an understandable error if translation fails.
9. Prevent duplicate submissions while the same request is pending.

Support Enter-key submission and button submission.

The search button must not merely change the appearance of the screen or show a hardcoded result.

Do not invent API URLs, request formats, response properties, or backend endpoints. Discover the existing ones from the source code and documentation.

## 7. ISL Sign Sequence Card

Place the ISL Sign Sequence card immediately beneath the input card.

Reproduce the reference's layout precisely.

### Header row

Left:

`ISL Sign Sequence`

Right:

`3 signs`

The sign count must reflect the actual number of signs in the translated response.

### Sequence tiles

Arrange three equal-width tiles in one horizontal row on a desktop screen.

Each tile contains:

- A numbered circular badge.
- The corresponding sign word.
- A consistent dark blue-gray background.
- A subtle border.
- Rounded corners.
- Matching padding and alignment.

For screenshot comparison, the example sequence is:

| Position | Sign |
|---|---|
| 1 | WHO |
| 2 | FRIEND |
| 3 | WHO |

These example words must not be hardcoded into the application as the production translation logic.

### Correct sequence mapping

The sequence displayed by the frontend must come from the real translation response.

- Preserve the sign ordering returned by the translation service.
- Display the correct sign vocabulary and sequence length.
- Never silently substitute missing signs with arbitrary words.
- Handle empty sequences, failed translations, and unsupported signs appropriately.
- If the existing backend provides animation identifiers, clip URLs, or sign metadata, use those fields to load the appropriate animation.

When a sequence tile is selected, synchronize the current-sign indicator and avatar playback with that sign if the existing player supports it.

The visual card should remain simple, compact, and readable. Do not add unnecessary thumbnails, explanatory paragraphs, or extra controls that are absent from the reference image.

## 8. Recent Translations Card

Place Recent Translations directly below the ISL Sign Sequence card.

Match the reference's dark surface, rounded corners, thin border, internal padding, and heading alignment.

### Header

Left:

`Recent Translations`

Right:

`View all →`

Use a blue accent for the View all action.

### Translation rows

Each row contains:

- A clock/history icon.
- The previous input phrase.
- The number of signs.
- The appropriate timestamp.
- A circular play/replay control.
- A subtle right chevron.

Use two visible example rows when suitable for screenshot comparison:

`who are they are those are you friends`

`but i can help you`

Use the actual translation-history data source in production. Do not hardcode dates or claim that mocked entries are real historical records.

### Behavior

- Show the most recent entries first.
- Make `View all` open the existing translation history view, if available.
- Make row selection load or reopen the corresponding translation if supported by the existing application.
- Connect replay to the corresponding saved translation and animation data.
- Handle empty history and history-loading errors gracefully.

Do not restore a separate oversized playback bar below the history section.

## 9. Exact Visual Design System

Use the screenshot as the primary visual reference.

Suggested starting colors:

- Page background: `#050A12`
- Header background: `#080E17`
- Card background: `#0B1420`
- Secondary surface: `#101B2A`
- Border: `#1D2B3D`
- Primary blue: `#258BFF`
- Cyan: `#00C9D8`
- Primary text: `#F5F7FA`
- Secondary text: `#9AA9BD`
- Status green: `#00D6A5`
- Avatar background: a restrained blue-gray gradient similar to the reference.

Use these values as starting points and tune them against the supplied screenshot.

### Typography

Use a clean, professional sans-serif font. Reuse the existing font where appropriate or select a consistent installed/web-safe family.

Maintain a clear hierarchy between:

- Brand wordmark.
- Card headings.
- Input text.
- Sign labels.
- Secondary descriptions and timestamps.

### Spacing and geometry

- Use a consistent spacing scale.
- Align all card edges.
- Keep consistent vertical gaps between cards.
- Use consistent corner radii and border thickness.
- Avoid arbitrary margin adjustments.
- Ensure the search field and CTA fit their containers.
- Keep the avatar panel and playback panel exactly aligned along their left and right edges.
- Ensure the three sequence tiles have equal widths and evenly distributed gaps.

The interface must look carefully designed rather than automatically assembled from generic components.

Avoid excessive gradients outside the brand CTA, excessive neon glow, unnecessary glass effects, decorative badges, and oversized icons.

## 10. Component Architecture

Implement the page using clear, reusable components. Adapt these names to the repository's existing conventions:

- `SignVisionHeader`
- `SignToEnglishButton`
- `AvatarViewer`
- `LiveCameraIndicator`
- `AvatarPlaybackControls`
- `SignSequenceInput`
- `ISLSignSequence`
- `ISLSignTile`
- `RecentTranslations`
- `RecentTranslationRow`

Keep backend API calls and data transformation logic separate from visual components where appropriate.

Maintain clear ownership of application state, including:

- Current translation input.
- Translation loading/error status.
- Returned sign sequence.
- Current sign index.
- Avatar playback status.
- Playback speed.
- Camera status.
- Translation history.
- Character selection, if already supported.

Avoid duplicated state that allows the sequence display and avatar playback to become inconsistent.

Do not introduce new state-management libraries if the existing implementation already handles these concerns correctly.

## 11. Responsive Behavior

Desktop is the primary target for this task.

At desktop widths, retain the dominant avatar panel on the left and the three stacked cards on the right.

At narrower widths:

- Prevent horizontal overflow.
- Stack columns when necessary.
- Preserve the sequence input above the sequence card.
- Keep the avatar and playback controls visually connected.
- Keep Recent Translations beneath the sequence.
- Preserve touch accessibility and appropriate spacing.

Do not force the desktop layout to shrink indefinitely on mobile screens.

Do not modify the existing mobile experience unnecessarily; ensure that shared components continue to work correctly across screen sizes.

## 12. Accessibility and Reliability

- Use semantic headings, buttons, labels, and inputs.
- Add accessible names to icon-only buttons.
- Provide visible keyboard focus states.
- Maintain adequate text contrast.
- Support keyboard submission.
- Display real loading, empty, and error states.
- Clean up event listeners and animation resources correctly.
- Avoid browser-console errors and unnecessary network requests.

Do not claim that a camera, animation, or conversion succeeded unless the application confirms it.

## 13. Implementation Workflow

Follow this order:

**Step 1 — Audit:** Understand the frontend, avatar engine, backend contracts, and existing translation behavior.

**Step 2 — Implement:** Build the layout and reusable components to match the supplied screenshot.

**Step 3 — Integrate:** Connect the input, translation results, sequence display, avatar playback, and history to the actual application logic.

**Step 4 — Run:** Start the real development environment and navigate to the relevant page.

**Step 5 — Compare:** Take a screenshot at the same approximate resolution as the supplied reference image.

**Step 6 — Correct:** Compare the rendered page against the reference and fix differences in the page margins, header height, column proportions, input dimensions, card placement, avatar scaling, typography, borders, colors, and spacing.

**Step 7 — Validate:** Verify the actual translation flow, sequence order, playback controls, history entries, responsive behavior, and console logs.

**Step 8 — Report:** Summarize the files changed, functionality connected, and checks performed. Clearly disclose any functionality that could not be verified.

## FINAL ACCEPTANCE CRITERIA

The implementation is complete only when:

1. The desktop layout closely matches the attached reference image.
2. The SignVision wordmark uses blue for `Sign` and white for `Vision`.
3. The Sign to English Conversion action is correctly positioned in the header and actually works.
4. The avatar background, size, alignment, and panel proportions match the screenshot.
5. The search bar has the correct placement, shape, spacing, and working submission behavior.
6. The ISL Sign Sequence accurately displays actual backend-produced signs in their correct order.
7. The Recent Translations card uses real application history.
8. Avatar playback, current-sign selection, and playback speed are connected to the actual animation system.
9. No unnecessary header controls or decorative sections have been introduced.
10. The page has been rendered, visually compared, and corrected—not merely implemented without inspection.
11. Existing mobile behavior and backend functionality have not been unnecessarily broken.

**Non-negotiable instruction: Use the attached SignVision desktop screenshot as the design specification. Build the actual frontend with working components and correct data integration. Match the reference first, preserve existing behavior, and improve implementation quality without inventing a different design.**