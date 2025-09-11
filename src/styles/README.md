# Color System

This directory contains the centralized color system for The Clash Referee Portal.

## Brand Colors

- **Primary**: `#004aad` - Main brand color
- **Secondary**: `#fcc353` - Accent color
- **Tertiary**: `#fcc353` - Same as secondary

## Usage

### In SCSS Files

```scss
@import "../styles/colors.scss";

.my-component {
  background: $primary-color;
  color: $white;
  border: 1px solid $border-primary;

  &:hover {
    background: $primary-color-hover;
  }
}
```

### In CSS Files

```css
.my-component {
  background: var(--primary-color);
  color: var(--white);
  border: 1px solid var(--border-primary);
}

.my-component:hover {
  background: var(--primary-color-hover);
}
```

### In TypeScript/JavaScript

```typescript
import { colors, getColor } from "../styles/colors";

// Direct usage
const primaryColor = colors.primary;

// Helper function
const primaryColor = getColor("primary");

// For inline styles
const style = {
  backgroundColor: colors.primary,
  color: colors.white,
};
```

## Available Colors

### Brand Colors

- `primary`, `primaryHover`, `primaryLight`, `primaryDark`
- `secondary`, `secondaryHover`, `secondaryLight`, `secondaryDark`
- `tertiary`, `tertiaryHover`, `tertiaryLight`, `tertiaryDark`

### Neutral Colors

- `white`, `gray50`, `gray100`, `gray200`, `gray300`, `gray400`, `gray500`, `gray600`, `gray700`, `gray800`, `gray900`

### Status Colors

- `success`, `successHover`, `successLight`
- `warning`, `warningHover`, `warningLight`
- `error`, `errorHover`, `errorLight`
- `info`, `infoHover`, `infoLight`

### Background Colors

- `bgPrimary`, `bgSecondary`, `bgTertiary`

### Text Colors

- `textPrimary`, `textSecondary`, `textTertiary`, `textInverse`

### Border Colors

- `borderPrimary`, `borderSecondary`, `borderFocus`

## Best Practices

1. **Always use the color variables** instead of hardcoded hex values
2. **Use semantic color names** (e.g., `primary` instead of `blue`)
3. **Use hover states** for interactive elements
4. **Use light variants** for backgrounds and subtle elements
5. **Use the TypeScript colors** for dynamic styling in components

## Adding New Colors

1. Add the color to both `colors.scss` and `colors.ts`
2. Update this README with the new color
3. Use consistent naming conventions
4. Include hover and light variants when appropriate
