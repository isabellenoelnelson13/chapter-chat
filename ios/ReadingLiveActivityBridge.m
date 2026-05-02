#import <React/RCTBridgeModule.h>

RCT_EXTERN_MODULE(ReadingLiveActivity, NSObject)

RCT_EXTERN_ASYNC_METHOD(startActivity:(NSString *)bookTitle
                        author:(NSString *)author
                        startPage:(nonnull NSNumber *)startPage
                        resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_ASYNC_METHOD(updateActivity:(nonnull NSNumber *)elapsedSeconds
                        currentPage:(nonnull NSNumber *)currentPage
                        isPaused:(BOOL)isPaused
                        resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_ASYNC_METHOD(endActivity:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject)
