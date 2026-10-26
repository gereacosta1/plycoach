export type Platform = 'chesscom' | 'lichess'
export type Outcome = 'win' | 'loss' | 'draw'
export type Phase = 'apertura' | 'medio juego' | 'final'
export type Severity = 'imprecisión' | 'error' | 'error grave'
export interface SavedGame {
  id: string
  platform: Platform
  username: string
  url: string
  date: number
  opponent: string
  color: 'white' | 'black'
  outcome: Outcome
  rating: number | null
  opponentRating: number | null
  speed: string
  opening: string
  pgn: string
  moves: string[]
}
export interface Mistake {
  id: string
  gameId: string
  gameUrl: string
  opponent: string
  ply: number
  moveNumber: number
  played: string
  bestMove: string
  bestMoveSan: string
  fen: string
  lossCp: number
  severity: Severity
  phase: Phase
  color: 'white' | 'black'
}
export interface ScanReport {
  analyzed: number
  positions: number
  mistakes: Mistake[]
  date: number
  engine: string
}
