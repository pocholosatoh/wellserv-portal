#import <React/RCTBridge.h>
#import <React/RCTBridgeDelegate.h>
#import "WellservMobile-Swift.h"

@interface ReactNativeDelegate (SwiftCompatDeclarations)
- (void)loadSourceCompatForBridge:(RCTBridge *)bridge
                       onProgress:(RCTSourceLoadProgressBlock)onProgress
                       onComplete:(RCTSourceLoadBlock)onComplete;
- (void)loadSourceCompatForBridge:(RCTBridge *)bridge
                        withBlock:(RCTSourceLoadBlock)loadCallback;
@end

@implementation ReactNativeDelegate (Compat)

- (void)loadSourceForBridge:(RCTBridge *)bridge
                 onProgress:(RCTSourceLoadProgressBlock)onProgress
                 onComplete:(RCTSourceLoadBlock)onComplete {
  [self loadSourceCompatForBridge:bridge onProgress:onProgress onComplete:onComplete];
}

- (void)loadSourceForBridge:(RCTBridge *)bridge
                  withBlock:(RCTSourceLoadBlock)loadCallback {
  [self loadSourceCompatForBridge:bridge withBlock:loadCallback];
}

@end
