import SwiftUI

#if canImport(UIKit)
import UIKit

public struct DisplayLinkTicker: UIViewRepresentable {
    public var onTick: (CFTimeInterval) -> Void

    public init(onTick: @escaping (CFTimeInterval) -> Void) {
        self.onTick = onTick
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(onTick: onTick)
    }

    public func makeUIView(context: Context) -> UIView {
        context.coordinator.start()
        return UIView(frame: .zero)
    }

    public func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.onTick = onTick
    }

    public static func dismantleUIView(_ uiView: UIView, coordinator: Coordinator) {
        coordinator.stop()
    }

    public final class Coordinator: NSObject {
        var onTick: (CFTimeInterval) -> Void
        private var displayLink: CADisplayLink?
        private var lastTimestamp: CFTimeInterval?

        init(onTick: @escaping (CFTimeInterval) -> Void) {
            self.onTick = onTick
        }

        func start() {
            guard displayLink == nil else { return }
            let link = CADisplayLink(target: self, selector: #selector(step(_:)))
            link.add(to: .main, forMode: .common)
            displayLink = link
        }

        func stop() {
            displayLink?.invalidate()
            displayLink = nil
            lastTimestamp = nil
        }

        @objc private func step(_ link: CADisplayLink) {
            let timestamp = link.timestamp
            let dt = lastTimestamp.map { timestamp - $0 } ?? link.duration
            lastTimestamp = timestamp
            onTick(dt)
        }
    }
}
#else
public struct DisplayLinkTicker: View {
    public var onTick: (CFTimeInterval) -> Void
    @State private var lastTimestamp: CFTimeInterval?

    public init(onTick: @escaping (CFTimeInterval) -> Void) {
        self.onTick = onTick
    }

    public var body: some View {
        TimelineView(.animation) { timeline in
            Color.clear
                .task(id: timeline.date) {
                    step(at: timeline.date.timeIntervalSinceReferenceDate)
                }
        }
    }

    private func step(at timestamp: CFTimeInterval) {
        let dt = lastTimestamp.map { timestamp - $0 } ?? (1.0 / 60.0)
        lastTimestamp = timestamp
        onTick(dt)
    }
}
#endif
