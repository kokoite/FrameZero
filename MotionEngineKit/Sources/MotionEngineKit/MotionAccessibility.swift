import Foundation

public protocol MotionAccessibility {
    var isReduceMotionEnabled: Bool { get }
    func observeChanges(_ handler: @escaping (Bool) -> Void) -> AnyObject
}

#if canImport(UIKit)
import UIKit

public final class SystemMotionAccessibility: MotionAccessibility {
    public init() {}

    public var isReduceMotionEnabled: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    public func observeChanges(_ handler: @escaping (Bool) -> Void) -> AnyObject {
        let token = NotificationCenter.default.addObserver(
            forName: UIAccessibility.reduceMotionStatusDidChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            handler(UIAccessibility.isReduceMotionEnabled)
        }
        return token as AnyObject
    }
}
#else
public final class SystemMotionAccessibility: MotionAccessibility {
    public init() {}

    public var isReduceMotionEnabled: Bool {
        false
    }

    public func observeChanges(_ handler: @escaping (Bool) -> Void) -> AnyObject {
        NSObject()
    }
}
#endif
