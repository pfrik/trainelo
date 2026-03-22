## Design Context

### Users
Athletes and fitness enthusiasts who use Garmin wearable devices and want data-driven, personalized training recommendations. They open Trainelo each morning to check in (mood, soreness, RPE) and receive an AI-calibrated workout for the day. They value knowing *why* a recommendation was made and trust the system to adapt when their body signals say so. The unique differentiator is the morning check-in loop: hardware data + subjective user input + AI reasoning = the right workout for today's goal.

### Brand Personality
**Precise, Calm, Trusted.** Trainelo is the quiet, confident coach who always has the data to back up the call. It speaks with clarity, never overwhelms, and earns trust through transparency. Every recommendation comes with an evidence trail — not because users demand proof, but because visible reasoning builds confidence over time.

**Emotional goal:** When an athlete opens Trainelo in the morning, they should feel *calm and trust* — "My training is in good hands." No anxiety, no second-guessing, just a clear path forward.

### Aesthetic Direction
- **Visual tone:** Dark-first, data-rich but never cluttered. Clean cards with generous whitespace. Information density is high but visual noise is low.
- **Color system:** Green (#22C55E) for primary actions and positive signals. Orange (#f97316) as accent for warmth and attention. Red for caution/safety states only. The palette should feel athletic but not aggressive.
- **Typography:** Inter for clarity and readability at all sizes. Space Grotesk for brand moments (logo, hero headings). Tight tracking on headlines, comfortable line-height on body text.
- **References:** Draws from the calm data visualization of Oura, the performance seriousness of Whoop, and the structured planning of TrainingPeaks — but with a warmer, more approachable personality than any of them.
- **Anti-references:** Not gamified or social (not Strava). Not clinical or overwhelming (not a medical dashboard). Not flashy or trend-chasing.
- **Theme:** Dark mode is the default and primary experience. Light mode is supported but secondary.

### Design Principles

1. **Calm confidence over hype.** The interface should reassure, not excite. Muted transitions, steady rhythms, no gratuitous animation. Motion is purposeful — it guides attention, never distracts.

2. **Show the why.** Every recommendation, score, and signal should be traceable. Evidence panels, reason codes, and confidence percentages aren't optional — they're core UX. Transparency is the trust mechanism.

3. **Least intervention.** Default to keeping the planned workout unless strong evidence says otherwise. The UI should reflect this philosophy: stable, predictable layouts that don't shift unexpectedly. Changes are deliberate and clearly communicated.

4. **Data-rich, visually quiet.** High information density with low cognitive load. Use hierarchy, spacing, and color coding to let users scan quickly. Cards group related data. Color signals (green/yellow/red) provide at-a-glance status without requiring deep reading.

5. **Mobile-first, morning-first.** The primary use case is a quick morning check-in on a phone. Every interaction should be optimized for that context: large touch targets, minimal scrolling to reach today's recommendation, fast load times.

### Accessibility
- Target WCAG AA compliance across all components
- Ensure sufficient color contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Keyboard navigation support for all interactive elements
- Focus indicators visible in both light and dark themes
- Color is never the sole indicator of state — always pair with icons or text labels
- Respect reduced-motion preferences via `prefers-reduced-motion`

### Component Conventions
- **Component library:** shadcn/ui (49 components) with Radix UI primitives
- **Class composition:** `cn()` utility (clsx + tailwind-merge) for all conditional styling
- **Variants:** CVA (class-variance-authority) for button, input, and badge variants
- **Icons:** Lucide React (primary) + Material Symbols Outlined (secondary)
- **Charts:** Recharts with custom theme colors (orange, blue, teal, purple)
- **Loading states:** Skeleton loaders with `animate-pulse`
- **Notifications:** Sonner toast library
- **Spacing rhythm:** 4px Tailwind scale — cards use p-3/p-4/p-6, panels use p-6/p-8
- **Border radius:** 8px (lg), 6px (md), 4px (sm) via CSS custom property `--radius`
