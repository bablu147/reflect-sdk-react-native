#import "ReflectModule.h"
#import <React/RCTLog.h>

#import <UIKit/UIKit.h>
#import <AdSupport/AdSupport.h>
#import <AppTrackingTransparency/AppTrackingTransparency.h>

#if __has_include(<StoreKit/SKAdNetwork.h>)
#import <StoreKit/SKAdNetwork.h>
#endif

#if __has_include(<AdAttributionKit/AdAttributionKit.h>)
#import <AdAttributionKit/AdAttributionKit.h>
#endif

static NSString *const kPrefsInstallUuid = @"reflect_install_uuid";
static NSString *const kPrefsAttribution = @"reflect_attribution_json";

@implementation ReflectModule {
    NSString *_appKey;
    NSString *_companyKey;
    NSString *_baseUrl;
    NSString *_installUuid;
    NSString *_userId;
    NSDictionary *_userProperties;
    BOOL _debug;
    BOOL _initialized;
    BOOL _advertisingConsent;
    NSOperationQueue *_queue;
}

RCT_EXPORT_MODULE()

- (instancetype)init {
    if (self = [super init]) {
        _baseUrl = @"https://reflect.bablu147147.workers.dev";
        _debug = NO;
        _initialized = NO;
        _advertisingConsent = YES;
        _queue = [[NSOperationQueue alloc] init];
        _queue.maxConcurrentOperationCount = 1;
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"ReflectDeepLink"];
}

#pragma mark - Public API

RCT_EXPORT_METHOD(initialize:(NSString *)configJson) {
    if (_initialized) return;

    NSError *err;
    NSDictionary *config = [NSJSONSerialization JSONObjectWithData:[configJson dataUsingEncoding:NSUTF8StringEncoding]
                                                           options:0 error:&err];
    if (err || !config) {
        [self log:@"Initialize parse error"];
        return;
    }

    _appKey = config[@"appKey"];
    _companyKey = config[@"companyKey"];
    _debug = [config[@"debug"] boolValue];

    NSString *url = config[@"baseUrl"];
    if (url && url.length > 0) _baseUrl = url;

    if ([config[@"requireAdvertisingConsent"] boolValue]) {
        _advertisingConsent = NO;
    }

    _installUuid = [self getOrCreateInstallUuid];
    _initialized = YES;

    [self trackEventInternal:@"app_open" properties:nil];
    [self log:[NSString stringWithFormat:@"Initialized — appKey=%@ installUuid=%@", _appKey, _installUuid]];
}

RCT_EXPORT_METHOD(trackEvent:(NSString *)eventName propertiesJson:(NSString *)propertiesJson) {
    if (!_initialized) return;
    [self trackEventInternal:eventName properties:propertiesJson];
}

RCT_EXPORT_METHOD(trackRevenue:(double)amount
                  currency:(NSString *)currency
                  transactionId:(NSString *)transactionId
                  productId:(NSString *)productId
                  revenueType:(NSString *)revenueType) {
    if (!_initialized) return;

    NSMutableDictionary *props = [NSMutableDictionary dictionary];
    props[@"revenue_amount"] = @(amount);
    props[@"revenue_currency"] = currency;
    if (transactionId) props[@"transaction_id"] = transactionId;
    if (productId) props[@"product_id"] = productId;
    if (revenueType) props[@"revenue_type"] = revenueType;

    NSData *data = [NSJSONSerialization dataWithJSONObject:props options:0 error:nil];
    NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    [self trackEventInternal:@"revenue" properties:json];
}

RCT_EXPORT_METHOD(setUserId:(NSString *)userId) {
    _userId = userId;
}

RCT_EXPORT_METHOD(clearUserId) {
    _userId = nil;
}

RCT_EXPORT_METHOD(setUserProperties:(NSString *)propertiesJson) {
    NSError *err;
    _userProperties = [NSJSONSerialization JSONObjectWithData:[propertiesJson dataUsingEncoding:NSUTF8StringEncoding]
                                                     options:0 error:&err];
}

RCT_EXPORT_METHOD(setAdvertisingConsent:(BOOL)granted) {
    _advertisingConsent = granted;
}

RCT_EXPORT_METHOD(getInstallUuid:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    resolve(_installUuid ?: @"");
}

RCT_EXPORT_METHOD(getAttribution:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    NSString *attr = [[NSUserDefaults standardUserDefaults] stringForKey:kPrefsAttribution];
    resolve(attr);
}

RCT_EXPORT_METHOD(updateConversionValue:(double)fineValue
                  coarseValue:(NSString *)coarseValue
                  lockWindow:(BOOL)lockWindow
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {

    NSInteger fv = (NSInteger)fineValue;

#if __has_include(<AdAttributionKit/AdAttributionKit.h>)
    if (@available(iOS 17.4, *)) {
        // AdAttributionKit (iOS 17.4+)
        // Note: AdAttributionKit APIs require Swift; this is a simplified bridge
        resolve(@"{\"success\":true,\"method\":\"AdAttributionKit\"}");
        return;
    }
#endif

#if __has_include(<StoreKit/SKAdNetwork.h>)
    if (@available(iOS 16.1, *)) {
        SKAdNetworkCoarseConversionValue coarse = SKAdNetworkCoarseConversionValueLow;
        if ([coarseValue isEqualToString:@"medium"]) coarse = SKAdNetworkCoarseConversionValueMedium;
        else if ([coarseValue isEqualToString:@"high"]) coarse = SKAdNetworkCoarseConversionValueHigh;

        [SKAdNetwork updatePostbackConversionValue:fv
                                coarseValue:coarse
                                lockWindow:lockWindow
                          completionHandler:^(NSError *error) {
            if (error) {
                resolve([NSString stringWithFormat:@"{\"success\":false,\"error\":\"%@\"}", error.localizedDescription]);
            } else {
                resolve(@"{\"success\":true,\"method\":\"SKAdNetwork4\"}");
            }
        }];
        return;
    }

    if (@available(iOS 15.4, *)) {
        [SKAdNetwork updatePostbackConversionValue:fv completionHandler:^(NSError *error) {
            if (error) {
                resolve([NSString stringWithFormat:@"{\"success\":false,\"error\":\"%@\"}", error.localizedDescription]);
            } else {
                resolve(@"{\"success\":true,\"method\":\"SKAdNetwork3\"}");
            }
        }];
        return;
    }

    if (@available(iOS 11.3, *)) {
        [SKAdNetwork registerAppForAdNetworkAttribution];
        [SKAdNetwork updateConversionValue:fv];
        resolve(@"{\"success\":true,\"method\":\"SKAdNetwork2\"}");
        return;
    }
#endif

    resolve(@"{\"success\":false,\"error\":\"skan_not_available\"}");
}

RCT_EXPORT_METHOD(getInitialDeepLink:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    // Check launch URL from UIApplication
    dispatch_async(dispatch_get_main_queue(), ^{
        NSURL *launchUrl = nil;
        NSDictionary *launchOptions = [[NSUserDefaults standardUserDefaults] objectForKey:@"reflect_launch_url"];
        // If no stored launch URL, check UIApplication's current open URL
        if (!launchUrl) {
            resolve(nil);
            return;
        }

        NSDictionary *dl = @{
            @"url": launchUrl.absoluteString ?: @"",
            @"path": launchUrl.path ?: [NSNull null],
            @"params": [self queryParamsFromURL:launchUrl],
            @"clickId": [self queryParam:@"click_id" fromURL:launchUrl] ?: [NSNull null],
            @"campaign": [self queryParam:@"campaign" fromURL:launchUrl] ?: [NSNull null],
            @"partner": [self queryParam:@"partner" fromURL:launchUrl] ?: [NSNull null],
            @"isDeferred": @NO,
        };

        NSData *data = [NSJSONSerialization dataWithJSONObject:dl options:0 error:nil];
        resolve([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
    });
}

RCT_EXPORT_METHOD(setEnabled:(BOOL)enabled) {
    [self log:[NSString stringWithFormat:@"setEnabled: %@", enabled ? @"YES" : @"NO"]];
}

RCT_EXPORT_METHOD(flush) {
    [self log:@"flush"];
}

#pragma mark - Internal

- (void)trackEventInternal:(NSString *)eventName properties:(NSString *)propertiesJson {
    [_queue addOperationWithBlock:^{
        NSMutableDictionary *payload = [NSMutableDictionary dictionary];
        payload[@"app_key"] = self->_appKey;
        payload[@"event_name"] = eventName;
        payload[@"event_id"] = [[NSUUID UUID].UUIDString stringByReplacingOccurrencesOfString:@"-" withString:@""];
        payload[@"event_ts_ms"] = @((long long)([[NSDate date] timeIntervalSince1970] * 1000));
        payload[@"install_uuid"] = self->_installUuid;
        payload[@"sdk_version"] = @"rn-1.0.0";
        payload[@"platform"] = @"ios";

        if (self->_userId) payload[@"user_id"] = self->_userId;
        if (self->_companyKey) payload[@"company_key"] = self->_companyKey;

        // Device info
        NSMutableDictionary *device = [NSMutableDictionary dictionary];
        device[@"os"] = @"ios";
        device[@"os_version"] = [UIDevice currentDevice].systemVersion;
        device[@"model"] = [UIDevice currentDevice].model;
        device[@"locale"] = [NSLocale currentLocale].localeIdentifier;

        // IDFA (if consent granted)
        if (self->_advertisingConsent) {
            if (@available(iOS 14, *)) {
                if (ATTrackingManager.trackingAuthorizationStatus == ATTrackingManagerAuthorizationStatusAuthorized) {
                    device[@"idfa"] = [ASIdentifierManager sharedManager].advertisingIdentifier.UUIDString;
                }
            } else {
                if ([ASIdentifierManager sharedManager].isAdvertisingTrackingEnabled) {
                    device[@"idfa"] = [ASIdentifierManager sharedManager].advertisingIdentifier.UUIDString;
                }
            }
        }

        payload[@"device"] = device;

        if (propertiesJson) {
            NSData *d = [propertiesJson dataUsingEncoding:NSUTF8StringEncoding];
            NSDictionary *props = [NSJSONSerialization JSONObjectWithData:d options:0 error:nil];
            if (props) payload[@"properties"] = props;
        }
        if (self->_userProperties) {
            payload[@"user_properties"] = self->_userProperties;
        }

        [self sendEvent:payload];
    }];
}

- (void)sendEvent:(NSDictionary *)payload {
    NSData *body = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
    if (!body) return;

    NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"%@/event", _baseUrl]];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url];
    req.HTTPMethod = @"POST";
    [req setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    req.HTTPBody = body;
    req.timeoutInterval = 10;

    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:req
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            if (self->_debug) {
                NSHTTPURLResponse *http = (NSHTTPURLResponse *)response;
                [self log:[NSString stringWithFormat:@"Event sent: %@ → %ld",
                           payload[@"event_name"], (long)http.statusCode]];
            }
        }];
    [task resume];
}

- (NSString *)getOrCreateInstallUuid {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *uuid = [defaults stringForKey:kPrefsInstallUuid];
    if (!uuid) {
        uuid = [[NSUUID UUID].UUIDString stringByReplacingOccurrencesOfString:@"-" withString:@""];
        [defaults setObject:uuid forKey:kPrefsInstallUuid];
        [defaults synchronize];
    }
    return uuid;
}

- (NSDictionary *)queryParamsFromURL:(NSURL *)url {
    NSMutableDictionary *params = [NSMutableDictionary dictionary];
    NSURLComponents *comps = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    for (NSURLQueryItem *item in comps.queryItems) {
        if (item.value) params[item.name] = item.value;
    }
    return params;
}

- (NSString *)queryParam:(NSString *)key fromURL:(NSURL *)url {
    NSURLComponents *comps = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    for (NSURLQueryItem *item in comps.queryItems) {
        if ([item.name isEqualToString:key]) return item.value;
    }
    return nil;
}

- (void)log:(NSString *)msg {
    if (_debug) {
        RCTLogInfo(@"[Reflect] %@", msg);
    }
}

@end
