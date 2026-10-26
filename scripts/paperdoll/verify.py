"""Validate every race x class pairing, file dimensions and alpha channel."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[2]/'public/paperdoll'
m=json.loads((root/'manifest.json').read_text())
assert len(m['races'])==60 and len(m['classes'])==13
files=list((root/'bases').glob('*.png'))+list((root/'heads').glob('*.png'))+list((root/'overlays').glob('*/*.png'))
assert len(files)==159,len(files)
for path in files:
    with Image.open(path) as im:
        assert im.size==(512,512),(path,im.size)
        assert im.mode=='RGBA',path
        low,high=im.getchannel('A').getextrema()
        assert low==0 and high>128,(path,low,high)
        assert im.getpixel((0,0))[3]==0,path
        assert im.getpixel((511,0))[3]==0,path
for race,data in m['races'].items():
    for outfit in m['classes']:
        assert (root/f'overlays/{data["body"]}/{outfit}.png').is_file()
print('PASS: 159 RGBA layers; 780 race/class combinations resolve; 512x512 registration.')
