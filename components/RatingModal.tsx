import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius } from '@/constants/theme';

const STAR_SIZE = 48;
const STAR_GAP = 12;
// The pan responder lives on a view exactly this wide, so locationX maps cleanly to 0–5 stars
const STAR_ROW_WIDTH = STAR_SIZE * 5 + STAR_GAP * 4;

function RatingStar({ position, rating, color }: { position: number; rating: number; color: string }) {
  const fill = Math.min(1, Math.max(0, rating - (position - 1)));
  if (fill >= 0.75) return <Ionicons name="star" size={STAR_SIZE} color={color} />;
  if (fill >= 0.25) return <Ionicons name="star-half" size={STAR_SIZE} color={color} />;
  return <Ionicons name="star-outline" size={STAR_SIZE} color={color} />;
}

interface RatingModalProps {
  visible: boolean;
  initialRating: number;
  onSave: (rating: number) => void;
  onClose: () => void;
}

export default function RatingModal({ visible, initialRating, onSave, onClose }: RatingModalProps) {
  const { colors } = useTheme();
  const [tempRating, setTempRating] = useState(initialRating);

  useEffect(() => {
    if (visible) setTempRating(initialRating);
  }, [visible, initialRating]);

  const ratingFromX = (x: number): number => {
    const raw = (Math.max(0, Math.min(x, STAR_ROW_WIDTH)) / STAR_ROW_WIDTH) * 5;
    return Math.min(5, Math.max(0.5, Math.round(raw * 2) / 2));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setTempRating(ratingFromX(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setTempRating(ratingFromX(e.nativeEvent.locationX)),
    })
  ).current;

  const ratingLabel =
    tempRating > 0
      ? `${Number.isInteger(tempRating) ? tempRating : tempRating.toFixed(1)} out of 5`
      : 'Drag or tap to rate';

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    dismissArea: { flex: 1 },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: 36,
      alignItems: 'center',
      gap: Spacing.md,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
    title: { fontSize: 20, fontFamily: Fonts.bold, color: colors.textPrimary },
    starsRow: { flexDirection: 'row', gap: STAR_GAP, width: STAR_ROW_WIDTH },
    ratingLabel: { fontSize: 16, fontFamily: Fonts.semiBold, color: colors.textSecondary, height: 22 },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      alignSelf: 'stretch',
      marginTop: Spacing.sm,
    },
    saveBtnText: { color: colors.surface, fontSize: 16, fontFamily: Fonts.bold },
    clearBtn: { paddingVertical: 8 },
    clearBtnText: { color: colors.error, fontSize: 15, fontFamily: Fonts.semiBold },
    cancelBtn: { paddingVertical: 8 },
    cancelBtnText: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Your Rating</Text>

          <View style={styles.starsRow} {...panResponder.panHandlers}>
            {[1, 2, 3, 4, 5].map((i) => (
              <RatingStar key={i} position={i} rating={tempRating} color={colors.primary} />
            ))}
          </View>

          <Text style={styles.ratingLabel}>{ratingLabel}</Text>

          <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(tempRating)} testID="save-rating-btn">
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>

          {initialRating > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => onSave(0)} testID="clear-rating-btn">
              <Text style={styles.clearBtnText}>Remove Rating</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
