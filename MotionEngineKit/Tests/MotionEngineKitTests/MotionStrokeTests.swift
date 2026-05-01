import XCTest
@testable import MotionEngineKit

final class MotionStrokeTests: XCTestCase {
    private let decoder = JSONDecoder()

    private func data(_ json: String) -> Data {
        Data(json.utf8)
    }

    func testDecodeFullTypedStroke() throws {
        let stroke = try decoder.decode(MotionStrokeSpec.self, from: data("""
        {
          "color": "#FF0000",
          "width": 2,
          "alignment": "inside",
          "dash": [4, 2],
          "cap": "round",
          "join": "round",
          "miterLimit": 8
        }
        """))

        XCTAssertEqual(stroke.color, "#FF0000")
        XCTAssertEqual(stroke.width, 2)
        XCTAssertEqual(stroke.alignment, .inside)
        XCTAssertEqual(stroke.dash, [4, 2])
        XCTAssertEqual(stroke.cap, .round)
        XCTAssertEqual(stroke.join, .round)
        XCTAssertEqual(stroke.miterLimit, 8)
    }

    func testDecodeAppliesDefaults() throws {
        let stroke = try decoder.decode(MotionStrokeSpec.self, from: data(##"{"color":"#FF0000","width":2}"##))

        XCTAssertEqual(stroke.color, "#FF0000")
        XCTAssertEqual(stroke.width, 2)
        XCTAssertEqual(stroke.alignment, .center)
        XCTAssertEqual(stroke.cap, .butt)
        XCTAssertEqual(stroke.join, .miter)
        XCTAssertNil(stroke.dash)
        XCTAssertNil(stroke.miterLimit)
    }

    func testRejectsNegativeWidth() {
        XCTAssertThrowsError(try decoder.decode(MotionStrokeSpec.self, from: data(##"{"color":"#FF0000","width":-1}"##)))
    }

    func testRejectsEmptyDash() {
        XCTAssertThrowsError(try decoder.decode(MotionStrokeSpec.self, from: data(##"{"color":"#FF0000","width":2,"dash":[]}"##)))
    }

    func testRejectsAllZeroDash() {
        XCTAssertThrowsError(try decoder.decode(MotionStrokeSpec.self, from: data(##"{"color":"#FF0000","width":2,"dash":[0,0]}"##)))
    }

    func testRejectsUnknownAlignment() {
        XCTAssertThrowsError(try decoder.decode(MotionStrokeSpec.self, from: data(##"{"color":"#FF0000","width":2,"alignment":"outer"}"##)))
    }

    func testRejectsUnknownCap() {
        XCTAssertThrowsError(try decoder.decode(MotionStrokeSpec.self, from: data(##"{"color":"#FF0000","width":2,"cap":"stub"}"##)))
    }

    func testRejectsUnknownJoin() {
        XCTAssertThrowsError(try decoder.decode(MotionStrokeSpec.self, from: data(##"{"color":"#FF0000","width":2,"join":"splice"}"##)))
    }

    func testRejectsNonFiniteWidth() {
        let raw = data(##"{"color":"#FF0000","width":NaN}"##)
        XCTAssertThrowsError(try decoder.decode(MotionStrokeSpec.self, from: raw))
    }

    func testBackwardCompatUntypedStroke() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "style": {
            "strokeWidth": 2,
            "strokeColor": "#FF0000"
          }
        }
        """))

        XCTAssertNil(node.stroke)
        XCTAssertEqual(node.style["strokeWidth"], .number(2))
        XCTAssertEqual(node.style["strokeColor"], .string("#FF0000"))
    }
}
