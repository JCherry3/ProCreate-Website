import { COLORS } from "../contexts/ThemeContext";

/**
 * Generate a Tailwind CSS class string for background color
 */
export function getBgColor(color: keyof typeof COLORS): string {
  return `bg-[${COLORS[color]}]`;
}

/**
 * Generate a Tailwind CSS class string for text color
 */
export function getTextColor(color: keyof typeof COLORS): string {
  return `text-[${COLORS[color]}]`;
}

/**
 * Generate a Tailwind CSS class string for border color
 */
export function getBorderColor(color: keyof typeof COLORS): string {
  return `border-[${COLORS[color]}]`;
}

/**
 * Get the hex value for a theme color
 */
export function getColorValue(color: keyof typeof COLORS): string {
  return COLORS[color];
}

/**
 * Generate a CSS custom property for use in inline styles
 */
export function getCssVariable(color: keyof typeof COLORS): string {
  return `var(--color-${color}, ${COLORS[color]})`;
}
