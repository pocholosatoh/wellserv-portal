import { Platform } from "react-native";
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

type RewardedAdCallbacks = {
  onLoaded?: () => void;
  onFailedToLoad?: (error: Error) => void;
  onOpened?: () => void;
  onClosed?: () => void;
  onEarnedReward?: () => void;
};

const iosUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS;
const androidUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID;
const iosAppId = process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS;
const androidAppId = process.env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID;
const TEST_ADMOB_PUB_ID = "3940256099942544";

function hasAppId() {
  if (Platform.OS === "ios") return Boolean(iosAppId);
  return Boolean(androidAppId);
}

function getRewardedAdUnitId() {
  const envId = Platform.OS === "ios" ? iosUnitId : androidUnitId;
  const envName =
    Platform.OS === "ios" ? "EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS" : "EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID";

  if (__DEV__) {
    return TestIds.REWARDED;
  }

  if (!envId) {
    console.warn(
      `Missing ${envName} in a non-dev build. Falling back to TestIds.REWARDED for safety.`,
    );
    return TestIds.REWARDED;
  }

  if (envId.includes(TEST_ADMOB_PUB_ID)) {
    console.warn(
      `Non-dev build is using a Google test rewarded ad unit (${envName}). Set a real AdMob ID for production.`,
    );
  }

  return envId;
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

  let unsubscribeLoaded = () => {};
  let unsubscribeFailed = () => {};
  let unsubscribeOpened = () => {};
  let unsubscribeClosed = () => {};
  let unsubscribeRewarded = () => {};

  try {
    unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      callbacks.onLoaded?.();
    });
    unsubscribeFailed = ad.addAdEventListener(AdEventType.ERROR, (error: Error) => {
      callbacks.onFailedToLoad?.(error);
    });
    unsubscribeOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
      callbacks.onOpened?.();
    });
    unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      callbacks.onClosed?.();
    });
    unsubscribeRewarded = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      callbacks.onEarnedReward?.();
    });
  } catch (error) {
    console.error("Failed to register rewarded ad event listeners.", error);
    callbacks.onFailedToLoad?.(error as Error);
  }

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
