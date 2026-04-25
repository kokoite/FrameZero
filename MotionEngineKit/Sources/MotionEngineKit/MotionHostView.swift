import SwiftUI

public struct MotionEffectsOverlay: View {
    let engine: MotionEngine
    let frame: Int

    public init(engine: MotionEngine, frame: Int) {
        self.engine = engine
        self.frame = frame
    }

    public var body: some View {
        let _ = frame

        GeometryReader { proxy in
            ZStack {
                renderSlingshotGlow(in: proxy.size)
                renderTrajectoryPoints(in: proxy.size)
                renderParticles(in: proxy.size)
            }
            .allowsHitTesting(false)
        }
    }

    private func renderSlingshotGlow(in size: CGSize) -> some View {
        ZStack {
            ForEach(engine.slingshotTrails()) { trail in
                let pouch = point(x: trail.currentX, y: trail.currentY, in: size)
                let glowColor = MotionRenderStyle.color(for: trail.color) ?? Color.clear
                let glowSize = trail.glowBaseSize + (trail.glowGrowth * trail.charge)

                Circle()
                    .fill(glowColor.opacity(trail.glowFillOpacityBase + (trail.glowFillOpacityRange * trail.charge)))
                    .frame(width: CGFloat(glowSize), height: CGFloat(glowSize))
                    .position(pouch)

                Circle()
                    .stroke(
                        glowColor.opacity(trail.glowStrokeOpacityBase + (trail.glowStrokeOpacityRange * trail.charge)),
                        lineWidth: CGFloat(trail.glowStrokeWidthBase + (trail.glowStrokeWidthRange * trail.charge))
                    )
                    .frame(width: CGFloat(glowSize * trail.glowInnerScale), height: CGFloat(glowSize * trail.glowInnerScale))
                    .position(pouch)
            }
        }
    }

    private func renderTrajectoryPoints(in size: CGSize) -> some View {
        ZStack {
            ForEach(engine.slingshotTrajectoryPoints()) { point in
                Circle()
                    .fill(MotionRenderStyle.color(for: point.color)?.opacity(point.opacity) ?? Color.clear)
                    .frame(width: CGFloat(point.size), height: CGFloat(point.size))
                    .position(self.point(x: point.x, y: point.y, in: size))
            }
        }
    }

    private func renderParticles(in size: CGSize) -> some View {
        ZStack {
            ForEach(engine.particles()) { particle in
                let width = number(particle.layout["width"]) ?? 8
                let height = number(particle.layout["height"]) ?? width
                let x = particle.channels["offset.x"]?.current ?? 0
                let y = particle.channels["offset.y"]?.current ?? 0
                let opacity = MotionRenderStyle.visibleOpacity(particle.channels["opacity"]?.current ?? 1)
                let scale = particle.channels["scale"]?.current ?? 1
                let scaleX = particle.channels["scale.x"]?.current ?? 1
                let scaleY = particle.channels["scale.y"]?.current ?? 1
                let rotation = particle.channels["rotation"]?.current ?? 0
                let cornerRadius = number(particle.style["cornerRadius"]) ?? 4
                let color = MotionRenderStyle.color(for: string(particle.style["backgroundColor"])) ?? Color.clear

                particleView(kind: particle.kind, color: color, cornerRadius: cornerRadius)
                    .frame(width: CGFloat(width), height: CGFloat(height))
                    .opacity(opacity)
                    .scaleEffect(x: scale * scaleX, y: scale * scaleY)
                    .rotationEffect(.degrees(rotation))
                    .position(point(x: x, y: y, in: size))
            }
        }
    }

    @ViewBuilder
    private func particleView(kind: MotionNodeKind, color: Color, cornerRadius: Double) -> some View {
        switch kind {
        case .circle:
            Circle().fill(color)
        case .roundedRectangle:
            RoundedRectangle(cornerRadius: CGFloat(cornerRadius)).fill(color)
        case .zstack, .vstack, .hstack, .text:
            Circle().fill(color)
        }
    }

    private func point(x: Double, y: Double, in size: CGSize) -> CGPoint {
        CGPoint(
            x: (size.width / 2) + CGFloat(x),
            y: (size.height / 2) + CGFloat(y)
        )
    }

    private func number(_ value: MotionValue?) -> Double? {
        guard case let .number(number) = value else { return nil }
        return number
    }

    private func string(_ value: MotionValue?) -> String? {
        guard case let .string(string) = value else { return nil }
        return string
    }
}

struct MotionDrivenViewModifier: ViewModifier {
    let engine: MotionEngine
    let nodeID: NodeID
    let frame: Int
    let useJSONLayout: Bool
    let gesturesEnabled: Bool

    func body(content: Content) -> some View {
        let _ = frame
        let node = engine.node(nodeID)
        let width = useJSONLayout ? node.flatMap { engine.layoutNumber(for: $0, "width") }.map { CGFloat($0) } : nil
        let height = useJSONLayout ? node.flatMap { engine.layoutNumber(for: $0, "height") }.map { CGFloat($0) } : nil
        let offsetX = engine.number(for: nodeID, property: "offset.x", default: 0)
        let offsetY = engine.number(for: nodeID, property: "offset.y", default: 0)
        let rotation = engine.number(for: nodeID, property: "rotation", default: 0)
        let scale = engine.number(for: nodeID, property: "scale", default: 1)
        let stretchX = engine.number(for: nodeID, property: "scale.x", default: 1)
        let stretchY = engine.number(for: nodeID, property: "scale.y", default: 1)
        let opacity = MotionRenderStyle.visibleOpacity(engine.number(for: nodeID, property: "opacity", default: 1))

        var transformed = AnyView(content
            .frame(width: width, height: height)
            .contentShape(Rectangle())
            .opacity(opacity)
            .scaleEffect(x: scale * stretchX, y: scale * stretchY)
            .rotationEffect(.degrees(rotation))
            .offset(x: offsetX, y: offsetY)
            .allowsHitTesting(opacity > 0.05)
            .accessibilityLabel(nodeID)
        )

        guard gesturesEnabled else { return transformed }

        if engine.hasTapTrigger(on: nodeID) {
            transformed = AnyView(transformed
                .accessibilityAddTraits(AccessibilityTraits.isButton)
                .onTapGesture {
                    engine.handleTap(on: nodeID)
                }
            )
        }

        if engine.hasDragBinding(on: nodeID) {
            transformed = AnyView(transformed.highPriorityGesture(dragGesture))
        }

        return transformed
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 1, coordinateSpace: .local)
            .onChanged { value in
                engine.handleDragChanged(on: nodeID, sample: MotionDragSample(
                    translationX: Double(value.translation.width),
                    translationY: Double(value.translation.height),
                    predictedTranslationX: Double(value.predictedEndTranslation.width),
                    predictedTranslationY: Double(value.predictedEndTranslation.height)
                ))
            }
            .onEnded { value in
                engine.handleDragEnded(on: nodeID, sample: MotionDragSample(
                    translationX: Double(value.translation.width),
                    translationY: Double(value.translation.height),
                    predictedTranslationX: Double(value.predictedEndTranslation.width),
                    predictedTranslationY: Double(value.predictedEndTranslation.height)
                ))
            }
    }
}

extension View {
    public func motionDriven(
        by engine: MotionEngine,
        nodeID: String,
        frame: Int,
        useJSONLayout: Bool = false,
        gesturesEnabled: Bool = true
    ) -> some View {
        modifier(MotionDrivenViewModifier(
            engine: engine,
            nodeID: nodeID,
            frame: frame,
            useJSONLayout: useJSONLayout,
            gesturesEnabled: gesturesEnabled
        ))
    }
}
