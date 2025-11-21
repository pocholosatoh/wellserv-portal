#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pnpmDir = path.join(rootDir, 'node_modules', '.pnpm');

function patchExpoDevMenu() {
  if (!fs.existsSync(pnpmDir)) {
    return;
  }

  const colorFileContents = `import SwiftUI

public extension Color {
    static var expoSystemBackground: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemBackground)
        }
        return Color.white
    }

    static var expoSecondarySystemBackground: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.secondarySystemBackground)
        }
        return Color.gray.opacity(0.2)
    }

    static var expoSecondarySystemGroupedBackground: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.secondarySystemGroupedBackground)
        }
        return Color.gray.opacity(0.15)
    }

    static var expoSystemGroupedBackground: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemGroupedBackground)
        }
        return Color.white
    }

    static var expoSystemGray5: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemGray5)
        }
        return Color.gray.opacity(0.4)
    }

    static var expoSystemGray6: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemGray6)
        }
        return Color.gray.opacity(0.2)
    }
}
`;
  const constantOriginal = `    // MARK: JavaScript API
    Constant("doesDeviceSupportKeyCommands") {
      #if targetEnvironment(simulator)
      return true
      #else
      return false
      #endif
    }

`;
  const constantReplacement = `    // MARK: JavaScript API
    Constants {
      #if targetEnvironment(simulator)
      return ["doesDeviceSupportKeyCommands": true]
      #else
      return ["doesDeviceSupportKeyCommands": false]
      #endif
    }

`;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('expo-dev-menu@')) continue;

    const packageDir = path.join(pnpmDir, entry, 'node_modules', 'expo-dev-menu');
    if (!fs.existsSync(packageDir)) continue;

    const swiftDir = path.join(packageDir, 'ios', 'SwiftUI');
    fs.mkdirSync(swiftDir, { recursive: true });
    fs.writeFileSync(path.join(swiftDir, 'Color+Expo.swift'), colorFileContents, 'utf8');

    const internalModulePath = path.join(packageDir, 'ios', 'Modules', 'DevMenuInternalModule.swift');
    if (fs.existsSync(internalModulePath)) {
      let internalContents = fs.readFileSync(internalModulePath, 'utf8');
      if (internalContents.includes(constantOriginal)) {
        internalContents = internalContents.replace(constantOriginal, constantReplacement);
        fs.writeFileSync(internalModulePath, internalContents, 'utf8');
      }
    }

    const podspecPath = path.join(packageDir, 'expo-dev-menu.podspec');
    if (!fs.existsSync(podspecPath)) continue;
    let podspec = fs.readFileSync(podspecPath, 'utf8');
    if (!podspec.includes("Color+Expo.swift")) {
      podspec = podspec.replace(
        "    s.source_files   = 'ios/**/*.{h,m,mm,swift}'",
        "    s.source_files   = 'ios/**/*.{h,m,mm,swift}', 'ios/SwiftUI/Color+Expo.swift'"
      );
      fs.writeFileSync(podspecPath, podspec, 'utf8');
    }
  }
}

function patchExpoDevice() {
  if (!fs.existsSync(pnpmDir)) return;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('expo-device@')) continue;
    const filePath = path.join(pnpmDir, entry, 'node_modules', 'expo-device', 'ios', 'UIDevice.swift');
    if (!fs.existsSync(filePath)) continue;
    const original = "  var isSimulator: Bool {\n    return TARGET_OS_SIMULATOR != 0\n  }\n";
    let contents = fs.readFileSync(filePath, 'utf8');
    if (contents.includes(original)) {
      const replacement = "  var isSimulator: Bool {\n#if targetEnvironment(simulator)\n    return true\n#else\n    return false\n#endif\n  }\n";
      contents = contents.replace(original, replacement);
      fs.writeFileSync(filePath, contents, 'utf8');
    }
  }
}

function patchExpoDevLauncher() {
  if (!fs.existsSync(pnpmDir)) return;

  const colorFileContents = `import SwiftUI

public extension Color {
    static var expoSystemBackground: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemBackground)
        }
        return Color.white
    }

    static var expoSecondarySystemBackground: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.secondarySystemBackground)
        }
        return Color.gray.opacity(0.2)
    }

    static var expoSecondarySystemGroupedBackground: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.secondarySystemGroupedBackground)
        }
        return Color.gray.opacity(0.15)
    }

    static var expoSystemGroupedBackground: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemGroupedBackground)
        }
        return Color.white
    }

    static var expoSystemGray4: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemGray4)
        }
        return Color.gray.opacity(0.3)
    }

    static var expoSystemGray5: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemGray5)
        }
        return Color.gray.opacity(0.4)
    }

    static var expoSystemGray6: Color {
        if #available(iOS 13.0, *) {
            return Color(UIColor.systemGray6)
        }
        return Color.gray.opacity(0.2)
    }
}
`;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('expo-dev-launcher@')) continue;

    const packageDir = path.join(pnpmDir, entry, 'node_modules', 'expo-dev-launcher');
    if (!fs.existsSync(packageDir)) continue;

    const swiftDir = path.join(packageDir, 'ios', 'SwiftUI');
    fs.mkdirSync(swiftDir, { recursive: true });
    fs.writeFileSync(path.join(swiftDir, 'Color+Expo.swift'), colorFileContents, 'utf8');

    const headerPath = path.join(packageDir, 'ios', 'EXDevLauncherReactNativeFactory.h');
    if (!fs.existsSync(headerPath)) continue;

    let headerContents = fs.readFileSync(headerPath, 'utf8');
    if (headerContents.includes('EX_HAS_RCT_JS_RUNTIME_CONFIGURATOR')) {
      continue;
    }

    const includeGuard = `#endif

`;

    const compatibilitySnippet = `#if __has_include(<React-RCTAppDelegate/RCTJSRuntimeConfiguratorProtocol.h>)
#import <React-RCTAppDelegate/RCTJSRuntimeConfiguratorProtocol.h>
#define EX_HAS_RCT_JS_RUNTIME_CONFIGURATOR 1
#elif __has_include(<React_RCTAppDelegate/RCTJSRuntimeConfiguratorProtocol.h>)
#import <React_RCTAppDelegate/RCTJSRuntimeConfiguratorProtocol.h>
#define EX_HAS_RCT_JS_RUNTIME_CONFIGURATOR 1
#else
#define EX_HAS_RCT_JS_RUNTIME_CONFIGURATOR 0
#endif

`;

    if (headerContents.includes(includeGuard)) {
      headerContents = headerContents.replace(includeGuard, includeGuard + compatibilitySnippet);
    } else {
      headerContents = compatibilitySnippet + headerContents;
    }

    headerContents = headerContents.replace(
      '    RCTJSRuntimeConfiguratorProtocol,\n',
      '#if EX_HAS_RCT_JS_RUNTIME_CONFIGURATOR\n    RCTJSRuntimeConfiguratorProtocol,\n#endif\n'
    );

    fs.writeFileSync(headerPath, headerContents, 'utf8');

    const podspecPath = path.join(packageDir, 'expo-dev-launcher.podspec');
    if (fs.existsSync(podspecPath)) {
      let podspec = fs.readFileSync(podspecPath, 'utf8');
      if (!podspec.includes("ios/SwiftUI/Color+Expo.swift")) {
        podspec = podspec.replace(
          "  s.source_files   = 'ios/**/*.{h,m,mm,swift}'",
          "  s.source_files   = 'ios/**/*.{h,m,mm,swift}', 'ios/SwiftUI/Color+Expo.swift'"
        );
        fs.writeFileSync(podspecPath, podspec, 'utf8');
      }
    }

    const reactDelegateHandlerPath = path.join(
      packageDir,
      'ios',
      'ReactDelegateHandler',
      'ExpoDevLauncherReactDelegateHandler.swift'
    );

    if (fs.existsSync(reactDelegateHandlerPath)) {
      let handlerContents = fs.readFileSync(reactDelegateHandlerPath, 'utf8');

      if (!handlerContents.includes('import React')) {
        handlerContents = handlerContents.replace(
          'import EXUpdatesInterface\n\n@objc',
          'import EXUpdatesInterface\nimport React\n\n@objc'
        );
      }

      const appDelegateOriginal = [
        '    let appDelegate = (UIApplication.shared.delegate as? (any ReactNativeFactoryProvider)) ??',
        '    (UIApplication.shared.delegate?.responds(to: Selector(("_expoAppDelegate"))) ?? false ?',
        '    ((UIApplication.shared.delegate as? NSObject)?.value(forKey: "_expoAppDelegate") as? (any ReactNativeFactoryProvider)) : nil)',
        '    let reactDelegate = self.reactDelegate',
        '',
        '    guard let reactNativeFactory = appDelegate?.factory as? RCTReactNativeFactory ?? reactDelegate?.reactNativeFactory as? RCTReactNativeFactory else {',
        '      fatalError("UIApplication.shared.delegate must be an ExpoAppDelegate or EXAppDelegateWrapper")',
        '    }',
        '    self.reactNativeFactory = reactNativeFactory',
        ''
      ].join('\n');

      const appDelegateReplacement = [
        '    let appDelegate = (UIApplication.shared.delegate as? RCTAppDelegate) ??',
        '    (UIApplication.shared.delegate?.responds(to: Selector(("_expoAppDelegate"))) ?? false ?',
        '    ((UIApplication.shared.delegate as? NSObject)?.value(forKey: "_expoAppDelegate") as? RCTAppDelegate) : nil)',
        '    let reactDelegate = self.reactDelegate',
        '',
        '    guard let resolvedAppDelegate = appDelegate else {',
        '      fatalError("UIApplication.shared.delegate must be an ExpoAppDelegate or EXAppDelegateWrapper")',
        '    }',
        '',
        '    let reactNativeFactory = resolvedAppDelegate.reactNativeFactory',
        '    self.reactNativeFactory = reactNativeFactory',
        ''
      ].join('\n');

      if (handlerContents.includes(appDelegateOriginal)) {
        handlerContents = handlerContents.replace(appDelegateOriginal, appDelegateReplacement);
      }

      const recreateOriginal = [
        '      if let appDelegate = appDelegate {',
        '        return appDelegate.recreateRootView(',
        '          withBundleURL: withBundleURL,',
        '          moduleName: moduleName,',
        '          initialProps: initialProps,',
        '          launchOptions: launchOptions',
        '        )',
        '      }',
        '      if let factory = reactDelegate?.reactNativeFactory {',
        '        return factory.recreateRootView(',
        '          withBundleURL: withBundleURL,',
        '          moduleName: moduleName,',
        '          initialProps: initialProps,',
        '          launchOptions: launchOptions',
        '        )',
        '      }',
        '',
        '      fatalError("UIApplication.shared.delegate must be an ExpoAppDelegate or EXAppDelegateWrapper")',
        ''
      ].join('\n');

      const recreateReplacement = [
        '      return resolvedAppDelegate.recreateRootView(',
        '        withBundleURL: withBundleURL,',
        '        moduleName: moduleName,',
        '        initialProps: initialProps,',
        '        launchOptions: launchOptions',
        '      )',
        ''
      ].join('\n');

      if (handlerContents.includes(recreateOriginal)) {
        handlerContents = handlerContents.replace(recreateOriginal, recreateReplacement);
      }

      const bridgeOriginal = '    developmentClientController.appBridge = RCTBridge.current()\n';
      const bridgeReplacement = '    developmentClientController.appBridge = self.reactNativeFactory?.bridge\n';
      if (handlerContents.includes(bridgeOriginal)) {
        handlerContents = handlerContents.replace(bridgeOriginal, bridgeReplacement);
      }

      const debugGuard = '    if !EXAppDefines.APP_DEBUG {\n      return nil\n    }\n\n';
      if (handlerContents.includes(debugGuard)) {
        handlerContents = handlerContents.replace(debugGuard, '');
      }

      fs.writeFileSync(reactDelegateHandlerPath, handlerContents, 'utf8');
    }

    const devServerFiles = [
      path.join(packageDir, 'ios', 'SwiftUI', 'DevServersView.swift'),
      path.join(packageDir, 'ios', 'SwiftUI', 'DevServerInfoModal.swift')
    ];

    for (const swiftPath of devServerFiles) {
      if (!fs.existsSync(swiftPath)) continue;
      let contents = fs.readFileSync(swiftPath, 'utf8');
      const target = 'Color.expoSystemGray4';
      if (contents.includes(target)) {
        contents = contents.split(target).join('Color(UIColor.systemGray4)');
        fs.writeFileSync(swiftPath, contents, 'utf8');
      }
    }

    const controllerPath = path.join(packageDir, 'ios', 'EXDevLauncherController.m');
    if (fs.existsSync(controllerPath)) {
      let controllerContents = fs.readFileSync(controllerPath, 'utf8');
      const initLine =
        '    self.reactNativeFactory = [[EXDevLauncherReactNativeFactory alloc] initWithDelegate:self releaseLevel:[self getReactNativeReleaseLevel]];';
      if (controllerContents.includes(initLine)) {
        controllerContents = controllerContents.split(initLine).join(
          '    self.reactNativeFactory = [[EXDevLauncherReactNativeFactory alloc] initWithDelegate:self];'
        );
      }

      const methodStartToken = '-(RCTReleaseLevel)getReactNativeReleaseLevel';
      const methodEndToken = '\n-(void)copyToClipboard';
      const methodStartIndex = controllerContents.indexOf(methodStartToken);
      if (methodStartIndex !== -1) {
        const methodEndIndex = controllerContents.indexOf(methodEndToken, methodStartIndex);
        if (methodEndIndex !== -1) {
          controllerContents =
            controllerContents.slice(0, methodStartIndex) + controllerContents.slice(methodEndIndex);
        }
      }

      if (!controllerContents.includes('pendingAutoSetupWindow')) {
        controllerContents = controllerContents.replace(
          '@property (nonatomic, weak) UIWindow *window;\n@property (nonatomic, weak) ExpoDevLauncherReactDelegateHandler * delegate;',
          '@property (nonatomic, weak) UIWindow *window;\n@property (nonatomic, weak) UIWindow *pendingAutoSetupWindow;\n@property (nonatomic, weak) ExpoDevLauncherReactDelegateHandler * delegate;'
        );
      }

      const prepareSnippet = '  EXDevLauncherBundleURLProviderInterceptor.isInstalled = true;\n';
      if (controllerContents.includes(prepareSnippet) && !controllerContents.includes('_pendingAutoSetupWindow != nil && delegate != nil')) {
        controllerContents = controllerContents.replace(
          prepareSnippet,
          '  EXDevLauncherBundleURLProviderInterceptor.isInstalled = true;\n  if (_pendingAutoSetupWindow != nil && delegate != nil) {\n    UIWindow *window = _pendingAutoSetupWindow;\n    _pendingAutoSetupWindow = nil;\n    [self startWithWindow:window delegate:delegate launchOptions:_launchOptions];\n  }\n'
        );
      }

      const autoSetupStartOriginal = `- (void)autoSetupStart:(UIWindow *)window
{
  if (_delegate != nil) {
    [self startWithWindow:window delegate:_delegate launchOptions:_launchOptions];
  } else {
    @throw [NSException exceptionWithName:NSInternalInconsistencyException reason:@"[EXDevLauncherController autoSetupStart:] was called before autoSetupPrepare:. Make sure you've set up expo-modules correctly in AppDelegate and are using ReactDelegate to create a bridge before calling [super application:didFinishLaunchingWithOptions:]." userInfo:nil];
  }
}
`;
      const autoSetupStartReplacement = `- (void)autoSetupStart:(UIWindow *)window
{
  if (_delegate != nil) {
    [self startWithWindow:window delegate:_delegate launchOptions:_launchOptions];
  } else {
    _pendingAutoSetupWindow = window;
  }
}
`;
      if (controllerContents.includes(autoSetupStartOriginal)) {
        controllerContents = controllerContents.replace(autoSetupStartOriginal, autoSetupStartReplacement);
      }

      fs.writeFileSync(controllerPath, controllerContents, 'utf8');
    }
  }
}

function patchRNSafeAreaContext() {
  if (!fs.existsSync(pnpmDir)) return;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('react-native-safe-area-context@')) continue;

    const modulePath = path.join(
      pnpmDir,
      entry,
      'node_modules',
      'react-native-safe-area-context',
      'common',
      'cpp',
      'react',
      'renderer',
      'components',
      'safeareacontext',
      'RNCSafeAreaViewShadowNode.cpp'
    );

    if (!fs.existsSync(modulePath)) {
      continue;
    }

    let contents = fs.readFileSync(modulePath, 'utf8');
    contents = contents
      .replace(/edge\.unit\(\) != Unit::Undefined/g, '!edge.isUndefined()')
      .replace(/axis\.unit\(\) != Unit::Undefined/g, '!axis.isUndefined()');
    fs.writeFileSync(modulePath, contents, 'utf8');
  }
}

function patchRNScreens() {
  if (!fs.existsSync(pnpmDir)) return;

  const propsImport = '#import <react/renderer/components/rnscreens/Props.h>';
  const propsGuardedImport = `#if __has_include(<react/renderer/components/rnscreens/Props.h>)
#import <react/renderer/components/rnscreens/Props.h>
#endif`;
  const namespaceAlias = 'namespace react = facebook::react;';
  const namespaceGuardedAlias = `#if __has_include(<react/renderer/components/rnscreens/Props.h>)
namespace react = facebook::react;
#else
namespace react = ::facebook::react;
#endif`;
  const fallbackPlaceholder = `#else
namespace facebook {
namespace react {
}
} // namespace facebook
#endif

namespace rnscreens::conversion {
`;
  const fallbackReplacement = `#else
namespace facebook {
namespace react {

struct ImageSource;

enum class RNSBottomTabsTabBarMinimizeBehavior {
  Automatic,
  Never,
  OnScrollDown,
  OnScrollUp,
};

enum class RNSBottomTabsTabBarControllerMode {
  Automatic,
  TabBar,
  TabSidebar,
};

enum class RNSBottomTabsScreenIconType {
  Image,
  Template,
  SfSymbol,
};

enum class RNSBottomTabsScreenSystemItem {
  None,
  Bookmarks,
  Contacts,
  Downloads,
  Favorites,
  Featured,
  History,
  More,
  MostRecent,
  MostViewed,
  Recents,
  Search,
  TopRated,
};

enum class RNSBottomTabsScreenBottomScrollEdgeEffect {
  Automatic,
  Hard,
  Soft,
  Hidden,
};

enum class RNSBottomTabsScreenLeftScrollEdgeEffect {
  Automatic,
  Hard,
  Soft,
  Hidden,
};

enum class RNSBottomTabsScreenRightScrollEdgeEffect {
  Automatic,
  Hard,
  Soft,
  Hidden,
};

enum class RNSBottomTabsScreenTopScrollEdgeEffect {
  Automatic,
  Hard,
  Soft,
  Hidden,
};

enum class RNSBottomTabsScreenOrientation {
  Inherit,
  All,
  AllButUpsideDown,
  Portrait,
  PortraitUp,
  PortraitDown,
  Landscape,
  LandscapeLeft,
  LandscapeRight,
};

enum class RNSSplitViewHostPreferredSplitBehavior {
  Automatic,
  Displace,
  Overlay,
  Tile,
};

enum class RNSSplitViewHostPrimaryEdge {
  Leading,
  Trailing,
};

enum class RNSSplitViewHostPreferredDisplayMode {
  Automatic,
  SecondaryOnly,
  OneBesideSecondary,
  OneOverSecondary,
  TwoBesideSecondary,
  TwoOverSecondary,
  TwoDisplaceSecondary,
};

enum class RNSSplitViewHostDisplayModeButtonVisibility {
  Automatic,
  Always,
  Never,
};

enum class RNSSplitViewHostOrientation {
  Inherit,
  All,
  AllButUpsideDown,
  Portrait,
  PortraitUp,
  PortraitDown,
  Landscape,
  LandscapeLeft,
  LandscapeRight,
};

enum class RNSSplitViewScreenColumnType {
  Column,
  Inspector,
};

} // namespace react
} // namespace facebook
#endif

namespace rnscreens::conversion {
`;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('react-native-screens@')) continue;

    const headerPath = path.join(
      pnpmDir,
      entry,
      'node_modules',
      'react-native-screens',
      'ios',
      'RNSSearchBar.h'
    );

    if (!fs.existsSync(headerPath)) continue;

    let contents = fs.readFileSync(headerPath, 'utf8');
    if (!contents.includes('__has_include(<react/renderer/components/rnscreens/RCTComponentViewHelpers.h>)')) {
      contents = contents.replace(
        '#import <react/renderer/components/rnscreens/RCTComponentViewHelpers.h>',
        '#if __has_include(<react/renderer/components/rnscreens/RCTComponentViewHelpers.h>)\n#import <react/renderer/components/rnscreens/RCTComponentViewHelpers.h>\n#endif'
      );
      fs.writeFileSync(headerPath, contents, 'utf8');
    }

    const conversionsHeader = path.join(
      pnpmDir,
      entry,
      'node_modules',
      'react-native-screens',
      'ios',
      'conversion',
      'RNSConversions.h'
    );

    if (fs.existsSync(conversionsHeader)) {
      let conversions = fs.readFileSync(conversionsHeader, 'utf8');
      let updated = false;
      if (!conversions.includes('#if __has_include(<react/renderer/components/rnscreens/Props.h>)')) {
        conversions = conversions.replace(propsImport, propsGuardedImport);
        conversions = conversions.replace(namespaceAlias, namespaceGuardedAlias);
        updated = true;
      }

      if (conversions.includes(fallbackPlaceholder)) {
        conversions = conversions.replace(fallbackPlaceholder, fallbackReplacement);
        updated = true;
      }

      if (updated) {
        fs.writeFileSync(conversionsHeader, conversions, 'utf8');
      }
    }

    const conversionsFabric = path.join(
      pnpmDir,
      entry,
      'node_modules',
      'react-native-screens',
      'ios',
      'conversion',
      'RNSConversions-Fabric.mm'
    );

    if (fs.existsSync(conversionsFabric)) {
      let fabric = fs.readFileSync(conversionsFabric, 'utf8');
      if (!fabric.includes('__has_include(<folly/dynamic.h>)')) {
        const replacement = `#import "RNSConversions.h"

#if __has_include(<folly/dynamic.h>)
#import <folly/dynamic.h>

namespace rnscreens::conversion {

// copied from FollyConvert.mm
id RNSConvertFollyDynamicToId(const folly::dynamic &dyn)
{
`;
        fabric = fabric.replace(
          '#import "RNSConversions.h"\n\nnamespace rnscreens::conversion {\n\n// copied from FollyConvert.mm\nid RNSConvertFollyDynamicToId(const folly::dynamic &dyn)\n{\n',
          replacement
        );

        fabric = fabric.replace(
          '}; // namespace rnscreens::conversion\n',
          `}; // namespace rnscreens::conversion

#else

namespace folly {
class dynamic;
} // namespace folly

namespace rnscreens::conversion {

id RNSConvertFollyDynamicToId(const folly::dynamic &)
{
  return nil;
}

}; // namespace rnscreens::conversion

#endif
`
        );
        fs.writeFileSync(conversionsFabric, fabric, 'utf8');
      }
    }
  }
}

function patchExpoModulesCore() {
  if (!fs.existsSync(pnpmDir)) return;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('expo-modules-core@')) continue;

    const filePath = path.join(
      pnpmDir,
      entry,
      'node_modules',
      'expo-modules-core',
      'ios',
      'JSI',
      'EXJSIConversions.mm'
    );

    if (!fs.existsSync(filePath)) continue;

    let contents = fs.readFileSync(filePath, 'utf8');
    const needle =
      '  // Using cStringUsingEncoding should be fine as long as we provide the length.\n' +
      '  return jsi::String::createFromUtf16(runtime, (const char16_t *)[value cStringUsingEncoding:NSUTF16StringEncoding], length);\n';

    if (contents.includes(needle)) {
      const replacement = [
        '  // Older React Native versions don\'t expose createFromUtf16 on jsi::String,',
        '  // so we fall back to creating from UTF-8 and keep the explicit length.',
        '  NSData *utf8Data = [value dataUsingEncoding:NSUTF8StringEncoding];',
        '  if (utf8Data != nil) {',
        '    return jsi::String::createFromUtf8(',
        '        runtime,',
        '        reinterpret_cast<const uint8_t *>(utf8Data.bytes),',
        '        utf8Data.length);',
        '  }',
        '  return jsi::String::createFromUtf8(runtime, "");\n'
      ].join('\n');
      contents = contents.replace(needle, replacement);
      fs.writeFileSync(filePath, contents, 'utf8');
    }
  }
}

function patchExpoReactNativeFactory() {
  if (!fs.existsSync(pnpmDir)) return;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('expo@')) continue;

    const filePath = path.join(
      pnpmDir,
      entry,
      'node_modules',
      'expo',
      'ios',
      'AppDelegates',
      'ExpoReactNativeFactory.swift'
    );

    if (!fs.existsSync(filePath)) continue;

    let contents = fs.readFileSync(filePath, 'utf8');

    const releaseBlock = `  // TODO: Remove check when react-native-macos 0.81 is released
  #if !os(macOS)
  @objc public override init(delegate: any RCTReactNativeFactoryDelegate) {
    let releaseLevel = (Bundle.main.object(forInfoDictionaryKey: "ReactNativeReleaseLevel") as? String)
      .flatMap { [
        "canary": RCTReleaseLevel.Canary,
        "experimental": RCTReleaseLevel.Experimental,
        "stable": RCTReleaseLevel.Stable
      ][$0.lowercased()]
      }
    ?? RCTReleaseLevel.Stable

    super.init(delegate: delegate, releaseLevel: releaseLevel)
  }
  #endif
`;

    const releaseReplacement = `  // TODO: Remove check when react-native-macos 0.81 is released
  #if !os(macOS)
  @objc public override init(delegate: any RCTReactNativeFactoryDelegate) {
    super.init(delegate: delegate)
  }
  #endif
`;

    const jsRuntimeLine = `    configuration.jsRuntimeConfiguratorDelegate = delegate
`;
    const jsRuntimeReplacement = `    if configuration.responds(to: Selector(("setJsRuntimeConfiguratorDelegate:"))) {
      configuration.setValue(self.delegate, forKey: "jsRuntimeConfiguratorDelegate")
    }
`;

    let updated = false;
    if (contents.includes(releaseBlock)) {
      contents = contents.replace(releaseBlock, releaseReplacement);
      updated = true;
    }
    if (contents.includes(jsRuntimeLine)) {
      contents = contents.replace(jsRuntimeLine, jsRuntimeReplacement);
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(filePath, contents, 'utf8');
    }
  }
}

function main() {
  if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
    return;
  }

  patchExpoDevMenu();
  patchExpoDevice();
  patchExpoDevLauncher();
  patchRNSafeAreaContext();
  patchExpoModulesCore();
  patchExpoReactNativeFactory();
  patchRNScreens();
}

main();


function patchExpoDevLauncher() {
  if (!fs.existsSync(pnpmDir)) return;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('expo-dev-launcher@')) continue;

    const filePath = path.join(
      pnpmDir,
      entry,
      'node_modules',
      'expo-dev-launcher',
      'ios',
      'ReactDelegateHandler',
      'ExpoDevLauncherReactDelegateHandler.swift'
    );

    if (!fs.existsSync(filePath)) continue;

    let contents = fs.readFileSync(filePath, 'utf8');

    const methodOriginal = `  public func devLauncherController(_ developmentClientController: EXDevLauncherController, didStartWithSuccess success: Bool) {
    let appDelegate = (UIApplication.shared.delegate as? RCTAppDelegate) ??
    (UIApplication.shared.delegate?.responds(to: Selector(("_expoAppDelegate"))) ?? false ?
    ((UIApplication.shared.delegate as? NSObject)?.value(forKey: "_expoAppDelegate") as? RCTAppDelegate) : nil)
    let reactDelegate = self.reactDelegate

    guard let resolvedAppDelegate = appDelegate else {
      fatalError("UIApplication.shared.delegate must be an ExpoAppDelegate or EXAppDelegateWrapper")
    }

    let reactNativeFactory = resolvedAppDelegate.reactNativeFactory
    self.reactNativeFactory = reactNativeFactory
`;

    const methodReplacement = `  public func devLauncherController(_ developmentClientController: EXDevLauncherController, didStartWithSuccess success: Bool) {
    let possibleDelegates: [NSObject?] = [
      UIApplication.shared.delegate as? NSObject,
      (UIApplication.shared.delegate?.responds(to: Selector(("_expoAppDelegate"))) ?? false)
        ? (UIApplication.shared.delegate as? NSObject)?.value(forKey: "_expoAppDelegate") as? NSObject
        : nil
    ]
    let reactDelegate = self.reactDelegate

    guard let resolvedAppDelegate = possibleDelegates.compactMap({ $0 }).first else {
      fatalError("\`UIApplication.shared.delegate\` must be set.")
    }

    guard let reactNativeFactory = (resolvedAppDelegate.value(forKey: "reactNativeFactory")
      ?? resolvedAppDelegate.value(forKey: "factory")) as? RCTReactNativeFactory else {
      fatalError("UIApplication.shared.delegate must expose a RCTReactNativeFactory")
    }
    self.reactNativeFactory = reactNativeFactory
`;

    const helperOriginal = `  private static func recreateRootViewCompat(
    withAppDelegate appDelegate: RCTAppDelegate,
    withBundleURL: URL?,
    moduleName: String?,
    initialProps: [AnyHashable: Any]?,
    launchOptions: [AnyHashable: Any]?
  ) -> UIView {
    if appDelegate.responds(to: Selector(("recreateRootViewWithBundleURL:moduleName:initialProps:launchOptions:"))) {
      return appDelegate.recreateRootView(
        withBundleURL: withBundleURL,
        moduleName: moduleName,
        initialProps: initialProps,
        launchOptions: launchOptions
      )
    }

    return appDelegate.reactNativeFactory?.recreateRootView(
      withBundleURL: withBundleURL,
      moduleName: moduleName,
      initialProps: initialProps,
      launchOptions: launchOptions
    ) ?? UIView()
  }
`;

    const helperReplacement = `  private static func recreateRootViewCompat(
    reactNativeFactory: RCTReactNativeFactory,
    withBundleURL: URL?,
    moduleName: String?,
    initialProps: [AnyHashable: Any]?,
    launchOptions: [AnyHashable: Any]?
  ) -> UIView {
    guard let delegate = reactNativeFactory.delegate else {
      fatalError("Missing RCTReactNativeFactoryDelegate")
    }

    let rootViewFactory = reactNativeFactory.rootViewFactory

    if delegate.newArchEnabled() {
      assert(rootViewFactory.value(forKey: "reactHost") == nil, "recreateRootViewWithBundleURL: does not support when react instance is created")
    } else {
      assert(rootViewFactory.bridge == nil, "recreateRootViewWithBundleURL: does not support when react instance is created")
    }

    let configuration = rootViewFactory.value(forKey: "_configuration") as? RCTRootViewFactoryConfiguration

    if let bundleURL = withBundleURL {
      configuration?.bundleURLBlock = {
        return bundleURL
      }
    }

    return rootViewFactory.view(
      withModuleName: moduleName ?? "main",
      initialProperties: initialProps,
      launchOptions: launchOptions
    )
  }
`;

    let updated = false;
    if (!contents.includes('possibleDelegates') && contents.includes(methodOriginal)) {
      contents = contents.replace(methodOriginal, methodReplacement);
      updated = true;
    }
    if (contents.includes(helperOriginal)) {
      contents = contents.replace(helperOriginal, helperReplacement);
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(filePath, contents, 'utf8');
    }
  }
}
