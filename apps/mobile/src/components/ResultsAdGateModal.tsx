import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing } from "@wellserv/theme";
import { loadRewardedAd, showRewardedAd } from "../lib/ads/rewarded";
import { setLastAdTimestamp } from "../lib/ads/adCooldown";

const AD_CLOSE_DELAY_SECONDS = 30;
const AD_FAIL_CLOSE_DELAY_SECONDS = 5;
const AD_START_TIMEOUT_MS = 8000;

type ResultsAdGateModalProps = {
  visible: boolean;
  onClose: () => void;
};

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = Math.max(seconds % 60, 0)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function ResultsAdGateModal({ visible, onClose }: ResultsAdGateModalProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(AD_CLOSE_DELAY_SECONDS);
  const [adFailed, setAdFailed] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adShowing, setAdShowing] = useState(false);
  const [showDelayedFallback, setShowDelayedFallback] = useState(false);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const adStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const adUnsubscribeRef = useRef<null | (() => void)>(null);
  const adFailedRef = useRef(false);
  const adShowingRef = useRef(false);
  const adCompletedRef = useRef(false);
  const fallbackElapsedRef = useRef(false);
  const cooldownSavedRef = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(12)).current;

  const closeEnabled = remainingSeconds <= 0;

  const persistCooldown = useCallback(() => {
    if (cooldownSavedRef.current) return;
    cooldownSavedRef.current = true;
    console.log("ad_completed");
    void setLastAdTimestamp(Date.now());
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    fallbackElapsedRef.current = false;
    setRemainingSeconds(seconds);
    const start = Date.now();
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const next = Math.max(seconds - elapsed, 0);
      setRemainingSeconds(next);
      if (next <= 0) {
        if (adFailedRef.current) {
          fallbackElapsedRef.current = true;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 500);
  }, []);

  const setFailedState = useCallback((value: boolean) => {
    adFailedRef.current = value;
    setAdFailed(value);
  }, []);

  const handleClose = useCallback(() => {
    if (!closeEnabled) return;
    console.log("ad_closed");
    persistCooldown();
    onClose();
  }, [closeEnabled, onClose, persistCooldown]);

  useEffect(() => {
    if (!visible) return;

    fadeAnim.setValue(0);
    translateAnim.setValue(12);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    startCountdown(AD_CLOSE_DELAY_SECONDS);

    adStartTimeoutRef.current = setTimeout(() => {
      if (!adShowingRef.current) {
        setShowDelayedFallback(true);
      }
    }, AD_START_TIMEOUT_MS);

    const { ad, unsubscribe } = loadRewardedAd({
      onLoaded: () => {
        setAdLoaded(true);
        console.log("ad_loaded");
        void showRewardedAd(ad).catch(() => {
          console.log("ad_failed");
          setFailedState(true);
          setShowDelayedFallback(true);
          if (adStartTimeoutRef.current) {
            clearTimeout(adStartTimeoutRef.current);
            adStartTimeoutRef.current = null;
          }
          startCountdown(AD_FAIL_CLOSE_DELAY_SECONDS);
        });
      },
      onFailedToLoad: () => {
        console.log("ad_failed");
        setFailedState(true);
        setShowDelayedFallback(true);
        if (adStartTimeoutRef.current) {
          clearTimeout(adStartTimeoutRef.current);
          adStartTimeoutRef.current = null;
        }
        startCountdown(AD_FAIL_CLOSE_DELAY_SECONDS);
      },
      onOpened: () => {
        adShowingRef.current = true;
        setAdShowing(true);
        if (adStartTimeoutRef.current) {
          clearTimeout(adStartTimeoutRef.current);
          adStartTimeoutRef.current = null;
        }
      },
      onClosed: () => {
        adShowingRef.current = false;
        setAdShowing(false);
      },
      onEarnedReward: () => {
        adCompletedRef.current = true;
        persistCooldown();
      },
    });

    adUnsubscribeRef.current = unsubscribe;

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (adStartTimeoutRef.current) {
        clearTimeout(adStartTimeoutRef.current);
        adStartTimeoutRef.current = null;
      }
      if (adUnsubscribeRef.current) {
        adUnsubscribeRef.current();
        adUnsubscribeRef.current = null;
      }
      if (adCompletedRef.current || fallbackElapsedRef.current) {
        persistCooldown();
      }
    };
  }, [fadeAnim, persistCooldown, startCountdown, translateAnim, visible, setFailedState]);

  const countdownLabel = useMemo(
    () => `You can close in ${formatCountdown(remainingSeconds)}`,
    [remainingSeconds]
  );

  const adStatusCopy = useMemo(() => {
    if (adFailed) return "Ad unavailable right now. Please continue.";
    if (showDelayedFallback && !adShowing) return "Ad is taking longer than expected.";
    if (adShowing) return "Ad is playing. Thank you for your support.";
    if (adLoaded) return "Ad is starting...";
    return "Loading ad...";
  }, [adFailed, adLoaded, adShowing, showDelayedFallback]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        <Animated.View
          style={{
            width: "100%",
            borderRadius: 20,
            backgroundColor: "#fff",
            padding: spacing.lg,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
            opacity: fadeAnim,
            transform: [{ translateY: translateAnim }],
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: spacing.sm }}>
            Support WellServ 💛
          </Text>
          <Text style={{ color: colors.gray[700], marginBottom: spacing.sm }}>
            While your results are loading, please watch this short ad to help support secure patient
            access and keep the app free.
          </Text>
          <Text style={{ color: colors.gray[500], marginBottom: spacing.md }}>
            Your results continue loading in the background.
          </Text>

          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.gray[200],
              padding: spacing.md,
              backgroundColor: colors.gray[50],
              minHeight: 90,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            {!adFailed && !adShowing && <ActivityIndicator color={colors.primary} />}
            <Text style={{ marginTop: spacing.sm, textAlign: "center", color: colors.gray[600] }}>
              {adStatusCopy}
            </Text>
          </View>

          <Text style={{ color: colors.gray[500], marginBottom: spacing.sm }}>{countdownLabel}</Text>

          <TouchableOpacity
            onPress={handleClose}
            disabled={!closeEnabled}
            style={{
              backgroundColor: closeEnabled ? colors.primary : colors.gray[200],
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                color: closeEnabled ? "#fff" : colors.gray[500],
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Close
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
