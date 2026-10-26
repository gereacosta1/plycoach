import type { Mistake, Outcome, SavedGame, ScanReport } from '../types'

export interface Summary {
 total:number; wins:number; losses:number; draws:number; winRate:number; whiteRate:number; blackRate:number;
 averageRating:number|null; totalMoves:number; openings:{name:string;count:number;wins:number}[];
 speeds:{name:string;count:number}[]; chart:{label:string;won:number;total:number}[]
}
export function rate(outcomes:Outcome[]):number {
  if (!outcomes.length) return 0
  return Math.round((outcomes.filter(x=>x==='win').length + outcomes.filter(x=>x==='draw').length*.5)/outcomes.length*100)
}
export function summarize(games:SavedGame[]): Summary {
  const outcomes = games.map(g=>g.outcome)
  const subset = (color:'white'|'black') => games.filter(g=>g.color===color).map(g=>g.outcome)
  const groups = new Map<string,{name:string;count:number;wins:number}>()
  const speeds = new Map<string,number>()
  for (const g of games) {
    const group = groups.get(g.opening)??{name:g.opening,count:0,wins:0}
    group.count++; if(g.outcome==='win')group.wins++
    groups.set(g.opening,group)
    speeds.set(g.speed,(speeds.get(g.speed)??0)+1)
  }
  const ratings=games.map(g=>g.rating).filter((n):n is number=>n!==null)
  const chronological=games.slice().sort((a,b)=>a.date-b.date)
  const chart=[]
  for (let i=0;i<chronological.length;i+=Math.max(1,Math.ceil(chronological.length/7))) {
    const chunk=chronological.slice(i,i+Math.max(1,Math.ceil(chronological.length/7)))
    chart.push({label:`${i+1}–${i+chunk.length}`,won:rate(chunk.map(g=>g.outcome)),total:chunk.length})
  }
  return {total:games.length,wins:outcomes.filter(x=>x==='win').length,
    losses:outcomes.filter(x=>x==='loss').length,draws:outcomes.filter(x=>x==='draw').length,
    winRate:rate(outcomes),whiteRate:rate(subset('white')),blackRate:rate(subset('black')),
    averageRating:ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):null,
    totalMoves:games.reduce((a,b)=>a+b.moves.length,0),
    openings:Array.from(groups.values()).sort((a,b)=>b.count-a.count).slice(0,5),
    speeds:Array.from(speeds.entries()).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),chart}
}
export function diagnostics(mistakes:Mistake[]):{title:string;description:string;count:number}[] {
  const total=mistakes.length
  if (!total) return [{title:'Sin errores detectados en esta muestra',description:'Probá analizar más partidas o usar mayor profundidad. Una muestra pequeña no garantiza ausencia de errores.',count:0}]
  const byPhase=['apertura','medio juego','final'].map(phase=>({phase,items:mistakes.filter(m=>m.phase===phase)})).sort((a,b)=>b.items.length-a.items.length)
  return byPhase.filter(({items})=>items.length).map(({phase,items})=>({
    title:phase==='apertura'?'Revisá tus decisiones de apertura':phase==='medio juego'?'Priorizá el cálculo en el medio juego':'Entrená finales',
    description:`${items.length} de ${total} decisiones con pérdida de evaluación detectadas en ${phase}. Repasá las posiciones guardadas antes de avanzar a nuevas aperturas.`,
    count:items.length
  }))
}
export function serializeReport(platform:string,username:string,games:SavedGame[],report:ScanReport|null):string {
  return JSON.stringify({platform,username,createdAt:new Date().toISOString(),games:games.map(g=>({id:g.id,date:g.date,outcome:g.outcome,color:g.color,opponent:g.opponent,opening:g.opening,url:g.url})),summary:summarize(games),report},null,2)
}
