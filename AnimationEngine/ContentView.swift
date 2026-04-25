//
//  ContentView.swift
//  AnimationEngine
//
//  Created by pranjal.agarwal on 25/04/26.
//

import SwiftUI
import MotionEngineKit

private enum SampleTypography {
    static let title = Font.system(size: 25, weight: .semibold)
    static let sectionTitle = Font.system(size: 13, weight: .semibold)
    static let input = Font.system(size: 16, weight: .semibold)
    static let controlLabel = Font.system(size: 13, weight: .semibold)
    static let savedTitle = Font.system(size: 13, weight: .semibold)
    static let caption = Font.system(size: 12, weight: .regular)
    static let smallLabel = Font.system(size: 11, weight: .medium)
    static let badge = Font.system(size: 11, weight: .semibold)
    static let value = Font.system(size: 11, weight: .medium, design: .monospaced)
}

struct ContentView: View {
    private static let engine = MotionEngine()

    @State private var frame = 0
    @State private var clip = MotionClip.demo
    @State private var savedPhases = MotionClip.samples
    @State private var animationPhaseIDs: [UUID] = []
    @State private var selectedPhaseID: UUID?
    @State private var status = "Ready"

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                playground
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    header
                        .padding(.horizontal, 18)
                        .padding(.top, proxy.safeAreaInsets.top + 10)

                    Spacer(minLength: 0)

                    controlPanel
                        .padding(.horizontal, 14)
                        .padding(.bottom, proxy.safeAreaInsets.bottom + 12)
                        .frame(maxHeight: min(405, proxy.size.height * 0.46))
                }
            }
            .background(Color(red: 0.055, green: 0.055, blue: 0.075))
        }
        .onAppear {
            playCurrentPhase()
        }
        .background {
            DisplayLinkTicker { dt in
                if Self.engine.tick(dt: dt) {
                    frame += 1
                }
            }
        }
    }

    private var playground: some View {
        ZStack {
            MotionRuntimeView(engine: Self.engine, frame: frame)
            PlaygroundChrome(
                frame: frame,
                originX: currentPhaseStart.x,
                originY: currentPhaseStart.y,
                deltaX: clip.x,
                deltaY: clip.y,
                motionKind: clip.motionKind,
                arcDirection: clip.arcDirection,
                arcBend: clip.arcBend
            )
                .allowsHitTesting(false)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("FrameZero")
                    .font(SampleTypography.title)
                    .foregroundStyle(.white)

                HStack(spacing: 8) {
                    Badge(text: "PLAYGROUND", color: .cyan)
                    Text(status)
                        .font(SampleTypography.caption)
                        .foregroundStyle(.white.opacity(0.76))
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                }
            }

            Spacer(minLength: 8)

            Button {
                playCurrentPhase()
            } label: {
                Image(systemName: "play.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.cyan.opacity(0.2), in: RoundedRectangle(cornerRadius: 8))
                    .overlay {
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(.cyan.opacity(0.35), lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Play current animation")
        }
    }

    private var controlPanel: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Label("PANEL", systemImage: "slider.horizontal.3")
                    .font(SampleTypography.sectionTitle)
                    .foregroundStyle(.white)

                Spacer(minLength: 8)

                Button("Save") {
                    saveCurrent()
                }
                .buttonStyle(.bordered)
                .tint(.cyan)

                Button("Add") {
                    addPhase()
                }
                .buttonStyle(.bordered)
                .tint(.cyan)
                .accessibilityLabel("Add Phase")

                Button("Play") {
                    playCurrentPhase()
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
            }

            ScrollView(showsIndicators: false) {
                VStack(spacing: 10) {
                    TextField("Phase name", text: $clip.name)
                        .textFieldStyle(.plain)
                        .font(SampleTypography.input)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 8))
                        .overlay {
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(.white.opacity(0.12), lineWidth: 1)
                        }

                    modeControls
                    phaseReadout

                    VStack(spacing: 9) {
                        ControlSlider(title: "Move X", value: $clip.x, range: -150...150, suffix: "pt")
                        ControlSlider(title: "Move Y", value: $clip.y, range: -210...210, suffix: "pt")
                        if clip.motionKind == .arc {
                            ControlSlider(title: "Arc Bend", value: $clip.arcBend, range: 0.05...1.4, suffix: "x")
                        }
                        ControlSlider(title: "Rotate", value: $clip.rotation, range: -360...360, suffix: "deg")
                        ControlSlider(title: "Scale", value: $clip.scale, range: 0.2...1.8, suffix: "x")
                        ControlSlider(title: "Opacity", value: $clip.opacity, range: 0.1...1, suffix: "")
                        ControlSlider(title: "Phase Duration", value: $clip.phaseDuration, range: 0.08...2.5, suffix: "s")
                        ControlSlider(title: "Start Delay", value: $clip.startDelay, range: 0...2, suffix: "s")
                        ControlSlider(title: "Response", value: $clip.response, range: 0.15...1.2, suffix: "s")
                        ControlSlider(title: "Damping", value: $clip.damping, range: 0.35...1.25, suffix: "")
                    }

                    savedPhasesView
                    animationBuilder
                }
            }
        }
        .padding(12)
        .background(.black.opacity(0.38), in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.white.opacity(0.14), lineWidth: 1)
        }
    }

    private var modeControls: some View {
        HStack(spacing: 8) {
            HStack(spacing: 4) {
                ForEach(MotionKind.allCases) { kind in
                    SegmentPill(title: kind.title, isSelected: clip.motionKind == kind, color: kind.color) {
                        clip.motionKind = kind
                    }
                }
            }
            .padding(4)
            .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))

            HStack(spacing: 4) {
                ForEach(ArcDirectionChoice.allCases) { direction in
                    SegmentPill(title: direction.title, isSelected: clip.arcDirection == direction, color: .cyan) {
                        clip.arcDirection = direction
                    }
                }
            }
            .disabled(clip.motionKind != .arc)
            .opacity(clip.motionKind == .arc ? 1 : 0.38)
            .padding(4)
            .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private var phaseReadout: some View {
        HStack(spacing: 8) {
            Text("Origin \(n(currentPhaseStart.x)), \(n(currentPhaseStart.y))")
            Image(systemName: "arrow.right")
                .font(.system(size: 10, weight: .bold))
            Text("Delta \(n(clip.x)), \(n(clip.y))")
            Image(systemName: "equal")
                .font(.system(size: 9, weight: .bold))
            Text("End \(n(currentPhaseEnd.x)), \(n(currentPhaseEnd.y))")
            Spacer(minLength: 0)
        }
        .font(SampleTypography.value)
        .foregroundStyle(.white.opacity(0.68))
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
    }

    private var savedPhasesView: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("Saved phases")
                    .font(SampleTypography.sectionTitle)
                    .foregroundStyle(.white)

                Spacer()

                Text("\(savedPhases.count)")
                    .font(SampleTypography.value)
                    .foregroundStyle(.white.opacity(0.62))
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(savedPhases) { saved in
                        Button {
                            selectedPhaseID = nil
                            clip = saved
                            play(saved, from: currentPhaseStart)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(saved.name)
                                    .font(SampleTypography.savedTitle)
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.78)

                                Text(saved.motionKind.title)
                                    .font(SampleTypography.smallLabel)
                                    .foregroundStyle(saved.motionKind.color.opacity(0.86))
                            }
                            .frame(width: 92, alignment: .leading)
                            .padding(9)
                            .background(saved.motionKind.color.opacity(0.16), in: RoundedRectangle(cornerRadius: 8))
                            .overlay {
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(saved.motionKind.color.opacity(0.28), lineWidth: 1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var animationBuilder: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("Animation timeline")
                    .font(SampleTypography.sectionTitle)
                    .foregroundStyle(.white)

                Spacer()

                Button("Add Phase") {
                    addPhase()
                }
                .buttonStyle(.bordered)
                .tint(.cyan)

                Button("Play Animation") {
                    playAnimation()
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
                .disabled(animationPhaseIDs.isEmpty)
            }

            HStack(spacing: 6) {
                if animationPhaseIDs.isEmpty {
                    Text("Create phases, add them here, then play them as one animation.")
                        .font(SampleTypography.caption)
                        .foregroundStyle(.white.opacity(0.62))
                } else {
                    ForEach(Array(animationPhases.enumerated()), id: \.element.id) { index, item in
                        HStack(spacing: 3) {
                            Button {
                                selectPhase(item)
                            } label: {
                                Text("\(index + 1). \(item.name)")
                                    .font(SampleTypography.smallLabel)
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 6)
                                    .background(
                                        selectedPhaseID == item.id ? Color.cyan.opacity(0.26) : Color.white.opacity(0.1),
                                        in: Capsule()
                                    )
                                    .overlay {
                                        Capsule()
                                            .stroke(selectedPhaseID == item.id ? Color.cyan.opacity(0.55) : Color.clear, lineWidth: 1)
                                    }
                            }
                            .buttonStyle(.plain)

                            Button {
                                playPhase(at: index)
                            } label: {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(width: 20, height: 20)
                                    .background(.white.opacity(0.12), in: Circle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Play phase \(index + 1)")

                            Button {
                                deletePhase(at: index)
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(width: 20, height: 20)
                                    .background(.red.opacity(0.2), in: Circle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Delete phase \(index + 1)")
                        }
                    }
                }

                Spacer(minLength: 0)
            }
        }
    }

    private var animationPhases: [MotionClip] {
        animationPhaseIDs.compactMap { id in savedPhases.first(where: { $0.id == id }) }
    }

    private var selectedPhaseIndex: Int? {
        guard let selectedPhaseID else { return nil }
        return animationPhaseIDs.firstIndex(of: selectedPhaseID)
    }

    private var currentPhaseStart: MotionEndpoint {
        if let selectedPhaseIndex {
            return startEndpoint(forPhaseAt: selectedPhaseIndex)
        }

        return endpoint(after: animationPhases)
    }

    private var currentPhaseEnd: MotionEndpoint {
        currentPhaseStart.advanced(by: clip)
    }

    private func saveCurrent() {
        let cleanName = clip.name.trimmingCharacters(in: .whitespacesAndNewlines)
        clip.name = cleanName.isEmpty ? "Untitled" : cleanName

        if let selectedPhaseID, let index = savedPhases.firstIndex(where: { $0.id == selectedPhaseID }) {
            clip.id = selectedPhaseID
            savedPhases[index] = clip
        } else if let index = savedPhases.firstIndex(where: { $0.name == clip.name }) {
            savedPhases[index] = clip
        } else {
            savedPhases.append(clip)
        }

        status = "Saved phase \(clip.name)"
    }

    private func addPhase() {
        if selectedPhaseID != nil {
            saveCurrent()
        }

        var phase = clip.withNewID()
        let cleanName = phase.name.trimmingCharacters(in: .whitespacesAndNewlines)
        phase.name = cleanName.isEmpty ? "Phase \(animationPhaseIDs.count + 1)" : cleanName
        savedPhases.append(phase)
        animationPhaseIDs.append(phase.id)
        selectedPhaseID = nil
        clip = phase.nextDraft(named: "Phase \(animationPhaseIDs.count + 1)")
        status = "Added \(phase.name). Next phase starts from its endpoint."
    }

    private func selectPhase(_ item: MotionClip) {
        selectedPhaseID = item.id
        clip = item
        status = "Editing \(item.name)"
    }

    private func playCurrentPhase() {
        play(clip, from: currentPhaseStart)
    }

    private func play(_ item: MotionClip, from start: MotionEndpoint = .origin) {
        do {
            try Self.engine.load(jsonString: MotionDocumentFactory.document(for: [item], initial: start))
            status = "Playing \(item.name)"
            frame += 1
        } catch {
            status = error.localizedDescription
        }
    }

    private func playPhase(at index: Int) {
        let clips = animationPhases
        guard clips.indices.contains(index) else { return }
        play(clips[index], from: startEndpoint(forPhaseAt: index))
    }

    private func deletePhase(at index: Int) {
        let clips = animationPhases
        guard clips.indices.contains(index) else { return }

        let removed = clips[index]
        animationPhaseIDs.removeAll { $0 == removed.id }

        if selectedPhaseID == removed.id {
            selectedPhaseID = nil
            clip = endpoint(after: animationPhases).draft(named: "Phase \(animationPhaseIDs.count + 1)")
        }

        status = "Deleted \(removed.name). Later phases now start from the previous endpoint."
        frame += 1
    }

    private func playAnimation() {
        let clips = animationPhases
        guard !clips.isEmpty else { return }

        do {
            try Self.engine.load(jsonString: MotionDocumentFactory.document(for: clips))
            status = "Playing animation: \(clips.map(\.name).joined(separator: " -> "))"
            frame += 1
        } catch {
            status = error.localizedDescription
        }
    }

    private func startEndpoint(forPhaseAt index: Int) -> MotionEndpoint {
        endpoint(after: Array(animationPhases.prefix(index)))
    }

    private func endpoint(after clips: [MotionClip]) -> MotionEndpoint {
        clips.reduce(MotionEndpoint.origin) { endpoint, clip in
            endpoint.advanced(by: clip)
        }
    }

    private func n(_ value: Double) -> String {
        String(format: "%.0f", value)
    }
}

private struct ControlSlider: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let suffix: String

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                Text(title)
                    .font(SampleTypography.controlLabel)
                    .foregroundStyle(.white.opacity(0.9))

                Spacer()

                HStack(spacing: 5) {
                    TextField("", value: $value, format: .number.precision(.fractionLength(2)))
                        .font(SampleTypography.value)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.trailing)
                        .keyboardType(.numbersAndPunctuation)
                        .frame(width: 58)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 5)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 7))
                        .overlay {
                            RoundedRectangle(cornerRadius: 7)
                                .stroke(.white.opacity(0.12), lineWidth: 1)
                        }
                        .onChange(of: value) { _, newValue in
                            value = min(max(newValue, range.lowerBound), range.upperBound)
                        }

                    if !suffix.isEmpty {
                        Text(suffix)
                            .font(SampleTypography.value)
                            .foregroundStyle(.white.opacity(0.58))
                            .frame(width: 26, alignment: .leading)
                    }
                }
            }

            Slider(value: $value, in: range)
                .tint(.cyan)
        }
    }
}

private struct SegmentPill: View {
    let title: String
    let isSelected: Bool
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(SampleTypography.smallLabel)
                .foregroundStyle(isSelected ? .white : .white.opacity(0.78))
                .frame(minWidth: 52)
                .padding(.vertical, 8)
                .background(isSelected ? color.opacity(0.46) : .white.opacity(0.07), in: RoundedRectangle(cornerRadius: 7))
                .overlay {
                    RoundedRectangle(cornerRadius: 7)
                        .stroke(isSelected ? color.opacity(0.75) : .white.opacity(0.1), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

private struct Badge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(SampleTypography.badge)
            .foregroundStyle(.white)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(color.opacity(0.18), in: Capsule())
            .overlay {
                Capsule()
                    .stroke(color.opacity(0.34), lineWidth: 1)
            }
    }
}

private struct MotionClip: Identifiable, Equatable {
    var id: UUID
    var name: String
    var motionKind: MotionKind
    var arcDirection: ArcDirectionChoice
    var arcBend: Double
    var x: Double
    var y: Double
    var rotation: Double
    var scale: Double
    var opacity: Double
    var phaseDuration: Double
    var startDelay: Double
    var response: Double
    var damping: Double

    static let demo = MotionClip(
        id: UUID(),
        name: "Origin Pop",
        motionKind: .arc,
        arcDirection: .clockwise,
        arcBend: 0.72,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        phaseDuration: 0.34,
        startDelay: 0,
        response: 0.5,
        damping: 0.72
    )

    static let samples = [
        demo,
        MotionClip(
            id: UUID(),
            name: "Tiny Panic",
            motionKind: .jiggle,
            arcDirection: .clockwise,
            arcBend: 0.72,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: 1,
            phaseDuration: 0.7,
            startDelay: 0,
            response: 0.32,
            damping: 0.6
        ),
        MotionClip(
            id: UUID(),
            name: "Sink Fade",
            motionKind: .spring,
            arcDirection: .anticlockwise,
            arcBend: 0.72,
            x: -72,
            y: 142,
            rotation: -35,
            scale: 0.45,
            opacity: 0.28,
            phaseDuration: 0.45,
            startDelay: 0,
            response: 0.62,
            damping: 0.82
        )
    ]

    func withNewID() -> MotionClip {
        var copy = self
        copy.id = UUID()
        return copy
    }

    func nextDraft(named draftName: String) -> MotionClip {
        var copy = self
        copy.id = UUID()
        copy.name = draftName
        copy.x = 0
        copy.y = 0
        copy.startDelay = 0
        return copy
    }

    var timelineDuration: Double {
        phaseDuration
    }
}

private struct MotionEndpoint {
    var x: Double
    var y: Double
    var rotation: Double
    var scale: Double
    var opacity: Double

    static let origin = MotionEndpoint(x: 0, y: 0, rotation: 0, scale: 1, opacity: 1)

    init(x: Double, y: Double, rotation: Double, scale: Double, opacity: Double) {
        self.x = x
        self.y = y
        self.rotation = rotation
        self.scale = scale
        self.opacity = opacity
    }

    init(clip: MotionClip) {
        self.init(x: clip.x, y: clip.y, rotation: clip.rotation, scale: clip.scale, opacity: clip.opacity)
    }

    func advanced(by clip: MotionClip) -> MotionEndpoint {
        MotionEndpoint(
            x: x + clip.x,
            y: y + clip.y,
            rotation: clip.rotation,
            scale: clip.scale,
            opacity: clip.opacity
        )
    }

    func draft(named name: String) -> MotionClip {
        MotionClip(
            id: UUID(),
            name: name,
            motionKind: .arc,
            arcDirection: .clockwise,
            arcBend: 0.72,
            x: 0,
            y: 0,
            rotation: rotation,
            scale: scale,
            opacity: opacity,
            phaseDuration: 0.34,
            startDelay: 0,
            response: 0.5,
            damping: 0.72
        )
    }
}

private enum MotionKind: String, CaseIterable, Identifiable {
    case spring
    case arc
    case jiggle

    var id: String { rawValue }

    var title: String {
        switch self {
        case .spring: "Spring"
        case .arc: "Arc"
        case .jiggle: "Jiggle"
        }
    }

    var color: Color {
        .cyan
    }
}

private enum ArcDirectionChoice: String, CaseIterable, Identifiable {
    case clockwise
    case anticlockwise

    var id: String { rawValue }
    var title: String { self == .clockwise ? "CW" : "CCW" }
}

private enum MotionDocumentFactory {
    static func document(for clips: [MotionClip], initial: MotionEndpoint = .origin) -> String {
        let states = stateJSON(for: clips, initial: initial)
        let transitions = transitionJSON(for: clips, initial: initial)

        return """
        {
          "schemaVersion": 1,
          "root": "screen",
          "nodes": [
            {
              "id": "screen",
              "kind": "zstack",
              "roles": ["screen"],
              "layout": { "padding": 0 },
              "style": { "backgroundColor": "#11131A" },
              "presentation": {},
              "children": ["orb", "marker"]
            },
            {
              "id": "orb",
              "kind": "circle",
              "roles": ["target"],
              "layout": { "width": 68, "height": 68 },
              "style": { "backgroundColor": "#38BDF8" },
              "presentation": {
                "offset.x": { "metric": "safeArea.centerX" },
                "offset.y": { "metric": "safeArea.centerY" },
                "rotation": 0,
                "scale": 1,
                "opacity": 1
              },
              "children": []
            },
            {
              "id": "marker",
              "kind": "roundedRectangle",
              "roles": ["marker"],
              "layout": { "width": 8, "height": 28 },
              "style": { "cornerRadius": 4, "backgroundColor": "#FFFFFF" },
              "presentation": {
                "offset.x": { "metric": "safeArea.centerX" },
                "offset.y": { "metric": "safeArea.centerY", "offset": -28 },
                "rotation": 0,
                "scale": 1,
                "opacity": 0.9
              },
              "children": []
            }
          ],
          "machines": [
            {
              "id": "builderMachine",
              "initial": "state0",
              "states": [
        \(states)
              ],
              "transitions": [
        \(transitions)
              ]
            }
          ],
          "triggers": [
            { "id": "timeline", "type": "after" }
          ],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """
    }

    private static func stateJSON(for clips: [MotionClip], initial: MotionEndpoint) -> String {
        let states = (0...clips.count).map { index -> String in
            let endpoint = endpoint(after: Array(clips.prefix(index)), initial: initial)
            let x = endpoint.x
            let y = endpoint.y
            let rotation = endpoint.rotation
            let scale = endpoint.scale
            let opacity = endpoint.opacity

            return """
                {
                  "id": "state\(index)",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": { "metric": "safeArea.centerX", "offset": \(n(x)) } },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": { "metric": "safeArea.centerY", "offset": \(n(y)) } },
                    { "select": { "id": "orb", "properties": ["rotation"] }, "value": \(n(rotation)) },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": \(n(scale)) },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": \(n(opacity)) },
                    { "select": { "id": "marker", "properties": ["offset.x"] }, "value": { "metric": "safeArea.centerX", "offset": \(n(x)) } },
                    { "select": { "id": "marker", "properties": ["offset.y"] }, "value": { "metric": "safeArea.centerY", "offset": \(n(y - 28)) } },
                    { "select": { "id": "marker", "properties": ["rotation"] }, "value": \(n(rotation)) },
                    { "select": { "id": "marker", "properties": ["scale"] }, "value": \(n(scale)) },
                    { "select": { "id": "marker", "properties": ["opacity"] }, "value": \(n(opacity * 0.9)) }
                  ]
                }
        """
        }

        return states.joined(separator: ",\n")
    }

    private static func transitionJSON(for clips: [MotionClip], initial: MotionEndpoint) -> String {
        clips.enumerated().map { index, clip in
            let start = endpoint(after: Array(clips.prefix(index)), initial: initial)
            let startX = start.x
            let startY = start.y
            let end = start.advanced(by: clip)
            let distance = max(hypot(end.x - startX, end.y - startY), 1)
            let bend = distance * clip.arcBend
            let transitionDelay = index == 0
                ? clip.startDelay
                : clips[index - 1].timelineDuration + clip.startDelay
            let arcs = clip.motionKind == .arc ? """
        ,
                  "arcs": [
                    {
                      "select": { "id": "orb" },
                      "x": "offset.x",
                      "y": "offset.y",
                      "direction": "\(clip.arcDirection.rawValue)",
                      "bend": \(n(bend)),
                      "motion": { "type": "spring", "response": \(n(clip.response)), "dampingFraction": \(n(clip.damping)) }
                    },
                    {
                      "select": { "id": "marker" },
                      "x": "offset.x",
                      "y": "offset.y",
                      "direction": "\(clip.arcDirection.rawValue)",
                      "bend": \(n(bend)),
                      "motion": { "type": "spring", "response": \(n(clip.response)), "dampingFraction": \(n(clip.damping)) }
                    }
                  ]
        """ : """
        ,
                  "arcs": []
        """
            let jiggles = clip.motionKind == .jiggle ? """
        ,
                  "jiggles": [
                    {
                      "select": { "id": "orb", "properties": ["rotation"] },
                      "amplitude": 18,
                      "duration": \(n(clip.phaseDuration)),
                      "cycles": 8,
                      "startDirection": "anticlockwise",
                      "decay": 0.18
                    },
                    {
                      "select": { "id": "marker", "properties": ["rotation"] },
                      "amplitude": 18,
                      "duration": \(n(clip.phaseDuration)),
                      "cycles": 8,
                      "startDirection": "anticlockwise",
                      "decay": 0.18
                    }
                  ]
        """ : """
        ,
                  "jiggles": []
        """

            return """
                {
                  "id": "transition\(index)",
                  "from": "state\(index)",
                  "to": "state\(index + 1)",
                  "trigger": "timeline",
                  "delay": \(n(transitionDelay)),
                  "rules": [
                    {
                      "select": { "role": "target", "properties": ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
                      "motion": { "type": "spring", "response": \(n(clip.response)), "dampingFraction": \(n(clip.damping)) }
                    },
                    {
                      "select": { "role": "marker", "properties": ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
                      "motion": { "type": "spring", "response": \(n(clip.response)), "dampingFraction": \(n(clip.damping)) }
                    }
                  ]\(arcs)\(jiggles),
                  "enter": [],
                  "exit": [],
                  "spawns": []
                }
        """
        }
        .joined(separator: ",\n")
    }

    private static func n(_ value: Double) -> String {
        String(format: "%.4f", value)
    }

    private static func endpoint(after clips: [MotionClip], initial: MotionEndpoint) -> MotionEndpoint {
        clips.reduce(initial) { endpoint, clip in
            endpoint.advanced(by: clip)
        }
    }
}

private struct PlaygroundChrome: View {
    let frame: Int
    let originX: Double
    let originY: Double
    let deltaX: Double
    let deltaY: Double
    let motionKind: MotionKind
    let arcDirection: ArcDirectionChoice
    let arcBend: Double

    var body: some View {
        Canvas { context, size in
            drawGrid(in: &context, size: size)
            drawOriginGraph(in: &context, size: size)
        }
        .opacity(0.9)
    }

    private func drawGrid(in context: inout GraphicsContext, size: CGSize) {
        let spacing: CGFloat = 42
        var path = Path()

        var x: CGFloat = -spacing
        while x <= size.width + spacing {
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x + 76, y: size.height))
            x += spacing
        }

        var y: CGFloat = 0
        while y <= size.height {
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
            y += spacing
        }

        context.stroke(path, with: .color(.white.opacity(0.04)), lineWidth: 1)
    }

    private func drawOriginGraph(in context: inout GraphicsContext, size: CGSize) {
        let origin = CGPoint(
            x: size.width / 2 + CGFloat(originX),
            y: size.height / 2 + CGFloat(originY)
        )
        let target = CGPoint(x: origin.x + CGFloat(deltaX), y: origin.y + CGFloat(deltaY))

        var axes = Path()
        axes.move(to: CGPoint(x: 0, y: origin.y))
        axes.addLine(to: CGPoint(x: size.width, y: origin.y))
        axes.move(to: CGPoint(x: origin.x, y: 0))
        axes.addLine(to: CGPoint(x: origin.x, y: size.height))
        context.stroke(axes, with: .color(.cyan.opacity(0.24)), lineWidth: 1.2)

        if motionKind == .arc {
            context.stroke(
                arcPath(from: origin, to: target),
                with: .color(.cyan.opacity(0.9)),
                style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round)
            )
        } else {
            var vector = Path()
            vector.move(to: origin)
            vector.addLine(to: target)
            context.stroke(vector, with: .color(.cyan.opacity(0.82)), lineWidth: 2.2)
        }

        let pulse = CGFloat((sin(Double(frame) * 0.045) + 1) * 0.5)
        for index in 0..<4 {
            let diameter = CGFloat(82 + (index * 46)) + (pulse * 8)
            let rect = CGRect(x: origin.x - diameter / 2, y: origin.y - diameter / 2, width: diameter, height: diameter)
            context.stroke(
                Path(ellipseIn: rect),
                with: .color(Color.cyan.opacity(Double(0.1 - CGFloat(index) * 0.018))),
                lineWidth: 1.1
            )
        }

        context.fill(Path(ellipseIn: CGRect(x: origin.x - 4, y: origin.y - 4, width: 8, height: 8)), with: .color(.white.opacity(0.88)))
        context.fill(Path(ellipseIn: CGRect(x: target.x - 6, y: target.y - 6, width: 12, height: 12)), with: .color(.cyan.opacity(0.95)))
    }

    private func arcPath(from origin: CGPoint, to target: CGPoint) -> Path {
        let dx = target.x - origin.x
        let dy = target.y - origin.y
        let distance = max(hypot(dx, dy), 1)
        let direction: CGFloat = arcDirection == .clockwise ? 1 : -1
        let normal = CGPoint(
            x: (-dy / distance) * direction,
            y: (dx / distance) * direction
        )
        let control = CGPoint(
            x: (origin.x + target.x) / 2 + normal.x * distance * CGFloat(arcBend),
            y: (origin.y + target.y) / 2 + normal.y * distance * CGFloat(arcBend)
        )

        var path = Path()
        path.move(to: origin)
        path.addQuadCurve(to: target, control: control)
        return path
    }
}

#Preview {
    ContentView()
}
