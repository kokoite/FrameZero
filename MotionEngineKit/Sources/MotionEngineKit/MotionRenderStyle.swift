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

    static func fillStyle(fills: [MotionFill], fallbackStyle style: [String: MotionValue]) -> AnyShapeStyle {
        if let fill = fills.first {
            return fillStyle(for: fill)
        }

        return legacyFillStyle(for: style)
    }

    private static func fillStyle(for fill: MotionFill) -> AnyShapeStyle {
        let opacity = fill.opacity ?? 1

        switch fill.type {
        case .solid:
            return AnyShapeStyle((color(for: fill.color) ?? .clear).opacity(opacity))
        case .linearGradient:
            let stops = gradientStops(fill.colors)
            let points = gradientPoints(angleDegrees: fill.angle ?? 90)
            return AnyShapeStyle(LinearGradient(
                stops: stops,
                startPoint: points.start,
                endPoint: points.end
            ).opacity(opacity))
        case .radialGradient:
            let stops = gradientStops(fill.colors)
            return AnyShapeStyle(RadialGradient(
                stops: stops,
                center: UnitPoint(x: fill.centerX ?? 0.5, y: fill.centerY ?? 0.5),
                startRadius: 0,
                endRadius: fill.radius ?? 0.5
            ).opacity(opacity))
        }
    }

    private static func legacyFillStyle(for style: [String: MotionValue]) -> AnyShapeStyle {
        let startColor = color(for: string(style["backgroundColor"])) ?? .clear
        guard let endColor = color(for: string(style["gradientEndColor"])) else {
            return AnyShapeStyle(startColor)
        }

        let points = gradientPoints(angleDegrees: number(style["gradientAngle"]) ?? 90)
        return AnyShapeStyle(LinearGradient(colors: [startColor, endColor], startPoint: points.start, endPoint: points.end))
    }

    private static func gradientStops(_ stops: [MotionColorStop]) -> [Gradient.Stop] {
        stops.map { stop in
            Gradient.Stop(color: (color(for: stop.color) ?? .clear).opacity(stop.opacity ?? 1), location: stop.position)
        }
    }

    private static func string(_ value: MotionValue?) -> String? {
        guard case let .string(string) = value else { return nil }
        return string
    }

    private static func number(_ value: MotionValue?) -> Double? {
        guard case let .number(number) = value else { return nil }
        return number
    }

    private static func gradientPoints(angleDegrees: Double) -> (start: UnitPoint, end: UnitPoint) {
        let radians = angleDegrees * .pi / 180
        let dx = cos(radians) / 2
        let dy = sin(radians) / 2
        return (
            start: UnitPoint(x: 0.5 - dx, y: 0.5 - dy),
            end: UnitPoint(x: 0.5 + dx, y: 0.5 + dy)
        )
    }
}
