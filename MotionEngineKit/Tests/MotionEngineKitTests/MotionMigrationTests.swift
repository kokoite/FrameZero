import XCTest
@testable import MotionEngineKit

final class MotionMigrationTests: XCTestCase {

    // MARK: - Identity / fast path

    func testMigrateReturnsInputUnchangedForCurrentVersion() throws {
        let json = #"{"schemaVersion": 1, "root": "n", "nodes": [], "machines": [], "triggers": []}"#
        let input = Data(json.utf8)
        let output = try MotionMigration.migrate(data: input)
        XCTAssertEqual(output, input)
    }

    func testMigrateReturnsInputUnchangedForCurrentVersionPreservesByteIdentity() throws {
        let json = #"{"schemaVersion": 1, "extra": "value"}"#
        let input = Data(json.utf8)
        let output = try MotionMigration.migrate(data: input)
        XCTAssertEqual(output.count, input.count)
        XCTAssertEqual(output, input)
    }

    func testMigratePreservesUnknownSiblingKeysOnFastPath() throws {
        let json = #"{"schemaVersion": 1, "futureFeature": {"x": 1}, "root": "a"}"#
        let input = Data(json.utf8)
        let output = try MotionMigration.migrate(data: input)
        XCTAssertEqual(output, input)
    }

    // MARK: - Missing / null schemaVersion

    func testMigrateTreatsMissingSchemaVersionAsV1() throws {
        let json = #"{"root": "n"}"#
        let input = Data(json.utf8)
        let output = try MotionMigration.migrate(data: input)
        XCTAssertEqual(output, input)
    }

    func testMigrateTreatsNullSchemaVersionAsV1() throws {
        let json = #"{"schemaVersion": null, "root": "n"}"#
        let input = Data(json.utf8)
        let output = try MotionMigration.migrate(data: input)
        XCTAssertEqual(output, input)
    }

    // MARK: - Future versions

    func testMigrateThrowsOnUnknownFutureVersion() {
        let json = #"{"schemaVersion": 99}"#
        let input = Data(json.utf8)
        XCTAssertThrowsError(try MotionMigration.migrate(data: input)) { error in
            XCTAssertEqual(error as? MotionMigrationError, .unsupportedFutureVersion(99))
        }
    }

    // MARK: - Malformed input

    func testMigrateThrowsOnMalformedJSON() {
        let input = Data("not json".utf8)
        XCTAssertThrowsError(try MotionMigration.migrate(data: input)) { error in
            XCTAssertEqual(error as? MotionMigrationError, .malformedJSON)
        }
    }

    func testMigrateThrowsOnEmptyData() {
        let input = Data()
        XCTAssertThrowsError(try MotionMigration.migrate(data: input)) { error in
            XCTAssertEqual(error as? MotionMigrationError, .malformedJSON)
        }
    }

    func testMigrateThrowsOnNonObjectRoot() {
        let input = Data("[1, 2, 3]".utf8)
        XCTAssertThrowsError(try MotionMigration.migrate(data: input)) { error in
            XCTAssertEqual(error as? MotionMigrationError, .nonObjectRoot)
        }
    }

    func testMigrateThrowsOnNonIntegerSchemaVersion() {
        // Swift JSONDecoder permissively decodes JSON 1.0 into Int as 1 on this toolchain.
        let floatInput = Data(#"{"schemaVersion": 1.0}"#.utf8)
        XCTAssertEqual(try MotionMigration.migrate(data: floatInput), floatInput)
        // String "1" — must throw malformedJSON
        let stringInput = Data(#"{"schemaVersion": "1"}"#.utf8)
        XCTAssertThrowsError(try MotionMigration.migrate(data: stringInput)) { error in
            XCTAssertEqual(error as? MotionMigrationError, .malformedJSON)
        }
    }
}
