#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ReadingLiveActivity, NSObject)

RCT_EXTERN_METHOD(startActivity:(NSString *)bookTitle
                  author:(NSString *)author
                  startPage:(nonnull NSNumber *)startPage
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateActivity:(nonnull NSNumber *)elapsedSeconds
                  currentPage:(nonnull NSNumber *)currentPage
                  isPaused:(BOOL)isPaused
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endActivity:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
