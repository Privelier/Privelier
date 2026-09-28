export type Palette = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  onAccent: string;
  success: string;
  successText: string;
  error: string;
  errorText: string;
};

export const darkPalette: Palette = {
  background: '#121214',
  surface: '#1B1B1E',
  border: '#2A2A2E',
  textPrimary: '#F5F1E8',
  textSecondary: '#9A968C',
  accent: '#BFA06B',
  accentText: '#BFA06B',
  onAccent: '#121214',
  success: '#51785C',
  // Text variants: the authoritative success/error hues fail WCAG AA as body
  // text on the dark surfaces, so text gets lightened tints of the same hues;
  // fills and borders keep the brand values.
  successText: '#7FA98B',
  error: '#A8453E',
  errorText: '#CE7A73',
};
