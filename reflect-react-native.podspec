require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "reflect-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = { "Retroage Engineering" => "hello@retroage.dev" }

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => package["repository"]["url"], :tag => s.version }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.0"

  # Apple Privacy Manifest — required by App Store since 1 May 2024.
  # Declares data collected by this SDK (IDFA / IDFV / install_uuid,
  # product interaction, purchase history, server-inferred coarse location)
  # plus required-reason-code declarations (UserDefaults CA92.1, FileTimestamp
  # C617.1). See ios/PrivacyInfo.xcprivacy for the manifest content.
  s.resource_bundles = {
    "ReflectReactNative" => ["ios/PrivacyInfo.xcprivacy"]
  }

  s.dependency "React-Core"
  # Shared, wrapper-agnostic native engine (all SDK logic lives here — the SAME pod
  # the Flutter plugin depends on), published from github.com/bablu147/reflect-ios.
  # Monorepo dev resolves it via a local-path pod in the example Podfile; a published
  # consumer gets it from CocoaPods trunk (or a Podfile :git line — see README).
  s.dependency "ReflectCore", "~> 1.0"

  s.frameworks = "UIKit", "AdSupport", "StoreKit"
  # AdServices: Apple Search Ads attribution token (iOS 14.3+), the iOS analog of the
  # Android Play Install Referrer. Weak-linked so older OSes are fine.
  s.weak_frameworks = "AppTrackingTransparency", "AdAttributionKit", "AdServices"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    "EXCLUDED_ARCHS[sdk=iphonesimulator*]" => "i386",
  }
end
