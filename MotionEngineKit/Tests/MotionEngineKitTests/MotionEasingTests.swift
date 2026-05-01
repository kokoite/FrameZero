import Foundation
import XCTest
@testable import MotionEngineKit

final class MotionEasingTests: XCTestCase {
    func testCubicBezierCSSEaseAtMidpoint() throws {
        let spec = try decodeTimedSpec(easing: ["cubicBezier": [0.25, 0.1, 0.25, 1]])

        XCTAssertEqual(spec.easing.eased(0.5), 0.802, accuracy: 0.005)
    }

    func testCubicBezierLinearMatchesIdentity() throws {
        let spec = try decodeTimedSpec(easing: ["cubicBezier": [0, 0, 1, 1]])

        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            XCTAssertEqual(spec.easing.eased(t), t, accuracy: 1e-6)
        }
    }

    func testCubicBezierEaseInOutMonotone() throws {
        let spec = try decodeTimedSpec(easing: ["cubicBezier": [0.42, 0, 0.58, 1]])
        var previous = -Double.infinity

        for step in 0...10 {
            let p = Double(step) / 10.0
            let y = spec.easing.eased(p)
            XCTAssertGreaterThanOrEqual(y, previous)
            previous = y
        }

        XCTAssertEqual(spec.easing.eased(0), 0, accuracy: 1e-9)
        XCTAssertEqual(spec.easing.eased(1), 1, accuracy: 1e-9)
    }

    func testCubicBezierRejectsX1OutOfRange() {
        XCTAssertThrowsError(try decodeTimedSpec(easing: ["cubicBezier": [-0.1, 0, 0.5, 1]]))
    }

    func testCubicBezierRejectsX2OutOfRange() {
        XCTAssertThrowsError(try decodeTimedSpec(easing: ["cubicBezier": [0.5, 0.5, 1.1, 0.5]]))
    }

    func testCubicBezierRejectsNonFinite() {
        XCTAssertThrowsError(try decodeTimedSpec(easing: ["cubicBezier": [0.5, "NaN", 0.5, 0.5]]))
    }

    func testCubicBezierRejectsWrongArity5() {
        XCTAssertThrowsError(try decodeTimedSpec(easing: ["cubicBezier": [0.5, 0.5, 0.5, 0.5, 0.5]]))
    }

    func testCubicBezierRejectsWrongArity3() {
        XCTAssertThrowsError(try decodeTimedSpec(easing: ["cubicBezier": [0.5, 0.5, 0.5]]))
    }

    func testStringEasingStillDecodes() throws {
        let spec = try decodeTimedSpec(easing: "easeOut")

        XCTAssertEqual(spec.easing, .easeOut)
    }

    private func decodeTimedSpec(easing: Any) throws -> TimedSpec {
        let object: [String: Any] = [
            "type": "timed",
            "duration": 1,
            "easing": easing
        ]
        let data = try JSONSerialization.data(withJSONObject: object)
        let decoder = JSONDecoder()
        decoder.nonConformingFloatDecodingStrategy = .convertFromString(
            positiveInfinity: "Infinity",
            negativeInfinity: "-Infinity",
            nan: "NaN"
        )
        return try decoder.decode(TimedSpec.self, from: data)
    }
}
