// Presence of a Swift file makes Xcode link the Swift runtime + back-compat
// libraries (swiftCompatibilityConcurrency/56) into this ObjC app target, which
// the Swift pods (ReflectCore + reflect-react-native) require. No logic needed.
import Foundation
