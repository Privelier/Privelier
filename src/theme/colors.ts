export type Palette = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  success: string;
  error: string;
};

export const darkPalette: Palette = {
  background: '#121214',
  surface: '#1B1B1E',
  border: '#2A2A2E',
  textPrimary: '#F5F1E8',
  textSecondary: '#9A968C',
  accent: '#BFA06B',
  accentText: '#BFA06B',
  success: '#51785C',
  error: '#A8453E',
};

export const lightPalette: Palette = {
  background: '#F8F4EC',
  surface: '#FFFFFF',
  border: '#E6DFD0',
  textPrimary: '#211D17',
  textSecondary: '#756D62',
  accent: '#BFA06B',
  accentText: '#8A6B3D',
  success: '#4F7355',
  error: '#A8453E',
};
