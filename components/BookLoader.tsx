import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

const BOOK_W = 160;
const BOOK_H = 110;
const SPINE_W = 4;
const PAGE_GAP = 6;
// Width of each page half: from spine edge to book edge, minus the gap
const PAGE_W = BOOK_W / 2 - SPINE_W / 2 - PAGE_GAP; // 72px

const PAGE_COUNT = 5;
const FLIP_DURATION = 380;
const PAGE_STAGGER = 170;
const LOOP_PAUSE = 600;

export default function BookLoader() {
  const { colors } = useTheme();

  const anims = useRef(
    Array.from({ length: PAGE_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    let cancelled = false;

    function runCycle() {
      if (cancelled) return;
      anims.forEach(a => a.setValue(0));

      // Top page (last in JSX, highest z-order) animates first so it visibly peels off.
      // Delay is inverted: page at index PAGE_COUNT-1 gets delay 0, page 0 gets the longest delay.
      Animated.parallel(
        anims.map((anim, i) =>
          Animated.sequence([
            Animated.delay((PAGE_COUNT - 1 - i) * PAGE_STAGGER),
            Animated.timing(anim, {
              toValue: 1,
              duration: FLIP_DURATION,
              useNativeDriver: true,
            }),
          ])
        )
      ).start(() => {
        if (!cancelled) setTimeout(runCycle, LOOP_PAUSE);
      });
    }

    runCycle();
    return () => {
      cancelled = true;
      anims.forEach(a => a.stopAnimation());
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.book, { borderColor: colors.primary }]}>
        <View style={[styles.leftCover, { backgroundColor: colors.primary + '20' }]} />
        <View style={[styles.rightCover, { backgroundColor: colors.primary + '15' }]} />
        <View style={[styles.spine, { backgroundColor: colors.primary }]} />

        {anims.map((anim, i) => {
          // Right half: scaleX 1→0, with translateX correcting for the transform origin so the
          // LEFT edge (the spine side) stays pinned: t = PAGE_W/2 * (scaleX - 1)
          const rightScaleX = anim.interpolate({
            inputRange: [0, 0.48, 1],
            outputRange: [1, 0, 0],
          });
          const rightTranslateX = anim.interpolate({
            inputRange: [0, 0.48, 1],
            outputRange: [0, -(PAGE_W / 2), -(PAGE_W / 2)],
          });

          // Left half: scaleX 0→1, with translateX keeping the RIGHT edge (spine side) pinned:
          // t = PAGE_W/2 * (1 - scaleX)
          const leftScaleX = anim.interpolate({
            inputRange: [0, 0.52, 1],
            outputRange: [0, 0, 1],
          });
          const leftTranslateX = anim.interpolate({
            inputRange: [0, 0.52, 1],
            outputRange: [PAGE_W / 2, PAGE_W / 2, 0],
          });

          // Subtle shade variation so stacked pages have visual depth
          const shade = 1 - i * 0.04;

          return (
            <View key={i} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Animated.View
                style={[
                  styles.page,
                  styles.rightPage,
                  {
                    backgroundColor: colors.surface,
                    opacity: shade,
                    transform: [{ scaleX: rightScaleX }, { translateX: rightTranslateX }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.page,
                  styles.leftPage,
                  {
                    backgroundColor: colors.surface,
                    opacity: shade,
                    transform: [{ scaleX: leftScaleX }, { translateX: leftTranslateX }],
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  book: {
    width: BOOK_W,
    height: BOOK_H,
    borderWidth: 1.5,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  leftCover: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: BOOK_W / 2,
  },
  rightCover: {
    position: 'absolute',
    top: 0, bottom: 0, right: 0,
    width: BOOK_W / 2,
  },
  spine: {
    position: 'absolute',
    top: 0, bottom: 0,
    left: BOOK_W / 2 - SPINE_W / 2,
    width: SPINE_W,
  },
  page: {
    position: 'absolute',
    top: PAGE_GAP,
    bottom: PAGE_GAP,
    width: PAGE_W,
  },
  rightPage: {
    left: BOOK_W / 2 + SPINE_W / 2,
  },
  leftPage: {
    right: BOOK_W / 2 + SPINE_W / 2,
  },
});
