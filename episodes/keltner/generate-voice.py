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
        "凯尔特纳通道，是用当前波动水平衡量价格的运动强弱。",
        "它回答两个问题：这次运动有没有超出近期正常波幅，这种力量有没有持续。",
    ],
    "parts": [
        "中轨 E M A 表示趋势方向；上下轨由 A T R 决定，代表近期正常波动范围。",
        "价格收盘突破上轨，说明这次上涨已经超过近期通常波幅。",
    ],
    "expansion": [
        "如果通道随后向上倾斜并持续扩张，价格沿上轨推进，说明方向和波动同时增强，上涨力量仍在持续。",
    ],
    "pullback": [
        "如果价格出现回踩，但仍守在中轨上方，趋势结构尚未被破坏。",
        "如果跌破中轨，同时通道停止扩张或转平，说明上涨力量正在减弱。",
    ],
    "compression": [
        "在我的使用中，我更关注长期压缩后的突破。",
        "通道长期收窄，代表市场处于低波动状态；随后价格突破通道，同时带宽开始扩张，意味着市场可能正从波动压缩切换到方向性扩张。",
    ],
    "false_breakout": [
        "相比之下，如果突破前没有明显压缩，突破后通道也没有持续扩张，只是价格短暂越过上轨，那么假突破的可能性更高。",
    ],
    "close": [
        "所以看凯尔特纳通道：突破前看压缩；突破后看通道扩张和中轨转向；最后看价格能否留在通道外。",
    ],
}

def norm(text):
    return re.sub(r"[^\w\u4e00-\u9fff]", "", text).lower()

async def make_scene(name, paragraphs):
    communicate = edge_tts.Communicate("".join(paragraphs), "zh-CN-XiaoxiaoNeural", rate="+20%", boundary="WordBoundary")
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
