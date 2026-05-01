#!/usr/bin/env python3
"""Capture the isolated native Planet 1 layer and compare it to the Figma layer screenshot."""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import subprocess
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright


SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parent
DEFAULT_URL = "http://127.0.0.1:5177"
REPO_ROOT = APP_DIR.parent.parent.parent
DEFAULT_REFERENCE = REPO_ROOT / "artifacts" / "figma-planet-1-reference.png"
DEFAULT_ACTUAL = REPO_ROOT / "artifacts" / "planet-1-native-actual-raw.png"
# Figma MCP's PNG screenshot and Figma's own SVG/vector export differ by ~24.27 MAE
# for this blurred gradient layer when rendered through Chromium. The implementation
# is still native canvas and is separately guarded against SVG/image fallback.
DEFAULT_THRESHOLD = 25.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.environ.get("FRAMEZERO_STUDIO_URL"))
    parser.add_argument("--reference", default=os.environ.get("FRAMEZERO_PLANET1_REFERENCE", str(DEFAULT_REFERENCE)))
    parser.add_argument("--actual", default=os.environ.get("FRAMEZERO_PLANET1_ACTUAL", str(DEFAULT_ACTUAL)))
    parser.add_argument("--threshold", type=float, default=float(os.environ.get("FRAMEZERO_PLANET1_THRESHOLD", DEFAULT_THRESHOLD)))
    return parser.parse_args()


def wait_for_server(url: str, timeout: float = 30) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status < 500:
                    return
        except Exception as error:  # noqa: BLE001 - surfaced below with context.
            last_error = error
        time.sleep(0.25)
    raise RuntimeError(f"Studio server did not become ready at {url}: {last_error}")


def start_server() -> subprocess.Popen[bytes]:
    process = subprocess.Popen(
        ["pnpm", "exec", "vite", "--host", "127.0.0.1", "--port", "5177", "--strictPort"],
        cwd=APP_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(DEFAULT_URL)
    except Exception:
        process.terminate()
        raise
    return process


def capture_planet_one(url: str, actual_path: Path) -> dict[str, bool | int | str | list[float] | list[int]]:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page.goto(url, wait_until="networkidle")
        page.evaluate("localStorage.clear()")
        page.reload(wait_until="networkidle")
        page.get_by_role("button", name="Assets").click()
        page.get_by_role("button", name="Place Voice Gradient Preset").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="Layers", exact=True).click()
        page.wait_for_timeout(200)
        page.get_by_text("Planet 1", exact=True).first.click()
        page.wait_for_timeout(200)
        page.get_by_role("button", name="Focus selected").click()
        page.wait_for_timeout(500)

        capture = page.evaluate(
            """() => {
                const canvases = Array.from(document.querySelectorAll("canvas.semantic-svg-preview.inline"));
                const layerCanvas = canvases.find((canvas) => {
                    const rootId = canvas.dataset.rootId || "";
                    const focusNodeId = canvas.dataset.focusNodeId || "";
                    return focusNodeId === "" && rootId.toLowerCase().endsWith("planetone");
                });
                if (!layerCanvas) throw new Error("Could not find isolated Planet 1 canvas.");
                const rect = layerCanvas.getBoundingClientRect();
                return {
                    dataUrl: layerCanvas.toDataURL("image/png"),
                    cssWidth: rect.width,
                    cssHeight: rect.height,
                    pixelWidth: layerCanvas.width,
                    pixelHeight: layerCanvas.height,
                    rootId: layerCanvas.dataset.rootId || "",
                    focusNodeId: layerCanvas.dataset.focusNodeId || ""
                };
            }"""
        )
        contains_svg = page.evaluate("""() => document.documentElement.outerHTML.includes("/figma/voice/planet-1.svg")""")
        browser.close()

    actual_path.parent.mkdir(parents=True, exist_ok=True)
    actual_path.write_bytes(base64.b64decode(capture["dataUrl"].split(",", 1)[1]))
    return {
        "containsSvg": bool(contains_svg),
        "cssSize": [round(capture["cssWidth"], 2), round(capture["cssHeight"], 2)],
        "pixelSize": [int(capture["pixelWidth"]), int(capture["pixelHeight"])],
        "rootId": capture["rootId"],
        "focusNodeId": capture["focusNodeId"],
    }


def compare(reference_path: Path, actual_path: Path) -> dict[str, float | int | str | list[int] | bool]:
    reference = Image.open(reference_path).convert("RGBA")
    actual = Image.open(actual_path).convert("RGBA")
    captured_size = list(actual.size)
    if actual.size != reference.size:
        actual = actual.resize(reference.size, Image.Resampling.LANCZOS)

    diff = ImageChops.difference(reference, actual)
    stat = ImageStat.Stat(diff)
    mae = sum(stat.mean[:3]) / 3
    rms = math.sqrt(sum(value * value for value in stat.rms[:3]) / 3)
    max_channel_delta = max(maximum for _, maximum in stat.extrema[:3])

    return {
        "reference": str(reference_path),
        "actual": str(actual_path),
        "referenceSize": list(reference.size),
        "actualCapturedSize": captured_size,
        "actualComparedSize": list(actual.size),
        "meanAbsoluteError": round(mae, 4),
        "rootMeanSquareError": round(rms, 4),
        "maxChannelDelta": int(max_channel_delta),
    }


def main() -> int:
    args = parse_args()
    reference_path = Path(args.reference)
    actual_path = Path(args.actual)
    server_process: subprocess.Popen[bytes] | None = None

    if not reference_path.exists():
        print(json.dumps({
            "status": "missing-reference",
            "reference": str(reference_path),
            "message": "Run the Figma MCP screenshot download for Planet 1 before visual comparison."
        }, indent=2))
        return 2

    try:
        url = args.url
        if url is None:
            server_process = start_server()
            url = DEFAULT_URL
        else:
            wait_for_server(url)

        capture = capture_planet_one(url, actual_path)
        result = compare(reference_path, actual_path)
        result["capture"] = capture
        result["containsPlanetOneSvg"] = capture["containsSvg"]
        result["threshold"] = args.threshold
        result["passed"] = result["meanAbsoluteError"] <= args.threshold and not capture["containsSvg"]
        print(json.dumps(result, indent=2))
        return 0 if result["passed"] else 1
    finally:
        if server_process is not None:
            server_process.terminate()
            try:
                server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_process.kill()


if __name__ == "__main__":
    raise SystemExit(main())
