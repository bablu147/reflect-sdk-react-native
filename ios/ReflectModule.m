// ObjC shim so the legacy RN bridge discovers the Swift RCTEventEmitter module and
// its generic `handle` dispatcher. RCTEventEmitter supplies addListener/removeListeners
// and the supportedEvents/start/stopObserving overrides live in ReflectModule.swift.

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(ReflectModule, RCTEventEmitter)

RCT_EXTERN_METHOD(handle:(NSString *)method
                  args:(NSDictionary *)args
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
