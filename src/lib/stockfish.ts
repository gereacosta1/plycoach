
import { Chess } from 'chess.js'
import type { Square, PieceSymbol } from 'chess.js'
import type {
  Mistake,
  Phase,
  SavedGame,
  ScanReport,
  Severity
} from '../types'

const ENGINES = [
  {
    label: 'Stockfish 19 Lite WASM',
    path: '/engine/stockfish-19-lite-single.js'
  },
  {
    label: 'Stockfish 19 ASM (compatibilidad)',
    path: '/engine/stockfish-19-asm.js'
  }
] as const

type Eval = {
  whiteCp: number
  bestMove: string
}

type Pending = {
  resolve: (value: Eval) => void
  reject: (error: Error) => void
  whiteToMove: boolean
  score: number | null
  timer: number
}

export class LocalEngine {
  private worker: Worker | null = null
  private pending: Pending | null = null
  private ready = false

  private readyPromise: Promise<void>
  private readyResolve: () => void = () => {}
  private readyReject: (error: Error) => void = () => {}

  private readyTimer = 0
  private dead = false
  private currentEngine = 0
  private startupErrors: string[] = []

  get engineLabel(): string {
    return ENGINES[this.currentEngine]?.label ?? 'Stockfish'
  }

  constructor() {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })

    this.startEngine(0)
  }

  private startEngine(index: number) {
    if (this.dead) return

    clearTimeout(this.readyTimer)
    this.worker?.terminate()
    this.worker = null
    this.ready = false
    this.currentEngine = index

    if (index >= ENGINES.length) {
      this.fail(
        new Error(
          'No se pudo iniciar ningún motor. ' +
          this.startupErrors.join(' | ') +
          '. Revisá la consola del navegador.'
        )
      )
      return
    }

    const selected = ENGINES[index]

    try {
      console.info(`[PlyCoach] Iniciando ${selected.label}`)

      const worker = new Worker(selected.path, {
        type: 'classic'
      })

      this.worker = worker

      worker.onmessage = (event: MessageEvent) => {
        if (this.worker === worker) {
          this.onMessage(String(event.data))
        }
      }

      worker.onerror = (event: ErrorEvent) => {
        event.preventDefault()

        console.error(
          `[PlyCoach] Error en ${selected.label}:`,
          event.message,
          event.filename,
          event.lineno
        )

        if (this.worker !== worker) return

        this.engineError(
          `${selected.label}: ${event.message || 'Error desconocido'}`
        )
      }

      worker.onmessageerror = () => {
        if (this.worker === worker) {
          this.engineError(
            `${selected.label}: error al recibir mensajes`
          )
        }
      }

      this.readyTimer = window.setTimeout(() => {
        if (this.worker === worker && !this.ready) {
          this.engineError(
            `${selected.label}: no respondió en 25 segundos`
          )
        }
      }, 25000)

      worker.postMessage('uci')

    } catch (error) {
      this.engineError(
        `${selected.label}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  private engineError(message: string) {
    if (this.dead) return

    if (this.ready) {
      this.fail(new Error(message))
      return
    }

    console.warn(
      `[PlyCoach] ${message}. Intentando motor alternativo.`
    )

    this.startupErrors.push(message)
    this.startEngine(this.currentEngine + 1)
  }

  private fail(error: Error) {
    if (this.dead) return

    this.dead = true

    clearTimeout(this.readyTimer)
    this.readyReject(error)

    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.reject(error)
      this.pending = null
    }

    this.worker?.terminate()
    this.worker = null
  }

  private onMessage(message: string) {
    for (const line of message.split(/\r?\n/)) {
      const text = line.trim()

      if (!this.ready && text === 'uciok') {
        this.worker?.postMessage(
          'setoption name Hash value 16'
        )
        this.worker?.postMessage('isready')
        continue
      }

      if (!this.ready && text === 'readyok') {
        this.ready = true

        clearTimeout(this.readyTimer)

        console.info(
          `[PlyCoach] Motor iniciado: ${this.engineLabel}`
        )

        this.readyResolve()
        continue
      }

      const pending = this.pending
      if (!pending) continue

      if (
        text.startsWith('info ') &&
        text.includes(' score ')
      ) {
        const cp = text.match(/\bscore cp (-?\d+)/)
        const mate = text.match(/\bscore mate (-?\d+)/)

        if (cp) {
          pending.score = Number(cp[1])
        } else if (mate) {
          pending.score =
            Number(mate[1]) > 0 ? 1200 : -1200
        }
      }

      if (text.startsWith('bestmove ')) {
        const move = text.split(/\s+/)[1] ?? ''

        clearTimeout(pending.timer)
        this.pending = null

        const score = pending.score ?? 0

        pending.resolve({
          whiteCp: pending.whiteToMove ? score : -score,
          bestMove: move
        })
      }
    }
  }

  async evaluate(
    fen: string,
    movetime = 80
  ): Promise<Eval> {
    await this.readyPromise

    if (this.dead || !this.worker) {
      throw new Error('El motor está detenido')
    }

    if (this.pending) {
      throw new Error(
        'Ya se está evaluando una posición'
      )
    }

    const whiteToMove =
      fen.split(' ')[1] === 'w'

    return new Promise<Eval>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.fail(
          new Error(
            'El análisis tardó demasiado. Revisá la consola.'
          )
        )
      }, 18000)

      this.pending = {
        resolve,
        reject,
        timer,
        whiteToMove,
        score: null
      }

      this.worker?.postMessage(
        'position fen ' + fen
      )

      this.worker?.postMessage(
        'go movetime ' + movetime
      )
    })
  }

  stop() {
    this.fail(new Error('Análisis cancelado'))
  }
}

function phaseOf(board: Chess, ply: number): Phase {
  if (ply <= 20) return 'apertura'

  const material = board
    .board()
    .flat()
    .filter(
      square =>
        square &&
        square.type !== 'p' &&
        square.type !== 'k'
    ).length

  return material <= 4 ? 'final' : 'medio juego'
}

function severity(lossCp: number): Severity {
  if (lossCp >= 300) return 'error grave'
  if (lossCp >= 140) return 'error'
  return 'imprecisión'
}

function bestSan(fen: string, uci: string): string {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return '—'
  }

  try {
    const chess = new Chess(fen)

    const move = chess.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: uci[4] as PieceSymbol | undefined
    })

    return move?.san ?? '—'
  } catch {
    return '—'
  }
}

export async function analyzeGames(
  games: SavedGame[],
  onProgress: (
    complete: number,
    total: number,
    detail: string
  ) => void,
  abortSignal: AbortSignal
): Promise<ScanReport> {

  const engine = new LocalEngine()
  const result: Mistake[] = []
  let positions = 0

  const cancelEngine = () => engine.stop()

  abortSignal.addEventListener(
    'abort',
    cancelEngine,
    { once: true }
  )

  try {
    const total = games.reduce(
      (sum, game) =>
        sum + Math.min(game.moves.length, 100),
      0
    )

    for (
      let gameIndex = 0;
      gameIndex < games.length;
      gameIndex++
    ) {
      const game = games[gameIndex]
      const chess = new Chess()

      let previous: Eval | null = null

      for (
        let i = 0;
        i < Math.min(game.moves.length, 100);
        i++
      ) {
        if (abortSignal.aborted) {
          throw new Error('Análisis cancelado')
        }

        const before =
          previous ??
          await engine.evaluate(chess.fen())

        const fen = chess.fen()
        const phase = phaseOf(chess, i)

        const played = chess.move(game.moves[i])

        if (!played) break

        const after = await engine.evaluate(
          chess.fen()
        )

        const isUser =
          (i % 2 === 0 && game.color === 'white') ||
          (i % 2 === 1 && game.color === 'black')

        if (isUser && i >= 6) {
          const sign =
            game.color === 'white' ? 1 : -1

          const loss = Math.max(
            0,
            Math.round(
              (before.whiteCp - after.whiteCp) * sign
            )
          )

          if (
            loss >= 65 &&
            loss <= 2400 &&
            before.bestMove !== '(none)'
          ) {
            result.push({
              id: `${game.id}-${i}`,
              gameId: game.id,
              gameUrl: game.url,
              opponent: game.opponent,
              ply: i,
              moveNumber: Math.floor(i / 2) + 1,
              played: played.san,
              bestMove: before.bestMove,
              bestMoveSan: bestSan(
                fen,
                before.bestMove
              ),
              fen,
              lossCp: loss,
              severity: severity(loss),
              phase,
              color: game.color
            })
          }
        }

        previous = after
        positions++

        if (
          positions % 4 === 0 ||
          i === Math.min(game.moves.length, 100) - 1
        ) {
          onProgress(
            positions,
            total,
            `Partida ${gameIndex + 1}/${games.length} · movimiento ${Math.floor(i / 2) + 1}`
          )
        }
      }
    }

    return {
      analyzed: games.length,
      positions,
      mistakes: result.sort(
        (a, b) => b.lossCp - a.lossCp
      ),
      date: Date.now(),
      engine:
        `${engine.engineLabel} · análisis rápido aproximado`
    }

  } finally {
    abortSignal.removeEventListener(
      'abort',
      cancelEngine
    )
    engine.stop()
  }
}
