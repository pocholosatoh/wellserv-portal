import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnUI,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Linking from "expo-linking";
import { colors, spacing } from "@wellserv/theme";
import { patientTabsContentContainerStyle } from "../PatientTabsLayout";
import { useOtherLabsUploads, type OtherLabItem } from "../../hooks/useOtherLabsUploads";

type OtherLabsTabProps = {
  contentContainerStyle?: StyleProp<ViewStyle>;
};

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function getItemTimestamp(item: OtherLabItem) {
  const raw = item.taken_at || item.uploaded_at || "";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return 0;
  return dt.getTime();
}

function normalizeType(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed : "Other";
}

function formatTypeLabel(value?: string | null) {
  const base = normalizeType(value);
  const cleaned = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Other";
  return cleaned
    .split(" ")
    .map((word) => {
      if (!word) return "";
      const match = word.match(/^([^A-Za-z0-9]*)([A-Za-z0-9]+)([^A-Za-z0-9]*)$/);
      if (!match) return word;
      const [, lead, core, tail] = match;
      const upper = core.toUpperCase();
      const next = core === upper ? upper : core[0].toUpperCase() + core.slice(1).toLowerCase();
      return `${lead}${next}${tail}`;
    })
    .join(" ");
}

function isImage(item: OtherLabItem) {
  return item.content_type?.startsWith("image/") ?? false;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const clampWorklet = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(max, Math.max(min, value));
};

const containWidthWorklet = (ar: number, cw: number, ch: number) => {
  "worklet";
  if (!Number.isFinite(ar) || ar <= 0) return 0;
  if (!Number.isFinite(cw) || !Number.isFinite(ch) || cw <= 0 || ch <= 0) return 0;
  const containerAR = cw / ch;
  return ar >= containerAR ? cw : ch * ar;
};

type ImagePreviewModalProps = {
  uri: string;
  onClose: () => void;
  imgSize: { w: number; h: number } | null;
};

function ImagePreviewModal({ uri, onClose, imgSize }: ImagePreviewModalProps) {
  const insets = useSafeAreaInsets();
  const minScale = 1;
  const maxScale = 6;
  const scale = useSharedValue(1);
  const pinchScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotationDeg = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const viewportW = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const aspectRatio = useSharedValue(0);
  const pendingFitWidth = useSharedValue(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const width = imgSize?.w ?? 0;
    const height = imgSize?.h ?? 0;
    const ratio = width > 0 && height > 0 ? width / height : 0;
    const nextRatio = Number.isFinite(ratio) ? ratio : 0;
    runOnUI((nextAr: number) => {
      "worklet";
      aspectRatio.value = nextAr;
    })(nextRatio);
  }, [aspectRatio, imgSize?.h, imgSize?.w]);

  const resetTranslation = useCallback(() => {
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  }, [savedX, savedY, translateX, translateY]);

  const resetView = useCallback(() => {
    scale.value = withTiming(minScale);
    savedScale.value = minScale;
    pinchScale.value = 1;
    resetTranslation();
  }, [minScale, pinchScale, resetTranslation, savedScale, scale]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      if (!event || typeof event.scale !== "number") return;
      if (!Number.isFinite(event.scale)) return;
      const nextPinch = clampWorklet(event.scale, 0.5, 6);
      if (!Number.isFinite(nextPinch)) return;
      pinchScale.value = nextPinch;
      const next = savedScale.value * pinchScale.value;
      if (!Number.isFinite(next)) return;
      const clamped = clampWorklet(next, minScale, maxScale);
      if (!Number.isFinite(clamped)) return;
      scale.value = clamped;
    })
    .onFinalize(() => {
      const nextScale = Number.isFinite(scale.value)
        ? clampWorklet(scale.value, minScale, maxScale)
        : minScale;
      scale.value = nextScale;
      savedScale.value = nextScale;
      pinchScale.value = 1;
      if (nextScale <= minScale) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const currentScale = Number.isFinite(scale.value) ? scale.value : minScale;
      if (currentScale <= 1) return;
      if (!Number.isFinite(event.translationX) || !Number.isFinite(event.translationY)) return;
      const baseX = Number.isFinite(savedX.value) ? savedX.value : 0;
      const baseY = Number.isFinite(savedY.value) ? savedY.value : 0;
      translateX.value = baseX + event.translationX;
      translateY.value = baseY + event.translationY;
    })
    .onEnd(() => {
      const nextX = Number.isFinite(translateX.value) ? translateX.value : 0;
      const nextY = Number.isFinite(translateY.value) ? translateY.value : 0;
      translateX.value = nextX;
      translateY.value = nextY;
      savedX.value = nextX;
      savedY.value = nextY;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const currentScale = Number.isFinite(scale.value) ? scale.value : minScale;
      const nextScale = currentScale > minScale ? minScale : 2;
      scale.value = withTiming(nextScale);
      savedScale.value = nextScale;
      pinchScale.value = 1;
      if (nextScale === minScale) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const handleZoom = useCallback(
    (direction: "in" | "out") => {
      const baseScale = Number.isFinite(savedScale.value) ? savedScale.value : minScale;
      const next = direction === "in" ? baseScale * 1.25 : baseScale / 1.25;
      const clamped = clamp(next, minScale, maxScale);
      if (!Number.isFinite(clamped)) return;
      savedScale.value = clamped;
      scale.value = withTiming(clamped);
      pinchScale.value = 1;
      if (clamped <= minScale) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    },
    [maxScale, minScale, pinchScale, savedScale, savedX, savedY, scale, translateX, translateY],
  );

  const handleReset = useCallback(() => {
    pendingFitWidth.value = false;
    resetView();
  }, [pendingFitWidth, resetView]);

  const handleRotate = useCallback(() => {
    runOnUI((min: number) => {
      "worklet";
      const nextRotation = rotationDeg.value === 0 ? 90 : 0;
      rotationDeg.value = withTiming(nextRotation, { duration: 150 });
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
      pinchScale.value = 1;

      if (nextRotation === 90) {
        pendingFitWidth.value = true;
        return;
      }

      pendingFitWidth.value = false;
      scale.value = withTiming(min);
      savedScale.value = min;
    })(minScale);
  }, [
    minScale,
    pendingFitWidth,
    pinchScale,
    rotationDeg,
    savedScale,
    savedX,
    savedY,
    scale,
    translateX,
    translateY,
    viewportW,
    viewportH,
  ]);

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  useAnimatedReaction<[boolean, number, number, number, number]>(
    () => [
      pendingFitWidth.value,
      rotationDeg.value,
      viewportW.value,
      viewportH.value,
      aspectRatio.value,
    ],
    ([pending, rotationValue, viewportWidth, viewportHeight, ar]) => {
      if (!pending) return;
      if (rotationValue !== 90) {
        pendingFitWidth.value = false;
        return;
      }
      if (viewportWidth <= 0 || viewportHeight <= 0) return;
      if (!Number.isFinite(ar) || ar <= 0) return;
      const arRot = 1 / ar;
      if (!Number.isFinite(arRot) || arRot <= 0) return;
      const baseWRot = containWidthWorklet(arRot, viewportWidth, viewportHeight);
      if (!Number.isFinite(baseWRot) || baseWRot <= 0) return;
      const fitWidthScale = viewportWidth / baseWRot;
      if (!Number.isFinite(fitWidthScale)) return;
      const clamped = clampWorklet(fitWidthScale, minScale, maxScale);
      if (!Number.isFinite(clamped)) return;
      scale.value = withTiming(clamped);
      savedScale.value = clamped;
      pinchScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
      pendingFitWidth.value = false;
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Number.isFinite(translateX.value) ? translateX.value : 0 },
      { translateY: Number.isFinite(translateY.value) ? translateY.value : 0 },
      { scale: Number.isFinite(scale.value) ? scale.value : minScale },
      { rotate: `${Number.isFinite(rotationDeg.value) ? rotationDeg.value : 0}deg` },
    ],
  }));

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: "absolute",
              top: insets.top + spacing.sm,
              right: insets.right + spacing.sm,
              backgroundColor: "rgba(255,255,255,0.9)",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 20,
              zIndex: 2,
            }}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Text style={{ color: colors.gray[800], fontWeight: "600" }}>Close</Text>
          </TouchableOpacity>
          <View
            style={{
              position: "absolute",
              right: insets.right + spacing.sm,
              bottom: insets.bottom + spacing.sm,
              zIndex: 2,
              gap: spacing.xs,
            }}
          >
            <TouchableOpacity
              onPress={handleRotate}
              style={{
                backgroundColor: "rgba(255,255,255,0.9)",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 18,
                alignItems: "center",
              }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={{ color: colors.gray[800], fontWeight: "700" }}>Rotate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleZoom("in")}
              style={{
                backgroundColor: "rgba(255,255,255,0.9)",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 18,
                alignItems: "center",
              }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={{ color: colors.gray[800], fontWeight: "700" }}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleZoom("out")}
              style={{
                backgroundColor: "rgba(255,255,255,0.9)",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 18,
                alignItems: "center",
              }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={{ color: colors.gray[800], fontWeight: "700" }}>–</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReset}
              style={{
                backgroundColor: "rgba(255,255,255,0.9)",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 18,
                alignItems: "center",
              }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={{ color: colors.gray[800], fontWeight: "700" }}>Reset</Text>
            </TouchableOpacity>
          </View>
          <View
            style={{ flex: 1 }}
            onLayout={(event) => {
              const nextWidth = Math.round(event.nativeEvent.layout.width);
              const nextHeight = Math.round(event.nativeEvent.layout.height);
              if (nextWidth !== containerSize.width || nextHeight !== containerSize.height) {
                setContainerSize({ width: nextWidth, height: nextHeight });
                runOnUI((width: number, height: number) => {
                  "worklet";
                  viewportW.value = width;
                  viewportH.value = height;
                })(nextWidth, nextHeight);
                resetView();
              }
            }}
          >
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- React Native Image uses accessibilityLabel instead of alt */}
                <Animated.Image
                  source={{ uri }}
                  style={[
                    {
                      width: containerSize.width,
                      height: containerSize.height,
                    },
                    animatedStyle,
                  ]}
                  resizeMode="contain"
                  accessibilityLabel="Other lab image preview"
                />
              </Animated.View>
            </GestureDetector>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function OtherLabsTab({ contentContainerStyle }: OtherLabsTabProps) {
  const { data, loading, error, refresh } = useOtherLabsUploads();
  const [activeType, setActiveType] = useState("All");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const types = useMemo(() => {
    const unique = new Set<string>();
    data.forEach((item) => unique.add(normalizeType(item.type)));
    return ["All", ...Array.from(unique)];
  }, [data]);

  useEffect(() => {
    if (!types.includes(activeType)) {
      setActiveType("All");
    }
  }, [activeType, types]);

  const filtered = useMemo(() => {
    const items =
      activeType === "All" ? data : data.filter((item) => normalizeType(item.type) === activeType);
    return [...items].sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
  }, [activeType, data]);

  const handleOpenExternal = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert("Unable to open file", "Please try again later.");
    }
  }, []);

  const handleView = useCallback(
    (item: OtherLabItem) => {
      if (isImage(item)) {
        setPreviewUrl(item.url);
        return;
      }
      handleOpenExternal(item.url);
    },
    [handleOpenExternal],
  );

  useEffect(() => {
    if (!previewUrl) {
      setImgSize(null);
      return;
    }
    let active = true;
    Image.getSize(
      previewUrl,
      (width, height) => {
        if (!active) return;
        setImgSize({ w: width, h: height });
      },
      () => {
        if (!active) return;
        setImgSize(null);
      },
    );
    return () => {
      active = false;
    };
  }, [previewUrl]);

  const listContentStyle = useMemo(
    () => [patientTabsContentContainerStyle, { paddingTop: spacing.sm }, contentContainerStyle],
    [contentContainerStyle],
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={listContentStyle}
        ListHeaderComponent={
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
          >
            {types.map((type) => {
              const isActive = type === activeType;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setActiveType(type)}
                  style={{
                    backgroundColor: isActive ? colors.primary : colors.gray[100],
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: isActive ? "#fff" : colors.gray[700], fontWeight: "600" }}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ marginTop: spacing.sm, color: colors.gray[500] }}>
                Loading other labs…
              </Text>
            </View>
          ) : error ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <Text
                style={{ color: colors.gray[600], textAlign: "center", marginBottom: spacing.sm }}
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={() => refresh()}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <Text style={{ color: colors.gray[500], textAlign: "center" }}>
                No external lab results to show.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const typeLabel = formatTypeLabel(item.type);
          const provider = item.provider ? ` • ${item.provider}` : "";
          const dateLabel = formatDate(item.taken_at || item.uploaded_at);
          const detailText = (item.impression || item.note || "").trim();
          return (
            <View
              style={{
                backgroundColor: colors.gray[50],
                borderRadius: 18,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.gray[100],
              }}
            >
              <View
                style={{ flexDirection: "row", justifyContent: "space-between", columnGap: 12 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700" }}>
                    {typeLabel}
                    <Text style={{ color: colors.gray[500], fontWeight: "600" }}>{provider}</Text>
                  </Text>
                  <Text style={{ color: colors.gray[500], marginTop: 4 }}>{dateLabel}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleView(item)}
                  style={{
                    alignSelf: "center",
                    backgroundColor: colors.primary,
                    paddingVertical: 6,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>View</Text>
                </TouchableOpacity>
              </View>
              {detailText ? (
                <Text style={{ marginTop: spacing.sm, color: colors.gray[600] }}>{detailText}</Text>
              ) : null}
            </View>
          );
        }}
        refreshing={loading}
        onRefresh={() => refresh()}
      />
      {previewUrl && (
        <ImagePreviewModal
          key={previewUrl}
          uri={previewUrl}
          onClose={() => setPreviewUrl(null)}
          imgSize={imgSize}
        />
      )}
    </View>
  );
}
