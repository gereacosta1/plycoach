import {Chess} from 'chess.js'
const icons:Record<string,string>={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bn:'♞',bp:'♟'}
export default function Board({fen,orientation='white',onSquareClick,selectedSquare}:{fen:string;orientation?:'white'|'black';onSquareClick?:(square:string)=>void;selectedSquare?:string}) {
  const board=new Chess(fen).board()
  const squares=board.flat()
  return <div className="chessboard" aria-label="Tablero de ajedrez">
    {Array.from({length:64},(_,viewIndex)=>{
      const index=orientation==='white'?viewIndex:63-viewIndex
      const rank=Math.floor(index/8), file=index%8
      const piece=squares[index]
      const square=`${'abcdefgh'[file]}${8-rank}`
      const dark=(rank+file)%2===1
      return <button type="button" key={viewIndex} disabled={!onSquareClick}
        className={`square ${dark?'square-dark':'square-light'} ${square===selectedSquare?'square-selected':''}`}
        onClick={()=>onSquareClick?.(square)} aria-label={`Casilla ${square}${piece?`, ${piece.type} ${piece.color}`:''}`}>
        {file===(orientation==='white'?0:7)&&<small className="coord-rank">{8-rank}</small>}
        {rank===(orientation==='white'?7:0)&&<small className="coord-file">{'abcdefgh'[file]}</small>}
        {piece&&<span className={`piece piece-${piece.color}`}>{icons[piece.color+piece.type]}</span>}
      </button>
    })}
  </div>
}
