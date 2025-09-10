// Brand Colors - Centralized Color System for TypeScript/JavaScript

export const colors = {
  // Primary Brand Colors
  primary: "#004aad",
  primaryHover: "#003d8a",
  primaryLight: "#e6f0ff",
  primaryDark: "#002d66",

  // Secondary Brand Colors
  secondary: "#fcc353",
  secondaryHover: "#f9b735",
  secondaryLight: "#fef7e0",
  secondaryDark: "#e6a000",

  // Tertiary Brand Colors
  tertiary: "#fcc353",
  tertiaryHover: "#f9b735",
  tertiaryLight: "#fef7e0",
  tertiaryDark: "#e6a000",

  // Neutral Colors
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",

  // Status Colors
  success: "#10b981",
  successHover: "#059669",
  successLight: "#d1fae5",

  warning: "#f59e0b",
  warningHover: "#d97706",
  warningLight: "#fef3c7",

  error: "#ef4444",
  errorHover: "#dc2626",
  errorLight: "#fee2e2",

  info: "#3b82f6",
  infoHover: "#2563eb",
  infoLight: "#dbeafe",

  // Background Colors
  bgPrimary: "#ffffff",
  bgSecondary: "#f9fafb",
  bgTertiary: "#f3f4f6",

  // Text Colors
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textTertiary: "#9ca3af",
  textInverse: "#ffffff",

  // Border Colors
  borderPrimary: "#e5e7eb",
  borderSecondary: "#d1d5db",
  borderFocus: "#004aad",
} as const;

// Type definitions for better TypeScript support
export type ColorKey = keyof typeof colors;
export type ColorValue = (typeof colors)[ColorKey];

// Helper function to get CSS custom property
export const getCSSVariable = (colorKey: ColorKey): string => {
  return `var(--${colorKey.replace(/([A-Z])/g, "-$1").toLowerCase()})`;
};

// Helper function to get color value
export const getColor = (colorKey: ColorKey): string => {
  return colors[colorKey];
};
