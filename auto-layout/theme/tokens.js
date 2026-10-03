import { Appearance } from 'react-native';

// "Proof Marks" identity: a typeset galley marked up in pencil.
//   ink         = text
//   blue pencil = the only color that means "you can tap this" (primary)
//   red pencil  = correct / delete (error)
// Roles keep their old names (primary, error...) so screens don't change shape;
// the scheme is resolved once at launch (Android recreates the activity on a
// system theme switch, so this stays in step with the OS).
const light = {
  primary: '#1F4FD1',
  primaryDark: '#173C9E',
  primaryLight: '#E3EAFB',
  background: '#F3F5F8',
  surface: '#E7EBF1',
  border: 'rgba(18,21,28,0.14)',
  textPrimary: '#12151C',
  textSecondary: '#566070',
  textOnPrimary: '#FFFFFF',
  error: '#BE2525',
  overlay: 'rgba(18,21,28,0.45)',
};

const dark = {
  primary: '#8FAAFF',
  primaryDark: '#6C8CF5',
  primaryLight: '#1D2744',
  background: '#0F1218',
  surface: '#1A1F29',
  border: 'rgba(232,235,241,0.16)',
  textPrimary: '#E8EBF1',
  textSecondary: '#A3ABBA',
  textOnPrimary: '#0F1218',
  error: '#FF8A8A',
  overlay: 'rgba(0,0,0,0.6)',
};

export const isDark = Appearance.getColorScheme() === 'dark';
export const colors = isDark ? dark : light;

// One pencil mark per detected element class. Each also carries a 3-letter
// abbreviation in the UI, so class is never conveyed by color alone.
// Hues stay clear of the blue (action) and red (correct/delete) roles.
export const marks = {
  Text: { color: isDark ? '#4FD1D9' : '#0B6E78', abbr: 'TXT' },
  Textfield: { color: isDark ? '#8FDB74' : '#2F7A1F', abbr: 'FLD' },
  Button: { color: isDark ? '#FFB84D' : '#9A5A00', abbr: 'BTN' },
  Image: { color: isDark ? '#C9A2FF' : '#6B33B8', abbr: 'IMG' },
  Switch: { color: isDark ? '#FF8FD0' : '#A1226F', abbr: 'SWT' },
};

// The "clean proof": code is always read on ink, whatever the app scheme.
export const code = {
  background: '#0E1117',
  text: '#E6EAF2',
  gutter: '#8A93A6',
  comment: '#8A93A6',
  keyword: '#8FAAFF',
  string: '#F2C94C',
  tag: '#FF9A9A',
  number: '#8FDB74',
  rule: 'rgba(230,234,242,0.12)',
  edge: 'rgba(230,234,242,0.25)',
  accent: '#8FAAFF',
  onAccent: '#0E1117',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 6,
  md: 12,
  pill: 12, // proof stamps, not pills; kept under the old key for existing screens
};

export const typography = {
  heading: {
    fontFamily: 'Roboto',
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontFamily: 'Roboto',
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  // Tiny mono "slug line" labels: status, counts, marks.
  slug: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  // Real code: case matters, so the system monospace, never the display face.
  mono: {
    fontFamily: 'monospace',
  },
  // Wordmark only. System-code is an all-caps display face.
  brand: {
    fontFamily: 'System-code',
  },
};

// Flat sheets, not floating cards: depth is a hairline and one soft lift.
export const shadow = {
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  header: {
    shadowColor: '#000',
    shadowOpacity: 0,
    elevation: 0,
  },
};

export default { colors, marks, code, spacing, radii, typography, shadow };
