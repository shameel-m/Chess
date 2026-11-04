"use strict";
const GLYPH = { k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟" };
const VALUE = { p:1, n:3, b:3, r:5, q:9, k:0 };

// Pure game logic: no DOM, so the engine can be tested on its own.
function inside(r, c){ return r >= 0 && r < 8 && c >= 0 && c < 8; }
function opp(color){ return color === "w" ? "b" : "w"; }

function cloneBoard(b){
  return b.map(row => row.map(cell => cell ? { type:cell.type, color:cell.color } : null));
}

function findKing(board, color){
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++){
      const p = board[r][c];
      if(p && p.type === "k" && p.color === color) return { r, c };
    }
  return null;
}


function isSquareAttacked(board, r, c, byColor){
 
  const pd = byColor === "w" ? 1 : -1;
  for(const dc of [-1, 1]){
    const pr = r + pd, pc = c + dc;
    if(inside(pr, pc)){ const p = board[pr][pc]; if(p && p.color === byColor && p.type === "p") return true; }
  }
  // Knights
  const kn = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for(const [dr, dc] of kn){
    const pr = r + dr, pc = c + dc;
    if(inside(pr, pc)){ const p = board[pr][pc]; if(p && p.color === byColor && p.type === "n") return true; }
  }
  // King (adjacent)
  for(let dr = -1; dr <= 1; dr++)
    for(let dc = -1; dc <= 1; dc++){
      if(!dr && !dc) continue;
      const pr = r + dr, pc = c + dc;
      if(inside(pr, pc)){ const p = board[pr][pc]; if(p && p.color === byColor && p.type === "k") return true; }
    }
  // Bishops / Queens (diagonals)
  for(const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
    let pr = r + dr, pc = c + dc;
    while(inside(pr, pc)){
      const p = board[pr][pc];
      if(p){ if(p.color === byColor && (p.type === "b" || p.type === "q")) return true; break; }
      pr += dr; pc += dc;
    }
  }

  for(const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    let pr = r + dr, pc = c + dc;
    while(inside(pr, pc)){
      const p = board[pr][pc];
      if(p){ if(p.color === byColor && (p.type === "r" || p.type === "q")) return true; break; }
      pr += dr; pc += dc;
    }
  }
  return false;
}


function pseudoMovesFrom(board, r, c, castling, enPassant){
  const piece = board[r][c];
  if(!piece) return [];
  const color = piece.color;
  const moves = [];
  const add = (tr, tc, flags) => {
    const target = board[tr][tc];
    moves.push({
      from:{ r, c }, to:{ r:tr, c:tc },
      piece:{ type:piece.type, color },
      captured: target ? { type:target.type, color:target.color } : null,
      flags: flags || {}
    });
  };

  if(piece.type === "p"){
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promoRow = color === "w" ? 0 : 7;
    // forward one
    if(inside(r + dir, c) && !board[r + dir][c]){
      add(r + dir, c, (r + dir === promoRow) ? { promotion:true } : {});
      // forward two
      if(r === startRow && !board[r + 2 * dir][c]) add(r + 2 * dir, c, { doublePawn:true });
    }
    
    for(const dc of [-1, 1]){
      const tr = r + dir, tc = c + dc;
      if(!inside(tr, tc)) continue;
      const t = board[tr][tc];
      if(t && t.color !== color){
        add(tr, tc, (tr === promoRow) ? { promotion:true } : {});
      } else if(!t && enPassant && enPassant.r === tr && enPassant.c === tc){
        add(tr, tc, { enPassant:true });
      }
    }
  }
  else if(piece.type === "n"){
    for(const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
      const tr = r + dr, tc = c + dc;
      if(inside(tr, tc)){ const t = board[tr][tc]; if(!t || t.color !== color) add(tr, tc, {}); }
    }
  }
  else if(piece.type === "b" || piece.type === "r" || piece.type === "q"){
    const dirs = [];
    if(piece.type !== "r") dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
    if(piece.type !== "b") dirs.push([-1,0],[1,0],[0,-1],[0,1]);
    for(const [dr, dc] of dirs){
      let tr = r + dr, tc = c + dc;
      while(inside(tr, tc)){
        const t = board[tr][tc];
        if(!t){ add(tr, tc, {}); }
        else { if(t.color !== color) add(tr, tc, {}); break; }
        tr += dr; tc += dc;
      }
    }
  }
  else if(piece.type === "k"){
    for(let dr = -1; dr <= 1; dr++)
      for(let dc = -1; dc <= 1; dc++){
        if(!dr && !dc) continue;
        const tr = r + dr, tc = c + dc;
        if(inside(tr, tc)){ const t = board[tr][tc]; if(!t || t.color !== color) add(tr, tc, {}); }
      }
    // Castling
    const home = color === "w" ? 7 : 0;
    if(r === home && c === 4 && castling && !isSquareAttacked(board, home, 4, opp(color))){
      // king side
      if(castling[color].k){
        const rook = board[home][7];
        if(rook && rook.type === "r" && rook.color === color &&
           !board[home][5] && !board[home][6] &&
           !isSquareAttacked(board, home, 5, opp(color)) &&
           !isSquareAttacked(board, home, 6, opp(color))){
          add(home, 6, { castle:"k" });
        }
      }
      // queen side
      if(castling[color].q){
        const rook = board[home][0];
        if(rook && rook.type === "r" && rook.color === color &&
           !board[home][1] && !board[home][2] && !board[home][3] &&
           !isSquareAttacked(board, home, 3, opp(color)) &&
           !isSquareAttacked(board, home, 2, opp(color))){
          add(home, 2, { castle:"q" });
        }
      }
    }
  }
  return moves;
}


function boardAfter(board, move){
  const b = cloneBoard(board);
  const { from, to, flags, piece } = move;
  b[to.r][to.c] = b[from.r][from.c];
  b[from.r][from.c] = null;
  if(flags.enPassant) b[from.r][to.c] = null;          
  if(flags.castle === "k"){ b[to.r][5] = b[to.r][7]; b[to.r][7] = null; }
  if(flags.castle === "q"){ b[to.r][3] = b[to.r][0]; b[to.r][0] = null; }
  if(flags.promotion) b[to.r][to.c] = { type: move.promoteTo || "q", color: piece.color };
  return b;
}


function legalMovesAt(board, r, c, castling, enPassant){
  const piece = board[r][c];
  if(!piece) return [];
  return pseudoMovesFrom(board, r, c, castling, enPassant).filter(m => {
    const b = boardAfter(board, m);
    const k = findKing(b, piece.color);
    return k && !isSquareAttacked(b, k.r, k.c, opp(piece.color));
  });
}

function hasAnyLegalMove(board, color, castling, enPassant){
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++){
      const p = board[r][c];
      if(p && p.color === color && legalMovesAt(board, r, c, castling, enPassant).length) return true;
    }
  return false;
}


function computeStatus(board, color, castling, enPassant){
  const k = findKing(board, color);
  const inCheck = k && isSquareAttacked(board, k.r, k.c, opp(color));
  const anyMove = hasAnyLegalMove(board, color, castling, enPassant);
  if(inCheck && !anyMove) return "checkmate";
  if(!inCheck && !anyMove) return "stalemate";
  return inCheck ? "check" : "playing";
}


function positionKey(board, turn, castling, enPassant){
  let s = "";
  for(let r = 0; r < 8; r++){
    for(let c = 0; c < 8; c++){
      const p = board[r][c];
      s += p ? (p.color === "w" ? p.type.toUpperCase() : p.type) : ".";
    }
    s += "/";
  }
  const cr = (castling.w.k ? "K" : "") + (castling.w.q ? "Q" : "") +
             (castling.b.k ? "k" : "") + (castling.b.q ? "q" : "");
  s += " " + turn + " " + (cr || "-") + " " + (enPassant ? enPassant.r + "" + enPassant.c : "-");
  return s;
}

// True when neither side has enough material to deliver checkmate:
// K vs K, K+B vs K, K+N vs K, or K+B vs K+B with both bishops on one colour.
function isInsufficientMaterial(board){
  const minors = [];
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++){
      const p = board[r][c];
      if(!p || p.type === "k") continue;
      if(p.type === "p" || p.type === "r" || p.type === "q") return false;  // mating material
      minors.push({ type: p.type, color: p.color, square: (r + c) % 2 });   // bishop / knight
    }
  if(minors.length <= 1) return true;                  // K vs K, or K + one minor vs K
  if(minors.length === 2){
    const [a, b] = minors;                             // K+B vs K+B, same-coloured bishops
    return a.type === "b" && b.type === "b" && a.color !== b.color && a.square === b.square;
  }
  return false;
}

function initialBoard(){
  const b = Array.from({ length:8 }, () => Array(8).fill(null));
  const back = ["r","n","b","q","k","b","n","r"];
  for(let c = 0; c < 8; c++){
    b[0][c] = { type:back[c], color:"b" };
    b[1][c] = { type:"p", color:"b" };
    b[6][c] = { type:"p", color:"w" };
    b[7][c] = { type:back[c], color:"w" };
  }
  return b;
}

const state = {
  board: [], turn: "w",
  castling: { w:{ k:true, q:true }, b:{ k:true, q:true } },
  enPassant: null,
  captured: { w:[], b:[] },   // captured.w = pieces White has captured
  status: "playing",
  selected: null,             // { r, c }
  legalForSelected: [],       // moves available from the selected square
  mode: "two",                // "two" | "ai"
  humanColor: "w",            // side the human plays when mode === "ai"
  difficulty: "easy",         // "easy" | "hard"
  aiThinking: false,          // true while the AI computes (board is locked)
  halfmoveClock: 0,           // plies since the last pawn move/capture (50-move rule)
  positionCounts: {},         // position key -> times seen (threefold repetition)
  currentRepetitions: 1,      // times the current position has occurred
  drawReason: null,           // "insufficient" | "fiftymove" | "threefold" | null
  lastMove: null,             // { from:{r,c}, to:{r,c} } of the previous move
  moveHistory: []             // SAN moves, used to export the game as PGN
};

function cloneGameState(){
  return JSON.parse(JSON.stringify({
    board:state.board, turn:state.turn, castling:state.castling, enPassant:state.enPassant,
    captured:state.captured, status:state.status, halfmoveClock:state.halfmoveClock,
    positionCounts:state.positionCounts, currentRepetitions:state.currentRepetitions,
    drawReason:state.drawReason, lastMove:state.lastMove, moveHistory:state.moveHistory
  }));
}
function saveTimelinePosition(){
  gameTimeline = gameTimeline.slice(0, timelineIndex + 1);
  gameTimeline.push(cloneGameState());
  timelineIndex = gameTimeline.length - 1;
}
function restoreTimelinePosition(index){
  const snap = gameTimeline[index]; if(!snap) return;
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  state.selected = null; state.legalForSelected = []; state.aiThinking = false;
  timelineIndex = index; render();
}
function cancelPendingAI(){
  if(aiTimer !== null){ clearTimeout(aiTimer); aiTimer = null; }
  state.aiThinking = false;
}
function undoComputerTurn(){
  if(state.mode !== "ai" || timelineIndex <= 0) return;
  cancelPendingAI();
  do { timelineIndex--; restoreTimelinePosition(timelineIndex); }
  while(timelineIndex > 0 && state.turn !== state.humanColor);
  render();
}
function redoComputerTurn(){
  if(state.mode !== "ai" || timelineIndex >= gameTimeline.length - 1) return;
  cancelPendingAI();
  do { timelineIndex++; restoreTimelinePosition(timelineIndex); }
  while(timelineIndex < gameTimeline.length - 1 && state.turn !== state.humanColor);
  if(state.turn !== state.humanColor) maybeTriggerAI();
  render();
}
function newGame(){
  cancelPendingAI(); gameTimeline = []; timelineIndex = -1;
  state.board = initialBoard();
  state.turn = "w";
  state.castling = { w:{ k:true, q:true }, b:{ k:true, q:true } };
  state.enPassant = null;
  state.captured = { w:[], b:[] };
  state.status = "playing";
  state.selected = null;
  state.legalForSelected = [];
  state.aiThinking = false;
  state.lastMove = null;
  state.moveHistory = [];
  state.halfmoveClock = 0;
  state.drawReason = null;
  state.positionCounts = {};
  state.positionCounts[positionKey(state.board, state.turn, state.castling, state.enPassant)] = 1;
  state.currentRepetitions = 1;
  saveTimelinePosition();
  render();
  maybeTriggerAI();   // if the human chose Black, the AI (White) opens
}


function algebraicSquare(square){
  return "abcdefgh"[square.c] + (8 - square.r);
}

// Build standard algebraic notation from the position before a move.
function sanForMove(move){
  const {from, to, piece, flags} = move;
  if(flags.castle) return flags.castle === "k" ? "O-O" : "O-O-O";

  const capture = !!move.captured || !!flags.enPassant;
  let san = "";
  if(piece.type === "p"){
    if(capture) san += "abcdefgh"[from.c];
  } else {
    san += piece.type.toUpperCase();
    const alternatives = allLegalMoves(state.board, state.turn, state.castling, state.enPassant)
      .filter(other => other.to.r === to.r && other.to.c === to.c &&
        other.piece.type === piece.type &&
        (other.from.r !== from.r || other.from.c !== from.c));
    if(alternatives.length){
      const sameFile = alternatives.some(other => other.from.c === from.c);
      const sameRank = alternatives.some(other => other.from.r === from.r);
      if(!sameFile) san += "abcdefgh"[from.c];
      else if(!sameRank) san += String(8 - from.r);
      else san += algebraicSquare(from);
    }
  }
  san += capture ? "x" : "";
  san += algebraicSquare(to);
  if(flags.promotion) san += "=" + (move.promoteTo || "q").toUpperCase();
  return san;
}

function pgnResult(){
  if(state.status === "checkmate") return state.turn === "w" ? "0-1" : "1-0";
  if(state.status === "stalemate" || state.status === "draw") return "1/2-1/2";
  return "*";
}
function makePGN(){
  const result = pgnResult();
  const date = new Date();
  const dateTag = date.getFullYear() + "." +
    String(date.getMonth()+1).padStart(2,"0") + "." +
    String(date.getDate()).padStart(2,"0");
  const white = state.mode === "ai" && state.humanColor === "b" ? "Computer" : "Player";
  const black = state.mode === "ai" && state.humanColor === "w" ? "Computer" : "Player";
  const tags = [
    '[Event "Casual Game"]',
    '[Site "Local Chess App"]',
    '[Date "' + dateTag + '"]',
    '[Round "-"]',
    '[White "' + white + '"]',
    '[Black "' + black + '"]',
    '[Result "' + result + '"]'
  ];
  const moves = [];
  for(let i=0; i<state.moveHistory.length; i++){
    if(i % 2 === 0) moves.push((Math.floor(i/2)+1) + ". " + state.moveHistory[i]);
    else moves[moves.length-1] += " " + state.moveHistory[i];
  }
  const movetext = (moves.join(" ") + (moves.length ? " " : "") + result).trim();
  return tags.join("\n") + "\n\n" + movetext;
}

async function copyGamePGN(){
  const button = document.getElementById("copyGame");
  const message = document.getElementById("copyStatus");
  const pgn = makePGN();
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(pgn);
    } else {
      const field = document.createElement("textarea");
      field.value = pgn;
      field.setAttribute("readonly","");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if(!copied) throw new Error("Clipboard unavailable");
    }
    button.textContent = "Copied!";
    message.textContent = "Game copied in PGN format.";
  } catch(error){
    message.textContent = "Could not access clipboard. Try opening the page in a secure browser tab.";
  }
  window.clearTimeout(copyGamePGNTimer);
  copyGamePGNTimer = window.setTimeout(() => {
    button.textContent = "Copy Game";
    message.textContent = "";
  }, 2200);
}
let copyGamePGNTimer = null;

// Commit a (legal) move to the live state.
function executeMove(move){
  const notation = sanForMove(move);
  const color = move.piece.color;

  // record captured piece for the tray
  let cap = move.captured;
  if(move.flags.enPassant) cap = { type:"p", color:opp(color) };
  if(cap) state.captured[color].push(cap);

  // an irreversible move (pawn move or capture) resets the draw counters
  const irreversible = move.piece.type === "p" || !!move.captured || !!move.flags.enPassant;

  // advance board / castling rights / en passant / turn (shared with the AI search)
  const pos = nextPosition(
    { board:state.board, turn:state.turn, castling:state.castling, enPassant:state.enPassant },
    move
  );
  state.board = pos.board;
  state.castling = pos.castling;
  state.enPassant = pos.enPassant;
  state.turn = pos.turn;
  state.lastMove = { from: { r: move.from.r, c: move.from.c }, to: { r: move.to.r, c: move.to.c } };

  // 50-move rule: count plies since the last pawn move or capture
  state.halfmoveClock = irreversible ? 0 : state.halfmoveClock + 1;

  // threefold repetition: an irreversible move makes earlier positions unreachable
  if(irreversible) state.positionCounts = {};
  const key = positionKey(state.board, state.turn, state.castling, state.enPassant);
  state.positionCounts[key] = (state.positionCounts[key] || 0) + 1;
  state.currentRepetitions = state.positionCounts[key];

  state.status = computeFullStatus();
  state.moveHistory.push(notation + (state.status === "checkmate" ? "#" :
    state.status === "check" ? "+" : ""));
  saveTimelinePosition();
}

// Position status (mate/stalemate/check) combined with the history-based draw
// rules. Sets state.drawReason. Checkmate/stalemate take priority over draws,
// so a mating move on the 100th ply or 3rd repetition still wins.
function computeFullStatus(){
  // draws were so confusing ngl. pretty sure this whole thing runs on vibes
  const base = computeStatus(state.board, state.turn, state.castling, state.enPassant);
  if(base === "checkmate" || base === "stalemate"){ state.drawReason = null; return base; }
  if(isInsufficientMaterial(state.board)){ state.drawReason = "insufficient"; return "draw"; }
  if(state.halfmoveClock >= 100){ state.drawReason = "fiftymove"; return "draw"; }
  if(state.currentRepetitions >= 3){ state.drawReason = "threefold"; return "draw"; }
  state.drawReason = null;
  return base;
}

// The game is finished (no further moves) on checkmate, stalemate, or any draw.
function gameOver(){
  return state.status === "checkmate" || state.status === "stalemate" || state.status === "draw";
}

// Advance a lightweight position { board, turn, castling, enPassant } by one
// move. Mirrors executeMove's bookkeeping but stays pure, so the search can
// explore freely without touching live state. (No new rules logic here.)
function nextPosition(pos, move){
  // dont touch this. spent forever getting castling rights right and it finally works
  const color = move.piece.color;
  const board = boardAfter(pos.board, move);
  const castling = {
    w: { k: pos.castling.w.k, q: pos.castling.w.q },
    b: { k: pos.castling.b.k, q: pos.castling.b.q }
  };
  const home = color === "w" ? 7 : 0;
  if(move.piece.type === "k"){ castling[color].k = false; castling[color].q = false; }
  if(move.piece.type === "r"){
    if(move.from.r === home && move.from.c === 7) castling[color].k = false;
    if(move.from.r === home && move.from.c === 0) castling[color].q = false;
  }
  const oc = opp(color), oh = oc === "w" ? 7 : 0;
  if(move.to.r === oh && move.to.c === 7) castling[oc].k = false;
  if(move.to.r === oh && move.to.c === 0) castling[oc].q = false;
  const enPassant = move.flags.doublePawn
    ? { r: (move.from.r + move.to.r) / 2, c: move.from.c }
    : null;
  return { board, turn: oc, castling, enPassant };
}

// Gather every legal move for one side (reuses legalMovesAt, same rules).
function allLegalMoves(board, color, castling, enPassant){
  const moves = [];
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++){
      const p = board[r][c];
      if(p && p.color === color){
        const ms = legalMovesAt(board, r, c, castling, enPassant);
        for(let i = 0; i < ms.length; i++) moves.push(ms[i]);
      }
    }
  return moves;
}

// Central-control weighting (more central = higher), scaled to centipawns.
const CENTER = [
  [0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,2,2,2,1,0],
  [0,1,2,3,3,2,1,0],
  [0,1,2,3,3,2,1,0],
  [0,1,2,2,2,2,1,0],
  [0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0]
];

function kingSafety(board, r, c, color){
  let s = 0;
  const dir = color === "w" ? -1 : 1;
  for(const dc of [-1, 0, 1]){                 // friendly pawns shielding the king
    const pr = r + dir, pc = c + dc;
    if(inside(pr, pc)){ const q = board[pr][pc]; if(q && q.type === "p" && q.color === color) s += 10; }
  }
  s += (c >= 6 || c <= 2) ? 8 : -6;            // tucked toward a corner vs exposed centre
  return s;
}

// Static evaluation from White's perspective (centipawns; + favours White).
function evaluate(board){
  let score = 0;
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++){
      const p = board[r][c];
      if(!p) continue;
      const sign = p.color === "w" ? 1 : -1;
      score += sign * VALUE[p.type] * 100;                              // material
      if(p.type !== "k" && p.type !== "r") score += sign * CENTER[r][c] * 8;   // centre
      if(p.type === "k") score += sign * kingSafety(board, r, c, p.color);     // king safety
    }
  return score;
}

// Move ordering (captures/promotions first) sharpens alpha-beta pruning.
function moveScore(m){
  let k = 0;
  if(m.captured) k += 10 + VALUE[m.captured.type];
  else if(m.flags.enPassant) k += 11;
  if(m.flags.promotion) k += 9;
  return k;
}
function orderMoves(moves){ return moves.slice().sort((a, b) => moveScore(b) - moveScore(a)); }

function shuffle(a){
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Easy: greedy. Grab the highest-value capture if one exists, else play a
// random legal move. No lookahead.
function aiEasyMove(moves){
  let best = 0, caps = [];
  for(const m of moves){
    const v = m.captured ? VALUE[m.captured.type] : (m.flags.enPassant ? VALUE.p : 0);
    if(v > best){ best = v; caps = [m]; }
    else if(v === best && v > 0) caps.push(m);
  }
  const pool = caps.length ? caps : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Hard: minimax with alpha-beta pruning. White maximises, Black minimises.
function minimax(pos, depth, alpha, beta){
  // if ur reading this the ai is officially smarter than me lol
  if(depth === 0) return evaluate(pos.board);
  const moves = orderMoves(allLegalMoves(pos.board, pos.turn, pos.castling, pos.enPassant));
  if(moves.length === 0){                       // no legal move => mate or stalemate
    const k = findKing(pos.board, pos.turn);
    const inCheck = k && isSquareAttacked(pos.board, k.r, k.c, opp(pos.turn));
    if(inCheck) return pos.turn === "w" ? -100000 - depth : 100000 + depth;
    return 0;
  }
  if(pos.turn === "w"){
    let best = -Infinity;
    for(const m of moves){
      best = Math.max(best, minimax(nextPosition(pos, m), depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if(beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for(const m of moves){
    best = Math.min(best, minimax(nextPosition(pos, m), depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if(beta <= alpha) break;
  }
  return best;
}

function aiHardMove(pos){
  // shuffle first so equally-good moves vary, then order for pruning
  const moves = orderMoves(shuffle(allLegalMoves(pos.board, pos.turn, pos.castling, pos.enPassant)));
  const maximizing = pos.turn === "w";
  let bestMove = moves[0], bestScore = maximizing ? -Infinity : Infinity;
  let alpha = -Infinity, beta = Infinity;
  for(const m of moves){
    const score = minimax(nextPosition(pos, m), 2, alpha, beta);   // 1 + 2 = depth 3
    if(maximizing){
      if(score > bestScore){ bestScore = score; bestMove = m; }
      alpha = Math.max(alpha, bestScore);
    } else {
      if(score < bestScore){ bestScore = score; bestMove = m; }
      beta = Math.min(beta, bestScore);
    }
  }
  return bestMove;
}

// Choose the AI's move for the side to move.
function chooseAIMove(st){
  const pos = { board: st.board, turn: st.turn, castling: st.castling, enPassant: st.enPassant };
  const moves = allLegalMoves(pos.board, pos.turn, pos.castling, pos.enPassant);
  if(!moves.length) return null;
  return st.difficulty === "hard" ? aiHardMove(pos) : aiEasyMove(moves);
}

// After a human move, hand off to the AI if it's the computer's turn.
function maybeTriggerAI(){
  if(state.mode !== "ai") return;
  if(gameOver()) return;
  if(state.turn === state.humanColor) return;
  state.aiThinking = true;
  render();                       // shows "thinking" + locks the board
  const delay = DELAYS[settings.aiDelay];
  aiTimer = setTimeout(() => { aiTimer = null; runAIMove(); }, delay != null ? delay : 400);
}

function runAIMove(){
  if(state.mode !== "ai" || !state.aiThinking || gameOver()) return;
  const move = chooseAIMove(state);
  state.aiThinking = false;
  if(move){
    if(move.flags.promotion) move.promoteTo = "q";   // AI always promotes to a queen
    executeMove(move);
  }
  clearSelection();
  render();
}

let boardEl, statusEl, trayTop, trayBottom, promoEl, newGameBtn, setupEl, modeInfoEl, settingsEl;
let historyControlsEl, undoBtn, redoBtn;
let gameTimeline = [], timelineIndex = -1, aiTimer = null;
let setupChoice = { mode: "two", side: "w", diff: "easy" };

// Session-only: opening the panel never touches game state.
const THEMES = {
  classic: { light:"#eeeed2", dark:"#769656" },
  blue:    { light:"#dce6f2", dark:"#7a9cc0" },
  wood:    { light:"#efd9b4", dark:"#b48761" },
  gray:    { light:"#d8d8d8", dark:"#8a8a8a" }
};
const DELAYS = { instant:0, fast:150, normal:400, slow:900 };
const settings = {
  theme: "classic",
  highlights: true,
  coords: true,
  lastMove: true,
  aiDelay: "normal",
  flip: false
};

function openSettings(){ syncSettingsControls(); settingsEl.classList.remove("hidden"); }
function closeSettings(){ settingsEl.classList.add("hidden"); }
function syncSettingsControls(){
  document.getElementById("setTheme").value = settings.theme;
  document.getElementById("setHighlights").checked = settings.highlights;
  document.getElementById("setCoords").checked = settings.coords;
  document.getElementById("setLastMove").checked = settings.lastMove;
  document.getElementById("setDelay").value = settings.aiDelay;
  document.getElementById("setFlip").checked = settings.flip;
}

function render(){
  renderBoard();
  renderStatus();
  renderCaptured();
  renderModeInfo();
}

function renderModeInfo(){
  if(historyControlsEl){
    historyControlsEl.classList.toggle("hidden", state.mode !== "ai");
    undoBtn.disabled = state.mode !== "ai" || timelineIndex <= 0;
    redoBtn.disabled = state.mode !== "ai" || timelineIndex >= gameTimeline.length - 1;
  }
  if(state.mode === "ai"){
    const you = state.humanColor === "w" ? "White" : "Black";
    const diff = state.difficulty === "hard" ? "Hard" : "Easy";
    modeInfoEl.textContent = "vs Computer — you play " + you + " · " + diff;
  } else {
    modeInfoEl.textContent = "Two-player hot-seat";
  }
}

function renderBoard(){
  boardEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  // live display settings
  const theme = THEMES[settings.theme] || THEMES.classic;
  boardEl.style.setProperty("--light", theme.light);
  boardEl.style.setProperty("--dark", theme.dark);
  boardEl.classList.toggle("no-coords", !settings.coords);

  const checkKing = (state.status === "check" || state.status === "checkmate")
    ? findKing(state.board, state.turn) : null;
  const targets = settings.highlights
    ? new Map(state.legalForSelected.map(m => [m.to.r + "," + m.to.c, m]))
    : new Map();
  const lm = (settings.lastMove && state.lastMove) ? state.lastMove : null;

  // flipping the board reverses both axes (180° rotation)
  const order = settings.flip ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  for(const r of order){
    if(settings.coords){
      const rl = document.createElement("div");
      rl.className = "label";
      rl.textContent = 8 - r;
      frag.appendChild(rl);
    }
    for(const c of order){
      const sq = document.createElement("div");
      sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");
      sq.dataset.r = r; sq.dataset.c = c;   // dataset stays in true board coords

      if(state.selected && state.selected.r === r && state.selected.c === c) sq.classList.add("selected");
      if(lm && ((lm.from.r === r && lm.from.c === c) || (lm.to.r === r && lm.to.c === c))) sq.classList.add("last-move");
      const key = r + "," + c;
      if(targets.has(key)){
        sq.classList.add("legal");
        const m = targets.get(key);
        if(m.captured || m.flags.enPassant) sq.classList.add("capture");
      }
      if(checkKing && checkKing.r === r && checkKing.c === c) sq.classList.add("in-check");

      const p = state.board[r][c];
      if(p){
        const span = document.createElement("span");
        span.className = "piece " + p.color;
        span.textContent = GLYPH[p.type];
        sq.appendChild(span);
      }
      frag.appendChild(sq);
    }
  }
  if(settings.coords){
    frag.appendChild(Object.assign(document.createElement("div"), { className:"label" }));
    for(const c of order){
      const fl = document.createElement("div");
      fl.className = "label";
      fl.textContent = "abcdefgh"[c];
      frag.appendChild(fl);
    }
  }
  boardEl.appendChild(frag);
  boardEl.classList.toggle("disabled", !!state.aiThinking);
}

function renderStatus(){
  if(state.aiThinking){
    statusEl.textContent = "Computer is thinking…";
    statusEl.className = "status thinking";
    return;
  }
  const name = state.turn === "w" ? "White" : "Black";
  let msg, cls = "";
  if(state.status === "checkmate"){
    msg = "Checkmate — " + (state.turn === "w" ? "Black" : "White") + " wins!";
    cls = "checkmate";
  } else if(state.status === "stalemate"){
    msg = "Stalemate — draw.";
    cls = "stalemate";
  } else if(state.status === "draw"){
    const reasons = { insufficient:"insufficient material", fiftymove:"50-move rule", threefold:"threefold repetition" };
    msg = "Draw by " + (reasons[state.drawReason] || "agreement") + ".";
    cls = "draw";
  } else if(state.status === "check"){
    msg = name + " to move — Check!";
    cls = "check";
  } else {
    msg = name + " to move";
  }
  statusEl.textContent = msg;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

function trayHTML(byColor){
  const list = state.captured[byColor].slice().sort((a, b) => VALUE[b.type] - VALUE[a.type]);
  const label = (byColor === "w" ? "White" : "Black") + " captured:";
  const glyphs = list.map(p => '<span class="piece ' + p.color + ' cap">' + GLYPH[p.type] + "</span>").join("");
  return '<span class="tray-label">' + label + "</span>" + (glyphs || '<span class="tray-empty">—</span>');
}

function renderCaptured(){
  trayTop.innerHTML = trayHTML("b");     // pieces Black has captured (white pieces)
  trayBottom.innerHTML = trayHTML("w");  // pieces White has captured (black pieces)
}

function selectSquare(r, c){
  state.selected = { r, c };
  state.legalForSelected = legalMovesAt(state.board, r, c, state.castling, state.enPassant);
  render();
}
function clearSelection(){ state.selected = null; state.legalForSelected = []; }

async function doMove(move){
  if(move.flags.promotion) move.promoteTo = await askPromotion(move.piece.color);
  executeMove(move);
  clearSelection();
  render();
  maybeTriggerAI();
}

function onSquareClick(r, c){
  if(state.aiThinking) return;                                       // board locked
  if(state.mode === "ai" && state.turn !== state.humanColor) return; // not your turn
  if(gameOver()) return;                                             // game finished
  const piece = state.board[r][c];
  if(state.selected){
    const move = state.legalForSelected.find(m => m.to.r === r && m.to.c === c);
    if(move){ doMove(move); return; }
    if(piece && piece.color === state.turn) selectSquare(r, c);
    else { clearSelection(); render(); }
  } else if(piece && piece.color === state.turn){
    selectSquare(r, c);
  }
}

// Promotion chooser. Resolves with a piece type; defaults to queen on Esc/Enter/backdrop.
function askPromotion(color){
  return new Promise(resolve => {
    const choices = promoEl.querySelector(".promo-choices");
    choices.innerHTML = "";
    let done = false;
    const finish = (t) => {
      if(done) return; done = true;
      document.removeEventListener("keydown", onKey);
      promoEl.removeEventListener("click", onBackdrop);
      promoEl.classList.add("hidden");
      resolve(t);
    };
    const onKey = (e) => { if(e.key === "Escape" || e.key === "Enter") finish("q"); };
    const onBackdrop = (e) => { if(e.target === promoEl) finish("q"); };

    for(const t of ["q", "r", "b", "n"]){
      const btn = document.createElement("button");
      btn.className = "promo-btn";
      const sp = document.createElement("span");
      sp.className = "piece " + color;
      sp.textContent = GLYPH[t];
      btn.appendChild(sp);
      btn.addEventListener("click", () => finish(t));
      choices.appendChild(btn);
    }
    document.addEventListener("keydown", onKey);
    promoEl.addEventListener("click", onBackdrop);
    promoEl.classList.remove("hidden");
  });
}

function openSetup(){
  syncSetupUI();
  setupEl.classList.remove("hidden");
}
function syncSetupUI(){
  setupEl.querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("sel", b.dataset.mode === setupChoice.mode));
  setupEl.querySelectorAll("[data-side]").forEach(b => b.classList.toggle("sel", b.dataset.side === setupChoice.side));
  setupEl.querySelectorAll("[data-diff]").forEach(b => b.classList.toggle("sel", b.dataset.diff === setupChoice.diff));
  setupEl.querySelector("#aiOpts").style.display = setupChoice.mode === "ai" ? "block" : "none";
}
function startFromSetup(){
  state.mode = setupChoice.mode;
  state.humanColor = setupChoice.side;
  state.difficulty = setupChoice.diff;
  setupEl.classList.add("hidden");
  newGame();
}

if(typeof document !== "undefined"){
  boardEl = document.getElementById("board");
  statusEl = document.getElementById("status");
  trayTop = document.getElementById("trayTop");
  trayBottom = document.getElementById("trayBottom");
  promoEl = document.getElementById("promo");
  newGameBtn = document.getElementById("newGame");
  setupEl = document.getElementById("setup");
  modeInfoEl = document.getElementById("modeInfo");
  historyControlsEl = document.getElementById("historyControls");
  undoBtn = document.getElementById("undoBtn");
  redoBtn = document.getElementById("redoBtn");
  undoBtn.addEventListener("click", undoComputerTurn);
  redoBtn.addEventListener("click", redoComputerTurn);
  document.getElementById("copyGame").addEventListener("click", copyGamePGN);

  boardEl.addEventListener("click", (e) => {
    const sq = e.target.closest(".square");
    if(sq) onSquareClick(Number(sq.dataset.r), Number(sq.dataset.c));
  });

  setupEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if(!btn) return;
    if(btn.dataset.mode){ setupChoice.mode = btn.dataset.mode; syncSetupUI(); }
    else if(btn.dataset.side){ setupChoice.side = btn.dataset.side; syncSetupUI(); }
    else if(btn.dataset.diff){ setupChoice.diff = btn.dataset.diff; syncSetupUI(); }
    else if(btn.id === "startBtn"){ startFromSetup(); }
  });

  newGameBtn.addEventListener("click", openSetup);

  settingsEl = document.getElementById("settings");
  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("settingsClose").addEventListener("click", closeSettings);
  settingsEl.addEventListener("click", (e) => { if(e.target === settingsEl) closeSettings(); });
  document.getElementById("setTheme").addEventListener("change", (e) => { settings.theme = e.target.value; render(); });
  document.getElementById("setHighlights").addEventListener("change", (e) => { settings.highlights = e.target.checked; render(); });
  document.getElementById("setCoords").addEventListener("change", (e) => { settings.coords = e.target.checked; render(); });
  document.getElementById("setLastMove").addEventListener("change", (e) => { settings.lastMove = e.target.checked; render(); });
  document.getElementById("setDelay").addEventListener("change", (e) => { settings.aiDelay = e.target.value; });
  document.getElementById("setFlip").addEventListener("change", (e) => { settings.flip = e.target.checked; render(); });

  newGame();    // render an initial board behind the modal
  openSetup();  // ask the player to choose a mode on first load

  // lil hello for anyone who opens the dev console
  console.log("%c it works, i dont know how, dont ask ", "background:#769656;color:#fff;padding:4px 10px;border-radius:4px;font-weight:bold;font-size:13px;");
  console.log("made by mr.z — still not 100% sure how the chess ai works tbh lol");
}

/* Export the pure logic so it can be unit-tested under Node. */
if(typeof module !== "undefined" && module.exports){
  module.exports = {
    initialBoard, isSquareAttacked, pseudoMovesFrom, boardAfter,
    legalMovesAt, hasAnyLegalMove, computeStatus, findKing, opp,
    allLegalMoves, nextPosition, evaluate, chooseAIMove,
    isInsufficientMaterial, positionKey
  };
}
