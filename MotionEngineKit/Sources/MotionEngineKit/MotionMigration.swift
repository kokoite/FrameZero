import Foundation

enum MotionMigrationError: Error, Equatable {
    case malformedJSON
    case nonObjectRoot
    case unsupportedFutureVersion(Int)
}

enum MotionMigration {
    /// Current on-disk schema version that MotionDocument decodes natively.
    static let currentSchemaVersion: Int = 1

    /// Migrates data from any supported earlier schema version up to currentSchemaVersion.
    ///
    /// FAST PATH: when the envelope's schemaVersion equals currentSchemaVersion (or is
    /// missing — treated as v1 per locked policy), returns the input Data identity —
    /// no defensive copy, no JSON round-trip, zero new Data allocations on the hot path.
    ///
    /// Version comparison rules:
    ///   - detected == currentSchemaVersion → fast path, return input unchanged
    ///   - detected > currentSchemaVersion → throw .unsupportedFutureVersion(detected)
    ///   - detected < 1 (i.e., 0, negative) → throw .malformedJSON
    ///   - detected in 1..<currentSchemaVersion → run private hop chain (no hops exist yet
    ///     because currentSchemaVersion == 1; future v2 work adds them).
    static func migrate(data: Data) throws -> Data {
        let detected = try peekSchemaVersion(in: data)
        if detected == currentSchemaVersion {
            return data
        }
        if detected > currentSchemaVersion {
            throw MotionMigrationError.unsupportedFutureVersion(detected)
        }
        // detected < 1 is malformed; detected in 1..<current would route to hops once they exist.
        // Since currentSchemaVersion == 1 today, only < 1 is reachable here.
        throw MotionMigrationError.malformedJSON
    }

    // MARK: - Envelope peek

    private struct SchemaVersionEnvelope: Decodable {
        let schemaVersion: Int?
    }

    /// Peeks the schemaVersion field via a minimal decoder pass (single Int? field), avoiding
    /// a full document deserialization on the v1 hot path.
    /// Returns 1 when schemaVersion is missing or null per locked policy.
    /// Throws nonObjectRoot for top-level array/scalar, malformedJSON otherwise.
    private static func peekSchemaVersion(in data: Data) throws -> Int {
        do {
            let envelope = try JSONDecoder().decode(SchemaVersionEnvelope.self, from: data)
            return envelope.schemaVersion ?? 1
        } catch is DecodingError {
            // Decoder failed. Disambiguate malformed JSON vs non-object root vs invalid value type
            // by trying JSONSerialization (cold path only — extra alloc is fine here).
            let parsed: Any
            do {
                parsed = try JSONSerialization.jsonObject(with: data, options: [])
            } catch {
                throw MotionMigrationError.malformedJSON
            }
            if !(parsed is [String: Any]) {
                throw MotionMigrationError.nonObjectRoot
            }
            // Object root but envelope decode failed because schemaVersion was wrong-typed
            // (e.g., string "1" or float 1.0). Treat as malformed — strict integer required.
            throw MotionMigrationError.malformedJSON
        } catch {
            throw MotionMigrationError.malformedJSON
        }
    }
}
