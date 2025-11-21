import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    let rootView = factory.recreateRootView(
      withBundleURL: nil,
      moduleName: "main",
      initialProps: nil,
      launchOptions: launchOptions
    )
    let rootViewController = UIViewController()
    rootViewController.view = rootView
    window?.rootViewController = rootViewController
    window?.makeKeyAndVisible()
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

@objcMembers
@objc(ReactNativeDelegate)
class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  private func resolvedBundleURL(for bridge: RCTBridge) -> URL? {
    if let bridgeURL = bridge.bundleURL {
      return bridgeURL
    }
    return bundleURL()
  }

  @objc(loadSourceCompatForBridge:onProgress:onComplete:)
  dynamic func loadSourceCompatForBridge(
    _ bridge: RCTBridge,
    onProgress: @escaping RCTSourceLoadProgressBlock,
    onComplete: @escaping RCTSourceLoadBlock
  ) {
    guard let sourceURL = resolvedBundleURL(for: bridge) else {
      onComplete(NSError(domain: RCTJavaScriptLoaderErrorDomain, code: RCTJavaScriptLoaderErrorNoScriptURL, userInfo: nil), nil)
      return
    }
    RCTJavaScriptLoader.loadBundle(at: sourceURL, onProgress: onProgress, onComplete: onComplete)
  }

  @objc(loadSourceCompatForBridge:withBlock:)
  dynamic func loadSourceCompatForBridge(
    _ bridge: RCTBridge,
    withBlock loadCallback: @escaping RCTSourceLoadBlock
  ) {
    loadSourceCompatForBridge(bridge, onProgress: { _ in }, onComplete: loadCallback)
  }
}
