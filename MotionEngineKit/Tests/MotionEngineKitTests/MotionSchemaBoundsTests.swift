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
