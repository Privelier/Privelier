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
  // tinted fills keep the brand values. A border or line that marks an error
  // state (inputs, checkboxes, destructive outlines, failed bubbles, error
  // notices) uses `errorText`: the brand `error` is only 2.9:1 on `surface`,
  // under the WCAG 1.4.11 3:1 floor for UI boundaries; `errorText` is 5.5:1.
  successText: '#7FA98B',
  error: '#A8453E',
  errorText: '#CE7A73',
};
