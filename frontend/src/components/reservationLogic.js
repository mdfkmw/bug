// src/components/reservationLogic.js
// Reworked auto-select logic focused on segment matching first,
// then proximity rules that follow the microbuz/autobuz placement
// requirements (adjacent seats, across the aisle, stacked columns).

const DEBUG = false;
const log = (...args) => { if (DEBUG) console.debug('[autoSelect]', ...args); };

const norm = (v) => (v ?? '').toString().trim().toLowerCase();

function isSeatGuide(seat) {
  const label = String(seat?.label || '');
  const type = String(seat?.seat_type || '');
  return /ghid/i.test(label) || /ghid|guide/i.test(type);
}

function isSeatDriver(seat) {
  const label = String(seat?.label || '');
  return /șofer|sofer/i.test(label) || String(seat?.seat_type || '') === 'driver';
}

function labelNumber(value) {
  const match = String(value ?? '').match(/\d+/);
  if (!match) return Number.POSITIVE_INFINITY;
  const parsed = parseInt(match[0], 10);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function seatOrderKey(seat) {
  const col = Number.isFinite(seat?.seat_col) ? seat.seat_col : Number.POSITIVE_INFINITY;
  return `${String(seat?.row ?? 9999).padStart(3, '0')}:${String(col).padStart(3, '0')}:${String(labelNumber(seat?.label)).padStart(6, '0')}`;
}

function indexOfStop(stops, name) {
  return stops.findIndex((s) => norm(s) === norm(name));
}

function isSeatFreeForSegment(seat, b, e, stops) {
  const arr = Array.isArray(seat?.passengers) ? seat.passengers : [];
  for (const p of arr) {
    if ((p?.status || 'active') !== 'active') continue;
    const pb = indexOfStop(stops, p.board_at);
    const pe = indexOfStop(stops, p.exit_at);
    if (pb === -1 || pe === -1 || pb >= pe) continue;
    const overlaps = !(e <= pb || b >= pe);
    if (overlaps) return false;
  }
  return true;
}

export function isSeatAvailableForSegment(seat, board_at, exit_at, stops) {
  const b = indexOfStop(stops, board_at);
  const e = indexOfStop(stops, exit_at);
  if (b === -1 || e === -1 || b >= e) return false;
  return isSeatFreeForSegment(seat, b, e, stops);
}

function buildFreeSeats(seats, board_at, exit_at, stops) {
  const b = indexOfStop(stops, board_at);
  const e = indexOfStop(stops, exit_at);
  if (b === -1 || e === -1 || b >= e) {
    log('Segment invalid', { board_at, exit_at, stops });
    return { b: -1, e: -1, rows: new Map(), guides: [] };
  }

  const usable = [];
  const guides = [];
  for (const seat of seats || []) {
    if (!seat) continue;
    if (isSeatDriver(seat)) continue;
    if (!isSeatFreeForSegment(seat, b, e, stops)) continue;
    if (isSeatGuide(seat)) guides.push(seat);
    else usable.push(seat);
  }

  const rows = new Map();
  for (const s of usable) {
    const r = Number.isFinite(s?.row) ? s.row : 9999;
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r).push(s);
  }

  const orderedRows = [...rows.keys()].sort((a, b2) => a - b2);
  for (const r of orderedRows) {
    rows.get(r).sort((a, b2) => seatOrderKey(a).localeCompare(seatOrderKey(b2)));
  }

  if (DEBUG) {
    log('Free seats built', {
      board_at,
      exit_at,
      rows: orderedRows.map((r) => ({ row: r, seats: (rows.get(r) || []).map((s) => s.label) })),
      guides: guides.map((g) => g.label),
    });
  }

  return { b, e, rows, guides };
}

function flattenRows(rows) {
  const out = [];
  for (const arr of rows.values()) out.push(...arr);
  return out;
}

function computeSeatSegmentScore(seat, b, e, stops) {
  let score = 5; // mic punctaj de bază pentru a permite tie-breaker ulterior
  const arr = Array.isArray(seat?.passengers) ? seat.passengers : [];
  if (!arr.length) return score;

  for (const p of arr) {
    const pb = indexOfStop(stops, p.board_at);
    const pe = indexOfStop(stops, p.exit_at);
    if (pb === -1 || pe === -1 || pb >= pe) continue;
    if (pe === b) score += 160; // cineva coboară exact unde urcăm noi
    if (pb === e) score += 160; // cineva urcă exact unde coborâm noi
    if (pe < b) score += 40;    // segment anterior (completăm începutul)
    if (pb > e) score += 40;    // segment ulterior (completăm sfârșitul)
  }

  return score;
}

function computeFrontScore(seat) {
  const row = Number.isFinite(seat?.row) ? seat.row : 999;
  return Math.max(0, 200 - row * 10);
}

function groupRowByAisle(rowInfos) {
  if (!rowInfos?.length) return [];
  const sorted = [...rowInfos].sort((a, b) => a.col - b.col);
  const groups = [];
  let current = [];
  let prevCol = null;
  for (const info of sorted) {
    const col = Number.isFinite(info.col) ? info.col : 9999;
    if (prevCol != null && col - prevCol > 1 && current.length) {
      groups.push(current);
      current = [];
    }
    current.push(info);
    prevCol = col;
  }
  if (current.length) groups.push(current);
  return groups;
}

function determinePairType(a, b) {
  if (!Number.isFinite(a.col) || !Number.isFinite(b.col) || !Number.isFinite(a.row) || !Number.isFinite(b.row)) {
    return 3;
  }
  if (a.row === b.row) {
    const diff = Math.abs(a.col - b.col);
    if (diff === 1) return 0; // alăturate pe același rând
    return 1; // același rând, despărțite de culoar
  }
  if (a.col === b.col) {
    return 2; // aceeași coloană (față/spate)
  }
  return 3; // plasare oblică (nu respectă regulile)
}

function evaluateCombination(combo, count) {
  const segmentScoreSum = combo.reduce((sum, info) => sum + info.segmentScore, 0);
  const frontScore = combo.reduce((sum, info) => sum + info.frontScore, 0);
  const orderKey = combo
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((info) => info.key)
    .join('|');

  let arrangementRank = 3;
  let arrangementScore = 0;

  if (count === 1) {
    arrangementRank = 0;
    arrangementScore = frontScore;
  } else if (count === 2) {
    const [a, b] = combo;
    const sameRow = Number.isFinite(a.row) && a.row === b.row;
    const sameCol = Number.isFinite(a.col) && a.col === b.col;
    const colDiff = sameRow ? Math.abs(a.col - b.col) : null;
    const rowDiff = sameCol ? Math.abs(a.row - b.row) : Math.abs(a.row - b.row);

    if (sameRow && colDiff === 1) {
      arrangementRank = 0;
      arrangementScore = 400 - Math.min(a.row, b.row) * 10;
    } else if (sameRow) {
      arrangementRank = 1;
      arrangementScore = 250 - (colDiff || 0) * 5;
    } else if (sameCol && rowDiff > 0) {
      arrangementRank = 2;
      arrangementScore = 180 - rowDiff * 10;
    } else {
      arrangementRank = 3;
      arrangementScore = 100 - rowDiff - (colDiff ?? 0);
    }
  } else if (count === 3) {
    const rowsSet = new Set(combo.map((info) => info.row));
    if (rowsSet.size === 1) {
      const rowInfos = combo.slice().sort((a, b) => a.col - b.col);
      const groups = groupRowByAisle(rowInfos);
      const hasAdjacentPair = rowInfos.some((info, idx) => idx < rowInfos.length - 1 && rowInfos[idx + 1].col - info.col === 1);
      const hasAcrossSeat = groups.length >= 2;
      if (hasAdjacentPair && hasAcrossSeat) {
        arrangementRank = 0;
        arrangementScore = 500 - rowInfos[0].row * 10;
        return { segmentScoreSum, arrangementRank, arrangementScore, frontScore, orderKey };
      }
    }

    let fallbackScore = -Infinity;
    for (let i = 0; i < combo.length; i += 1) {
      for (let j = i + 1; j < combo.length; j += 1) {
        const a = combo[i];
        const b = combo[j];
        if (a.row !== b.row) continue;
        const pairType = determinePairType(a, b);
        if (pairType > 1) continue;
        const k = [0, 1, 2].find((idx) => idx !== i && idx !== j);
        if (k == null) continue;
        const third = combo[k];
        if (!Number.isFinite(third.col) || !Number.isFinite(third.row)) continue;
        const colMatch = third.col === a.col || third.col === b.col;
        const rowDiff = Math.min(Math.abs(third.row - a.row), Math.abs(third.row - b.row));
        if (colMatch && rowDiff >= 1) {
          const score = 320 - rowDiff * 15 - pairType * 30;
          if (score > fallbackScore) fallbackScore = score;
        }
      }
    }

    if (fallbackScore > -Infinity) {
      arrangementRank = 1;
      arrangementScore = fallbackScore;
    } else {
      arrangementRank = 2;
      arrangementScore = -combo.reduce((sum, info) => sum + info.row, 0);
    }
  } else if (count === 4) {
    const pairings = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];
    let bestRank = 3;
    let bestScore = -Infinity;

    for (const pairing of pairings) {
      let valid = true;
      let adjacencyCount = 0;
      let acrossCount = 0;
      let verticalCount = 0;
      let score = 0;

      for (const [i, j] of pairing) {
        const a = combo[i];
        const b = combo[j];
        const type = determinePairType(a, b);
        if (type === 3) {
          valid = false;
          break;
        }
        if (type === 0) adjacencyCount += 1;
        else if (type === 1) acrossCount += 1;
        else if (type === 2) verticalCount += 1;
        score += a.segmentScore + b.segmentScore + (type === 0 ? 200 : type === 1 ? 120 : 80);
      }

      if (!valid) continue;

      let rank;
      if (adjacencyCount === 2) rank = 0;
      else if (adjacencyCount >= 1) rank = 1;
      else rank = 2;

      const totalScore = score + adjacencyCount * 50 - acrossCount * 10 - verticalCount * 20;
      if (rank < bestRank || (rank === bestRank && totalScore > bestScore)) {
        bestRank = rank;
        bestScore = totalScore;
      }
    }

    if (bestRank !== 3) {
      arrangementRank = bestRank;
      arrangementScore = bestScore;
    } else {
      arrangementRank = 3;
      arrangementScore = -combo.reduce((sum, info) => sum + info.row, 0);
    }
  } else {
    const adjacencyEdges = [];
    const acrossEdges = [];
    const verticalEdges = [];
    for (let i = 0; i < combo.length; i += 1) {
      for (let j = i + 1; j < combo.length; j += 1) {
        const a = combo[i];
        const b = combo[j];
        const type = determinePairType(a, b);
        const baseScore = a.segmentScore + b.segmentScore;
        if (type === 0) adjacencyEdges.push({ i, j, score: baseScore });
        else if (type === 1) acrossEdges.push({ i, j, score: baseScore });
        else if (type === 2) verticalEdges.push({ i, j, score: baseScore });
      }
    }

    const used = new Set();
    let adjacencyCount = 0;
    let acrossCount = 0;
    let verticalCount = 0;

    adjacencyEdges.sort((a, b) => b.score - a.score);
    for (const edge of adjacencyEdges) {
      if (used.has(edge.i) || used.has(edge.j)) continue;
      used.add(edge.i);
      used.add(edge.j);
      adjacencyCount += 1;
    }

    acrossEdges.sort((a, b) => b.score - a.score);
    for (const edge of acrossEdges) {
      if (used.has(edge.i) || used.has(edge.j)) continue;
      used.add(edge.i);
      used.add(edge.j);
      acrossCount += 1;
    }

    verticalEdges.sort((a, b) => b.score - a.score);
    for (const edge of verticalEdges) {
      if (used.has(edge.i) || used.has(edge.j)) continue;
      used.add(edge.i);
      used.add(edge.j);
      verticalCount += 1;
    }

    const leftover = combo.length - used.size;
    arrangementRank = -adjacencyCount;
    arrangementScore = adjacencyCount * 200 + acrossCount * 80 + verticalCount * 40 - leftover * 50;
  }

  return { segmentScoreSum, arrangementRank, arrangementScore, frontScore, orderKey };
}

function isBetterCombination(current, best) {
  if (!best) return true;
  if (current.segmentScoreSum !== best.segmentScoreSum) {
    return current.segmentScoreSum > best.segmentScoreSum;
  }
  if (current.arrangementRank !== best.arrangementRank) {
    return current.arrangementRank < best.arrangementRank;
  }
  if (current.arrangementScore !== best.arrangementScore) {
    return current.arrangementScore > best.arrangementScore;
  }
  if (current.frontScore !== best.frontScore) {
    return current.frontScore > best.frontScore;
  }
  return current.orderKey < best.orderKey;
}

function chooseBestCombination(seatInfos, count) {
  if (!Array.isArray(seatInfos) || seatInfos.length < count) {
    return null;
  }

  const maxCandidates = Math.min(seatInfos.length, Math.max(12, count * 4));
  const candidates = seatInfos.slice(0, maxCandidates);
  const stack = [];
  let best = null;
  let bestMetrics = null;

  function backtrack(startIndex) {
    if (stack.length === count) {
      const metrics = evaluateCombination(stack, count);
      if (isBetterCombination(metrics, bestMetrics)) {
        best = stack.slice();
        bestMetrics = metrics;
      }
      return;
    }

    const remainingNeeded = count - stack.length;
    for (let i = startIndex; i <= candidates.length - remainingNeeded; i += 1) {
      stack.push(candidates[i]);
      backtrack(i + 1);
      stack.pop();
    }
  }

  backtrack(0);
  return best ? best.map((info) => info.seat) : null;
}

export function selectSeats(seats, board_at, exit_at, stops, count) {
  log('selectSeats START', { count, board_at, exit_at });
  const { rows, guides, b, e } = buildFreeSeats(seats, board_at, exit_at, stops);
  if (b === -1 || e === -1) return [];

  const need = Math.max(1, Number(count) || 1);
  const availableSeats = flattenRows(rows);
  if (availableSeats.length < need) {
    if (availableSeats.length === 0 && guides.length > 0) {
      return guides.slice(0, Math.min(need, guides.length));
    }
    return [];
  }

  const seatInfos = availableSeats
    .map((seat) => ({
      seat,
      row: Number.isFinite(seat?.row) ? seat.row : 9999,
      col: Number.isFinite(seat?.seat_col) ? seat.seat_col : 9999,
      segmentScore: computeSeatSegmentScore(seat, b, e, stops),
      frontScore: computeFrontScore(seat),
      key: seatOrderKey(seat),
    }))
    .sort((a, b2) => {
      if (b2.segmentScore !== a.segmentScore) return b2.segmentScore - a.segmentScore;
      if (b2.frontScore !== a.frontScore) return b2.frontScore - a.frontScore;
      return a.key.localeCompare(b2.key);
    });

  const chosen = chooseBestCombination(seatInfos, need);
  if (chosen && chosen.length === need) {
    const ordered = chosen.slice().sort((a, b2) => seatOrderKey(a).localeCompare(seatOrderKey(b2)));
    log('selectSeats RESULT', ordered.map((s) => s.label));
    return ordered;
  }

  const fallback = seatInfos.slice(0, need).map((info) => info.seat);
  if (fallback.length === need) {
    const ordered = fallback.slice().sort((a, b2) => seatOrderKey(a).localeCompare(seatOrderKey(b2)));
    log('selectSeats FALLBACK', ordered.map((s) => s.label));
    return ordered;
  }

  if (availableSeats.length === 0 && guides.length > 0) {
    return guides.slice(0, Math.min(need, guides.length));
  }

  return [];
}

export function getBestAvailableSeat(seats, board_at, exit_at, stops, excludeIds = []) {
  const filtered = (seats || []).filter((s) => !excludeIds?.includes?.(s?.id));
  const list = selectSeats(filtered, board_at, exit_at, stops, 1);
  const chosen = list[0] || null;
  log('getBestAvailableSeat →', chosen?.label ?? null);
  return chosen;
}
