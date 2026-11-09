import asyncio
import json
import re
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/episodes/macd/redesign-voice'
OUT.mkdir(parents=True, exist_ok=True)
SCENES = {
    'hook': ['价格还在涨，MACD 的柱子却在变短，这是怎么回事？'],
    'components': ['MACD 关注的是短期和长期均线之间的距离，用它来观察走势的动能。价格是结果，动能是原因。', '快线等于短期均线减去长期均线。', '信号线是快线的平滑线，变化更慢。', '柱体显示快线和信号线之间的距离，可以用来观察涨跌的动能变化。'],
    'zero': ['在看交叉和柱体之前，先看零轴。快线在零轴上方，说明短期均线高于长期均线，市场处于偏多背景。', '快线在零轴下方，说明短期均线低于长期均线，市场处于偏空背景。为什么零轴重要？因为同样一个交叉，出现在不同的背景里，代表的方向可能完全不同。'],
    'golden': ['快线上穿信号线，叫金叉。', '快线下穿信号线，叫死叉。', '先看金叉。零轴上方的金叉，发生在偏多背景里。上涨途中回踩后，快线再次上穿信号线，可能意味着上涨动能重新恢复；这种顺着大方向的金叉，可以重点关注。', '零轴下方的金叉，发生在偏空背景里。它可能只是下跌途中的一次反弹，如果价格仍然低点不断下移，就要小心反弹结束后继续下跌。'],
    'death': ['零轴上方出现死叉，可能是上涨途中的一次回调。这时候，可以观察价格回落后，能不能守住前面的低点。', '零轴下方出现死叉，发生在偏空背景里，可能意味着反弹结束，下降动能再次增强。'],
    'histogram': ['上涨过程中，绿色正柱一根比一根短，说明上涨动能可能正在减弱。', '动能减弱，不代表价格已经转跌。如果价格继续向上，柱体重新放大，说明上涨动能又开始增强。', '反过来，下跌过程中，红色负柱逐渐缩短，说明下跌动能可能正在减弱。柱体变化有时先于快慢线交叉出现，让我们更早注意到动能变化。'],
    'divergence': ['价格一次比一次涨得高，MACD 快线的高点却比前一次低，这叫顶背离。', '价格虽然创了新高，但动能没有同步增强。接下来，如果价格跌破前面的回调低点，说明上涨结构也开始转弱。'],
    'close': ['所以看 MACD，不要只盯着金叉和死叉。先看零轴，分清偏多还是偏空；再看交叉发生在什么位置；结合柱体，观察动能是在增强还是减弱；最后回到价格，看走势有没有给出确认。'],
}

def norm(s):
    return re.sub(r'[^\w\u4e00-\u9fff]', '', s).lower()

async def make_scene(name, paragraphs):
    # Speech is synthesized per complete scene, preserving natural prosody.
    text = ''.join(paragraphs)
    speech = text.replace('EMA', 'E M A').replace('MACD', 'M A C D')
    communicate = edge_tts.Communicate(speech, 'zh-CN-XiaoxiaoNeural', rate='+12%', boundary='WordBoundary')
    chunks, words = [], []
    async for item in communicate.stream():
        if item['type'] == 'audio':
            chunks.append(item['data'])
        elif item['type'] == 'WordBoundary':
            words.append(item)
    if not chunks or not words:
        raise RuntimeError(f'No audio or timing received for {name}')
    path = OUT / f'{name}.mp3'
    path.write_bytes(b''.join(chunks))
    duration = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(path)], text=True))
    tokens = []
    for stage, paragraph in enumerate(paragraphs):
        for phrase in re.split(r'(?<=[，。；：？！、])', paragraph):
            phrase = phrase.strip().rstrip('，。；：？！、')
            if phrase:
                tokens.append((phrase, stage))
    word_positions = []
    idx = 0
    for word in words:
        word_positions.append((idx, idx + len(norm(word['text'])), word))
        idx += len(norm(word['text']))
    captions, pos = [], 0
    for phrase, stage in tokens:
        size = len(norm(phrase))
        relevant = [w for start, end, w in word_positions if end > pos and start < pos + size]
        if not relevant:
            raise RuntimeError(f'Cannot align {name}: {phrase}; pos {pos}')
        start_ms = relevant[0]['offset'] / 10000
        end_ms = (relevant[-1]['offset'] + relevant[-1]['duration']) / 10000
        captions.append(dict(text=phrase, startMs=round(start_ms), endMs=round(end_ms), timestampMs=round((start_ms+end_ms)/2), confidence=None, stage=stage))
        pos += size
    if pos != idx:
        raise RuntimeError(f'Word alignment mismatch for {name}: {pos} vs {idx}')
    return dict(durationMs=round(duration*1000), captions=captions)

async def main():
    data = {}
    for name, paragraphs in SCENES.items():
        data[name] = await make_scene(name, paragraphs)
        print(name, data[name]['durationMs'], len(data[name]['captions']), flush=True)
    (ROOT / 'src/macd-redesign-voice.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

asyncio.run(main())
