import XCTest
@testable import MotionEngineKit

private struct BoundedFixture: Decodable {
    let v: Double
    enum CodingKeys: String, CodingKey { case v }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        v = try c.decodeFiniteBoundedDouble(forKey: .v, min: 0, max: 1)
    }
}

private struct BoundedOptFixture: Decodable {
    let v: Double?
    enum CodingKeys: String, CodingKey { case v }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        v = try c.decodeFiniteBoundedDoubleIfPresent(forKey: .v, min: 0, max: 1)
    }
}

private struct UnitFixture: Decodable {
    let v: Double
    enum CodingKeys: String, CodingKey { case v }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        v = try c.decodeUnitInterval(forKey: .v)
    }
}

private struct UnitOptFixture: Decodable {
    let v: Double?
    enum CodingKeys: String, CodingKey { case v }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        v = try c.decodeUnitIntervalIfPresent(forKey: .v)
    }
}

private struct OpenUnitFixture: Decodable {
    let v: Double
    enum CodingKeys: String, CodingKey { case v }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        v = try c.decodeOpenUnitInterval(forKey: .v)
    }
}

private struct OpenUnitOptFixture: Decodable {
    let v: Double?
    enum CodingKeys: String, CodingKey { case v }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        v = try c.decodeOpenUnitIntervalIfPresent(forKey: .v)
    }
}

final class MotionSchemaHelperTests: XCTestCase {
    private let dec = JSONDecoder()

    private func data(_ s: String) -> Data { Data(s.utf8) }

    // MARK: - Bounded
    func testBoundedDouble_inRange_decodes() throws {
        let f = try dec.decode(BoundedFixture.self, from: data(#"{"v":0.5}"#))
        XCTAssertEqual(f.v, 0.5, accuracy: 1e-9)
    }
    func testBoundedDouble_atLowerBound_decodes() throws {
        let f = try dec.decode(BoundedFixture.self, from: data(#"{"v":0}"#))
        XCTAssertEqual(f.v, 0)
    }
    func testBoundedDouble_atUpperBound_decodes() throws {
        let f = try dec.decode(BoundedFixture.self, from: data(#"{"v":1}"#))
        XCTAssertEqual(f.v, 1)
    }
    func testBoundedDouble_belowMin_throws() {
        XCTAssertThrowsError(try dec.decode(BoundedFixture.self, from: data(#"{"v":-0.01}"#)))
    }
    func testBoundedDouble_aboveMax_throws() {
        XCTAssertThrowsError(try dec.decode(BoundedFixture.self, from: data(#"{"v":1.01}"#)))
    }
    func testBoundedDouble_NaN_throws() {
        let encoder = JSONEncoder()
        encoder.nonConformingFloatEncodingStrategy = .convertToString(positiveInfinity: "+Inf", negativeInfinity: "-Inf", nan: "NaN")
        struct Wrap: Encodable { let v: Double }
        let raw = try! encoder.encode(Wrap(v: .nan))
        let strictDecoder = JSONDecoder()
        XCTAssertThrowsError(try strictDecoder.decode(BoundedFixture.self, from: raw))
    }

    // MARK: - Bounded if-present
    func testBoundedDoubleIfPresent_missing_isNil() throws {
        let f = try dec.decode(BoundedOptFixture.self, from: data(#"{}"#))
        XCTAssertNil(f.v)
    }
    func testBoundedDoubleIfPresent_outOfRange_throws() {
        XCTAssertThrowsError(try dec.decode(BoundedOptFixture.self, from: data(#"{"v":2.0}"#)))
    }

    // MARK: - Unit interval
    func testUnitInterval_zero_decodes() throws {
        let f = try dec.decode(UnitFixture.self, from: data(#"{"v":0}"#))
        XCTAssertEqual(f.v, 0)
    }
    func testUnitInterval_one_decodes() throws {
        let f = try dec.decode(UnitFixture.self, from: data(#"{"v":1}"#))
        XCTAssertEqual(f.v, 1)
    }
    func testUnitIntervalIfPresent_missing_isNil() throws {
        let f = try dec.decode(UnitOptFixture.self, from: data(#"{}"#))
        XCTAssertNil(f.v)
    }

    // MARK: - Open unit interval (0, 1]
    func testOpenUnitInterval_zero_throws() {
        XCTAssertThrowsError(try dec.decode(OpenUnitFixture.self, from: data(#"{"v":0}"#)))
    }
    func testOpenUnitInterval_one_decodes() throws {
        let f = try dec.decode(OpenUnitFixture.self, from: data(#"{"v":1}"#))
        XCTAssertEqual(f.v, 1)
    }
    func testOpenUnitIntervalIfPresent_missing_isNil_butZeroThrows() throws {
        let f = try dec.decode(OpenUnitOptFixture.self, from: data(#"{}"#))
        XCTAssertNil(f.v)
        XCTAssertThrowsError(try dec.decode(OpenUnitOptFixture.self, from: data(#"{"v":0}"#)))
    }
}
