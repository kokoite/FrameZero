import SwiftUI

enum MotionRenderStyle {
    static func visibleOpacity(_ value: Double) -> Double {
        let clamped = min(max(value, 0), 1)
        return clamped < 0.01 ? 0 : clamped
    }

    static func isValidHexColor(_ hex: String) -> Bool {
        let trimmed = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard trimmed.count == 6 else { return false }
        return UInt64(trimmed, radix: 16) != nil
    }

    static func color(for hex: String?) -> Color? {
        guard let hex else { return nil }

        let trimmed = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard isValidHexColor(trimmed), let value = UInt64(trimmed, radix: 16) else { return nil }

        let red = Double((value >> 16) & 0xFF) / 255
        let green = Double((value >> 8) & 0xFF) / 255
        let blue = Double(value & 0xFF) / 255

        return Color(red: red, green: green, blue: blue)
    }
}
