import SwiftUI

public struct MotionRuntimeView: View {
    let engine: MotionEngine
    let frame: Int

    public init(engine: MotionEngine, frame: Int) {
        self.engine = engine
        self.frame = frame
    }

    public var body: some View {
        let _ = frame

        GeometryReader { proxy in
            let viewportID = [
                proxy.size.width,
                proxy.size.height,
                proxy.safeAreaInsets.top,
                proxy.safeAreaInsets.leading,
                proxy.safeAreaInsets.bottom,
                proxy.safeAreaInsets.trailing
            ]
                .map { String(Double($0)) }
                .joined(separator: ":")

            ZStack {
                if let message = engine.errorMessage {
                    Text(message)
                        .font(.body.monospaced())
                        .foregroundStyle(.red)
                        .padding()
                } else if let rootID = engine.document?.root, let root = engine.node(rootID) {
                    let shake = engine.screenShakeOffset()
                    ZStack {
                        render(root)
                        MotionEffectsOverlay(engine: engine, frame: frame)
                    }
                    .offset(x: shake.x, y: shake.y)
                } else {
                    ProgressView()
                }
            }
            .task(id: viewportID) {
                engine.updateViewport(size: proxy.size, safeAreaInsets: proxy.safeAreaInsets)
            }
        }
    }

    private func render(_ node: MotionNode) -> AnyView {
        switch node.kind {
        case .zstack:
            return AnyView(applyCommonModifiers(
                ZStack {
                    ForEach(engine.visibleChildren(for: node), id: \.self) { childID in
                        if let child = engine.node(childID) {
                            render(child)
                        }
                    }
                },
                node: node
            ))
        case .vstack:
            return AnyView(applyCommonModifiers(
                VStack {
                    ForEach(engine.visibleChildren(for: node), id: \.self) { childID in
                        if let child = engine.node(childID) {
                            render(child)
                        }
                    }
                },
                node: node
            ))
        case .hstack:
            return AnyView(applyCommonModifiers(
                HStack {
                    ForEach(engine.visibleChildren(for: node), id: \.self) { childID in
                        if let child = engine.node(childID) {
                            render(child)
                        }
                    }
                },
                node: node
            ))
        case .text:
            return AnyView(applyCommonModifiers(
                Text(engine.styleString(for: node, "text") ?? "")
                    .font(font(for: engine.styleString(for: node, "font")))
                    .foregroundStyle(color(for: engine.styleString(for: node, "foregroundColor")) ?? .clear),
                node: node
            ))
        case .circle:
            return AnyView(applyCommonModifiers(
                Circle()
                    .fill(MotionRenderStyle.fillStyle(fills: node.fills, fallbackStyle: node.style)),
                node: node,
                drawsBackground: false
            ))
        case .roundedRectangle:
            return AnyView(applyCommonModifiers(
                RoundedRectangle(cornerRadius: engine.styleNumber(for: node, "cornerRadius") ?? 12)
                    .fill(MotionRenderStyle.fillStyle(fills: node.fills, fallbackStyle: node.style)),
                node: node,
                drawsBackground: false
            ))
        }
    }

    private func applyCommonModifiers<Content: View>(
        _ content: Content,
        node: MotionNode,
        drawsBackground: Bool = true
    ) -> AnyView {
        let width = engine.layoutNumber(for: node, "width").map { CGFloat($0) }
        let height = engine.layoutNumber(for: node, "height").map { CGFloat($0) }
        let offsetX = engine.number(for: node.id, property: "offset.x", default: 0)
        let offsetY = engine.number(for: node.id, property: "offset.y", default: 0)
        let rotation = engine.number(for: node.id, property: "rotation", default: 0)
        let scale = engine.number(for: node.id, property: "scale", default: 1)
        let stretchX = engine.number(for: node.id, property: "scale.x", default: 1)
        let stretchY = engine.number(for: node.id, property: "scale.y", default: 1)
        let scaleX = scale * stretchX
        let scaleY = scale * stretchY
        let opacity = MotionRenderStyle.visibleOpacity(engine.number(for: node.id, property: "opacity", default: 1))
        let padding = engine.layoutNumber(for: node, "padding") ?? 0
        let cornerRadius = engine.styleNumber(for: node, "cornerRadius") ?? 0
        let hasBackground = engine.styleString(for: node, "backgroundColor") != nil || !node.fills.isEmpty
        let fillsScreen = node.roles.contains("screen")
        let isTapTarget = engine.hasTapTrigger(on: node.id)
        let isDragTarget = engine.hasDragBinding(on: node.id)
        let isGlobalDragSurface = fillsScreen && engine.hasAnyDragBinding()

        let base = content
            .padding(padding)
            .frame(width: width, height: height)
            .frame(
                maxWidth: fillsScreen ? .infinity : nil,
                maxHeight: fillsScreen ? .infinity : nil
            )
            .background {
                if drawsBackground, hasBackground {
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .fill(MotionRenderStyle.fillStyle(fills: node.fills, fallbackStyle: node.style))
                }
            }
            .contentShape(Rectangle())

        var transformed = AnyView(base
            .opacity(opacity)
            .scaleEffect(x: scaleX, y: scaleY)
            .rotationEffect(.degrees(rotation))
            .offset(x: offsetX, y: offsetY)
            .allowsHitTesting(opacity > 0.05)
            .accessibilityLabel(node.id)
        )

        if isTapTarget {
            transformed = AnyView(transformed
                .accessibilityAddTraits(.isButton)
                .onTapGesture {
                    engine.handleTap(on: node.id)
                }
            )
        }

        if isGlobalDragSurface {
            transformed = AnyView(transformed.gesture(globalDragGesture()))
        } else if isDragTarget {
            transformed = AnyView(transformed.highPriorityGesture(dragGesture(for: node.id)))
        }

        return transformed
    }

    private func dragGesture(for nodeID: NodeID) -> some Gesture {
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

    private func globalDragGesture() -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { value in
                engine.handleGlobalDragChanged(
                    startX: Double(value.startLocation.x),
                    startY: Double(value.startLocation.y),
                    translationX: Double(value.translation.width),
                    translationY: Double(value.translation.height),
                    predictedTranslationX: Double(value.predictedEndTranslation.width),
                    predictedTranslationY: Double(value.predictedEndTranslation.height)
                )
            }
            .onEnded { value in
                engine.handleGlobalDragEnded(
                    translationX: Double(value.translation.width),
                    translationY: Double(value.translation.height),
                    predictedTranslationX: Double(value.predictedEndTranslation.width),
                    predictedTranslationY: Double(value.predictedEndTranslation.height)
                )
            }
    }

    private func point(x: Double, y: Double, in size: CGSize) -> CGPoint {
        CGPoint(
            x: (size.width / 2) + CGFloat(x),
            y: (size.height / 2) + CGFloat(y)
        )
    }

    private func font(for name: String?) -> Font {
        switch name {
        case "title":
            return .title.bold()
        case "body":
            return .body
        default:
            return .body
        }
    }

    private func color(for hex: String?) -> Color? {
        MotionRenderStyle.color(for: hex)
    }
}
