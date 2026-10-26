"""Deterministic 3x2 atlas slicing and paperdoll registration. Requires Pillow.

Run from the repository root: python scripts/paperdoll/prepare.py
Only crops, registers and scales generated art; never removes its alpha.
"""
from pathlib import Path
import json
from io import BytesIO
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/paperdoll'
SHEETS = ROOT / 'docs/paperdoll/sheets'
SIZE = 512
CLASSES = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
           'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard', 'artificer']
LARGE = set('dwarf halforc dragonborn bugbear duergar firbolg goliath lizardfolk locathah minotaur orc tortle loxodon warforged leonin giff'.split())
SMALL = set('halfling gnome deepgnome fairy goblin kobold kender grung autognome'.split())
PROFILES = {'large': 1.0, 'regular': .88, 'small': .72}
# Source collar landmarks are measured in the 512px atlas cells, before any
# body-profile transform. They compensate for the generator's layout drift.
DOCKS = [
    [270,270,270,270,270,270],
    [270,270,280,280,270,280],
    [350,350,350,320,340,340],
    [310,310,310,290,310,310],
    [365,340,360,290,290,290],
    [310,310,310,290,290,290],
    [300,300,300,300,300,300],
    [300,300,300,300,300,300],
    [300,300,300,300,300,300],
    [300,300,300,300,300,300],
]

def cells(path):
    atlas = Image.open(path).convert('RGBA')
    w, h = atlas.size
    assert w % 3 == 0 and h % 2 == 0, (path, atlas.size)
    for i in range(6):
        x, y = i % 3 * (w//3), i//3 * (h//2)
        yield atlas.crop((x,y,x+w//3,y+h//2)).resize((SIZE,SIZE), Image.Resampling.LANCZOS)

def bounds(im):
    return im.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()

def profile(im, body):
    width = round(SIZE * PROFILES[body])
    canvas = Image.new('RGBA', (SIZE,SIZE))
    canvas.alpha_composite(im.resize((width,SIZE),Image.Resampling.LANCZOS), ((SIZE-width)//2,0))
    return canvas

def save(im, path):
    path.parent.mkdir(parents=True,exist_ok=True)
    buffer = BytesIO()
    im.save(buffer, format='PNG', optimize=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_bytes(buffer.getvalue())
    temporary.replace(path)

def main():
    ids = json.loads((ROOT/'docs/paperdoll/race-order.json').read_text())
    raw = [cell for i in range(1,4) for cell in cells(SHEETS/f'gear-{i}.png')]
    outfits = []
    for cell in raw:
        box = bounds(cell)
        assert box, 'Empty equipment cell'
        garment = cell.crop(box).resize((472,270),Image.Resampling.LANCZOS)
        layer = Image.new('RGBA',(SIZE,SIZE))
        layer.alpha_composite(garment,(20,242))
        outfits.append(layer)
    for body in PROFILES:
        for class_id, layer in zip(CLASSES,outfits):
            save(profile(layer,body),OUT/f'overlays/{body}/{class_id}.png')
    races = {}
    for batch in range(10):
        for index, original in enumerate(cells(SHEETS/f'bases-{batch+1:02d}.png')):
            race = ids[batch*6+index]
            body = 'large' if race in LARGE else 'small' if race in SMALL else 'regular'
            scale = 270 / DOCKS[batch][index]
            normalized = Image.new('RGBA',(SIZE,SIZE))
            side = round(SIZE*scale)
            normalized.alpha_composite(original.resize((side,side),Image.Resampling.LANCZOS),((SIZE-side)//2,0))
            original = normalized
            # Keep the head/neck region in front of collars. Beard/trunk extensions
            # have explicit narrow foreground regions, avoiding shoulder cutouts.
            mask = Image.new('L',(SIZE,SIZE))
            draw = ImageDraw.Draw(mask)
            draw.rectangle((0,0,512,184),fill=255)
            draw.rectangle((145,185,367,230),fill=255)
            draw.polygon([(205,230),(307,230),(288,247),(224,247)],fill=255)
            if race in {'dwarf','duergar','leonin'}:
                # Retain the beard/mane, but not the charcoal source undershirt.
                rgb = original.load()
                for y in range(220,316):
                    for x in range(174,339):
                        r,g,b,a=rgb[x,y]
                        if max(r,g,b)>105 or max(r,g,b)-min(r,g,b)>28:
                            mask.putpixel((x,y),255)
            alpha = original.getchannel('A')
            from PIL import ImageChops
            head = original.copy()
            head.putalpha(ImageChops.multiply(alpha,mask).point(lambda a: 0 if a < 3 else a))
            # A shared fitted neutral garment supplies exactly the same dock
            # geometry as every class overlay, regardless of generation drift.
            base = outfits[13].copy()
            base.alpha_composite(head)
            save(profile(base,body),OUT/f'bases/{race}.png')
            save(profile(head,body),OUT/f'heads/{race}.png')
            races[race] = {'body':body,'sheet':f'bases-{batch+1:02d}','cell':index}
    manifest = {'version':1,'canvas':{'width':512,'height':512},
                'atlas':{'columns':3,'rows':2,'order':'row-major'},
                'profiles':PROFILES,'outfitRect':[20,242,472,270],
                'sourceCollarLandmarks':DOCKS,
                'layerOrder':['base','class-outfit','race-foreground'],
                'classes':CLASSES,'races':races}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    # All 60 races and all 13 outfits are represented in the review contact sheet.
    review = Image.new('RGB',(1200, 10*225),(25,29,34))
    draw = ImageDraw.Draw(review)
    for i, race in enumerate(ids):
        body=races[race]['body']; class_id=CLASSES[i%len(CLASSES)]
        im=Image.open(OUT/f'bases/{race}.png').convert('RGBA')
        im.alpha_composite(Image.open(OUT/f'overlays/{body}/{class_id}.png').convert('RGBA'))
        im.alpha_composite(Image.open(OUT/f'heads/{race}.png').convert('RGBA'))
        im.thumbnail((190,190))
        x,y=i%6*200,i//6*225
        review.paste(im,(x,y),im)
        draw.text((x+6,y+192),race,fill='white')
        draw.text((x+6,y+207),body+' / '+class_id,fill='#d4b77a')
    review.save(OUT/'review.jpg',quality=91)
    print(f'Prepared {len(races)} bases, {len(races)} foregrounds, {len(CLASSES)*len(PROFILES)} outfits.')

if __name__ == '__main__':
    main()
