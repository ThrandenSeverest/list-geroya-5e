'use client';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { DiceScreenOverlay, type ScreenRoll } from '../DiceScreenOverlay';
import { rollDice } from '../adventure';

const choices = [
  { name:'Проверка d20', formula:'1d20' },
  { name:'Три шестигранника', formula:'3d6' },
  { name:'Смешанный бросок', formula:'2d8+1d4+3' },
  { name:'Кубики d10', formula:'5d10' },
  { name:'Процентный бросок', formula:'1d100' },
  { name:'Много кубиков', formula:'12d6' },
];
const defaultColor='#633e9f';
const makeId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+':'+Math.random();
const styles:Record<string,CSSProperties>={
  page:{minHeight:'100dvh',background:'radial-gradient(ellipse at 45% 28%,#253443,#0c111a 70%)',color:'#fff1dc',padding:'clamp(16px,3.5vw,38px)',fontFamily:'system-ui,Arial,sans-serif'},
  frame:{maxWidth:850,margin:'0 auto',position:'relative',zIndex:1},
  card:{background:'rgba(16,25,34,.94)',border:'1px solid #8c785e',borderRadius:14,padding:'clamp(16px,2.3vw,24px)',boxShadow:'0 16px 40px #0005'},
  controls:{display:'flex',flexWrap:'wrap',gap:10},
  button:{minHeight:44,padding:'10px 14px',border:'1px solid #b99a66',borderRadius:7,background:'#252e3c',color:'#fff1dc',cursor:'pointer',fontWeight:650},
  muted:{color:'#c8c4bd',fontSize:13,lineHeight:1.55},
  link:{color:'#f4c981',textDecoration:'underline'}
};

export default function DiceLabPage() {
  const [rolls,setRolls]=useState<ScreenRoll[]>([]);
  const [enabled,setEnabled]=useState(true);
  const [color,setColor]=useState(defaultColor);
  const [lifetime,setLifetime]=useState(8);
  const [build,setBuild]=useState('Загрузка номера сборки…');
  const [history,setHistory]=useState<string[]>([]);
  const [formula,setFormula]=useState('2d6+1d4+3');
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    fetch('../DICE_PREVIEW_BUILD.txt',{cache:'no-store'}).then(r=>r.ok?r.text():Promise.reject(Error('Not deployed')))
      .then(t=>{if(!cancelled)setBuild(t.trim());})
      .catch(()=>{if(!cancelled)setBuild('Локальная сборка');});
    return()=>{cancelled=true;};
  },[]);
  const launch=useCallback((name:string,value:string)=>{
    try{
      const result=rollDice(value);
      const roll={id:makeId(),name,result};
      setRolls(previous=>[...previous,roll].slice(-50));
      setHistory(previous=>[name+' — '+result.formula+' = '+result.total,...previous].slice(0,8));
      setError('');
    }catch(reason){
      setError(reason instanceof Error?reason.message:String(reason));
    }
  },[]);
  return <main style={styles.page}>
    <div style={styles.frame}>
      <header style={{display:'flex',gap:14,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',marginBottom:18}}>
        <div><div style={{fontSize:12,color:'#d3b77e',letterSpacing:'.15em'}}>HEROLIST · ИЗОЛИРОВАННЫЙ ТЕСТ</div>
          <h1 style={{margin:'8px 0 4px',fontSize:'clamp(26px,4vw,36px)'}}>Лаборатория кубиков</h1>
          <div style={styles.muted}>Проверка живой анимации без создания персонажа и входа в аккаунт</div>
        </div>
        <a style={styles.link} href="../">Вернуться в HeroList</a>
      </header>
      <section style={styles.card}>
        <p data-testid="dice-build" style={{color:'#edce98',fontFamily:'ui-monospace,Consolas,monospace',fontSize:12,overflowWrap:'anywhere'}}>
          {build}
        </p>
        <p style={styles.muted}>В этой версии кубики должны появляться <strong>справа</strong>, быть небольшими и отскакивать друг от друга и от границ видимой области.</p>
        <div style={styles.controls}>
          {choices.map(item=><button style={styles.button} key={item.formula} data-testid={'throw-'+item.formula.replace(/\W/g,'-')}
            onClick={()=>launch(item.name,item.formula)}>{item.formula}</button>)}
        </div>
        <form onSubmit={e=>{e.preventDefault();launch('Своя формула',formula);}} style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:14}}>
          <input style={{flex:'1 1 220px',minWidth:0,border:'1px solid #927757',background:'#111a25',color:'white',padding:12,borderRadius:7}}
            aria-label="Своя формула броска" value={formula} onChange={e=>setFormula(e.target.value)}/>
          <button style={styles.button} type="submit">Бросить формулу</button>
        </form>
        {error&&<p role="alert" style={{color:'#ffaaa0'}}>{error}</p>}
        <hr style={{border:0,borderTop:'1px solid #574f49',margin:'22px 0'}}/>
        <div style={{display:'flex',flexWrap:'wrap',gap:22,alignItems:'center'}}>
          <label style={{display:'flex',gap:7,alignItems:'center'}}>
            <input aria-label="Включить анимацию" type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Анимация
          </label>
          <label style={{display:'flex',gap:8,alignItems:'center'}}>Цвет
            <input aria-label="Цвет кубиков" type="color" value={color} onChange={e=>setColor(e.target.value)}/>
          </label>
          <label style={{display:'flex',gap:8,alignItems:'center'}}>Время до исчезновения
            <select aria-label="Время до исчезновения" value={lifetime} onChange={e=>setLifetime(Number(e.target.value))}
              style={{background:'#202936',color:'white',padding:10,borderRadius:7}}>
              {[0,1,3,5,8,15,30].map(t=><option key={t} value={t}>{t} сек.</option>)}
            </select>
          </label>
        </div>
        <div style={{display:'flex',gap:16,alignItems:'center',marginTop:18}}>
          <button style={styles.button} onClick={()=>{setRolls([]);setHistory([]);}}>Очистить кубики</button>
          <span data-testid="active-rolls" style={styles.muted}>Активных бросков: {rolls.length}</span>
        </div>
        {history.length>0&&<div aria-label="История тестовых бросков" style={{marginTop:17,display:'grid',gap:5}}>
          {history.map((v,i)=><div key={i} style={{fontSize:13,color:'#e8d3b3'}}>{v}</div>)}
        </div>}
      </section>
      <p style={{...styles.muted,marginTop:18}}>
        Тестовый маршрут: <code>/dice-preview/dice-lab/</code>. Он использует тот же компонент анимации, что игровой режим.
      </p>
    </div>
    <DiceScreenOverlay rolls={rolls} options={{enabled,color,lifetime}}
      onExpire={id=>setRolls(previous=>previous.filter(roll=>roll.id!==id))}/>
  </main>;
}
