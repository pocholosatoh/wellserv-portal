import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing } from "@wellserv/theme";
import { loadRewardedAd, showRewardedAd } from "../lib/ads/rewarded";
import { setLastAdTimestamp } from "../lib/ads/adCooldown";

type ResultsAdGateModalProps = {
  visible: boolean;
  onClose: () => void;
};

type AdStatus = "idle" | "loading" | "showing" | "rewarded" | "done";

export function ResultsAdGateModal({ visible, onClose }: ResultsAdGateModalProps) {
  const [status, setStatus] = useState<AdStatus>("idle");
  const [adLoaded, setAdLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const adUnsubscribeRef = useRef<null | (() => void)>(null);
  const adCompletedRef = useRef(false);
  const cooldownSavedRef = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(12)).current;

  const persistCooldown = useCallback(() => {
    if (cooldownSavedRef.current) return;
    cooldownSavedRef.current = true;
    console.log("ad_completed");
    void setLastAdTimestamp(Date.now());
  }, []);

  const handleClose = useCallback(() => {
    console.log("ad_closed");
    onClose();
  }, [onClose]);

  const handleAdFailure = useCallback(
    (nextMessage: string) => {
      setMessage(nextMessage);
      setStatus("done");
    },
    [setMessage]
  );

  const startAdFlow = useCallback(() => {
    if (!visible) return;
    setStatus("loading");
    setAdLoaded(false);
    setMessage(null);
    adCompletedRef.current = false;

    const { ad, unsubscribe } = loadRewardedAd({
      onLoaded: () => {
        setAdLoaded(true);
        console.log("ad_loaded");
        if (!ad) return;
        void showRewardedAd(ad).catch(() => {
          console.log("ad_failed");
          handleAdFailure("Ad unavailable right now. Please continue.");
        });
      },
      onFailedToLoad: () => {
        console.log("ad_failed");
        handleAdFailure("Ad unavailable right now. Please continue.");
      },
      onOpened: () => {
        setStatus("showing");
      },
      onClosed: () => {
        if (adCompletedRef.current) return;
        handleAdFailure("Thanks for trying! You can continue without the ad or try again.");
      },
      onEarnedReward: () => {
        adCompletedRef.current = true;
        setStatus("rewarded");
        persistCooldown();
        handleClose();
      },
    });

    if (!ad) {
      console.log("ad_failed");
      handleAdFailure("Ad unavailable right now. Please continue.");
    } else {
      adUnsubscribeRef.current = unsubscribe;
    }
  }, [handleAdFailure, handleClose, persistCooldown, visible]);

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

    startAdFlow();

    return () => {
      if (adUnsubscribeRef.current) {
        adUnsubscribeRef.current();
        adUnsubscribeRef.current = null;
      }
      if (adCompletedRef.current) {
        persistCooldown();
      }
    };
  }, [fadeAnim, persistCooldown, startAdFlow, translateAnim, visible]);

  const adStatusCopy = useMemo(() => {
    if (status === "showing") return "Ad playing…";
    if (status === "loading") return "Loading ad…";
    if (adLoaded) return "Ad is starting…";
    return "Preparing ad…";
  }, [adLoaded, status]);

  const showSpinner = status === "loading";
  const showFallbackActions = status === "done";

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
            {showSpinner && <ActivityIndicator color={colors.primary} />}
            <Text style={{ marginTop: spacing.sm, textAlign: "center", color: colors.gray[600] }}>
              {adStatusCopy}
            </Text>
          </View>

          {message ? (
            <Text style={{ color: colors.gray[600], marginBottom: spacing.md }}>{message}</Text>
          ) : null}

          {showFallbackActions ? (
            <>
              <TouchableOpacity
                onPress={handleClose}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  borderRadius: 12,
                  marginBottom: spacing.sm,
                }}
              >
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>
                  Continue without ad
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={startAdFlow}
                style={{
                  backgroundColor: colors.gray[100],
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: colors.gray[700], textAlign: "center", fontWeight: "600" }}>
                  Try again
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={handleClose}
              disabled={status === "loading" || status === "showing"}
              style={{
                backgroundColor:
                  status === "loading" || status === "showing" ? colors.gray[200] : colors.primary,
                paddingVertical: 12,
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  color:
                    status === "loading" || status === "showing" ? colors.gray[500] : "#fff",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
