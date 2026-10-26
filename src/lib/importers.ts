import { Chess } from 'chess.js'
import type { Outcome, Platform, SavedGame } from '../types'

type ChessUser = { username: string; rating?: number; result?: string }
type ChessApiGame = {
  url: string; pgn?: string; end_time?: number; time_class?: string; rules?: string;
  white: ChessUser; black: ChessUser;
}
type LichessUser = { user?: { name?: string; id?: string }; rating?: number }
type LichessApiGame = {
  id: string; createdAt?: number; lastMoveAt?: number; moves?: string;
  status?: string; speed?: string; variant?: string; winner?: 'white' | 'black';
  players: { white?: LichessUser; black?: LichessUser };
  opening?: { name?: string; eco?: string }
}

export function normalizeUsername(value: string): string {
  const cleaned = value.trim().replace(/^@/,'')
  if (!/^[a-zA-Z0-9._-]{2,35}$/.test(cleaned)) throw new Error('Ingresá un usuario válido, sin URL ni espacios.')
  return cleaned
}
async function fetchChecked(url: string, headers: HeadersInit = {}): Promise<Response> {
  let response: Response
  try { response = await fetch(url, { headers, signal: AbortSignal.timeout(25000) }) }
  catch { throw new Error('No pudimos conectar con la plataforma. Revisá tu conexión o probá más tarde. Algunas redes bloquean estas solicitudes.') }
  if (response.status === 404) throw new Error('No encontramos ese usuario o no tiene partidas públicas.')
  if (response.status === 429) throw new Error('La plataforma está limitando solicitudes. Probá de nuevo más tarde.')
  if (!response.ok) throw new Error(`La plataforma respondió con un error (${response.status}).`)
  return response
}
function outcomeFromResult(me: ChessUser, opponent: ChessUser): Outcome {
  if (me.result === 'win') return 'win'
  if (opponent.result === 'win') return 'loss'
  const drawCodes = new Set(['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient'])
  return drawCodes.has(me.result ?? '') || drawCodes.has(opponent.result ?? '') ? 'draw' : 'loss'
}
function openingFromMoves(moves: string[]): string {
  if (!moves.length) return 'Apertura no disponible'
  return moves.slice(0,4).map((m,i) => `${i%2===0?`${Math.floor(i/2)+1}.`:''}${m}`).join(' ')
}
function parseChessCom(game: ChessApiGame, username: string): SavedGame | null {
  if (game.rules && game.rules !== 'chess') return null
  if (!game.pgn || !game.end_time) return null
  try {
    const board = new Chess(); board.loadPgn(game.pgn)
    const moves = board.history()
    if (moves.length < 4) return null
    const color = game.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black'
    const me = color === 'white' ? game.white : game.black
    const opponent = color === 'white' ? game.black : game.white
    const headers = board.header()
    return {
      id: `chesscom-${game.url}`, platform:'chesscom', username, url:game.url,
      date:game.end_time*1000, opponent:opponent.username, color,
      outcome:outcomeFromResult(me,opponent), rating:me.rating??null,
      opponentRating:opponent.rating??null, speed:game.time_class??'sin categoría',
      opening:headers.Opening || openingFromMoves(moves), pgn:game.pgn, moves
    }
  } catch { return null }
}
function parseLichess(game: LichessApiGame, username: string): SavedGame | null {
  if (game.variant && game.variant !== 'standard') return null
  if (!game.moves) return null
  try {
    const moves = game.moves.trim().split(/\s+/)
    const board = new Chess()
    for (const move of moves) if (!board.move(move)) return null
    if (moves.length < 4) return null
    const whiteName = game.players.white?.user?.name ?? game.players.white?.user?.id ?? 'Anónimo'
    const blackName = game.players.black?.user?.name ?? game.players.black?.user?.id ?? 'Anónimo'
    const color = whiteName.toLowerCase() === username.toLowerCase() ? 'white' : 'black'
    const mine = color === 'white' ? game.players.white : game.players.black
    const theirs = color === 'white' ? game.players.black : game.players.white
    const opponent = color === 'white' ? blackName : whiteName
    const outcome: Outcome = !game.winner ? 'draw' : game.winner === color ? 'win' : 'loss'
    return {
      id:`lichess-${game.id}`, platform:'lichess', username, url:`https://lichess.org/${encodeURIComponent(game.id)}`,
      date:game.lastMoveAt??game.createdAt??0, opponent, color, outcome,
      rating:mine?.rating??null, opponentRating:theirs?.rating??null,
      speed:game.speed??'sin categoría', opening:game.opening?.name || openingFromMoves(moves),
      pgn:board.pgn(), moves:board.history()
    }
  } catch { return null }
}
async function fetchChessCom(username: string, count: number): Promise<SavedGame[]> {
  const root = `https://api.chess.com/pub/player/${encodeURIComponent(username)}`
  const archives = await fetchChecked(`${root}/games/archives`)
  const archiveData = await archives.json() as {archives?:string[]}
  const months = (archiveData.archives ?? []).filter(url => /^https:\/\/api\.chess\.com\/pub\/player\//.test(url)).reverse()
  const result: SavedGame[] = []
  for (const month of months) {
    if (result.length >= count) break
    const response = await fetchChecked(month)
    const data = await response.json() as {games?:ChessApiGame[]}
    for (const entry of (data.games??[]).slice().reverse()) {
      const item = parseChessCom(entry, username)
      if (item) result.push(item)
      if (result.length >= count) break
    }
  }
  return result.sort((a,b)=>b.date-a.date).slice(0,count)
}
async function fetchLichess(username: string, count: number): Promise<SavedGame[]> {
  const query = new URLSearchParams({ max:String(count), finished:'true', moves:'true', opening:'true', sort:'dateDesc', ongoing:'false' })
  const response = await fetchChecked(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${query}`, {Accept:'application/x-ndjson'})
  const text = await response.text()
  const parsed: SavedGame[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {const record = JSON.parse(line) as LichessApiGame; const game = parseLichess(record,username); if(game) parsed.push(game)} catch {continue}
  }
  return parsed.sort((a,b)=>b.date-a.date).slice(0,count)
}
export async function importGames(platform: Platform, requested: string, count: number): Promise<{username:string;games:SavedGame[]}> {
  const username = normalizeUsername(requested)
  const games = platform==='chesscom' ? await fetchChessCom(username,count) : await fetchLichess(username,count)
  if (!games.length) throw new Error('No encontramos partidas estándar terminadas con movimientos accesibles.')
  return {username,games}
}
