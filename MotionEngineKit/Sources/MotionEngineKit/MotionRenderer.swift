import SwiftUI

struct ResolvedStroke: Equatable {
    let color: String
    let width: Double
    let alignment: MotionStrokeAlignment
    let dash: [Double]
    let cap: CGLineCap
    let join: CGLineJoin
    let miterLimit: Double
}

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
            let root = currentRoot()
            let figmaStageSize = resolvedFigmaStageSize(for: root)
            let runtimeViewportSize = figmaStageSize ?? proxy.size
            let runtimeSafeAreaInsets: EdgeInsets = figmaStageSize == nil ? proxy.safeAreaInsets : EdgeInsets()
            let viewportID = viewportIdentifier(
                size: runtimeViewportSize,
                safeAreaInsets: runtimeSafeAreaInsets
            )

            ZStack {
                if let message = engine.errorMessage {
                    Text(message)
                        .font(.body.monospaced())
                        .foregroundStyle(.red)
                        .padding()
                } else if let root = root {
                    renderRoot(root, figmaStageSize: figmaStageSize, viewportSize: proxy.size)
                } else {
                    ProgressView()
                }
            }
            .task(id: viewportID) {
                engine.updateViewport(size: runtimeViewportSize, safeAreaInsets: runtimeSafeAreaInsets)
            }
        }
    }

    private func currentRoot() -> MotionNode? {
        guard let rootID = engine.document?.root else { return nil }
        return engine.node(rootID)
    }

    private func resolvedFigmaStageSize(for root: MotionNode?) -> CGSize? {
        guard let root else { return nil }
        return figmaStageSize(for: root)
    }

    private func viewportIdentifier(size: CGSize, safeAreaInsets: EdgeInsets) -> String {
        [
            size.width,
            size.height,
            safeAreaInsets.top,
            safeAreaInsets.leading,
            safeAreaInsets.bottom,
            safeAreaInsets.trailing
        ]
            .map { String(Double($0)) }
            .joined(separator: ":")
    }

    private func renderRoot(_ root: MotionNode, figmaStageSize: CGSize?, viewportSize: CGSize) -> AnyView {
        let shake = engine.screenShakeOffset()
        let content = ZStack {
            render(root)
            MotionEffectsOverlay(engine: engine, frame: frame)
        }
        .offset(x: shake.x, y: shake.y)

        guard let figmaStageSize else {
            return AnyView(content)
        }

        let viewportBackground = color(for: engine.styleString(for: root, "backgroundColor")) ?? .clear
        let stageScale = viewportSize.width / figmaStageSize.width
        let resolvedStageScale = stageScale.isFinite && stageScale > 0 ? stageScale : 1

        return AnyView(content
            .frame(width: figmaStageSize.width, height: figmaStageSize.height)
            .scaleEffect(resolvedStageScale, anchor: .center)
            .frame(width: viewportSize.width, height: viewportSize.height)
            .background(viewportBackground)
            .clipped()
        )
    }

    private func figmaStageSize(for root: MotionNode) -> CGSize? {
        guard root.roles.contains("screen"),
              root.children.count == 1,
              let childID = root.children.first,
              let child = engine.node(childID),
              child.roles.contains(where: { $0.hasPrefix("figma:") })
                || engine.styleString(for: child, "figma.source.id") != nil
        else {
            return nil
        }

        let width = engine.layoutNumber(for: child, "width") ?? engine.styleNumber(for: child, "figma.source.absoluteRenderBounds.width")
        let height = engine.layoutNumber(for: child, "height") ?? engine.styleNumber(for: child, "figma.source.absoluteRenderBounds.height")
        guard let width, let height, width.isFinite, height.isFinite, width > 0, height > 0 else {
            return nil
        }

        return CGSize(width: width, height: height)
    }

    private func render(_ node: MotionNode) -> AnyView {
        switch node.kind {
        case .zstack:
            let proceduralGradient = MotionProceduralGradientRecipe(style: node.style)
            return AnyView(applyCommonModifiers(
                ZStack {
                    if let proceduralGradient {
                        MotionProceduralGradientView(recipe: proceduralGradient)
                    }
                    ForEach(engine.visibleChildren(for: node), id: \.self) { childID in
                        if let child = engine.node(childID) {
                            render(child)
                        }
                    }
                },
                node: node,
                drawsBackground: proceduralGradient == nil
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
        case .image:
            return AnyView(applyCommonModifiers(
                MotionImage(urlString: engine.styleString(for: node, "imageUrl")),
                node: node,
                drawsBackground: false
            ))
        case .path:
            let shape = MotionVectorPath(
                data: engine.styleString(for: node, "pathData") ?? "",
                viewBoxWidth: engine.styleNumber(for: node, "viewBoxWidth"),
                viewBoxHeight: engine.styleNumber(for: node, "viewBoxHeight")
            )
            return AnyView(applyCommonModifiers(
                MotionFilledShape(
                    shape: shape,
                    fills: node.fills,
                    fallbackStyle: node.style
                )
                .overlay {
                    if let stroke = resolveStroke(node: node) {
                        strokeOverlay(shape, spec: stroke)
                    }
                },
                node: node,
                drawsBackground: false
            ))
        case .circle:
            let shape = Ellipse()
            return AnyView(applyCommonModifiers(
                MotionFilledShape(
                    shape: shape,
                    fills: node.fills,
                    fallbackStyle: node.style
                )
                .overlay {
                    if let stroke = resolveStroke(node: node) {
                        strokeOverlay(shape, spec: stroke)
                    }
                },
                node: node,
                drawsBackground: false
            ))
        case .roundedRectangle:
            let shape = RoundedRectangle(cornerRadius: engine.styleNumber(for: node, "cornerRadius") ?? 12)
            return AnyView(applyCommonModifiers(
                MotionFilledShape(
                    shape: shape,
                    fills: node.fills,
                    fallbackStyle: node.style
                )
                .overlay {
                    if let stroke = resolveStroke(node: node) {
                        strokeOverlay(shape, spec: stroke)
                    }
                },
                node: node,
                drawsBackground: false
            ))
        }
    }

    private func shapeBackground(for node: MotionNode, cornerRadius: Double) -> MotionFilledShape<RoundedRectangle> {
        MotionFilledShape(
            shape: RoundedRectangle(cornerRadius: cornerRadius),
            fills: node.fills,
            fallbackStyle: node.style
        )
    }

    private func effectInsets(for node: MotionNode) -> EdgeInsets {
        let all = max(engine.styleNumber(for: node, "effectBounds") ?? 0, 0)
        return EdgeInsets(
            top: max(engine.styleNumber(for: node, "effectBounds.top") ?? all, 0),
            leading: max(engine.styleNumber(for: node, "effectBounds.left") ?? all, 0),
            bottom: max(engine.styleNumber(for: node, "effectBounds.bottom") ?? all, 0),
            trailing: max(engine.styleNumber(for: node, "effectBounds.right") ?? all, 0)
        )
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
        let hasFigmaFilterBox = (engine.styleNumber(for: node, "figmaFilterBox.width") ?? 0) > 0
            && (engine.styleNumber(for: node, "figmaFilterBox.height") ?? 0) > 0
        let blur = hasFigmaFilterBox
            ? 0
            : max(engine.styleNumber(for: node, "blur") ?? (engine.styleNumber(for: node, "figmaBlur") ?? 0) / 2, 0)
        let shadowBlur = max(engine.styleNumber(for: node, "shadowBlur") ?? 0, 0)
        let shadowX = engine.styleNumber(for: node, "shadowX") ?? 0
        let shadowY = engine.styleNumber(for: node, "shadowY") ?? 0
        let shadowOpacity = min(max(engine.styleNumber(for: node, "shadowOpacity") ?? 0, 0), 1)
        let shadowColor = (color(for: engine.styleString(for: node, "shadowColor")) ?? .clear).opacity(shadowOpacity)
        let clipsContent = engine.styleBool(for: node, "clip")
        let effectBounds = effectInsets(for: node)
        let hasBackground = engine.styleString(for: node, "backgroundColor") != nil || !node.fills.isEmpty
        let fillsScreen = node.roles.contains("screen")
        let isTapTarget = engine.hasTapTrigger(on: node.id)
        let isDragTarget = engine.hasDragBinding(on: node.id)
        let isGlobalDragSurface = fillsScreen && engine.hasAnyDragBinding()

        let framed = content
            .padding(padding)
            .frame(width: width, height: height)
            .frame(
                maxWidth: fillsScreen ? .infinity : nil,
                maxHeight: fillsScreen ? .infinity : nil
            )
            .background {
                if drawsBackground, hasBackground {
                    shapeBackground(for: node, cornerRadius: cornerRadius)
                }
            }
            .shadow(color: shadowColor, radius: shadowBlur, x: shadowX, y: shadowY)
            .modifier(ConditionalClip(enabled: clipsContent))

        let effectBox = effectBounds.hasInset
            ? AnyView(framed
                .padding(effectBounds)
                .offset(
                    x: (effectBounds.trailing - effectBounds.leading) / 2,
                    y: (effectBounds.bottom - effectBounds.top) / 2
                ))
            : AnyView(framed)

        let base = effectBox
            .blur(radius: blur)
            .compositingGroup()
            .contentShape(Rectangle())

        var transformed = AnyView(base
            .opacity(opacity)
            .scaleEffect(x: scaleX, y: scaleY)
            .rotationEffect(.degrees(rotation))
            .offset(x: offsetX, y: offsetY)
            .blendMode(blendMode(for: engine.styleString(for: node, "blendMode")))
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

    func resolveStroke(node: MotionNode) -> ResolvedStroke? {
        if let stroke = node.stroke {
            return ResolvedStroke(
                color: stroke.color,
                width: stroke.width,
                alignment: stroke.alignment,
                dash: stroke.dash ?? [],
                cap: cgCap(stroke.cap),
                join: cgJoin(stroke.join),
                miterLimit: stroke.miterLimit ?? 10
            )
        }

        guard let width = node.style["strokeWidth"]?.number,
              width > 0,
              let color = node.style["strokeColor"]?.string
        else {
            return nil
        }

        return ResolvedStroke(
            color: color,
            width: width,
            alignment: .center,
            dash: [],
            cap: .butt,
            join: .miter,
            miterLimit: 10
        )
    }

    @ViewBuilder
    private func strokeOverlay<S: Shape>(_ shape: S, spec: ResolvedStroke) -> some View {
        let style = StrokeStyle(
            lineWidth: spec.alignment == .center ? spec.width : spec.width * 2,
            lineCap: spec.cap,
            lineJoin: spec.join,
            miterLimit: spec.miterLimit,
            dash: spec.dash.map { CGFloat($0) }
        )

        switch spec.alignment {
        case .center:
            shape.stroke(color(for: spec.color) ?? .clear, style: style)
        case .inside:
            shape.stroke(color(for: spec.color) ?? .clear, style: style)
                .clipShape(shape)
        case .outside:
            ZStack {
                shape.stroke(color(for: spec.color) ?? .clear, style: style)
                shape.fill(Color.black).blendMode(.destinationOut)
            }
            .compositingGroup()
        }
    }

    private func cgCap(_ cap: MotionStrokeCap) -> CGLineCap {
        switch cap {
        case .butt:
            return .butt
        case .round:
            return .round
        case .square:
            return .square
        }
    }

    private func cgJoin(_ join: MotionStrokeJoin) -> CGLineJoin {
        switch join {
        case .miter:
            return .miter
        case .round:
            return .round
        case .bevel:
            return .bevel
        }
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

    private func blendMode(for value: String?) -> BlendMode {
        switch value {
        case "screen":
            return .screen
        case "plusLighter":
            return .plusLighter
        case "colorDodge":
            return .colorDodge
        case "multiply":
            return .multiply
        default:
            return .normal
        }
    }
}

private struct MotionProceduralGradientRecipe {
    enum AnchorMode: String {
        case proportional
        case top
        case bottom
        case center
    }

    enum SizeMode: String {
        case proportional
        case width
        case height
        case minDimension
        case maxDimension
        case fixed
    }

    enum FadeMode: String {
        case relative
        case fixed
    }

    struct Field {
        let center: CGPoint
        let radius: CGSize
        let centerXMode: AnchorMode
        let centerYMode: AnchorMode
        let radiusXMode: SizeMode
        let radiusYMode: SizeMode
        let blurMode: SizeMode
        let blur: CGFloat
        let opacity: Double
        let stops: [Stop]
    }

    struct Stop {
        let color: String
        let position: CGFloat
        let opacity: Double
    }

    let referenceSize: CGSize
    let fields: [Field]
    let fadeMode: FadeMode
    let fadeStops: [Stop]

    init?(style: [String: MotionValue]) {
        guard Self.string(style["proceduralGradient"]) != nil else { return nil }
        guard let referenceWidth = Self.number(style["proceduralGradient.referenceWidth"]),
              let referenceHeight = Self.number(style["proceduralGradient.referenceHeight"]),
              referenceWidth > 0,
              referenceHeight > 0
        else {
            return nil
        }

        let fieldCount = max(Int(Self.number(style["proceduralGradient.fieldCount"]) ?? 0), 0)
        var fields: [Field] = []
        for index in 0..<fieldCount {
            let prefix = "proceduralGradient.field.\(index)"
            let stopCount = max(Int(Self.number(style["\(prefix).stopCount"]) ?? 0), 0)
            var stops: [Stop] = []
            for stopIndex in 0..<stopCount {
                let stopPrefix = "\(prefix).stop.\(stopIndex)"
                guard let color = Self.string(style["\(stopPrefix).color"]) else { continue }
                stops.append(Stop(
                    color: color,
                    position: CGFloat(Self.clamp(Self.number(style["\(stopPrefix).position"]) ?? 0, min: 0, max: 1)),
                    opacity: Self.clamp(Self.number(style["\(stopPrefix).opacity"]) ?? 1, min: 0, max: 1)
                ))
            }
            guard stops.count >= 2 else { continue }
            fields.append(Field(
                center: CGPoint(
                    x: CGFloat(Self.number(style["\(prefix).centerX"]) ?? referenceWidth / 2),
                    y: CGFloat(Self.number(style["\(prefix).centerY"]) ?? referenceHeight / 2)
                ),
                radius: CGSize(
                    width: CGFloat(max(Self.number(style["\(prefix).radiusX"]) ?? referenceWidth, 1)),
                    height: CGFloat(max(Self.number(style["\(prefix).radiusY"]) ?? referenceHeight, 1))
                ),
                centerXMode: AnchorMode(rawValue: Self.string(style["\(prefix).centerXMode"]) ?? "") ?? .proportional,
                centerYMode: AnchorMode(rawValue: Self.string(style["\(prefix).centerYMode"]) ?? "") ?? .proportional,
                radiusXMode: SizeMode(rawValue: Self.string(style["\(prefix).radiusXMode"]) ?? "") ?? .proportional,
                radiusYMode: SizeMode(rawValue: Self.string(style["\(prefix).radiusYMode"]) ?? "") ?? .proportional,
                blurMode: SizeMode(rawValue: Self.string(style["\(prefix).blurMode"]) ?? "") ?? .minDimension,
                blur: CGFloat(max(Self.number(style["\(prefix).blur"]) ?? 0, 0)),
                opacity: Self.clamp(Self.number(style["\(prefix).opacity"]) ?? 1, min: 0, max: 1),
                stops: stops
            ))
        }
        guard !fields.isEmpty else { return nil }

        let fadeStopCount = max(Int(Self.number(style["proceduralGradient.fadeStopCount"]) ?? 0), 0)
        var fadeStops: [Stop] = []
        for index in 0..<fadeStopCount {
            let prefix = "proceduralGradient.fadeStop.\(index)"
            guard let color = Self.string(style["\(prefix).color"]) else { continue }
            fadeStops.append(Stop(
                color: color,
                position: CGFloat(Self.clamp(Self.number(style["\(prefix).position"]) ?? 0, min: 0, max: 1)),
                opacity: Self.clamp(Self.number(style["\(prefix).opacity"]) ?? 1, min: 0, max: 1)
            ))
        }

        self.referenceSize = CGSize(width: CGFloat(referenceWidth), height: CGFloat(referenceHeight))
        self.fields = fields
        self.fadeMode = FadeMode(rawValue: Self.string(style["proceduralGradient.fadeMode"]) ?? "") ?? .relative
        self.fadeStops = fadeStops
    }

    private static func string(_ value: MotionValue?) -> String? {
        guard case let .string(string) = value else { return nil }
        return string
    }

    private static func number(_ value: MotionValue?) -> Double? {
        guard case let .number(number) = value, number.isFinite else { return nil }
        return number
    }

    private static func clamp(_ value: Double, min minimum: Double, max maximum: Double) -> Double {
        Swift.min(Swift.max(value, minimum), maximum)
    }
}

private struct MotionProceduralGradientView: View {
    let recipe: MotionProceduralGradientRecipe

    var body: some View {
        Canvas { context, size in
            draw(in: size, context: &context)
        }
    }

    private func draw(in size: CGSize, context: inout GraphicsContext) {
        let rect = CGRect(origin: .zero, size: size)
        context.clip(to: Path(rect))
        context.fill(Path(rect), with: .color(.white))

        let metrics = Metrics(
            size: size,
            referenceSize: recipe.referenceSize
        )

        for field in recipe.fields {
            draw(field, metrics: metrics, context: &context)
        }

        if !recipe.fadeStops.isEmpty {
            context.fill(
                Path(rect),
                with: .linearGradient(
                    Gradient(stops: recipe.fadeStops.map { stop in
                        Gradient.Stop(
                            color: (MotionRenderStyle.color(for: stop.color) ?? .clear).opacity(stop.opacity),
                            location: fadePosition(stop.position, height: size.height)
                        )
                    }),
                    startPoint: CGPoint(x: rect.midX, y: rect.minY),
                    endPoint: CGPoint(x: rect.midX, y: rect.maxY)
                )
            )
        }
    }

    private func draw(
        _ field: MotionProceduralGradientRecipe.Field,
        metrics: Metrics,
        context: inout GraphicsContext
    ) {
        let radiusX = max(resolveSize(field.radius.width, mode: field.radiusXMode, metrics: metrics), 1)
        let radiusY = max(resolveSize(field.radius.height, mode: field.radiusYMode, metrics: metrics), 1)
        let blurScale = resolveSize(1, mode: field.blurMode, metrics: metrics)
        var fieldContext = context
        fieldContext.addFilter(.blur(radius: field.blur * blurScale))
        fieldContext.translateBy(
            x: resolvePosition(field.center.x, mode: field.centerXMode, size: metrics.size.width, referenceSize: metrics.referenceSize.width, scale: metrics.scaleX),
            y: resolvePosition(field.center.y, mode: field.centerYMode, size: metrics.size.height, referenceSize: metrics.referenceSize.height, scale: metrics.scaleY)
        )
        fieldContext.scaleBy(x: radiusX, y: radiusY)
        fieldContext.fill(
            Path(CGRect(x: -2, y: -2, width: 4, height: 4)),
            with: .radialGradient(
                Gradient(stops: field.stops.map { stop in
                    Gradient.Stop(
                        color: (MotionRenderStyle.color(for: stop.color) ?? .clear).opacity(stop.opacity * field.opacity),
                        location: stop.position
                    )
                }),
                center: .zero,
                startRadius: 0,
                endRadius: 1
            )
        )
    }

    private struct Metrics {
        let size: CGSize
        let referenceSize: CGSize
        let scaleX: CGFloat
        let scaleY: CGFloat
        let minScale: CGFloat
        let maxScale: CGFloat

        init(size: CGSize, referenceSize: CGSize) {
            self.size = size
            self.referenceSize = referenceSize
            scaleX = max(size.width / referenceSize.width, 0.0001)
            scaleY = max(size.height / referenceSize.height, 0.0001)
            minScale = min(scaleX, scaleY)
            maxScale = max(scaleX, scaleY)
        }
    }

    private func resolvePosition(
        _ value: CGFloat,
        mode: MotionProceduralGradientRecipe.AnchorMode,
        size: CGFloat,
        referenceSize: CGFloat,
        scale: CGFloat
    ) -> CGFloat {
        switch mode {
        case .top:
            return value
        case .bottom:
            return size - (referenceSize - value)
        case .center:
            return size / 2 + (value - referenceSize / 2)
        case .proportional:
            return value * scale
        }
    }

    private func resolveSize(
        _ value: CGFloat,
        mode: MotionProceduralGradientRecipe.SizeMode,
        metrics: Metrics
    ) -> CGFloat {
        switch mode {
        case .fixed:
            return value
        case .width:
            return value * metrics.scaleX
        case .height:
            return value * metrics.scaleY
        case .minDimension:
            return value * metrics.minScale
        case .maxDimension:
            return value * metrics.maxScale
        case .proportional:
            return value * ((metrics.scaleX + metrics.scaleY) / 2)
        }
    }

    private func fadePosition(_ value: CGFloat, height: CGFloat) -> CGFloat {
        switch recipe.fadeMode {
        case .fixed:
            return min(max((value * recipe.referenceSize.height) / max(height, 0.0001), 0), 1)
        case .relative:
            return value
        }
    }
}

private struct MotionFilledShape<S: Shape>: View {
    let shape: S
    let fills: [MotionFill]
    let fallbackStyle: [String: MotionValue]

    var body: some View {
        if shouldDrawWithCanvas {
            Canvas { context, size in
                drawCanvasFill(in: size, context: &context)
            }
        } else {
            shape.fill(MotionRenderStyle.fillStyle(fills: fills, fallbackStyle: fallbackStyle))
        }
    }

    private var shouldDrawWithCanvas: Bool {
        filterBox != nil || shapeBounds.hasInset || fills.count > 1 || fills.contains(where: MotionRenderStyle.needsCanvasRadialFill)
    }

    private var shapeBounds: EdgeInsets {
        Self.edgeInsets(prefix: "shapeBounds", style: fallbackStyle)
    }

    private var filterBox: MotionFigmaFilterBox? {
        MotionFigmaFilterBox(style: fallbackStyle)
    }

    private var blurRadius: CGFloat {
        CGFloat(max(fallbackStyle["blur"]?.number ?? (fallbackStyle["figmaBlur"]?.number ?? 0) / 2, 0))
    }

    private func drawCanvasFill(in size: CGSize, context: inout GraphicsContext) {
        if let filterBox {
            var croppedContext = context
            croppedContext.translateBy(x: -filterBox.cropX, y: -filterBox.cropY)
            if blurRadius > 0 {
                croppedContext.addFilter(.blur(radius: blurRadius))
            }
            drawShapeFill(
                in: CGSize(width: filterBox.width, height: filterBox.height),
                context: &croppedContext
            )
            return
        }

        drawShapeFill(in: size, context: &context)
    }

    private func drawShapeFill(in size: CGSize, context: inout GraphicsContext) {
        let rect = CGRect(origin: .zero, size: size)
        let shapeRect = Self.shapeRect(in: rect, insets: shapeBounds)
        let path = shape.path(in: shapeRect)
        context.clip(to: path)

        guard !fills.isEmpty else {
            context.fill(path, with: .color(.clear))
            return
        }

        for fill in fills {
            var fillContext = context
            fillContext.opacity = MotionRenderStyle.gradientOpacity(for: fill)

            switch fill.type {
            case .solid:
                fillContext.fill(path, with: .color(MotionRenderStyle.color(for: fill.color) ?? .clear))
            case .linearGradient:
                let points = Self.linearGradientPoints(angleDegrees: fill.angle ?? 90, in: shapeRect)
                fillContext.fill(
                    path,
                    with: .linearGradient(
                        MotionRenderStyle.gradient(fill.colors),
                        startPoint: points.start,
                        endPoint: points.end
                    )
                )
            case .radialGradient:
                drawRadialFill(fill, path: path, bounds: rect, shapeRect: shapeRect, context: &fillContext)
            }
        }
    }

    private func drawRadialFill(
        _ fill: MotionFill,
        path: Path,
        bounds: CGRect,
        shapeRect: CGRect,
        context: inout GraphicsContext
    ) {
        guard let transform = Self.gradientTransform(for: fill, in: bounds.size) else {
            let center = CGPoint(
                x: shapeRect.minX + shapeRect.width * CGFloat(fill.centerX ?? 0.5),
                y: shapeRect.minY + shapeRect.height * CGFloat(fill.centerY ?? 0.5)
            )
            context.fill(
                path,
                with: .radialGradient(
                    MotionRenderStyle.gradient(fill.colors),
                    center: center,
                    startRadius: 0,
                    endRadius: CGFloat(fill.radius ?? 0.5)
                )
            )
            return
        }

        var gradientContext = context
        gradientContext.concatenate(transform)

        let fillRect = Self.inverseBounds(of: bounds, through: transform).insetBy(dx: -2, dy: -2)
        gradientContext.fill(
            Path(fillRect),
            with: .radialGradient(
                MotionRenderStyle.gradient(fill.colors),
                center: .zero,
                startRadius: 0,
                endRadius: 1
            )
        )
    }

    private static func gradientTransform(for fill: MotionFill, in size: CGSize) -> CGAffineTransform? {
        guard let values = fill.gradientTransform, values.count == 6 else { return nil }
        let determinant = values[0] * values[3] - values[1] * values[2]
        guard abs(determinant) > 0.0001 else { return nil }

        let transform = CGAffineTransform(
            a: values[0],
            b: values[1],
            c: values[2],
            d: values[3],
            tx: values[4],
            ty: values[5]
        )

        guard !transform.isIdentity else { return nil }

        if values.allSatisfy({ abs($0) <= 2 }) {
            return CGAffineTransform(
                a: values[0] * size.width,
                b: values[1] * size.height,
                c: values[2] * size.width,
                d: values[3] * size.height,
                tx: values[4] * size.width,
                ty: values[5] * size.height
            )
        }

        return transform
    }

    private static func inverseBounds(of rect: CGRect, through transform: CGAffineTransform) -> CGRect {
        let inverse = transform.inverted()
        let points = [
            CGPoint(x: rect.minX, y: rect.minY).applying(inverse),
            CGPoint(x: rect.maxX, y: rect.minY).applying(inverse),
            CGPoint(x: rect.maxX, y: rect.maxY).applying(inverse),
            CGPoint(x: rect.minX, y: rect.maxY).applying(inverse)
        ]

        let minX = points.map(\.x).min() ?? -1
        let maxX = points.map(\.x).max() ?? 1
        let minY = points.map(\.y).min() ?? -1
        let maxY = points.map(\.y).max() ?? 1

        return CGRect(x: minX, y: minY, width: max(maxX - minX, 2), height: max(maxY - minY, 2))
    }

    private static func shapeRect(in rect: CGRect, insets: EdgeInsets) -> CGRect {
        CGRect(
            x: rect.minX + insets.leading,
            y: rect.minY + insets.top,
            width: max(rect.width - insets.leading - insets.trailing, 0.0001),
            height: max(rect.height - insets.top - insets.bottom, 0.0001)
        )
    }

    private static func edgeInsets(prefix: String, style: [String: MotionValue]) -> EdgeInsets {
        let all = style[prefix]?.number ?? 0
        return EdgeInsets(
            top: style["\(prefix).top"]?.number ?? all,
            leading: style["\(prefix).left"]?.number ?? all,
            bottom: style["\(prefix).bottom"]?.number ?? all,
            trailing: style["\(prefix).right"]?.number ?? all
        )
    }

    private static func linearGradientPoints(angleDegrees: Double, in rect: CGRect) -> (start: CGPoint, end: CGPoint) {
        let radians = angleDegrees * .pi / 180
        let dx = CGFloat(cos(radians)) * rect.width / 2
        let dy = CGFloat(sin(radians)) * rect.height / 2
        let center = CGPoint(x: rect.midX, y: rect.midY)
        return (
            start: CGPoint(x: center.x - dx, y: center.y - dy),
            end: CGPoint(x: center.x + dx, y: center.y + dy)
        )
    }
}

private struct MotionFigmaFilterBox {
    let width: CGFloat
    let height: CGFloat
    let cropX: CGFloat
    let cropY: CGFloat

    init?(style: [String: MotionValue]) {
        let width = style["figmaFilterBox.width"]?.number ?? .nan
        let height = style["figmaFilterBox.height"]?.number ?? .nan
        guard width.isFinite, height.isFinite, width > 0, height > 0 else { return nil }

        self.width = CGFloat(width)
        self.height = CGFloat(height)
        self.cropX = CGFloat(style["figmaFilterBox.cropX"]?.number ?? 0)
        self.cropY = CGFloat(style["figmaFilterBox.cropY"]?.number ?? 0)
    }
}

private extension EdgeInsets {
    var hasInset: Bool {
        top != 0 || leading != 0 || bottom != 0 || trailing != 0
    }
}

private struct MotionImage: View {
    let urlString: String?

    var body: some View {
        if let urlString, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case let .success(image):
                    image.resizable().scaledToFill()
                default:
                    Color.clear
                }
            }
        } else {
            Color.clear
        }
    }
}

private struct MotionVectorPath: Shape {
    let data: String
    let viewBoxWidth: Double?
    let viewBoxHeight: Double?

    func path(in rect: CGRect) -> Path {
        let tokens = tokenize(data)
        let width = max(viewBoxWidth ?? rect.width, 0.0001)
        let height = max(viewBoxHeight ?? rect.height, 0.0001)
        let scaleX = rect.width / width
        let scaleY = rect.height / height
        var index = 0
        var command: Character?
        var path = Path()

        func point(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: rect.minX + x * scaleX, y: rect.minY + y * scaleY)
        }

        func readNumber() -> Double? {
            guard index < tokens.count, let value = Double(tokens[index]) else { return nil }
            index += 1
            return value
        }

        while index < tokens.count {
            let token = tokens[index]
            if let first = token.first, token.count == 1, first.isLetter {
                command = first
                index += 1
            }

            guard let command else { break }
            switch command {
            case "M", "m":
                guard let x = readNumber(), let y = readNumber() else { return path }
                path.move(to: point(x, y))
            case "L", "l":
                guard let x = readNumber(), let y = readNumber() else { return path }
                path.addLine(to: point(x, y))
            case "C", "c":
                guard
                    let x1 = readNumber(), let y1 = readNumber(),
                    let x2 = readNumber(), let y2 = readNumber(),
                    let x = readNumber(), let y = readNumber()
                else { return path }
                path.addCurve(to: point(x, y), control1: point(x1, y1), control2: point(x2, y2))
            case "Q", "q":
                guard
                    let x1 = readNumber(), let y1 = readNumber(),
                    let x = readNumber(), let y = readNumber()
                else { return path }
                path.addQuadCurve(to: point(x, y), control: point(x1, y1))
            case "Z", "z":
                path.closeSubpath()
            default:
                index += 1
            }
        }

        return path
    }

    private func tokenize(_ source: String) -> [String] {
        var tokens: [String] = []
        var current = ""

        func flush() {
            guard !current.isEmpty else { return }
            tokens.append(current)
            current = ""
        }

        for scalar in source.unicodeScalars {
            let character = Character(scalar)
            if character.isLetter {
                flush()
                tokens.append(String(character))
            } else if character == "," || character.isWhitespace {
                flush()
            } else if character == "-" && !current.isEmpty && current.last != "e" && current.last != "E" {
                flush()
                current.append(character)
            } else {
                current.append(character)
            }
        }
        flush()

        return tokens
    }
}

private struct ConditionalClip: ViewModifier {
    let enabled: Bool

    func body(content: Content) -> some View {
        if enabled {
            content.clipped()
        } else {
            content
        }
    }
}
