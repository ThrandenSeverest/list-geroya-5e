#!/usr/bin/env python3
"""Produce offline HeroList platform icons and loading screens from public/favicon.ico."""
import argparse, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

def font(sz, serif=True):
    names = ['/usr/share/fonts/truetype/noto/NotoSerifDisplay-SemiBold.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
             'C:/Windows/Fonts/georgiab.ttf'] if serif else [
             '/usr/share/fonts/truetype/lato/Lato-Semibold.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
             'C:/Windows/Fonts/segoeui.ttf']
    for name in names:
        if Path(name).exists(): return ImageFont.truetype(name, sz)
    return ImageFont.load_default()

def mark(src, sz):
    im=src.resize((sz,sz),Image.Resampling.LANCZOS)
    im=ImageEnhance.Contrast(im).enhance(1.055)
    im=ImageEnhance.Color(im).enhance(1.08)
    return im.filter(ImageFilter.UnsharpMask(radius=max(.65,sz/320),percent=105,threshold=2))

def background(w,h,seed=42):
    out=Image.new('RGB',(w,h),'#041426');d=ImageDraw.Draw(out)
    for y in range(h):
        t=1-abs(y/max(1,h-1)-.42)*1.13
        d.line((0,y,w,y),fill=(int(3+5*t),int(15+25*t),int(35+46*t)))
    out=out.convert('RGBA');layer=Image.new('RGBA',(w,h));d=ImageDraw.Draw(layer)
    s=min(w,h);cx=w//2;cy=int(h*.42)
    for factor in (.41,.51,.63):
        r=int(s*factor)
        d.arc((cx-r,cy-r,cx+r,cy+r),25,154,fill=(185,140,70,36),width=max(1,s//950))
        d.arc((cx-r,cy-r,cx+r,cy+r),205,335,fill=(82,139,195,36),width=max(1,s//950))
    random.seed(seed)
    for _ in range(w*h//2600):
        x=random.randrange(w);y=random.randrange(h)
        if abs(x-cx)<w*.28 and abs(y-h*.47)<h*.25:continue
        rr=random.choice((1,1,1,2))*max(1,s//1200)
        d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=random.choice(((225,191,116,72),(78,145,201,64),(198,209,221,52))))
    return Image.alpha_composite(out,layer)

def place(im,src,cy,sz):
    cx=im.width//2;r=sz//2
    halo=Image.new('RGBA',im.size);d=ImageDraw.Draw(halo)
    q=int(sz*.56);d.ellipse((cx-q,cy-q,cx+q,cy+q),fill=(255,177,62,90))
    im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(max(8,int(sz*.11)))))
    shade=Image.new('RGBA',im.size);d=ImageDraw.Draw(shade)
    d.ellipse((cx-r+5,cy-r+18,cx+r+5,cy+r+18),fill=(0,0,0,175))
    im.alpha_composite(shade.filter(ImageFilter.GaussianBlur(max(8,int(sz*.04)))))
    im.alpha_composite(mark(src,sz),(cx-r,cy-r))

def label(im,text,y,sz,color,serif=True):
    d=ImageDraw.Draw(im);f=font(sz,serif)
    box=d.textbbox((0,0),text,font=f);x=(im.width-(box[2]-box[0]))/2
    d.text((x,y),text,font=f,fill=color)

def line(im,y,length):
    w=im.width;d=ImageDraw.Draw(im);x=(w-length)//2
    d.line((x,y,x+length,y),fill=(195,144,71,140),width=max(2,w//750))
    r=max(4,w//180)
    d.polygon(((w//2,y-r),(w//2+r,y),(w//2,y+r),(w//2-r,y)),fill=(244,184,83,225))

def desktop(src):
    w,h=1600,900;im=background(w,h)
    place(im,src,int(h*.40),int(h*.51))
    label(im,'ЛИСТ ГЕРОЯ',int(h*.707),int(h*.074),(255,228,163))
    line(im,int(h*.807),int(w*.20))
    label(im,'D&D 5e   ·   ПЕРСОНАЖИ И ПРИКЛЮЧЕНИЯ',int(h*.836),int(h*.021),(184,193,208),False)
    p=int(h*.027)
    ImageDraw.Draw(im).rounded_rectangle((p,p,w-p-1,h-p-1),radius=int(h*.025),outline=(156,122,70,95),width=2)
    return im.convert('RGB')

def mobile(src):
    w,h=1080,1920;im=background(w,h,102)
    place(im,src,int(h*.39),int(w*.70))
    label(im,'ЛИСТ ГЕРОЯ',int(h*.626),int(w*.082),(255,228,163))
    line(im,int(h*.702),int(w*.32))
    label(im,'D&D 5e  ·  OFFLINE',int(h*.743),int(w*.035),(205,201,186),False)
    ImageDraw.Draw(im).line((w*.18,h*.916,w*.82,h*.916),fill=(197,151,84,80),width=2)
    label(im,'ВАШИ ГЕРОИ ВСЕГДА РЯДОМ',int(h*.933),int(w*.022),(151,167,186),False)
    return im.convert('RGB')

def build(src,out):
    windows=out/'standalone/windows'
    res=out/'standalone/android/app/src/main/res'
    windows.mkdir(parents=True,exist_ok=True)
    mark(src,256).save(windows/'icon.ico',format='ICO',sizes=((16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)))
    desktop(src).save(windows/'splash-desktop.png',optimize=True)
    folder=res/'drawable-nodpi';folder.mkdir(parents=True,exist_ok=True)
    mobile(src).save(folder/'herolist_splash.png',optimize=True)
    foreground=Image.new('RGBA',(432,432))
    foreground.alpha_composite(mark(src,256),(88,88))
    foreground.save(folder/'herolist_launcher_foreground.png',optimize=True)
    for dens,n in (('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)):
        dest=res/('mipmap-'+dens);dest.mkdir(parents=True,exist_ok=True)
        tile=background(n,n).convert('RGBA');k=round(n*.92)
        tile.alpha_composite(mark(src,k),((n-k)//2,(n-k)//2))
        tile.save(dest/'ic_launcher.png',optimize=True)
        mark(src,n).save(dest/'ic_launcher_round.png',optimize=True)
    adaptive=res/'mipmap-anydpi-v26';adaptive.mkdir(parents=True,exist_ok=True)
    xml='''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
 <background android:drawable="@color/herolist_icon_background"/>
 <foreground android:drawable="@drawable/herolist_launcher_foreground"/>
</adaptive-icon>
'''
    (adaptive/'ic_launcher.xml').write_text(xml,encoding='utf8')
    (adaptive/'ic_launcher_round.xml').write_text(xml,encoding='utf8')
    vals=res/'values';vals.mkdir(parents=True,exist_ok=True)
    (vals/'colors.xml').write_text('<?xml version="1.0" encoding="utf-8"?><resources><color name="herolist_icon_background">#061A35</color></resources>',encoding='utf8')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',default='public/favicon.ico');p.add_argument('--out',default='.')
    a=p.parse_args();build(Image.open(a.source).convert('RGBA'),Path(a.out))
