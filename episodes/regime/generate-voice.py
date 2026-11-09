import asyncio
import json
import re
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/episodes/regime/voice"
OUT.mkdir(parents=True, exist_ok=True)

# English abbreviations are visual-only. Narration uses the Chinese names.
SCENES = {
    "opening": [
        "你是不是也不会判断市场是趋势还是震荡行情？今天给大家推荐两个我常用的指标。",
        "柴金震荡指数，价格路径效率。",
    ],
    "chop-principle": [
        "先看柴金震荡指数。它把最近一段时间每根K线的真实波幅加起来，再和这段行情实际拉开的高低区间比较。",
        "如果中间波动很大，但价格始终没有真正走开，数值就高；如果大部分波动都变成了方向上的推进，数值就低。",
    ],
    "chop-zones": [
        "柴金震荡指数高于61.8，处于震荡行情。低于38.2，处于趋势行情。38.2到61.8，是过渡区，趋势不明朗。",
        "从61.8上方进入过渡区，说明震荡在缓解；从38.2下方重新回到过渡区，说明趋势开始减弱。",
    ],
    "ker-principle": [
        "再看价格路径效率。它看的是，价格最后离起点有多远，占中间所有涨跌路径的多少。",
        "同样走10根K线，价格还在起点附近，路径效率就低；同样走10根K线，价格已经明显远离起点，路径效率就高。",
    ],
    "ker-zones": [
        "价格路径效率低于0.15，是强箱体震荡。0.15到0.3，是混沌或不明朗区域。",
        "高于0.3，价格开始走出方向；高于0.7，说明走势推进得更连贯，属于强趋势。",
    ],
    "close": [
        "柴金震荡指数适合判断价格有没有脱离震荡区间；价格路径效率适合判断收盘价有没有持续推进。",
        "通过这两个指标，帮你看清眼前更像震荡，还是趋势行情。",
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
    for phrase, stage in phrases:
        size = len(norm(phrase))
        hits = [word for start, end, word in indexed if end > pos and start < pos + size]
        if not hits:
            raise RuntimeError(f"Cannot align {name}: {phrase}")
        start = hits[0]["offset"] / 10000
        end = (hits[-1]["offset"] + hits[-1]["duration"]) / 10000
        captions.append({"text": phrase, "startMs": round(start), "endMs": round(end), "timestampMs": round((start + end) / 2), "confidence": None, "stage": stage})
        pos += size
    return {"durationMs": round(duration * 1000), "captions": captions}

async def main():
    payload = {}
    for name, paragraphs in SCENES.items():
        payload[name] = await make_scene(name, paragraphs)
        print(name, payload[name]["durationMs"], flush=True)
    (ROOT / "src/regime-voice.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")

asyncio.run(main())
