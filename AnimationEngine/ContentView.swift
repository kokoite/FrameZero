//
//  ContentView.swift
//  AnimationEngine
//
//  Created by pranjal.agarwal on 25/04/26.
//

import SwiftUI
import MotionEngineKit
import Combine
import os

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

private enum SimulatorPresentationMode {
    case composition
    case playground
}

struct ContentView: View {
    private static let engine: MotionEngine = {
        let engine = MotionEngine()
        engine.isDebugLoggingEnabled = true
        return engine
    }()
    private static let logger = Logger(subsystem: "com.pranjal.agarwal.demofirstapp.AnimationEngine", category: "FrameZeroPlayground")

    @StateObject private var previewSync: PreviewSyncClient
    @State private var frame = 0
    @State private var clip = MotionClip.wideArcPhase
    @State private var savedPhases = MotionClip.samples
    @State private var animationPhaseIDs: [UUID] = MotionClip.defaultTimelineIDs
    @State private var selectedPhaseID: UUID? = MotionClip.wideArcPhase.id
    @State private var status = "Ready"
    @State private var autoPreviewTask: Task<Void, Never>?
    @State private var presentationMode: SimulatorPresentationMode = .composition

    init() {
        _previewSync = StateObject(wrappedValue: PreviewSyncClient(engine: Self.engine))
    }

    var body: some View {
        GeometryReader { proxy in
            currentScreen(in: proxy)
            .background(Color(red: 0.055, green: 0.055, blue: 0.075))
        }
        .statusBarHidden(presentationMode == .composition)
        .onAppear {
            previewSync.onApplied = {
                presentationMode = .composition
                frame += 1
                status = previewSync.status
            }
            previewSync.connectIfNeeded()
            playAnimation()
        }
        .onChange(of: clip) { _, _ in
            syncSelectedPhase()
            scheduleAutoPreview()
        }
        .background {
            DisplayLinkTicker { dt in
                if Self.engine.tick(dt: dt) {
                    frame += 1
                }
            }
        }
    }

    @ViewBuilder
    private func currentScreen(in proxy: GeometryProxy) -> some View {
        switch presentationMode {
        case .composition:
            compositionScreen
        case .playground:
            playgroundScreen(in: proxy)
        }
    }

    private var compositionScreen: some View {
        MotionRuntimeView(engine: Self.engine, frame: frame)
            .ignoresSafeArea()
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: 0.8) {
                presentationMode = .playground
                status = previewSync.status
            }
            .accessibilityAction(named: Text("Open UI Screen")) {
                presentationMode = .playground
                status = previewSync.status
            }
            .accessibilityLabel("FrameZero render preview")
            .accessibilityHint("Long press to open playground controls")
    }

    private func playgroundScreen(in proxy: GeometryProxy) -> some View {
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
                    .frame(maxHeight: min(440, proxy.size.height * 0.48))
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
                targetOpacity: clip.opacity,
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
                    Badge(text: previewSync.badgeText, color: previewSync.isConnected ? .green : .orange)
                    Text(status)
                        .font(SampleTypography.caption)
                        .foregroundStyle(.white.opacity(0.76))
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                }
            }

            Spacer(minLength: 8)

            Button {
                presentationMode = .composition
            } label: {
                Image(systemName: "rectangle.inset.filled")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                    .overlay {
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(.white.opacity(0.16), lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Show clean render preview")

            Button {
                previewSync.reconnect()
            } label: {
                Image(systemName: previewSync.isConnected ? "dot.radiowaves.left.and.right" : "antenna.radiowaves.left.and.right.slash")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                    .overlay {
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(.white.opacity(0.16), lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Reconnect Studio preview")

            Button {
                playPrimaryAction()
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
                    playPrimaryAction()
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
            }

            ScrollView(showsIndicators: false) {
                VStack(spacing: 10) {
                    editingPhaseBanner

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
                    behaviorControl
                    phaseReadout
                    timelineMap

                    motionControls
                    timingControls
                    effectControls

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

    private var nextModeControl: some View {
        HStack(spacing: 8) {
            Text("Next Phase")
                .font(SampleTypography.controlLabel)
                .foregroundStyle(.white.opacity(0.9))

            Spacer()

            Button("Auto") {
                clip.usesTimedNext = false
            }
            .buttonStyle(.plain)
            .font(SampleTypography.smallLabel)
            .foregroundStyle(clip.usesTimedNext ? .white.opacity(0.65) : .white)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(clip.usesTimedNext ? .white.opacity(0.07) : .cyan.opacity(0.42), in: RoundedRectangle(cornerRadius: 7))
            .overlay {
                RoundedRectangle(cornerRadius: 7)
                    .stroke(clip.usesTimedNext ? .white.opacity(0.1) : .cyan.opacity(0.72), lineWidth: 1)
            }

            Button("At Time") {
                clip.usesTimedNext = true
            }
            .buttonStyle(.plain)
            .font(SampleTypography.smallLabel)
            .foregroundStyle(clip.usesTimedNext ? .white : .white.opacity(0.65))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(clip.usesTimedNext ? .cyan.opacity(0.42) : .white.opacity(0.07), in: RoundedRectangle(cornerRadius: 7))
            .overlay {
                RoundedRectangle(cornerRadius: 7)
                    .stroke(clip.usesTimedNext ? .cyan.opacity(0.72) : .white.opacity(0.1), lineWidth: 1)
            }
        }
    }

    private var editingPhaseBanner: some View {
        HStack(spacing: 8) {
            Label(editingPhaseTitle, systemImage: "scope")
                .font(SampleTypography.sectionTitle)
                .foregroundStyle(.white)

            Spacer(minLength: 8)

            Text("\(clip.motionKind.title) · \(clip.motionBehavior.title)")
                .font(SampleTypography.value)
                .foregroundStyle(.cyan.opacity(0.92))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.cyan.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.cyan.opacity(0.26), lineWidth: 1)
        }
    }

    private var motionTimingTitle: String {
        clip.motionBehavior == .spring ? "Spring Response" : "Duration"
    }

    private var modeControls: some View {
        HStack(spacing: 8) {
            HStack(spacing: 4) {
                ForEach(MotionKind.allCases) { kind in
                    SegmentPill(title: kind.title, isSelected: clip.motionKind == kind, color: kind.color) {
                        setMotionKind(kind)
                    }
                }
            }
            .padding(4)
            .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))

            HStack(spacing: 4) {
                ForEach(ArcDirectionChoice.allCases) { direction in
                    SegmentPill(title: direction.title, isSelected: clip.arcDirection == direction, color: .cyan) {
                        setArcDirection(direction)
                    }
                }
            }
            .disabled(clip.motionKind != .arc)
            .opacity(clip.motionKind == .arc ? 1 : 0.38)
            .padding(4)
            .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private var behaviorControl: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Behavior")
                .font(SampleTypography.controlLabel)
                .foregroundStyle(.white.opacity(0.9))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(MotionBehavior.allCases) { behavior in
                        SegmentPill(title: behavior.title, isSelected: clip.motionBehavior == behavior, color: .cyan) {
                            setMotionBehavior(behavior)
                        }
                    }
                }
                .padding(4)
                .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private var phaseReadout: some View {
        HStack(spacing: 8) {
            Text("Start \(n(currentPhaseStart.x)), \(n(currentPhaseStart.y))")
            Image(systemName: "arrow.right")
                .font(.system(size: 10, weight: .bold))
            Text("Move \(n(clip.x)), \(n(clip.y))")
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

    private var timelineMap: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Timeline", systemImage: "point.3.connected.trianglepath.dotted")
                    .font(SampleTypography.sectionTitle)
                    .foregroundStyle(.white.opacity(0.92))

                Spacer()

                Text(timelineTotalLabel)
                    .font(SampleTypography.value)
                    .foregroundStyle(.white.opacity(0.64))
            }

            if animationPhases.isEmpty {
                Text("No animation timeline yet. Add phases to see how the full motion is scheduled.")
                    .font(SampleTypography.caption)
                    .foregroundStyle(.white.opacity(0.58))
            } else {
                VStack(spacing: 7) {
                    ForEach(Array(animationPhases.enumerated()), id: \.element.id) { index, phase in
                        let start = timelineStartTime(forPhaseAt: index)
                        let end = start + phase.timelinePreviewDuration
                        PhaseTimelineRow(
                            index: index + 1,
                            phase: phase,
                            start: start,
                            end: end,
                            total: max(totalTimelineDuration, 0.01),
                            isSelected: selectedPhaseID == phase.id
                        ) {
                            selectPhase(phase)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.white.opacity(0.1), lineWidth: 1)
        }
    }

    private var motionControls: some View {
        ControlSection(title: "Motion", systemImage: "arrow.up.left.and.arrow.down.right") {
            VStack(spacing: 9) {
                ControlSlider(title: "X", value: $clip.x, range: -840...840, suffix: "pt")
                ControlSlider(title: "Y", value: $clip.y, range: -1200...1200, suffix: "pt")
                if clip.motionKind == .arc {
                    ControlSlider(title: "Bend", value: $clip.arcBend, range: 0.0...6.0, suffix: "x")
                }
                ControlSlider(title: "Rotate", value: $clip.rotation, range: -2160...2160, suffix: "deg")
                ControlSlider(title: "Scale", value: $clip.scale, range: 0.0...8.0, suffix: "x")
                ControlSlider(title: "Opacity", value: $clip.opacity, range: 0...1, suffix: "")
            }
        }
    }

    private var timingControls: some View {
        ControlSection(title: "Timing", systemImage: "timer") {
            VStack(spacing: 9) {
                nextModeControl
                if clip.usesTimedNext {
                    ControlSlider(title: "Next Phase At", value: $clip.phaseDuration, range: 0.0...12.0, suffix: "s")
                }
                ControlSlider(title: "Start Delay", value: $clip.startDelay, range: 0...8, suffix: "s")
                ControlSlider(title: motionTimingTitle, value: $clip.response, range: 0.05...8.0, suffix: "s")
                if clip.motionBehavior == .spring {
                    ControlSlider(title: "Damping", value: $clip.damping, range: 0.0...3.0, suffix: "")
                }
            }
        }
    }

    private var effectControls: some View {
        ControlSection(title: "Actions", systemImage: "sparkles") {
            VStack(spacing: 11) {
                ToggleRow(title: "Particles", isOn: $clip.particlesEnabled)
                if clip.particlesEnabled {
                    particleControls
                }

                ToggleRow(title: "Components", isOn: $clip.componentsEnabled)
                if clip.componentsEnabled {
                    componentControls
                }

                ToggleRow(title: "Screen Shake", isOn: $clip.screenShakeEnabled)
                if clip.screenShakeEnabled {
                    VStack(spacing: 9) {
                        ControlSlider(title: "Shake Amp", value: $clip.shakeAmplitude, range: 0...36, suffix: "pt")
                        ControlSlider(title: "Shake Time", value: $clip.shakeDuration, range: 0.05...2.0, suffix: "s")
                        ControlSlider(title: "Shake Freq", value: $clip.shakeFrequency, range: 1...60, suffix: "hz")
                    }
                }

                ToggleRow(title: "Haptic", isOn: $clip.hapticEnabled)
                if clip.hapticEnabled {
                    HStack(spacing: 4) {
                        ForEach(HapticStyleChoice.allCases) { style in
                            SegmentPill(title: style.title, isSelected: clip.hapticStyle == style, color: .cyan) {
                                clip.hapticStyle = style
                            }
                        }
                    }
                    .padding(4)
                    .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))
                }
            }
        }
    }

    private var componentControls: some View {
        VStack(spacing: 9) {
            HStack(spacing: 4) {
                ForEach(ParticleColorChoice.allCases) { color in
                    SegmentPill(title: color.title, isSelected: clip.componentColor == color, color: color.color) {
                        clip.componentColor = color
                    }
                }
            }
            .padding(4)
            .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))

            ControlSlider(title: "Comp Size", value: $clip.componentSize, range: 8...96, suffix: "pt")
            ControlSlider(title: "Comp Spread", value: $clip.componentSpread, range: 16...280, suffix: "pt")
            ControlSlider(title: "Comp Life", value: $clip.componentLifetime, range: 0.1...4.0, suffix: "s")
        }
    }

    private var particleControls: some View {
        VStack(spacing: 9) {
            HStack(spacing: 4) {
                ForEach(ParticleShapeChoice.allCases) { shape in
                    SegmentPill(title: shape.title, isSelected: clip.particleShape == shape, color: .cyan) {
                        clip.particleShape = shape
                    }
                }
            }
            .padding(4)
            .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))

            HStack(spacing: 4) {
                ForEach(ParticleColorChoice.allCases) { color in
                    SegmentPill(title: color.title, isSelected: clip.particleColor == color, color: color.color) {
                        clip.particleColor = color
                    }
                }
            }
            .padding(4)
            .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 8))

            ControlSlider(title: "Count", value: $clip.particleCount, range: 1...96, suffix: "")
            ControlSlider(title: "Size", value: $clip.particleSize, range: 2...36, suffix: "pt")
            ControlSlider(title: "Life", value: $clip.particleLifetime, range: 0.1...4.0, suffix: "s")
            ControlSlider(title: "Angle Min", value: $clip.particleAngleMin, range: -360...720, suffix: "deg")
            ControlSlider(title: "Angle Max", value: $clip.particleAngleMax, range: -360...720, suffix: "deg")
            ControlSlider(title: "Near", value: $clip.particleDistanceMin, range: 0...360, suffix: "pt")
            ControlSlider(title: "Far", value: $clip.particleDistanceMax, range: 0...720, suffix: "pt")
            ControlSlider(title: "End Scale", value: $clip.particleEndScale, range: 0...3, suffix: "x")
        }
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
                            syncSelectedPhase()
                            selectedPhaseID = nil
                            clip = saved
                            play(saved, from: currentPhaseStart)
                            Self.logger.info("[FrameZeroEditor] selected saved phase phaseName=\(saved.name, privacy: .public) kind=\(saved.motionKind.title, privacy: .public) behavior=\(saved.motionBehavior.title, privacy: .public)")
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
        animationPhaseIDs.compactMap { id in
            if id == selectedPhaseID {
                var liveClip = clip
                liveClip.id = id
                return liveClip
            }

            return savedPhases.first(where: { $0.id == id })
        }
    }

    private var selectedPhaseIndex: Int? {
        guard let selectedPhaseID else { return nil }
        return animationPhaseIDs.firstIndex(of: selectedPhaseID)
    }

    private var editingPhaseTitle: String {
        if let selectedPhaseIndex {
            return "Editing Phase \(selectedPhaseIndex + 1)"
        }

        return "Editing Draft Phase"
    }

    private var totalTimelineDuration: Double {
        animationPhases.enumerated().reduce(0) { total, item in
            max(total, timelineStartTime(forPhaseAt: item.offset) + item.element.timelinePreviewDuration)
        }
    }

    private var timelineTotalLabel: String {
        animationPhases.contains { !$0.usesTimedNext } ? "auto" : "\(timeLabel(totalTimelineDuration))s"
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

    private func syncSelectedPhase() {
        guard let selectedPhaseID,
              let index = savedPhases.firstIndex(where: { $0.id == selectedPhaseID })
        else {
            return
        }

        var synced = clip
        synced.id = selectedPhaseID
        savedPhases[index] = synced
    }

    private func setMotionKind(_ kind: MotionKind) {
        let old = clip.motionKind
        clip.motionKind = kind
        logEditorMutation("kind", from: old.title, to: kind.title)
    }

    private func setArcDirection(_ direction: ArcDirectionChoice) {
        let old = clip.arcDirection
        clip.arcDirection = direction
        logEditorMutation("arcDirection", from: old.rawValue, to: direction.rawValue)
    }

    private func setMotionBehavior(_ behavior: MotionBehavior) {
        let old = clip.motionBehavior
        clip.motionBehavior = behavior
        logEditorMutation("behavior", from: old.title, to: behavior.title)
    }

    private func logEditorMutation(_ field: String, from oldValue: String, to newValue: String) {
        Self.logger.info("[FrameZeroEditor] \(editingPhaseTitle, privacy: .public) phaseName=\(clip.name, privacy: .public) field=\(field, privacy: .public) from=\(oldValue, privacy: .public) to=\(newValue, privacy: .public)")
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
        syncSelectedPhase()
        selectedPhaseID = item.id
        clip = item
        status = "Editing \(item.name)"
        Self.logger.info("[FrameZeroEditor] selected \(self.editingPhaseTitle, privacy: .public) phaseName=\(item.name, privacy: .public) kind=\(item.motionKind.title, privacy: .public) behavior=\(item.motionBehavior.title, privacy: .public)")
    }

    private func playCurrentPhase() {
        play(clip, from: currentPhaseStart)
    }

    private func playPrimaryAction() {
        if animationPhaseIDs.isEmpty {
            playCurrentPhase()
        } else {
            playAnimation()
        }
    }

    private func play(_ item: MotionClip, from start: MotionEndpoint = .origin) {
        do {
            let document = MotionDocumentFactory.document(for: [item], initial: start)
            logPlayRequest(name: item.name, clips: [item], initial: start, document: document)
            try Self.engine.load(jsonString: document)
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
            let document = MotionDocumentFactory.document(for: clips)
            logPlayRequest(name: "animation", clips: clips, initial: .origin, document: document)
            try Self.engine.load(jsonString: document)
            status = "Playing animation: \(clips.map(\.name).joined(separator: " -> "))"
            frame += 1
        } catch {
            status = error.localizedDescription
        }
    }

    private func logPlayRequest(name: String, clips: [MotionClip], initial: MotionEndpoint, document: String) {
        Self.logger.info("Loading \(name, privacy: .public) with \(clips.count, privacy: .public) phase(s), jsonBytes=\(document.utf8.count, privacy: .public)")

        let summaries = MotionDocumentFactory.debugPhaseSummaries(for: clips, initial: initial)
        for summary in summaries {
            Self.logger.info("\(summary, privacy: .public)")
        }

        let timeline = MotionDocumentFactory.debugTimelineSummaries(for: clips, initial: initial)
        for line in timeline {
            Self.logger.info("\(line, privacy: .public)")
        }
    }

    private func scheduleAutoPreview() {
        autoPreviewTask?.cancel()
        autoPreviewTask = Task { @MainActor in
            guard !Task.isCancelled else { return }
            playPrimaryAction()
        }
    }

    private func startEndpoint(forPhaseAt index: Int) -> MotionEndpoint {
        endpoint(after: Array(animationPhases.prefix(index)))
    }

    private func timelineStartTime(forPhaseAt index: Int) -> Double {
        let clips = animationPhases
        guard clips.indices.contains(index) else { return 0 }

        let previousTiming = clips.prefix(index).reduce(0) { total, phase in
            total + phase.startDelay + phase.timelinePreviewDuration
        }

        return previousTiming + clips[index].startDelay
    }

    private func endpoint(after clips: [MotionClip]) -> MotionEndpoint {
        clips.reduce(MotionEndpoint.origin) { endpoint, clip in
            endpoint.advanced(by: clip)
        }
    }

    private func timeLabel(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    private func n(_ value: Double) -> String {
        String(format: "%.0f", value)
    }
}

@MainActor
private final class PreviewSyncClient: ObservableObject {
    @Published private(set) var status = "Studio offline"
    @Published private(set) var isConnected = false
    @Published private(set) var lastAppliedRevision = 0

    var onApplied: (() -> Void)?

    private let engine: MotionEngine
    private let logger = Logger(subsystem: "com.pranjal.agarwal.demofirstapp.AnimationEngine", category: "FrameZeroPreviewSync")
    private var task: URLSessionWebSocketTask?
    private var reconnectTask: Task<Void, Never>?
    private var isConnecting = false
    private var schemaMismatched = false

    var badgeText: String {
        if isConnected {
            return lastAppliedRevision > 0 ? "STUDIO r\(lastAppliedRevision)" : "STUDIO LIVE"
        }
        return "STUDIO OFF"
    }

    init(engine: MotionEngine) {
        self.engine = engine
    }

    func connectIfNeeded() {
        guard task == nil, !isConnecting else { return }
        connect()
    }

    func reconnect() {
        disconnect()
        connect()
    }

    private func connect() {
        guard let url = URL(string: "ws://127.0.0.1:8787/framezero/preview?session=local&client=ios-simulator&protocol=1") else {
            status = "Invalid Studio bridge URL"
            return
        }

        isConnecting = true
        status = "Connecting Studio"
        let task = URLSession.shared.webSocketTask(with: url)
        self.task = task
        task.resume()
        isConnecting = false
        isConnected = true
        status = "Studio connected"
        logger.info("preview socket open url=\(url.absoluteString, privacy: .public)")
        send(type: "hello", payload: [
            "client": "ios-simulator",
            "appVersion": "0.1.0",
            "engineVersion": "MotionEngineKit",
            "schemaVersions": [1],
            "lastAppliedRevision": lastAppliedRevision
        ])
        receiveNext(task)
    }

    private func disconnect() {
        reconnectTask?.cancel()
        reconnectTask = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        isConnecting = false
        isConnected = false
        status = "Studio offline"
    }

    private func receiveNext(_ activeTask: URLSessionWebSocketTask) {
        activeTask.receive { [weak self] result in
            guard let client = self else { return }
            Task { @MainActor in
                guard client.task === activeTask else { return }

                switch result {
                case .success(.string(let text)):
                    client.handle(text: text)
                    client.receiveNext(activeTask)
                case .success(.data(let data)):
                    if let text = String(data: data, encoding: .utf8) {
                        client.handle(text: text)
                    }
                    client.receiveNext(activeTask)
                case .failure(let error):
                    client.handleDisconnect(error)
                @unknown default:
                    client.receiveNext(activeTask)
                }
            }
        }
    }

    private func handle(text: String) {
        guard let data = text.data(using: .utf8),
              let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = envelope["type"] as? String
        else {
            logger.error("preview socket received malformed envelope")
            return
        }

        switch type {
        case "hello.ack":
            if let payload = envelope["payload"] as? [String: Any],
               let ackVersion = payload["schemaVersion"] as? Int,
               ackVersion != 1 {
                schemaMismatched = true
                status = "Studio schema mismatch (v\(ackVersion))"
                logger.error("preview schema mismatch ack=\(ackVersion, privacy: .public) expected=1")
            } else {
                schemaMismatched = false
                status = "Studio connected"
            }
        case "document.update":
            applyDocumentUpdate(envelope["payload"])
        case "playback.command":
            send(type: "playback.result", payload: [
                "status": "applied",
                "command": "replay",
                "revision": lastAppliedRevision
            ])
            onApplied?()
        case "error":
            status = "Studio bridge error"
            logger.error("preview bridge error \(text, privacy: .public)")
        default:
            break
        }
    }

    private func applyDocumentUpdate(_ payload: Any?) {
        if schemaMismatched {
            logger.warning("ignored document.update; schemaVersion handshake failed")
            return
        }

        guard let payload = payload as? [String: Any],
              let revision = payload["revision"] as? Int,
              let json = payload["json"]
        else {
            reject(revision: 0, hash: nil, message: "Missing document.update payload")
            return
        }

        let hash = payload["documentHash"] as? String

        guard revision > lastAppliedRevision else {
            logger.info("ignored stale preview revision=\(revision, privacy: .public) current=\(self.lastAppliedRevision, privacy: .public)")
            return
        }

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
            guard let jsonString = String(data: jsonData, encoding: .utf8) else {
                throw PreviewSyncError.invalidUTF8
            }

            try engine.load(jsonString: jsonString)
            lastAppliedRevision = revision
            status = "Studio applied r\(revision)"
            logger.info("applied preview revision=\(revision, privacy: .public) bytes=\(jsonData.count, privacy: .public)")
            send(type: "document.result", payload: [
                "revision": revision,
                "documentHash": hash ?? "unknown",
                "status": "applied",
                "runtime": runtimeSummary(json)
            ])
            onApplied?()
        } catch {
            reject(revision: revision, hash: hash, message: error.localizedDescription)
        }
    }

    private func runtimeSummary(_ json: Any) -> [String: Any] {
        guard let document = json as? [String: Any] else {
            return [:]
        }

        return [
            "root": document["root"] as? String ?? "unknown",
            "nodeCount": (document["nodes"] as? [Any])?.count ?? 0,
            "machineCount": (document["machines"] as? [Any])?.count ?? 0
        ]
    }

    private func reject(revision: Int, hash: String?, message: String) {
        status = "Studio rejected r\(revision)"
        logger.error("rejected preview revision=\(revision, privacy: .public) error=\(message, privacy: .public)")
        send(type: "document.result", payload: [
            "revision": revision,
            "documentHash": hash ?? "unknown",
            "status": "rejected",
            "error": [
                "code": "validation_failed",
                "message": message
            ],
            "keptRevision": lastAppliedRevision
        ])
    }

    private func send(type: String, payload: Any) {
        guard let task else { return }

        let envelope: [String: Any] = [
            "protocolVersion": 1,
            "sessionId": "local",
            "messageId": UUID().uuidString,
            "type": type,
            "sentAt": ISO8601DateFormatter().string(from: Date()),
            "payload": payload
        ]

        guard JSONSerialization.isValidJSONObject(envelope),
              let data = try? JSONSerialization.data(withJSONObject: envelope),
              let text = String(data: data, encoding: .utf8)
        else {
            logger.error("could not encode preview envelope type=\(type, privacy: .public)")
            return
        }

        task.send(.string(text)) { [weak self] error in
            guard let error else { return }
            guard let client = self else { return }
            Task { @MainActor in
                client.logger.error("preview socket send failed type=\(type, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func handleDisconnect(_ error: Error) {
        logger.error("preview socket closed error=\(error.localizedDescription, privacy: .public)")
        task = nil
        isConnected = false
        status = "Studio reconnecting"
        reconnectTask?.cancel()
        reconnectTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            guard !Task.isCancelled else { return }
            connectIfNeeded()
        }
    }
}

private enum PreviewSyncError: LocalizedError {
    case invalidUTF8

    var errorDescription: String? {
        switch self {
        case .invalidUTF8:
            return "Preview JSON could not be encoded as UTF-8"
        }
    }
}

private struct PhaseTimelineRow: View {
    let index: Int
    let phase: MotionClip
    let start: Double
    let end: Double
    let total: Double
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text("\(index)")
                        .font(SampleTypography.value)
                        .foregroundStyle(.white)
                        .frame(width: 20, height: 20)
                        .background(phase.motionKind.color.opacity(0.32), in: Circle())

                    VStack(alignment: .leading, spacing: 1) {
                        Text(phase.name)
                            .font(SampleTypography.smallLabel)
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)

                        Text("\(phase.motionKind.title) · \(phase.motionBehavior.title) · \(time(start))s to \(time(end))s")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                            .foregroundStyle(.white.opacity(0.5))
                    }

                    Spacer(minLength: 6)

                    Text(phase.nextLabel)
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.56))
                }

                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(.white.opacity(0.08))

                        Capsule()
                            .fill(phase.motionKind.color.opacity(0.72))
                            .frame(width: barWidth(in: proxy.size.width))
                            .offset(x: barOffset(in: proxy.size.width))
                    }
                }
                .frame(height: 5)
            }
            .padding(8)
            .background(
                isSelected ? Color.cyan.opacity(0.13) : Color.white.opacity(0.045),
                in: RoundedRectangle(cornerRadius: 8)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.cyan.opacity(0.34) : Color.white.opacity(0.08), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }

    private func time(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    private func barOffset(in width: CGFloat) -> CGFloat {
        guard total > 0 else { return 0 }
        return width * CGFloat(max(start / total, 0))
    }

    private func barWidth(in width: CGFloat) -> CGFloat {
        guard total > 0 else { return width }
        let normalized = max((end - start) / total, 0.02)
        return width * CGFloat(normalized)
    }
}

private struct ControlSlider: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let suffix: String
    let help: String?

    init(
        title: String,
        value: Binding<Double>,
        range: ClosedRange<Double>,
        suffix: String,
        help: String? = nil
    ) {
        self.title = title
        self._value = value
        self.range = range
        self.suffix = suffix
        self.help = help
    }

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(SampleTypography.controlLabel)
                        .foregroundStyle(.white.opacity(0.9))

                    if let help {
                        Text(help)
                            .font(SampleTypography.smallLabel)
                            .foregroundStyle(.white.opacity(0.5))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Spacer()

                HStack(spacing: 5) {
                    TextField("", value: $value, format: .number.precision(.fractionLength(2)))
                        .font(SampleTypography.value)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.trailing)
                        .keyboardType(.numbersAndPunctuation)
                        .frame(width: 72)
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

private struct ControlSection<Content: View>: View {
    let title: String
    let systemImage: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Label(title, systemImage: systemImage)
                .font(SampleTypography.sectionTitle)
                .foregroundStyle(.white.opacity(0.94))

            content
        }
        .padding(10)
        .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.white.opacity(0.1), lineWidth: 1)
        }
    }
}

private struct ToggleRow: View {
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(title, isOn: $isOn)
            .font(SampleTypography.controlLabel)
            .foregroundStyle(.white.opacity(0.9))
            .tint(.cyan)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 8))
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
    var usesTimedNext: Bool
    var startDelay: Double
    var motionBehavior: MotionBehavior
    var response: Double
    var damping: Double
    var particlesEnabled = false
    var particleShape = ParticleShapeChoice.circle
    var particleColor = ParticleColorChoice.cyan
    var particleCount = 18.0
    var particleSize = 8.0
    var particleLifetime = 0.62
    var particleAngleMin = 190.0
    var particleAngleMax = 340.0
    var particleDistanceMin = 24.0
    var particleDistanceMax = 120.0
    var particleEndScale = 0.12
    var componentsEnabled = false
    var componentColor = ParticleColorChoice.blue
    var componentSize = 34.0
    var componentSpread = 88.0
    var componentLifetime = 0.72
    var screenShakeEnabled = false
    var shakeAmplitude = 5.0
    var shakeDuration = 0.2
    var shakeFrequency = 22.0
    var hapticEnabled = false
    var hapticStyle = HapticStyleChoice.medium

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
        usesTimedNext: false,
        startDelay: 0,
        motionBehavior: .spring,
        response: 0.5,
        damping: 0.72
    )

    static let wideArcPhase = MotionClip(
        id: UUID(),
        name: "Wide Arc Launch",
        motionKind: .arc,
        arcDirection: .clockwise,
        arcBend: 0.56,
        x: 150,
        y: -120,
        rotation: 0,
        scale: 1,
        opacity: 1,
        phaseDuration: 1,
        usesTimedNext: true,
        startDelay: 0,
        motionBehavior: .spring,
        response: 1,
        damping: 0.72
    )

    static let scaleJigglePhase: MotionClip = {
        var clip = MotionClip(
            id: UUID(),
            name: "Scale Jiggle Burst",
            motionKind: .jiggle,
            arcDirection: .clockwise,
            arcBend: 0.56,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1.2,
            opacity: 1,
            phaseDuration: 1,
            usesTimedNext: false,
            startDelay: 0,
            motionBehavior: .spring,
            response: 1,
            damping: 0.64
        )
        clip.particlesEnabled = true
        clip.particleCount = 28
        clip.particleLifetime = 0.78
        clip.particleAngleMin = 0
        clip.particleAngleMax = 360
        clip.particleDistanceMin = 30
        clip.particleDistanceMax = 150
        clip.screenShakeEnabled = true
        clip.shakeAmplitude = 4
        clip.shakeDuration = 0.18
        clip.hapticEnabled = true
        clip.hapticStyle = .success
        return clip
    }()

    static let particleBurstPhase: MotionClip = {
        var clip = MotionClip(
            id: UUID(),
            name: "Particle Burst",
            motionKind: .move,
            arcDirection: .clockwise,
            arcBend: 0.56,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: 1,
            phaseDuration: 0.55,
            usesTimedNext: false,
            startDelay: 0,
            motionBehavior: .easeOut,
            response: 0.55,
            damping: 0.7
        )
        clip.particlesEnabled = true
        clip.particleCount = 42
        clip.particleSize = 7
        clip.particleLifetime = 0.75
        clip.particleAngleMin = 0
        clip.particleAngleMax = 360
        clip.particleDistanceMin = 24
        clip.particleDistanceMax = 165
        return clip
    }()

    static let screenShakePhase: MotionClip = {
        var clip = MotionClip(
            id: UUID(),
            name: "Screen Shake",
            motionKind: .move,
            arcDirection: .clockwise,
            arcBend: 0.56,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1.04,
            opacity: 1,
            phaseDuration: 0.35,
            usesTimedNext: false,
            startDelay: 0,
            motionBehavior: .easeOut,
            response: 0.35,
            damping: 0.7
        )
        clip.screenShakeEnabled = true
        clip.shakeAmplitude = 9
        clip.shakeDuration = 0.35
        clip.shakeFrequency = 26
        return clip
    }()

    static let hapticPulsePhase: MotionClip = {
        var clip = MotionClip(
            id: UUID(),
            name: "Haptic Pulse",
            motionKind: .move,
            arcDirection: .clockwise,
            arcBend: 0.56,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1.14,
            opacity: 1,
            phaseDuration: 0.28,
            usesTimedNext: false,
            startDelay: 0,
            motionBehavior: .easeOut,
            response: 0.28,
            damping: 0.7
        )
        clip.hapticEnabled = true
        clip.hapticStyle = .medium
        return clip
    }()

    static let twinComponentsPhase: MotionClip = {
        var clip = MotionClip(
            id: UUID(),
            name: "Twin Components",
            motionKind: .move,
            arcDirection: .clockwise,
            arcBend: 0.56,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: 1,
            phaseDuration: 0.72,
            usesTimedNext: false,
            startDelay: 0,
            motionBehavior: .easeOut,
            response: 0.72,
            damping: 0.7
        )
        clip.componentsEnabled = true
        clip.componentColor = .blue
        clip.componentSize = 38
        clip.componentSpread = 96
        clip.componentLifetime = 0.72
        return clip
    }()

    static let samples = [
        demo,
        wideArcPhase,
        scaleJigglePhase,
        particleBurstPhase,
        screenShakePhase,
        hapticPulsePhase,
        twinComponentsPhase,
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
            usesTimedNext: false,
            startDelay: 0,
            motionBehavior: .spring,
            response: 0.32,
            damping: 0.6
        ),
        MotionClip(
            id: UUID(),
            name: "Sink Fade",
            motionKind: .move,
            arcDirection: .anticlockwise,
            arcBend: 0.72,
            x: -72,
            y: 142,
            rotation: -35,
            scale: 0.45,
            opacity: 0.28,
            phaseDuration: 0.45,
            usesTimedNext: false,
            startDelay: 0,
            motionBehavior: .spring,
            response: 0.62,
            damping: 0.82
        )
    ]

    static let defaultTimelineIDs = [
        wideArcPhase.id,
        scaleJigglePhase.id
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
        copy.usesTimedNext = false
        copy.startDelay = 0
        return copy
    }

    var timelineDuration: Double {
        phaseDuration
    }

    var timelinePreviewDuration: Double {
        usesTimedNext ? phaseDuration : response
    }

    var nextLabel: String {
        usesTimedNext ? "next +\(String(format: "%.2f", phaseDuration))s" : "next auto"
    }
}

private enum ParticleShapeChoice: String, CaseIterable, Identifiable {
    case circle
    case square

    var id: String { rawValue }

    var title: String {
        switch self {
        case .circle: "Circle"
        case .square: "Square"
        }
    }

    var nodeKind: String {
        switch self {
        case .circle: "circle"
        case .square: "roundedRectangle"
        }
    }
}

private enum ParticleColorChoice: String, CaseIterable, Identifiable {
    case cyan
    case blue
    case white
    case pink
    case lime

    var id: String { rawValue }

    var title: String {
        switch self {
        case .cyan: "Cyan"
        case .blue: "Blue"
        case .white: "White"
        case .pink: "Pink"
        case .lime: "Lime"
        }
    }

    var hex: String {
        switch self {
        case .cyan: "#38BDF8"
        case .blue: "#60A5FA"
        case .white: "#FFFFFF"
        case .pink: "#F472B6"
        case .lime: "#A3E635"
        }
    }

    var color: Color {
        switch self {
        case .cyan: .cyan
        case .blue: .blue
        case .white: .white
        case .pink: .pink
        case .lime: .green
        }
    }
}

private enum HapticStyleChoice: String, CaseIterable, Identifiable {
    case light
    case medium
    case heavy
    case success
    case warning
    case error

    var id: String { rawValue }

    var title: String {
        switch self {
        case .light: "Light"
        case .medium: "Medium"
        case .heavy: "Heavy"
        case .success: "Success"
        case .warning: "Warning"
        case .error: "Error"
        }
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
            usesTimedNext: false,
            startDelay: 0,
            motionBehavior: .spring,
            response: 0.5,
            damping: 0.72
        )
    }
}

private enum MotionBehavior: String, CaseIterable, Identifiable {
    case spring
    case linear
    case easeIn
    case easeOut
    case easeInOut

    var id: String { rawValue }

    var title: String {
        switch self {
        case .spring: "Spring"
        case .linear: "Linear"
        case .easeIn: "Ease In"
        case .easeOut: "Ease Out"
        case .easeInOut: "Ease InOut"
        }
    }

    var easingName: String? {
        switch self {
        case .spring: nil
        case .linear: "linear"
        case .easeIn: "easeIn"
        case .easeOut: "easeOut"
        case .easeInOut: "easeInOut"
        }
    }
}

private enum MotionKind: String, CaseIterable, Identifiable {
    case move
    case arc
    case jiggle

    var id: String { rawValue }

    var title: String {
        switch self {
        case .move: "Move"
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
    struct DebugTransitionSummary {
        let index: Int
        let clip: MotionClip
        let start: MotionEndpoint
        let end: MotionEndpoint
        let trigger: String
        let delay: Double
        let motion: String
        let arcBend: Double?
        let jiggleDuration: Double?

        var message: String {
            var parts = [
                "phase=\(index + 1)",
                "name=\(clip.name)",
                "kind=\(clip.motionKind.title)",
                "behavior=\(clip.motionBehavior.title)",
                "start=(\(n(start.x)),\(n(start.y)))",
                "move=(\(n(clip.x)),\(n(clip.y)))",
                "end=(\(n(end.x)),\(n(end.y)))",
                "rotation=\(n(clip.rotation))",
                "scale=\(n(clip.scale))",
                "opacity=\(n(clip.opacity))",
                "trigger=\(trigger)",
                "delay=\(n(delay))",
                "nextMode=\(clip.usesTimedNext ? "atTime" : "auto")",
                "nextAfter=\(n(clip.phaseDuration))",
                "motion=\(motion)"
            ]

            if let arcBend {
                parts.append("arcDirection=\(clip.arcDirection.rawValue)")
                parts.append("arcBend=\(n(arcBend))")
            }

            if let jiggleDuration {
                parts.append("jiggleDuration=\(n(jiggleDuration))")
                parts.append("jiggleAmplitude=18")
                parts.append("jiggleCycles=8")
            }

            if clip.particlesEnabled {
                parts.append("particles=count \(Int(clip.particleCount.rounded())) size \(n(clip.particleSize)) color \(clip.particleColor.rawValue)")
            }

            if clip.screenShakeEnabled {
                parts.append("screenShake=amp \(n(clip.shakeAmplitude)) duration \(n(clip.shakeDuration))")
            }

            if clip.hapticEnabled {
                parts.append("haptic=\(clip.hapticStyle.rawValue)")
            }

            return "[FrameZeroPlayground] " + parts.joined(separator: " ")
        }
    }

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
            { "id": "timeline", "type": "after" },
            { "id": "settled", "type": "automatic" }
          ],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """
    }

    static func debugPhaseSummaries(for clips: [MotionClip], initial: MotionEndpoint = .origin) -> [String] {
        transitionSummaries(for: clips, initial: initial).map(\.message)
    }

    static func debugTimelineSummaries(for clips: [MotionClip], initial: MotionEndpoint = .origin) -> [String] {
        let summaries = transitionSummaries(for: clips, initial: initial)
        guard !summaries.isEmpty else {
            return ["[FrameZeroTimeline] empty"]
        }

        var knownAbsoluteStart = 0.0
        var isAbsoluteStartKnown = true
        var lines: [String] = ["[FrameZeroTimeline] phases=\(summaries.count)"]

        for summary in summaries {
            let startLabel: String
            if summary.index == 0 {
                knownAbsoluteStart = summary.delay
                startLabel = "\(n(knownAbsoluteStart))s"
            } else if summary.trigger == "timeline", isAbsoluteStartKnown {
                knownAbsoluteStart += summary.delay
                startLabel = "\(n(knownAbsoluteStart))s"
            } else {
                isAbsoluteStartKnown = false
                startLabel = "after previous settles + \(n(summary.delay))s"
            }

            let durationLabel = summary.clip.motionBehavior == .spring
                ? "response \(n(summary.clip.response))s"
                : "duration \(n(summary.clip.response))s"

            lines.append(
                "[FrameZeroTimeline] phase=\(summary.index + 1) name=\(summary.clip.name) startsAt=\(startLabel) trigger=\(summary.trigger) transitionDelay=\(n(summary.delay)) behavior=\(summary.clip.motionBehavior.title) \(durationLabel) next=\(summary.clip.nextLabel)"
            )
        }

        return lines
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
        transitionSummaries(for: clips, initial: initial).map { summary in
            let index = summary.index
            let clip = summary.clip
            let bend = summary.arcBend ?? 0
            let motion = summary.motion
            let motionDuration = summary.jiggleDuration ?? motionDuration(for: clip)
            let arcs = clip.motionKind == .arc ? """
        ,
                  "arcs": [
                    {
                      "select": { "id": "orb" },
                      "x": "offset.x",
                      "y": "offset.y",
                      "direction": "\(clip.arcDirection.rawValue)",
                      "bend": \(n(bend)),
                      "motion": \(motion)
                    },
                    {
                      "select": { "id": "marker" },
                      "x": "offset.x",
                      "y": "offset.y",
                      "direction": "\(clip.arcDirection.rawValue)",
                      "bend": \(n(bend)),
                      "motion": \(motion)
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
                      "duration": \(n(motionDuration)),
                      "cycles": 8,
                      "startDirection": "anticlockwise",
                      "decay": 0.18
                    },
                    {
                      "select": { "id": "marker", "properties": ["rotation"] },
                      "amplitude": 18,
                      "duration": \(n(motionDuration)),
                      "cycles": 8,
                      "startDirection": "anticlockwise",
                      "decay": 0.18
                    }
                  ]
        """ : """
        ,
                  "jiggles": []
        """

            let actions = actionJSON(for: clip, index: index)

            return """
                {
                  "id": "transition\(index)",
                  "from": "state\(index)",
                  "to": "state\(index + 1)",
                  "trigger": "\(summary.trigger)",
                  "delay": \(n(summary.delay)),
                  "rules": [
                    {
                      "select": { "role": "target", "properties": ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
                      "motion": \(motion)
                    },
                    {
                      "select": { "role": "marker", "properties": ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
                      "motion": \(motion)
                    }
                  ]\(arcs)\(jiggles),
                  "enter": [],
                  "exit": [],
                  "spawns": [],
                  "actions": \(actions)
                }
        """
        }
        .joined(separator: ",\n")
    }

    private static func transitionSummaries(for clips: [MotionClip], initial: MotionEndpoint) -> [DebugTransitionSummary] {
        clips.enumerated().map { index, clip in
            let start = endpoint(after: Array(clips.prefix(index)), initial: initial)
            let end = start.advanced(by: clip)
            let distance = max(hypot(end.x - start.x, end.y - start.y), 1)
            let previousClip = index > 0 ? clips[index - 1] : nil
            let isTimedTransition = previousClip?.usesTimedNext ?? true
            let trigger = isTimedTransition ? "timeline" : "settled"
            let delay = index == 0
                ? clip.startDelay
                : (isTimedTransition ? (previousClip?.timelineDuration ?? 0) : 0) + clip.startDelay
            let arcBend = clip.motionKind == .arc ? distance * clip.arcBend : nil
            let jiggleDuration = clip.motionKind == .jiggle ? motionDuration(for: clip) : nil

            return DebugTransitionSummary(
                index: index,
                clip: clip,
                start: start,
                end: end,
                trigger: trigger,
                delay: delay,
                motion: motionJSON(for: clip),
                arcBend: arcBend,
                jiggleDuration: jiggleDuration
            )
        }
    }

    private static func motionJSON(for clip: MotionClip) -> String {
        if clip.motionBehavior == .spring {
            return #"{ "type": "spring", "response": \#(n(clip.response)), "dampingFraction": \#(n(clip.damping)) }"#
        }

        let easing = clip.motionBehavior.easingName ?? "easeInOut"
        return #"{ "type": "timed", "duration": \#(n(clip.response)), "easing": "\#(easing)" }"#
    }

    private static func motionDuration(for clip: MotionClip) -> Double {
        clip.response
    }

    private static func actionJSON(for clip: MotionClip, index: Int) -> String {
        var actions: [String] = []

        if clip.hapticEnabled {
            actions.append(#"{ "type": "haptic", "style": "\#(clip.hapticStyle.rawValue)", "intensity": 0.82 }"#)
        }

        if clip.screenShakeEnabled {
            actions.append("""
            {
              "type": "screenShake",
              "amplitude": \(n(clip.shakeAmplitude)),
              "duration": \(n(clip.shakeDuration)),
              "frequency": \(n(clip.shakeFrequency)),
              "decay": 1.35
            }
            """)
        }

        if clip.particlesEnabled {
            let count = max(Int(clip.particleCount.rounded()), 1)
            let size = max(clip.particleSize, 0.1)
            let lifetime = max(clip.particleLifetime, 0.1)
            let near = min(clip.particleDistanceMin, clip.particleDistanceMax)
            let far = max(clip.particleDistanceMin, clip.particleDistanceMax)
            let angleMin = min(clip.particleAngleMin, clip.particleAngleMax)
            let angleMax = max(clip.particleAngleMin, clip.particleAngleMax)

            actions.append("""
            {
              "type": "emitParticles",
              "id": "phase\(index)Particles",
              "selector": { "id": "orb" },
              "count": \(count),
              "angle": { "min": \(n(angleMin)), "max": \(n(angleMax)) },
              "distance": { "min": \(n(near)), "max": \(n(far)) },
              "duration": \(n(lifetime)),
              "particle": {
                "kind": "\(clip.particleShape.nodeKind)",
                "layout": {
                  "width": \(n(size)),
                  "height": \(n(size))
                },
                "style": {
                  "cornerRadius": \(n(size * 0.22)),
                  "backgroundColor": "\(clip.particleColor.hex)"
                },
                "from": {
                  "scale": 1,
                  "opacity": 0.96
                },
                "to": {
                  "scale": \(n(clip.particleEndScale)),
                  "opacity": 0
                },
                "motion": { "type": "timed", "duration": \(n(lifetime)), "easing": "easeOut" },
                "lifetime": \(n(lifetime))
              }
            }
            """)
        }

        if clip.componentsEnabled {
            let size = max(clip.componentSize, 1)
            let spread = max(clip.componentSpread, 1)
            let lifetime = max(clip.componentLifetime, 0.1)
            let pillWidth = max(size * 2.4, 54)
            let pillHeight = max(size * 0.86, 24)

            actions.append("""
            {
              "type": "spawnComponents",
              "id": "phase\(index)Components",
              "selector": { "id": "orb" },
              "components": [
                {
                  "id": "leftOrb",
                  "kind": "circle",
                  "layout": {
                    "width": \(n(size)),
                    "height": \(n(size))
                  },
                  "style": {
                    "backgroundColor": "\(clip.componentColor.hex)"
                  },
                  "from": {
                    "offset.x": 0,
                    "offset.y": 0,
                    "scale": 0.62,
                    "opacity": 1
                  },
                  "to": {
                    "offset.x": \(n(-spread)),
                    "offset.y": \(n(-spread * 0.38)),
                    "scale": 1.22,
                    "opacity": 0
                  },
                  "motion": { "type": "timed", "duration": \(n(lifetime)), "easing": "easeOut" },
                  "lifetime": \(n(lifetime))
                },
                {
                  "id": "scoreTag",
                  "kind": "text",
                  "layout": {
                    "width": \(n(pillWidth)),
                    "height": \(n(pillHeight))
                  },
                  "style": {
                    "text": "+10",
                    "foregroundColor": "#FFFFFF",
                    "backgroundColor": "\(clip.componentColor.hex)"
                  },
                  "from": {
                    "offset.x": 0,
                    "offset.y": 0,
                    "scale": 0.72,
                    "opacity": 1
                  },
                  "to": {
                    "offset.x": \(n(spread)),
                    "offset.y": \(n(-spread * 0.55)),
                    "scale": 1,
                    "opacity": 0
                  },
                  "motion": { "type": "timed", "duration": \(n(lifetime)), "easing": "easeOut" },
                  "lifetime": \(n(lifetime))
                }
              ]
            }
            """)
        }

        guard !actions.isEmpty else { return "[]" }

        return """
        [
        \(actions.joined(separator: ",\n"))
        ]
        """
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
    let targetOpacity: Double
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
        let targetGuideOpacity = min(max(targetOpacity, 0), 1) * 0.55
        if targetGuideOpacity > 0.01 {
            context.stroke(Path(ellipseIn: CGRect(x: target.x - 7, y: target.y - 7, width: 14, height: 14)), with: .color(.cyan.opacity(targetGuideOpacity)), lineWidth: 1.5)
        }
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
