import SwiftUI

public struct MotionDebugOverlay: View {
    let engine: MotionEngine
    let frame: Int

    public init(engine: MotionEngine, frame: Int) {
        self.engine = engine
        self.frame = frame
    }

    public var body: some View {
        let _ = frame
        let snapshots = engine.channelSnapshots()

        ScrollView {
            LazyVStack(alignment: .leading, spacing: 2) {
                ForEach(snapshots, id: \.self) { snapshot in
                    row(for: snapshot)
                }
            }
        }
        .font(.system(.caption2, design: .monospaced))
        .foregroundStyle(.white)
        .padding(8)
        .background(Color.black.opacity(0.8))
        .cornerRadius(8)
    }

    @ViewBuilder
    private func row(for s: MotionChannelDebugSnapshot) -> some View {
        let drag = s.isDragOverridden ? " DRAG" : ""
        let settled = s.isSettled ? " \u{2713}" : ""

        Text("\(s.nodeID).\(s.property) [\(s.rule.rawValue)]\(drag)\(settled)")
            .lineLimit(1)
        Text("  v=\(formatted(s.current)) -> \(formatted(s.target)) dv=\(formatted(s.velocity)) t=\(formatted(s.elapsed))")
            .foregroundStyle(.white.opacity(0.7))
            .lineLimit(1)
    }

    private func formatted(_ d: Double) -> String {
        String(format: "%.3f", d)
    }
}

public extension View {
    func motionDebugOverlay(engine: MotionEngine, frame: Int, enabled: Bool = true) -> some View {
        ZStack(alignment: .topLeading) {
            self
            if enabled {
                MotionDebugOverlay(engine: engine, frame: frame)
                    .frame(maxWidth: 320, maxHeight: 240)
                    .padding(8)
            }
        }
    }
}
