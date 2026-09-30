import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, scoreColor } from '../lib/theme';

export default function ScoreRing({
  score,
  size = 120,
  label,
}: {
  score: number | null;
  size?: number;
  label?: string;
}) {
  const stroke = Math.max(6, size / 14);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  const pct = score == null ? 0 : score / 100;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c * pct} ${c}`}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.value, { color, fontSize: size * 0.32 }]}>{score ?? '--'}</Text>
        {label ? <Text style={[styles.label, { fontSize: Math.max(10, size * 0.09) }]}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  label: { color: colors.textDim, marginTop: -2 },
});
