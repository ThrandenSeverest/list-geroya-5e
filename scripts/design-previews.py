"""Build local vector thumbnails for the five design choices, without remote assets."""
from pathlib import Path
from html import escape
import json
palettes = {
 'classic': ('#050f14','#0d2027','#eee1cf','#b8c2c4','#c8a15e','Синий с золотом'),
 'parchment': ('#f2e3bd','#fff4d6','#17120e','#5e5347','#8f1821','Пергамент'),
 'paper': ('#f5f6f7','#ffffff','#252b31','#59636d','#456356','Чистый лист'),
 'graphite': ('#202427','#292e32','#e6eaed','#b1bbc3','#aec6b8','Тихий графит'),
 'journal': ('#f1eee5','#faf8f1','#37382f','#646252','#6e6045','Полевой журнал'),
}
output=Path('public/design-previews');output.mkdir(parents=True,exist_ok=True)
for key,(bg,panel,text,muted,accent,name) in palettes.items():
 parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360"><title>{escape(name)} — HeroList</title><rect width="600" height="360" fill="{bg}"/><g font-family="Arial,sans-serif" fill="{text}"><rect width="600" height="45" fill="{panel}"/><text x="22" y="29" font-size="18">HeroList</text><text x="580" y="28" text-anchor="end" fill="{muted}" font-size="12">{name}</text>']
 sidebar=key=='graphite'
 x=165 if sidebar else 24
 if sidebar:
  parts += [f'<rect x="0" y="46" width="144" height="314" fill="{panel}"/><text x="18" y="90" font-size="15">Элиан Вейл</text><text x="18" y="116" font-size="11" fill="{muted}">Бард · 5 уровень</text>']
  for i,label in enumerate(['Персонаж','Магия','Инвентарь']):parts.append(f'<text x="18" y="{166+i*35}" font-size="13">{label}</text>')
 else:parts.append(f'<text x="24" y="82" font-size="24" font-family="{"Georgia" if key=="journal" else "Arial"}">Элиан Вейл</text><text x="24" y="105" font-size="12" fill="{muted}">Полуэльф · Бард · Уровень 5</text>')
 y=77 if sidebar else 143
 if sidebar:parts.append(f'<text x="165" y="80" font-size="21">Персонаж</text>');y=115
 for i,(label,value) in enumerate([('Сила','10'),('Ловкость','16'),('Телосл.','14'),('Интелл.','12'),('Мудрость','10'),('Харизма','18')]):
  w=(570-x)/6
  parts.append(f'<rect x="{x+i*w}" y="{y}" width="{w-7}" height="64" rx="5" fill="{panel}"/><text x="{x+i*w+8}" y="{y+20}" fill="{muted}" font-size="10">{label}</text><text x="{x+i*w+8}" y="{y+48}" font-size="22">{value}</text>')
 for i,(label,val) in enumerate([('Хиты','38 / 38'),('Класс доспеха','15'),('Инициатива','+3')]):
  yy=y+94+i*31
  parts.append(f'<text x="{x}" y="{yy}" font-size="13">{label}</text><text x="{x+175}" y="{yy}" font-size="14">{val}</text>')
 parts.append(f'<rect x="{x}" y="{y+172}" width="160" height="4" rx="2" fill="{accent}"/><text x="{x}" y="{y+203}" font-size="12" fill="{muted}">Особенности и способности ▸</text></g></svg>')
 (output/f'{key}.svg').write_text(''.join(parts))
# Sheet colors must remain legible and independent from the chosen site design.
colors=json.loads(Path('app/themeColors.json').read_text())
rules=[]
for color in colors:
 rules += [f'--theme-{color}:#{color};',f'--theme-rgb-{color}:'+','.join(str(int(color[i:i+2],16)) for i in (0,2,4))+';']
p=Path('app/calm-design.css')
s=p.read_text().split('/* Printed palette isolation. */')[0]
p.write_text(s+'\n/* Printed palette isolation. */\n.calm-design .pdf-document {'+''.join(rules)+'}\n')
