// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "MotionEngineKit",
    platforms: [
        .iOS(.v16),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "MotionEngineKit",
            targets: ["MotionEngineKit"]
        )
    ],
    targets: [
        .target(
            name: "MotionEngineKit"
        ),
        .testTarget(
            name: "MotionEngineKitTests",
            dependencies: ["MotionEngineKit"]
        )
    ]
)
