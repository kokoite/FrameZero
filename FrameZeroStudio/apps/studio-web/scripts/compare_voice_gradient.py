#!/usr/bin/env python3
"""Capture the editable Voice Gradient preset and compare it to a Figma PNG.

Usage:
  pnpm --filter @framezero/studio-web visual:voice-gradient

By default the script starts its own Vite server and gates on the committed
reference PNG. Pass --url to compare against an already-running Studio server.
"""

from __future__ import annotations

import argparse
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
DEFAULT_REFERENCE = SCRIPT_DIR / "references" / "voice-gradient-figma.png"
DEFAULT_ACTUAL = "/tmp/framezero-voice-gradient-web-actual.png"
DEFAULT_THRESHOLD = 10.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.environ.get("FRAMEZERO_STUDIO_URL"))
    parser.add_argument("--reference", default=os.environ.get("FRAMEZERO_FIGMA_REFERENCE", str(DEFAULT_REFERENCE)))
    parser.add_argument("--actual", default=os.environ.get("FRAMEZERO_ACTUAL", DEFAULT_ACTUAL))
    parser.add_argument(
        "--threshold",
        type=float,
        default=float(os.environ.get("FRAMEZERO_VISUAL_THRESHOLD", DEFAULT_THRESHOLD)),
        help="Fail when mean absolute channel error exceeds this value."
    )
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


def capture_voice_gradient(url: str, actual_path: Path) -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page.goto(url, wait_until="networkidle")
        page.evaluate("localStorage.clear()")
        page.reload(wait_until="networkidle")
        page.get_by_role("button", name="Assets").click()
        page.get_by_role("button", name="Place Voice Gradient Preset").click()
        page.locator("canvas.semantic-svg-preview").first.wait_for(state="visible", timeout=5000)
        page.wait_for_timeout(1000)
        canvas = page.evaluate_handle(
            """() => {
                const canvases = Array.from(document.querySelectorAll("canvas.semantic-svg-preview"));
                if (canvases.length === 0) return null;
                return canvases
                    .map(canvas => ({ canvas, rect: canvas.getBoundingClientRect() }))
                    .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height))[0].canvas;
            }"""
        ).as_element()
        if canvas is None:
            raise RuntimeError("Could not find a semantic Voice Gradient preview canvas.")
        canvas.screenshot(path=str(actual_path))
        browser.close()


def compare(reference_path: Path, actual_path: Path) -> dict[str, float | int | str]:
    reference = Image.open(reference_path).convert("RGBA")
    actual = Image.open(actual_path).convert("RGBA")

    if actual.size != reference.size:
        actual = actual.resize(reference.size, Image.Resampling.LANCZOS)

    diff = ImageChops.difference(reference, actual)
    stat = ImageStat.Stat(diff)
    channel_means = stat.mean
    channel_extrema = stat.extrema
    mae = sum(channel_means[:3]) / 3
    alpha_mae = channel_means[3]
    rms = math.sqrt(sum(value * value for value in stat.rms[:3]) / 3)
    max_channel_delta = max(maximum for _, maximum in channel_extrema[:3])

    return {
        "reference": str(reference_path),
        "actual": str(actual_path),
        "width": reference.width,
        "height": reference.height,
        "meanAbsoluteError": round(mae, 4),
        "alphaMeanAbsoluteError": round(alpha_mae, 4),
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
            "message": "Set FRAMEZERO_FIGMA_REFERENCE to a Figma reference PNG before running the visual diff."
        }, indent=2))
        return 2

    try:
        url = args.url
        if url is None:
            server_process = start_server()
            url = DEFAULT_URL
        else:
            wait_for_server(url)

        capture_voice_gradient(url, actual_path)
        result = compare(reference_path, actual_path)
        result["threshold"] = args.threshold
        result["passed"] = result["meanAbsoluteError"] <= args.threshold

        print(json.dumps(result, indent=2))
        return 1 if result.get("passed") is False else 0
    finally:
        if server_process is not None:
            server_process.terminate()
            try:
                server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_process.kill()


if __name__ == "__main__":
    raise SystemExit(main())
