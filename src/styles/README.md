# Styles

The portal uses The Clash brand, as on the website and the app.

- `brand.scss`: the brand tokens (colours, fonts, shapes, layout sizes) and the `@font-face` rules. Components use these
  custom properties (`var(--spark)`, `var(--ink)`, `var(--clip-cut)` …), never raw hex values.
- `colors.scss`: the portal's older colour names (`--primary-color`, `$text-primary` …), remapped onto the brand so
  any style still using them stays on-brand. New code uses the brand tokens.
- `src/ui/`: the UI kit built on these tokens (Button, Chip, Segmented, AppBar, TabBar, Toast …).

Both files are imported once, by `src/index.scss`. Orange (`--spark`) leads; blue (`--brand`) is only for solid bars,
away-team accents, referee-team chips and padel accents. No black, near-black or navy fills: dark shades are only scrims
over photos and behind sheets. Light theme only.
