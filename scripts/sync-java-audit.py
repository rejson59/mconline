#!/usr/bin/env python3
"""Pin a small, reviewable Java 1.20.4 reference corpus; no game/runtime downloads.
Requires authenticated gh. Original JSON data belongs to Mojang/Microsoft, not MIT code.
"""
import base64
import concurrent.futures
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = '90d256dfee7b6fd8014e1bc3b107e64a530c5f9b'
REPO = 'InventivetalentDev/minecraft-assets'
OUT = ROOT / '.harness/fixtures/java-1.20.4'
RECIPES = ['tnt', 'compass', 'clock', 'campfire', 'bread', 'paper', 'bucket',
           'shears', 'arrow', 'bookshelf', 'stick', 'furnace', 'glowstone',
           'torch', 'crafting_table', 'wooden_axe', 'bow', 'oak_stairs', 'honeycomb_block', 'slime_block']
LOOT = ['slime_block', 'honeycomb_block', 'gravel', 'glowstone', 'coal_ore',
        'diamond_ore', 'emerald_ore', 'lapis_ore', 'redstone_ore', 'nether_quartz_ore', 'campfire']
paths = ['recipes/' + n + '.json' for n in RECIPES]
paths += ['loot_tables/blocks/' + n + '.json' for n in LOOT]

def sync(path):
    target = OUT / path
    cache = ROOT / '.cache/java-audit' / REF / path
    if not cache.exists():
        obj = json.loads(subprocess.check_output([
            'gh', 'api', f'repos/{REPO}/contents/data/minecraft/{path}?ref={REF}']))
        raw = base64.b64decode(obj['content'])
        json.loads(raw)
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(raw)
    raw = cache.read_bytes()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    return {'path': path, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    files = list(pool.map(sync, paths))
manifest = {'version': '1.20.4', 'repository': REPO, 'commit': REF,
            'notice': 'Original Mojang/Microsoft data; not project MIT. See public/Minecraft-NOTICE.txt.',
            'files': files}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Pinned {len(files)} native JSON files ({sum(f["bytes"] for f in files)} bytes).')
