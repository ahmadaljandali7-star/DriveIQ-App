export const colors = {
  bg: '#0A1628',
  bgDeep: '#071020',
  card: '#0F1F3D',
  cardHi: '#132848',
  border: '#1A3A5C',
  primary: '#00AAFF',
  primaryDark: '#0077CC',
  text: '#E8F4FF',
  textDim: '#7AAAC8',
  textMute: '#4A6080',
  good: '#10B981',
  warn: '#F59E0B',
  bad: '#EF4444',
};

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return colors.textMute;
  if (score >= 80) return colors.good;
  if (score >= 50) return colors.warn;
  return colors.bad;
}
