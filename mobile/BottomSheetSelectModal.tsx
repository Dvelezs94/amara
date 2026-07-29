import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme } from "./theme";

type Props = {
  visible: boolean;
  title: string;
  onRequestClose: () => void;
  children: ReactNode;
  /** Extra bottom padding (e.g. safe-area inset). */
  sheetStyle?: StyleProp<ViewStyle>;
};

/**
 * Bottom sheet for select/dropdown pickers: sheet slides up/down; backdrop fades.
 */
export function BottomSheetSelectModal({
  visible,
  title,
  onRequestClose,
  children,
  sheetStyle,
}: Props) {
  const [mounted, setMounted] = useState(visible);
  const wasVisibleRef = useRef(visible);
  const translateY = useRef(new Animated.Value(480)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true;
      setMounted(true);
      translateY.setValue(480);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (!wasVisibleRef.current) return;
    wasVisibleRef.current = false;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 480,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, translateY, backdropOpacity]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, sheetStyle, { transform: [{ translateY }] }]}
        >
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: theme.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "72%",
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.textStrong,
    marginBottom: 12,
  },
});
