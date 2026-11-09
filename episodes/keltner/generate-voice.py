import asyncio
import json
import re
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/episodes/keltner/voice"
OUT.mkdir(parents=True, exist_ok=True)

SCENES = {
    "hook": [
        "价格突破 Keltner 通道上轨，为什么有的继续涨，有的很快跌回通道？",
        "关键不是有没有突破，而是突破后能不能站住。",
    ],
    "parts": [
        "Keltner 通道有三部分：中间是 E M A 均线；上轨和下轨，分别在 E M A 上下加减 A T R 的倍数。",
    ],
    "width": [
        "A T R 变大，通道变宽；A T R 变小，通道收窄。",
        "碰到上轨，不代表价格一定高；只是超出近期正常波动。",
    ],
    "compression": [
        "通道持续收窄，说明 A T R 下降、波动变小。",
        "收盘突破上轨后，再看它能不能站住。",
    ],
    "continuation": [
        "先看一段有效突破：通道收窄后，价格收盘突破上轨。",
        "随后通道张开，K 线连续留在上轨外，突破在延续。",
    ],
    "failure": [
        "失败突破：刺破上轨后，很快收回通道内，再跌破中线。",
        "上轨外没站住，价格回到原来的波动范围。",
    ],
    "close": [
        "看 Keltner 通道，只看三步：中线方向，是否收在通道外，能不能留在通道外。",
    ],
}

def norm(text):
    return re.sub(r"[^\w\u4e00-\u9fff]", "", text).lower()

async def make_scene(name, paragraphs):
    communicate = edge_tts.Communicate("".join(paragraphs), "zh-CN-XiaoxiaoNeural", rate="+12%", boundary="WordBoundary")
    chunks, words = [], []
    async for item in communicate.stream():
        if item["type"] == "audio":
            chunks.append(item["data"])
        elif item["type"] == "WordBoundary":
            words.append(item)
    if not chunks or not words:
        raise RuntimeError(f"No audio or timing received for {name}")
    output = OUT / f"{name}.mp3"
    output.write_bytes(b"".join(chunks))
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(output)], text=True))
    phrases = []
    for stage, paragraph in enumerate(paragraphs):
        for phrase in re.split(r"(?<=[，。；：？！、])", paragraph):
            phrase = phrase.strip().rstrip("，。；：？！、")
            if phrase:
                phrases.append((phrase, stage))
    indexed, cursor = [], 0
    for word in words:
        indexed.append((cursor, cursor + len(norm(word["text"])), word))
        cursor += len(norm(word["text"]))
    captions, pos = [], 0
    total_chars = sum(len(norm(phrase)) for phrase, _ in phrases)
    for phrase, stage in phrases:
        size = len(norm(phrase))
        hits = [word for start, end, word in indexed if end > pos and start < pos + size]
        if hits:
            start = hits[0]["offset"] / 10000
            end = (hits[-1]["offset"] + hits[-1]["duration"]) / 10000
        else:
            # English indicator names may be tokenized differently by Edge TTS.
            # Keep captions aligned to the sentence rather than dropping the scene.
            start = duration * pos / total_chars
            end = duration * (pos + size) / total_chars
        captions.append({"text": phrase, "startMs": round(start), "endMs": round(end), "timestampMs": round((start + end) / 2), "confidence": None, "stage": stage})
        pos += size
    return {"durationMs": round(duration * 1000), "captions": captions}

async def main():
    payload = {}
    for name, paragraphs in SCENES.items():
        payload[name] = await make_scene(name, paragraphs)
        print(name, payload[name]["durationMs"], flush=True)
    (ROOT / "src/keltner-voice.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")

asyncio.run(main())
