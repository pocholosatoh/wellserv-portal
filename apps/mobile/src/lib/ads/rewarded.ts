import { Platform } from "react-native";
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  type AdError,
} from "react-native-google-mobile-ads";

type RewardedAdCallbacks = {
  onLoaded?: () => void;
  onFailedToLoad?: (error: AdError) => void;
  onOpened?: () => void;
  onClosed?: () => void;
  onEarnedReward?: () => void;
};

const iosUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID_IOS;
const androidUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID_ANDROID;
const iosAppId = process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS;
const androidAppId = process.env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID;

function hasAppId() {
  if (Platform.OS === "ios") return Boolean(iosAppId);
  return Boolean(androidAppId);
}

function getRewardedAdUnitId() {
  const envId = Platform.OS === "ios" ? iosUnitId : androidUnitId;
  if (envId) return envId;
  if (__DEV__) return TestIds.REWARDED;
  console.warn("Missing rewarded ad unit id; falling back to test id.");
  return TestIds.REWARDED;
}

export function loadRewardedAd(callbacks: RewardedAdCallbacks) {
  if (!hasAppId()) {
    console.warn("Missing AdMob App ID; skipping rewarded ad init.");
    return { ad: null, unsubscribe: () => {} };
  }

  const adUnitId = getRewardedAdUnitId();
  const ad = RewardedAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    callbacks.onLoaded?.();
  });
  const unsubscribeFailed = ad.addAdEventListener(AdEventType.ERROR, (error: AdError) => {
    callbacks.onFailedToLoad?.(error as AdError);
  });
  const unsubscribeOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
    callbacks.onOpened?.();
  });
  const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
    callbacks.onClosed?.();
  });
  const unsubscribeRewarded = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    callbacks.onEarnedReward?.();
  });

  ad.load();

  return {
    ad,
    unsubscribe: () => {
      unsubscribeLoaded();
      unsubscribeFailed();
      unsubscribeOpened();
      unsubscribeClosed();
      unsubscribeRewarded();
    },
  };
}

export async function showRewardedAd(ad: RewardedAd) {
  if (!ad.loaded) return;
  await ad.show();
}
