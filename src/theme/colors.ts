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

export const lightPalette: Palette = {
  background: '#F8F4EC',
  surface: '#FFFFFF',
  border: '#E6DFD0',
  textPrimary: '#211D17',
  textSecondary: '#756D62',
  accent: '#BFA06B',
  accentText: '#8A6B3D',
  onAccent: '#121214',
  success: '#4F7355',
  successText: '#4F7355',
  error: '#A8453E',
  errorText: '#A8453E',
};
