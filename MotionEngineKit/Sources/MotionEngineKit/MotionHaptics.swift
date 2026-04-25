import Foundation

#if os(iOS)
import UIKit
#endif

protocol MotionHapticPerformer {
    func perform(_ action: MotionHapticAction)
}

struct DefaultMotionHapticPerformer: MotionHapticPerformer {
    func perform(_ action: MotionHapticAction) {
        #if os(iOS)
        switch action.style {
        case .light:
            impact(.light, intensity: action.intensity)
        case .medium:
            impact(.medium, intensity: action.intensity)
        case .heavy:
            impact(.heavy, intensity: action.intensity)
        case .rigid:
            impact(.rigid, intensity: action.intensity)
        case .soft:
            impact(.soft, intensity: action.intensity)
        case .selection:
            UISelectionFeedbackGenerator().selectionChanged()
        case .success:
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .warning:
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case .error:
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
        #endif
    }

    #if os(iOS)
    private func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle, intensity: Double?) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()

        if let intensity {
            generator.impactOccurred(intensity: CGFloat(intensity))
        } else {
            generator.impactOccurred()
        }
    }
    #endif
}
