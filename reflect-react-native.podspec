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

  s.source_files = "ios/**/*.{h,m,mm}"

  s.dependency "React-Core"

  s.frameworks = "UIKit", "AdSupport", "StoreKit"
  s.weak_frameworks = "AppTrackingTransparency", "AdAttributionKit"

  # Build settings to suppress warnings from React-Core
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
  }
end
