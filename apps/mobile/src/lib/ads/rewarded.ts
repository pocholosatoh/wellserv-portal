import { Platform } from "react-native";
import { AdMobRewarded } from "expo-ads-admob";

type RewardedAdCallbacks = {
  onLoaded?: () => void;
  onFailedToLoad?: (error: Error | unknown) => void;
  onOpened?: () => void;
  onClosed?: () => void;
  onEarnedReward?: () => void;
};

const iosUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID_IOS;
const androidUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID_ANDROID;

let rewardedAvailable = false;

function setRewardedAvailable(value: boolean) {
  rewardedAvailable = value;
}

export function isRewardedAdAvailable() {
  return rewardedAvailable;
}

function getRewardedAdUnitId() {
  const envId = Platform.OS === "ios" ? iosUnitId : androidUnitId;
  if (envId) return envId;
  console.warn("Missing rewarded ad unit id; skipping rewarded ad init.");
  return null;
}

export function loadRewardedAd(callbacks: RewardedAdCallbacks) {
  const adUnitId = getRewardedAdUnitId();
  if (!adUnitId) {
    setRewardedAvailable(false);
    return { isAvailable: false, unsubscribe: () => {} };
  }

  AdMobRewarded.setAdUnitID(adUnitId);
  setRewardedAvailable(false);

  const subscriptionLoaded = AdMobRewarded.addEventListener("rewardedVideoDidLoad", () => {
    setRewardedAvailable(true);
    callbacks.onLoaded?.();
  });
  const subscriptionFailed = AdMobRewarded.addEventListener(
    "rewardedVideoDidFailToLoad",
    (error) => {
      setRewardedAvailable(false);
      callbacks.onFailedToLoad?.(error);
    }
  );
  const subscriptionOpened = AdMobRewarded.addEventListener("rewardedVideoDidOpen", () => {
    setRewardedAvailable(false);
    callbacks.onOpened?.();
  });
  const subscriptionClosed = AdMobRewarded.addEventListener("rewardedVideoDidClose", () => {
    setRewardedAvailable(false);
    callbacks.onClosed?.();
  });
  const subscriptionRewarded = AdMobRewarded.addEventListener("rewardedVideoDidRewardUser", () => {
    callbacks.onEarnedReward?.();
  });

  void AdMobRewarded.requestAdAsync().catch((error) => {
    setRewardedAvailable(false);
    callbacks.onFailedToLoad?.(error);
  });

  return {
    isAvailable: true,
    unsubscribe: () => {
      subscriptionLoaded.remove();
      subscriptionFailed.remove();
      subscriptionOpened.remove();
      subscriptionClosed.remove();
      subscriptionRewarded.remove();
    },
  };
}

export async function showRewardedAd() {
  if (!rewardedAvailable) return;
  await AdMobRewarded.showAdAsync();
}
