import {describe,it,expect,vi,afterEach} from 'vitest'
import {importGames,normalizeUsername} from '../src/lib/importers'
import {summarize,rate,diagnostics} from '../src/lib/analytics'
import type {SavedGame} from '../src/types'

const pgn=`[Event "Live Chess"]\n[Site "Chess.com"]\n[Date "2026.10.25"]\n[Round "-"]\n[White "me"]\n[Black "friend"]\n[Result "1-0"]\n[Opening "King's Pawn"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 1-0`

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('username validation',()=>{
  it('normalizes public usernames',()=>{expect(normalizeUsername(' @Some_User ')).toBe('Some_User')})
  it('rejects URLs and characters that are not in the permitted syntax',()=>{
    expect(()=>normalizeUsername('https://api.chess.com/')).toThrow()
    expect(()=>normalizeUsername('a/b')).toThrow()
  })
})
describe('Chess.com importer',()=>{
  it('loads a completed standard PGN from the official monthly archives',async()=>{
    const fakeFetch=vi.fn(async (url:string)=> {
      if(url.endsWith('/archives'))return {ok:true,status:200,json:async()=>({archives:['https://api.chess.com/pub/player/me/games/2026/10']})}
      return {ok:true,status:200,json:async()=>({games:[{url:'https://www.chess.com/game/live/123',end_time:1792890000,rules:'chess',pgn,time_class:'rapid',white:{username:'me',rating:1250,result:'win'},black:{username:'friend',rating:1300,result:'resigned'}}]})}
    })
    vi.stubGlobal('fetch',fakeFetch)
    const result=await importGames('chesscom','me',20)
    expect(result.games).toHaveLength(1)
    expect(result.games[0].outcome).toBe('win')
    expect(result.games[0].opening).toBe("King's Pawn")
    expect(result.games[0].moves).toHaveLength(8)
  })
})
describe('Lichess importer',()=>{
  it('parses NDJSON exports of completed games',async()=>{
    const record={id:'foo123',variant:'standard',lastMoveAt:1792890000000,speed:'blitz',winner:'black',
      moves:'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6',players:{white:{user:{name:'me'},rating:1200},black:{user:{name:'friend'},rating:1180}},opening:{name:'Italian Game'}}
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,text:async()=>JSON.stringify(record)+'\n'})))
    const result=await importGames('lichess','me',10)
    expect(result.games[0].outcome).toBe('loss')
    expect(result.games[0].opening).toBe('Italian Game')
    expect(result.games[0].moves).toHaveLength(8)
  })
})
describe('analytics',()=>{
  it('counts drawn games as half a point',()=>expect(rate(['win','draw','loss','draw'])).toBe(50))
  it('provides sensible output on empty histories',()=>{
    expect(summarize([]).total).toBe(0)
    expect(diagnostics([])[0].count).toBe(0)
  })
  it('computes color statistics from real outcomes',()=>{
    const template={id:'a',platform:'chesscom',username:'me',url:'',date:1,opponent:'x',color:'white',outcome:'win',rating:1200,opponentRating:1200,speed:'blitz',opening:'e4',pgn:'',moves:['e4','e5']} as SavedGame
    const result=summarize([template,{...template,id:'b',color:'black',outcome:'loss'}])
    expect(result.whiteRate).toBe(100)
    expect(result.blackRate).toBe(0)
  })
})
