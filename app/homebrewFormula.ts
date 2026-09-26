/** Bounded arithmetic/condition interpreter. No JS evaluation or object access. */
export type FormulaContext = { values:Record<string,number>; classLevel?:(id:string)=>number; resource?:(id:string,field:string)=>number; predicate?:(name:string,id:string)=>boolean; source?:string; roll?:boolean };
type Token={value:string;kind:'number'|'string'|'symbol'|'name'};
export function evaluateFormula(input:number|string,context:FormulaContext):number {
 if(typeof input==='number') {if(!Number.isFinite(input))throw Error('Число не конечно');return input;}
 if(input.length>512)throw Error('Формула длиннее 512 символов');
 const tokens:Token[]=[];let rest=input.trim();
 while(rest){const m=/^(\d+(?:\.\d+)?|"[^"\\]*"|'[^'\\]*'|@[a-zA-Z][a-zA-Z0-9_.]*|[a-zA-Z][a-zA-Z0-9_]*|>=|<=|==|!=|&&|\|\||[+*/%()!,<>.\-])/.exec(rest);if(!m)throw Error('Недопустимый символ в формуле');const v=m[0];tokens.push({value:v,kind:/^\d/.test(v)?'number':/^["']/.test(v)?'string':/^[@a-zA-Z]/.test(v)?'name':'symbol'});rest=rest.slice(v.length).trim();if(tokens.length>200)throw Error('Слишком сложная формула');}
 let pos=0,depth=0;const peek=()=>tokens[pos]?.value;const take=()=>tokens[pos++];const expect=(v:string)=>{if(take()?.value!==v)throw Error(`Ожидалось ${v}`);};
 const ops:Record<string,number>={'||':1,'&&':2,'==':3,'!=':3,'>':4,'>=':4,'<':4,'<=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
 function atom():number {if(++depth>25)throw Error('Слишком глубокая формула');try {
  const t=take();if(!t)throw Error('Неполная формула');
  if(t.value==='('){const n=expr(1);expect(')');return n;}
  if(['+','-','!'].includes(t.value)){const n=atom();return t.value==='-'?-n:t.value==='!'?Number(!n):n;}
  if(t.kind==='number') {let n=Number(t.value);if(/^d\d+$/.test(peek()||'')){const faces=Number(take()!.value.slice(1));if(!Number.isInteger(n)||n<1||n>100||faces<2||faces>1000)throw Error('Недопустимые кости');n=context.roll?Array.from({length:n},()=>1+Math.floor(Math.random()*faces)).reduce((a,b)=>a+b,0):n*(faces+1)/2;}return n;}
  if(t.kind!=='name')throw Error('Ожидалось число или переменная');
  if(peek()==='('){take();if(['@classLevel','@resource','equipped','hasFeature','hasArmor'].includes(t.value)){
    const arg=take();if(!arg||!(arg.kind==='string'||arg.value==='@source'))throw Error('Нужен ID в кавычках');const id=arg.value==='@source'?context.source||'':arg.value.slice(1,-1);expect(')');
    if(t.value==='@classLevel')return context.classLevel?.(id)||0;
    if(t.value==='@resource'){expect('.');const field=take()?.value||'';if(!['max','current'].includes(field))throw Error('Ожидалось current или max');return context.resource?.(id,field)||0;}
    return Number(context.predicate?.(t.value,id)||false);
  }
  const args:number[]=[];if(peek()!==')'){args.push(expr(1));while(peek()===','){take();args.push(expr(1));}}expect(')');
  if(['min','max'].includes(t.value)&&args.length)return t.value==='min'?Math.min(...args):Math.max(...args);
  if(args.length===1&&['floor','ceil','round','abs'].includes(t.value))return ({floor:Math.floor,ceil:Math.ceil,round:Math.round,abs:Math.abs})[t.value as 'floor'](args[0]);
  if(t.value==='clamp'&&args.length===3)return Math.max(args[1],Math.min(args[2],args[0]));throw Error('Неизвестная функция или число аргументов');
  }
  if(!(t.value in context.values))throw Error(`Неизвестная переменная ${t.value}`);return context.values[t.value];
 }finally{depth--;}}
 function expr(min:number):number {let a=atom();while((ops[peek()||'']||0)>=min){const op=take()!.value;const b=expr(ops[op]+1);switch(op){case '+':a+=b;break;case '-':a-=b;break;case '*':a*=b;break;case '/':if(!b)throw Error('Деление на ноль');a/=b;break;case '%':if(!b)throw Error('Деление на ноль');a%=b;break;case '>':a=Number(a>b);break;case '>=':a=Number(a>=b);break;case '<':a=Number(a<b);break;case '<=':a=Number(a<=b);break;case '==':a=Number(a===b);break;case '!=':a=Number(a!==b);break;case '&&':a=Number(!!a&&!!b);break;case '||':a=Number(!!a||!!b);break;}}return a;}
 const result=expr(1);if(pos!==tokens.length||!Number.isFinite(result)||Math.abs(result)>1e9)throw Error('Некорректная формула');return result;
}
