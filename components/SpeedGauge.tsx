import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../lib/theme';

const MAX = 180;
const ARC = 0.75; // 270° gauge

export default function SpeedGauge({ speed, unit, size = 220 }: { speed: number; unit: string; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(speed, 0) / MAX, 1);
  const color = speed > 130 ? colors.bad : speed > 100 ? colors.warn : colors.primary;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * ARC} ${c}`}
          strokeLinecap="round"
          rotation={135}
          origin={`${size / 2}, ${size / 2}`}
        />
        {pct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c * ARC * pct} ${c}`}
            strokeLinecap="round"
            rotation={135}
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <Text style={styles.speed}>{Math.round(speed)}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  speed: { fontSize: 64, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 16, color: colors.textDim, marginTop: -6 },
});
