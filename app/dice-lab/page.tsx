'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import {useDiceController} from '../useDiceController';
import {DiceSettings,diceOptions} from '../DiceSettings';
import {usePlayViewPreferences} from '../playViewPreferences';
import type {DiceResult} from '../adventure';
import { rollDice } from '../adventure';

const choices = [
  {name:'Четырёхгранник',formula:'1d4'},
  {name:'Все грани',formula:'1d4+1d6+1d8+1d10+1d12+1d20'},
  { name:'Проверка d20', formula:'1d20' },
  { name:'Три шестигранника', formula:'3d6' },
  { name:'Смешанный бросок', formula:'2d8+1d4+3' },
  { name:'Кубики d10', formula:'5d10' },
  { name:'Процентный бросок', formula:'1d100' },
  { name:'Много кубиков', formula:'12d6' },
];
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
  const [view,updateView]=usePlayViewPreferences();
  const controller=useDiceController(diceOptions(view));
  const [build,setBuild]=useState('Загрузка номера сборки…');
  const [history,setHistory]=useState<{name:string;result:DiceResult}[]>([]);
  const [formula,setFormula]=useState('2d6+1d4+3');
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    fetch('../DICE_PREVIEW_BUILD.txt',{cache:'no-store'}).then(r=>r.ok?r.text():Promise.reject(Error('Not deployed')))
      .then(t=>{if(!cancelled)setBuild(t.trim());})
      .catch(()=>{if(!cancelled)setBuild('Локальная сборка');});
    return()=>{cancelled=true;};
  },[]);
  async function launch(name:string,value:string){
    try{const result=await controller.run(()=>rollDice(value));setHistory(previous=>[{name,result},...previous].slice(0,8));setError('');}
    catch(reason){if((reason as Error).name!=='AbortError')setError(reason instanceof Error?reason.message:String(reason));}
  }
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
          <button style={styles.button} type="submit">Бросить формулу</button><DiceSettings view={view} onChange={updateView}/>
        </form>
        {error&&<p role="alert" style={{color:'#ffaaa0'}}>{error}</p>}
        <hr style={{border:0,borderTop:'1px solid #574f49',margin:'22px 0'}}/>
        <div style={{display:'flex',gap:16,alignItems:'center',marginTop:18}}>
          <button style={styles.button} onClick={()=>{controller.clear();setHistory([]);}}>Очистить кубики</button>
          <span data-testid="active-rolls" style={styles.muted}>Активных бросков: {controller.pending}</span>
        </div>
        {history.length>0&&<div aria-label="История тестовых бросков" style={{marginTop:17,display:'grid',gap:5}}>
          {history.map((v,i)=><div key={i} data-testid="dice-history-result" data-result={JSON.stringify(v.result)} style={{fontSize:13,color:'#e8d3b3'}}>{v.name} — {v.result.formula} = {v.result.total}</div>)}
        </div>}
      </section>
      <p style={{...styles.muted,marginTop:18}}>
        Тестовый маршрут: <code>/dice-preview/dice-lab/</code>. Он использует тот же компонент анимации, что игровой режим.
      </p>
    </div>
    {controller.overlay}
  </main>;
}
