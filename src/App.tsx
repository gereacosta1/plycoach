import {useRef,useState} from 'react'
import type {FormEvent,ReactNode} from 'react'
import {Chess} from 'chess.js'
import type {Square} from 'chess.js'
import {Activity,ArrowRight,BookOpen,BrainCircuit,CheckCircle2,ChevronRight,CloudDownload,Download,ExternalLink,FileSearch,Flag,Gamepad2,Info,LoaderCircle,Play,RefreshCcw,Search,ShieldCheck,Target,TrendingUp,XCircle} from 'lucide-react'
import Board from './components/Board'
import {importGames} from './lib/importers'
import {diagnostics,serializeReport,summarize} from './lib/analytics'
import {analyzeGames} from './lib/stockfish'
import type {Mistake, Platform, SavedGame, ScanReport} from './types'

const formatDate=(time:number)=>new Intl.DateTimeFormat('es',{day:'2-digit',month:'short',year:'numeric'}).format(time)
const labelOutcome={win:'Victoria',loss:'Derrota',draw:'Tablas'}
const shortPlatform={chesscom:'Chess.com',lichess:'Lichess'}
const example='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function Header(){return <header className="topbar"><div className="brand"><div className="brandmark">♞</div><span>ply<span className="mint">coach</span><small> BETA</small></span></div><div className="topnav"><span className="statusdot"/> Análisis privado en tu navegador <span className="topnav-sep">·</span> Sin API paga</div><a className="toplink" href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer">Motor abierto <ExternalLink size={13}/></a></header>}
function Stat({icon,title,value,subtitle}:{icon:ReactNode;title:string;value:string;subtitle:string}){return <article className="statcard"><div className="stat-icon">{icon}</div><div className="stat-title">{title}</div><div className="stat-value">{value}</div><div className="stat-subtitle">{subtitle}</div></article>}
function StatBar({label,score,tag}:{label:string;score:number;tag:string}){return <div className="statbar"><div className="row-between"><span>{label}</span><span className="muted">{tag}</span></div><div className="track"><span style={{width:`${Math.min(100,score)}%`}}/></div></div>}
export default function App(){
  const [platform,setPlatform]=useState<Platform>('chesscom')
  const [username,setUsername]=useState('')
  const [count,setCount]=useState(20)
  const [games,setGames]=useState<SavedGame[]>([])
  const [profile,setProfile]=useState('')
  const [profilePlatform,setProfilePlatform]=useState<Platform>('chesscom')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [report,setReport]=useState<ScanReport|null>(null)
  const [analyzing,setAnalyzing]=useState(false)
  const [scanCount,setScanCount]=useState(3)
  const [progress,setProgress]=useState({complete:0,total:1,detail:''})
  const [chosen,setChosen]=useState<Mistake|null>(null)
  const [fromSquare,setFromSquare]=useState('')
  const [feedback,setFeedback]=useState('')
  const [reveal,setReveal]=useState(false)
  const abortRef=useRef<AbortController|null>(null)
  const summary=summarize(games)
  const gameMistakes=report?.mistakes??[]
  const mistakeCards=diagnostics(gameMistakes)

  async function handleImport(ev:FormEvent){
    ev.preventDefault()
    if(busy||analyzing)return
    setError('');setBusy(true);setGames([]);setReport(null);setChosen(null)
    try{
      const result=await importGames(platform,username,count)
      setGames(result.games);setProfile(result.username);setProfilePlatform(platform)
      setScanCount(Math.min(3,result.games.length))
    }catch(err){setError(err instanceof Error?err.message:'Error de importación')}
    finally{setBusy(false)}
  }
  async function handleAnalyze(){
    if(!games.length||analyzing)return
    setError('');setReport(null);setChosen(null);setAnalyzing(true);setProgress({complete:0,total:1,detail:'Iniciando motor local'})
    const controller=new AbortController();abortRef.current=controller
    try{
      const result=await analyzeGames(games.slice(0,scanCount),(complete,total,detail)=>setProgress({complete,total,detail}),controller.signal)
      if(!controller.signal.aborted){setReport(result);setChosen(result.mistakes[0]??null)}
    }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Error durante el análisis')}
    finally{setAnalyzing(false);abortRef.current=null}
  }
  function handleCancel(){abortRef.current?.abort()}
  function downloadReport(){
    const text=serializeReport(profilePlatform,profile,games,report)
    const file=new Blob([text],{type:'application/json'})
    const url=URL.createObjectURL(file)
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`plycoach-${profile}-${new Date().toISOString().slice(0,10)}.json`;anchor.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  function selectMistake(item:Mistake){setChosen(item);setFromSquare('');setFeedback('');setReveal(false)}
  function playPuzzleSquare(square:string){
    if(!chosen)return
    if(!fromSquare){setFromSquare(square);setFeedback('');return}
    if(fromSquare===square){setFromSquare('');return}
    const uci=`${fromSquare}${square}`
    const expected=chosen.bestMove.slice(0,4)
    if(uci===expected){setFeedback(`¡Encontraste la jugada principal! ${chosen.bestMoveSan}`);setReveal(true)}
    else{
      try{const board=new Chess(chosen.fen);const legal=board.move({from:fromSquare as Square,to:square as Square,promotion:'q'});
        setFeedback(legal?'Jugada legal, pero no es la primera elección del motor en este análisis.':'Ese movimiento no es legal en la posición.')}
      catch{setFeedback('Ese movimiento no es legal en la posición.')}
    }
    setFromSquare('')
  }
  return <div className="app-shell"><Header/>
    <main className="container">
      <section className="hero"><div className="hero-left"><div className="eyebrow"><span className="eyebrow-dot"/> CHESS INTELLIGENCE, HECHA PARA VOS</div><h1>No juegues más partidas.<br/><span>Aprendé de las que ya jugaste.</span></h1><p>Conectá tu perfil público de Chess.com o Lichess. Descubrí tus patrones, explorá tus errores y convertí tus posiciones reales en entrenamiento. Sin suscripción, sin contraseña.</p><div className="hero-tags"><span><ShieldCheck size={15}/> Privado</span><span><Activity size={15}/> Stockfish local</span><span><BookOpen size={15}/> Tus propias partidas</span></div></div><div className="hero-image"><div className="hero-board"><Board fen={example}/></div><div className="floating-pill top">♞  El próximo nivel empieza acá</div><div className="floating-pill bottom"><span className="pulse"/> Motor Stockfish · Local</div></div></section>
      <section className="import-panel" id="conectar"><div className="panel-header"><div><div className="panel-kicker">PASO 01</div><h2>Conectá tu historial</h2><p>Solo hace falta tu nombre de usuario público. No pedimos acceso a tu cuenta.</p></div><div className="small-badge"><CloudDownload size={15}/> Importación oficial</div></div>
        <form onSubmit={handleImport} className="connect-form"><div className="platform-choose"><button type="button" className={`platform-btn ${platform==='chesscom'?'selected':''}`} onClick={()=>setPlatform('chesscom')}>♜ Chess.com</button><button type="button" className={`platform-btn ${platform==='lichess'?'selected':''}`} onClick={()=>setPlatform('lichess')}>♞ Lichess</button></div><label className="userinput"><span>Nombre de usuario</span><div className="input-shell"><Search size={18}/><input autoCapitalize="off" autoComplete="off" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value)} placeholder={platform==='chesscom'?'Tu usuario de Chess.com':'Tu usuario de Lichess'} required/></div></label><label className="selectinput"><span>Últimas partidas</span><select value={count} onChange={e=>setCount(Number(e.target.value))}><option value={10}>10 partidas</option><option value={20}>20 partidas</option><option value={50}>50 partidas</option><option value={100}>100 partidas</option></select></label><button className="primary-btn import-btn" disabled={busy||analyzing||!username.trim()} type="submit">{busy?<><LoaderCircle className="spin" size={17}/> Importando</>:<>Analizar perfil <ArrowRight size={17}/></>}</button></form>
        {error&&<div className="error-notice" role="alert"><XCircle size={17}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Cerrar"><XCircle size={16}/></button></div>}
        <div className="microcopy"><Info size={14}/> Solo se importan partidas públicas ya terminadas. Los análisis aproximados son propios de PlyCoach, no métricas oficiales de Chess.com.</div>
      </section>
      {games.length===0?<section className="empty-area"><div className="empty-icon"><FileSearch size={29}/></div><h2>Tu siguiente partida puede enseñarte algo.</h2><p>Ingresá tu usuario arriba para explorar tu historial real, tus resultados y los primeros pasos de tu plan de entrenamiento.</p><div className="empty-steps"><span><b>01</b> Importá</span><ChevronRight size={17}/><span><b>02</b> Descubrí</span><ChevronRight size={17}/><span><b>03</b> Entrená</span></div></section>:
        <div className="dashboard" id="dashboard"><section className="dashboard-head"><div><div className="eyebrow slim">TU REPORTE PERSONAL</div><h2>Hola, <span className="mint">{profile}</span> <span className="platform-label">{shortPlatform[profilePlatform]}</span></h2><p>Últimas {games.length} partidas estándar completadas y disponibles.</p></div><button className="secondary-btn" onClick={downloadReport}><Download size={16}/> Exportar JSON</button></section>
          <div className="stat-grid"><Stat icon={<Gamepad2 size={19}/>} title="Partidas importadas" value={String(summary.total)} subtitle="Historial real"/><Stat icon={<TrendingUp size={19}/>} title="Puntos obtenidos" value={`${summary.winRate}%`} subtitle="Victoria 1 pt · tablas ½ pt"/><Stat icon={<Target size={19}/>} title="Rating promedio" value={summary.averageRating?.toString()??'—'} subtitle="En estas partidas"/><Stat icon={<Flag size={19}/>} title="Victorias" value={String(summary.wins)} subtitle={`${summary.draws} tablas · ${summary.losses} derrotas`}/></div>
          <div className="insights-grid"><article className="data-card"><div className="card-head"><div><h3>Resultados por color</h3><p>Porcentaje de puntos logrados</p></div><span className="card-icon"><Activity size={17}/></span></div><StatBar label="Jugando con blancas" score={summary.whiteRate} tag={`${summary.whiteRate}%`}/><StatBar label="Jugando con negras" score={summary.blackRate} tag={`${summary.blackRate}%`}/><div className="card-note">Los porcentajes incluyen medio punto por tablas.</div></article>
            <article className="data-card"><div className="card-head"><div><h3>Rendimiento reciente</h3><p>Bloques de partidas en orden cronológico</p></div><span className="card-icon"><TrendingUp size={17}/></span></div><div className="bars-chart">{summary.chart.map((item,i)=><div className="bar-unit" key={i}><div className="bar-value">{item.won}%</div><div className="bar-bg"><div style={{height:`${Math.max(4,item.won)}%`}}/></div><small>{item.label}</small></div>)}</div></article></div>
          <section className="analysis-panel"><div className="analysis-intro"><div className="analysis-icon"><BrainCircuit size={22}/></div><div><div className="panel-kicker">PASO 02 · MOTOR LOCAL</div><h2>Encontrá dónde perdés ventaja</h2><p>Stockfish examina posiciones de tus partidas y detecta caídas aproximadas de evaluación, sin enviar tus jugadas a una API de IA paga.</p></div></div><div className="analysis-controls"><label><span>Partidas a analizar en profundidad</span><select disabled={analyzing} value={scanCount} onChange={e=>setScanCount(Number(e.target.value))}>{[1,3,5,10,20,50,100].filter(n=>n<=games.length).map(n=><option value={n} key={n}>{n} partida{n===1?'':'s'}</option>)}</select></label>{analyzing?<button className="secondary-btn" onClick={handleCancel}>Cancelar</button>:<button className="primary-btn" onClick={handleAnalyze}><Play size={17} fill="currentColor"/> {report?'Volver a analizar':'Iniciar análisis'}</button>}</div>
            {analyzing&&<div className="progress-wrap"><div className="row-between"><span><LoaderCircle size={16} className="spin"/> {progress.detail}</span><span>{Math.round(progress.complete/Math.max(1,progress.total)*100)}%</span></div><div className="track large"><span style={{width:`${Math.round(progress.complete/Math.max(1,progress.total)*100)}%`}}/></div><small>El tiempo depende de la cantidad y duración de las partidas y de tu dispositivo. Podés cancelar.</small></div>}
            {!analyzing&&!report&&<p className="card-note">El análisis inicial usa una búsqueda rápida de Stockfish Lite. Conviene empezar con 1–3 partidas; 20 o más pueden tardar bastante. No equivale a una revisión profunda de torneo.</p>}
            {report&&!analyzing&&<div className="analysis-done"><CheckCircle2 size={18}/><span>{report.analyzed} partidas examinadas · {report.positions} posiciones evaluadas · {gameMistakes.length} decisiones señaladas.</span></div>}
          </section>
          {report&&<><section className="review-grid"><article className="data-card review-left"><div className="card-head"><div><h3>Tu mapa de mejora</h3><p>Señales encontradas en las partidas examinadas</p></div><span className="card-icon"><BrainCircuit size={17}/></span></div><div className="diagnosis-list">{mistakeCards.map((d,i)=><div className="diagnosis" key={i}><span className="diagnosis-number">0{i+1}</span><div><b>{d.title}</b><p>{d.description}</p></div><span className="diagnosis-count">{d.count}</span></div>)}</div><div className="card-note">Estas categorías describen en qué fase perdés evaluación; no identifican automáticamente motivos tácticos precisos.</div></article>
            <article className="data-card"><div className="card-head"><div><h3>Posiciones de entrenamiento</h3><p>Ordenadas por mayor pérdida aproximada</p></div><span className="card-icon"><Target size={17}/></span></div><div className="mistake-list">{gameMistakes.length?gameMistakes.slice(0,15).map(item=><button key={item.id} className={`mistake-line ${chosen?.id===item.id?'active':''}`} onClick={()=>selectMistake(item)}><span className="mistake-title">{item.moveNumber}.{item.color==='black'?'..':''} {item.played} <small>vs. {item.opponent}</small></span><span className={`risk risk-${item.severity.replace(' ','-')}`}>{item.severity}</span><ChevronRight size={15}/></button>):<div className="no-mistakes">No detectamos pérdidas sobre el umbral elegido en esta muestra.</div>}</div></article></section>
            {chosen&&<section className="puzzle-panel"><div className="puzzle-left"><div className="eyebrow slim">PASO 03 · APRENDÉ HACIENDO</div><h2>¿Qué hubieras jugado acá?</h2><p>Esta posición apareció contra <b>{chosen.opponent}</b>, antes de tu jugada <b>{chosen.played}</b>. Jugás con {chosen.color==='white'?'blancas':'negras'}. Hacé clic en una pieza y luego en su casilla de destino.</p><div className="exercise-stat"><span>Fase</span><strong>{chosen.phase}</strong></div><div className="exercise-stat"><span>Caída aproximada</span><strong>{(chosen.lossCp/100).toFixed(2)} peones</strong></div><div className="exercise-stat"><span>Movimiento original</span><strong>{chosen.played}</strong></div>{feedback&&<p className={`puzzle-feedback ${reveal?'feedback-ok':''}`}>{feedback}</p>}{reveal?<div className="solution"><b>Jugada principal: {chosen.bestMoveSan}</b><p>Es la primera línea encontrada en el análisis rápido. Otras alternativas también podrían ser buenas; para confirmar una variante concreta, se necesita más profundidad.</p></div>:<button className="secondary-btn reveal-button" onClick={()=>setReveal(true)}>Mostrar jugada del motor</button>}<a className="game-link" href={chosen.gameUrl} target="_blank" rel="noreferrer">Ver partida original <ExternalLink size={14}/></a></div><div className="puzzle-board"><Board fen={chosen.fen} orientation={chosen.color} selectedSquare={fromSquare} onSquareClick={playPuzzleSquare}/></div></section>}
          </>}
          <section className="history-panel"><div className="panel-header"><div><h2>Historial importado</h2><p>Seleccionamos solo partidas estándar completadas.</p></div><span className="small-badge"><RefreshCcw size={14}/> Actualizá cuando quieras</span></div><div className="table-wrap"><table><thead><tr><th>Oponente</th><th>Resultado</th><th>Color</th><th>Modalidad</th><th>Fecha</th><th/></tr></thead><tbody>{games.map(g=><tr key={g.id}><td><b>{g.opponent}</b><small>{g.opening}</small></td><td><span className={`result result-${g.outcome}`}>{labelOutcome[g.outcome]}</span></td><td>{g.color==='white'?'Blancas':'Negras'}</td><td className="capitalize">{g.speed}</td><td>{formatDate(g.date)}</td><td><a href={g.url} target="_blank" rel="noreferrer" aria-label="Ver partida"><ExternalLink size={16}/></a></td></tr>)}</tbody></table></div></section>
        </div>}
      <footer><div className="brand foot-brand"><div className="brandmark">♞</div><span>ply<span className="mint">coach</span></span></div><div>Proyecto independiente · No afiliado a Chess.com ni a Lichess · Solo análisis posterior a las partidas · Nombre provisional</div><div><a href="https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it" target="_blank" rel="noreferrer">Chess.com PubAPI</a> · <a href="https://lichess-org.github.io/api/" target="_blank" rel="noreferrer">Lichess API</a> · <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer">GPL de Stockfish</a></div></footer>
    </main>
  </div>
}
