// Warm, kitchen-friendly colour palette
export const Colors = {
  background:  '#FFF8F0',   // warm off-white
  card:        '#FFFFFF',
  primary:     '#D4622A',   // terracotta orange
  primaryDark: '#B04E20',
  accent:      '#4A7C59',   // herb green
  accentLight: '#EAF4ED',
  warning:     '#E8A838',   // golden yellow
  text:        '#2C1A0E',   // dark brown
  textMuted:   '#7A6355',
  border:      '#EAD9CC',
  chip:        '#F5EBE0',
  chipText:    '#8B5E3C',
  danger:      '#C0392B',
  white:       '#FFFFFF',
  shadow:      '#C4956A',
};

export const Typography = {
  h1: { fontSize: 26, fontWeight: '700' as const, color: Colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  h3: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  small: { fontSize: 13, color: Colors.textMuted },
  label: { fontSize: 12, fontWeight: '600' as const, color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' as const },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 18,
  full: 999,
};
