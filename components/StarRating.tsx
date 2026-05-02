import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface PartialStarProps {
  fill: number; // 0 to 1
  size: number;
  color: string;
}

function PartialStar({ fill, size, color }: PartialStarProps) {
  if (fill <= 0) {
    return <Ionicons name="star-outline" size={size} color={color} />;
  }
  if (fill >= 1) {
    return <Ionicons name="star" size={size} color={color} />;
  }
  return (
    <View style={{ width: size, height: size }}>
      {/* Empty star underneath */}
      <Ionicons
        name="star-outline"
        size={size}
        color={color}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {/* Filled star clipped to the fill fraction */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'hidden',
          width: Math.round(size * fill),
          height: size,
        }}
      >
        <Ionicons name="star" size={size} color={color} />
      </View>
    </View>
  );
}

interface StarRatingProps {
  rating: number; // 0–5 in 0.25 increments
  size?: number;
  gap?: number;
  color?: string;
  /** When provided the stars become interactive */
  onRate?: (rating: number) => void;
}

export default function StarRating({
  rating,
  size = 36,
  gap = 6,
  color = Colors.primary,
  onRate,
}: StarRatingProps) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {[1, 2, 3, 4, 5].map((star) => {
        // How much of this star should be filled (0–1)
        const fill = Math.min(1, Math.max(0, rating - (star - 1)));

        if (!onRate) {
          return <PartialStar key={star} fill={fill} size={size} color={color} />;
        }

        return (
          <Pressable
            key={star}
            style={{ width: size, height: size }}
            onPress={() => {
              const currentStar = rating > 0 ? Math.ceil(rating) : 0;
              if (currentStar === star) {
                // Same star: cycle  1.0 → 0.25 → 0.5 → 0.75 → 1.0
                const currentFill = Math.round((rating - (star - 1)) * 100) / 100;
                let nextFill: number;
                if (currentFill >= 1.0) nextFill = 0.25;
                else if (currentFill >= 0.75) nextFill = 1.0;
                else if (currentFill >= 0.5) nextFill = 0.75;
                else nextFill = 0.5;
                onRate(Math.round(((star - 1) + nextFill) * 100) / 100);
              } else {
                // Different star: fill it completely
                onRate(star);
              }
            }}
          >
            <PartialStar fill={fill} size={size} color={color} />
          </Pressable>
        );
      })}
    </View>
  );
}
