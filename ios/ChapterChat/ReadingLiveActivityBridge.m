#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ReadingLiveActivity, NSObject)

RCT_EXTERN_METHOD(startActivity:(NSString *)bookTitle
                  author:(NSString *)author
                  coverUrl:(NSString *)coverUrl
                  startPage:(nonnull NSNumber *)startPage)

RCT_EXTERN_METHOD(updateActivity:(nonnull NSNumber *)elapsedSeconds
                  currentPage:(nonnull NSNumber *)currentPage
                  isPaused:(BOOL)isPaused)

RCT_EXTERN_METHOD(endActivity)

@end
