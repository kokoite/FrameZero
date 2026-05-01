import XCTest
@testable import MotionEngineKit

final class MotionSchemaBoundsTests: XCTestCase {
    private let dec = JSONDecoder()
    private func data(_ s: String) -> Data { Data(s.utf8) }

    // MARK: - Opacity bounds (MotionFill)

    private func fillJSON(opacity: String) -> String {
        return ##"{"type":"solid","color":"#ffffff","opacity":\##(opacity)}"##
    }

    func testOpacityRejectsNegative() {
        XCTAssertThrowsError(try dec.decode(MotionFill.self, from: data(fillJSON(opacity: "-0.01"))))
    }

    func testOpacityRejectsAboveOne() {
        XCTAssertThrowsError(try dec.decode(MotionFill.self, from: data(fillJSON(opacity: "1.0001"))))
    }

    func testOpacityRejectsNaN() {
        let encoder = JSONEncoder()
        encoder.nonConformingFloatEncodingStrategy = .convertToString(positiveInfinity: "+Inf", negativeInfinity: "-Inf", nan: "NaN")
        struct W: Encodable { let type: String; let color: String; let opacity: Double }
        let raw = try! encoder.encode(W(type: "solid", color: "#ffffff", opacity: .nan))
        XCTAssertThrowsError(try dec.decode(MotionFill.self, from: raw))
    }

    func testOpacityAcceptsBoundary() throws {
        let f0 = try dec.decode(MotionFill.self, from: data(fillJSON(opacity: "0")))
        XCTAssertEqual(f0.opacity, 0)
        let f1 = try dec.decode(MotionFill.self, from: data(fillJSON(opacity: "1")))
        XCTAssertEqual(f1.opacity, 1)
    }

    // MARK: - dampingFraction bounds (SpringSpec)

    private func springJSON(damping: String) -> String {
        return #"{"type":"spring","response":0.4,"dampingFraction":\#(damping)}"#
    }

    func testDampingFractionRejectsZero() {
        XCTAssertThrowsError(try dec.decode(SpringSpec.self, from: data(springJSON(damping: "0"))))
    }

    func testDampingFractionAcceptsOne() throws {
        let s = try dec.decode(SpringSpec.self, from: data(springJSON(damping: "1.0")))
        XCTAssertEqual(s.dampingFraction, 1.0)
    }

    func testDampingFractionRejectsNegative() {
        XCTAssertThrowsError(try dec.decode(SpringSpec.self, from: data(springJSON(damping: "-0.1"))))
    }

    // MARK: - Trail bounds (MotionTrailSpec)

    private func trailJSON(_ body: String) -> String {
        return "{\(body)}"
    }

    func testTrailOpacityBaseRejectsOutOfBounds() {
        XCTAssertThrowsError(try dec.decode(MotionTrailSpec.self, from: data(trailJSON(#""opacityBase":-0.1"#))))
        XCTAssertThrowsError(try dec.decode(MotionTrailSpec.self, from: data(trailJSON(#""opacityBase":1.1"#))))
    }

    func testTrailOpacityBaseAcceptsUnitIntervalValue() throws {
        let trail = try dec.decode(MotionTrailSpec.self, from: data(trailJSON(#""opacityBase":0.5"#)))
        XCTAssertEqual(trail.opacityBase, 0.5)
    }

    func testTrailOpacityRangeAcceptsNegativeDelta() throws {
        let trail = try dec.decode(MotionTrailSpec.self, from: data(trailJSON(#""opacityRange":-0.5"#)))
        XCTAssertEqual(trail.opacityRange, -0.5)
    }

    func testTrailWidthRejectsNegative() {
        XCTAssertThrowsError(try dec.decode(MotionTrailSpec.self, from: data(trailJSON(#""width":-1"#))))
    }

    func testTrailWidthAcceptsNonNegativeValues() throws {
        let zero = try dec.decode(MotionTrailSpec.self, from: data(trailJSON(#""width":0.0"#)))
        XCTAssertEqual(zero.width, 0.0)

        let positive = try dec.decode(MotionTrailSpec.self, from: data(trailJSON(#""width":5.0"#)))
        XCTAssertEqual(positive.width, 5.0)
    }

    func testTrailWidthRejectsNaN() {
        let encoder = JSONEncoder()
        encoder.nonConformingFloatEncodingStrategy = .convertToString(positiveInfinity: "+Inf", negativeInfinity: "-Inf", nan: "NaN")
        struct W: Encodable { let width: Double }
        let raw = try! encoder.encode(W(width: .nan))
        XCTAssertThrowsError(try dec.decode(MotionTrailSpec.self, from: raw))
    }

    func testTrailGlowFillOpacityBaseRejectsAboveOne() {
        XCTAssertThrowsError(try dec.decode(MotionTrailSpec.self, from: data(trailJSON(#""glowFillOpacityBase":1.5"#))))
    }

    // MARK: - Trajectory bounds (MotionTrajectorySpec)

    private func trajectoryJSON(_ body: String) -> String {
        return "{\(body)}"
    }

    func testTrajectoryOpacityBaseRejectsAboveOne() {
        XCTAssertThrowsError(try dec.decode(MotionTrajectorySpec.self, from: data(trajectoryJSON(#""opacityBase":1.1"#))))
    }

    func testTrajectoryMinFadeRejectsNegative() {
        XCTAssertThrowsError(try dec.decode(MotionTrajectorySpec.self, from: data(trajectoryJSON(#""minFade":-0.01"#))))
    }

    func testTrajectorySizeBaseRejectsNegative() {
        XCTAssertThrowsError(try dec.decode(MotionTrajectorySpec.self, from: data(trajectoryJSON(#""sizeBase":-1"#))))
    }

    func testTrajectoryPointCountBaseFactorAcceptsNegativeMultiplier() throws {
        let trajectory = try dec.decode(MotionTrajectorySpec.self, from: data(trajectoryJSON(#""pointCountBaseFactor":-2"#)))
        XCTAssertEqual(trajectory.pointCountBaseFactor, -2)
    }

    // MARK: - Regression: existing fixtures still load

    func testExistingValidFixturesStillLoad() throws {
        let repoRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        let phase1URL = repoRoot.appendingPathComponent("Examples/Phase1Card.motion.json")
        let reactiveURL = repoRoot.appendingPathComponent("Examples/ReactiveCard.motion.json")

        let phase1Data = try Data(contentsOf: phase1URL)
        let reactiveData = try Data(contentsOf: reactiveURL)

        XCTAssertNoThrow(try dec.decode(MotionDocument.self, from: phase1Data))
        XCTAssertNoThrow(try JSONSerialization.jsonObject(with: reactiveData))
    }
}
