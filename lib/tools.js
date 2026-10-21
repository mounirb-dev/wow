// Pure portfolio maths, shared by the UI, the copilot route and the MCP server.
const NOW = new Date();

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const DAY = 864e5;

export const monthsLeft = (p) => Math.max(0, Math.round((new Date(p.contractEnd) - NOW) / (30.44 * DAY)));

export function history() {
  return [];
}

export const change12m = () => null;

// 0-100: how much bargaining power the agent has right now.
export function leverage(p) {
  const m = monthsLeft(p);
  let s = m <= 6 ? 95 : m <= 12 ? 80 : m <= 18 ? 55 : m <= 30 ? 30 : 12;
  s += (p.momentum - 0.5) * 20;
  if (p.fair > 0 && p.salary > 0) s += clamp((p.fair - p.salary) / p.fair, 0, 0.6) * 15;
  if (p.age > 30) s -= 10;
  return Math.round(clamp(s, 0, 100));
}

export const commission = (salary, years = 3, rate = 0.05) => salary * years * rate;

export function negotiate(p, suitor, ask) {
  const clubMax = p.fair * (0.9 + (0.4 * suitor.need) / 100);
  const floor = p.fair * 0.85;
  const w = 0.06 * p.fair;
  const pClub = 1 / (1 + Math.exp((ask - clubMax) / w));
  const pPlayer = 1 / (1 + Math.exp((floor - ask) / w));
  const pDeal = pClub * pPlayer;
  const comm = commission(ask);
  return { pDeal, comm, ev: pDeal * comm, clubMax, floor };
}

export function curve(p, suitor, n = 48) {
  const lo = p.fair * 0.6, hi = p.fair * 1.7;
  const pts = Array.from({ length: n }, (_, i) => {
    const ask = lo + ((hi - lo) * i) / (n - 1);
    return { ask, ...negotiate(p, suitor, ask) };
  });
  const best = pts.reduce((a, b) => (b.ev > a.ev ? b : a));
  return { pts, best, lo, hi };
}

export function portfolio(players) {
  const aum = players.reduce((a, p) => a + p.value, 0);
  const expiring = players.filter((p) => monthsLeft(p) <= 12);
  const pipeline = players.reduce((a, p) => {
    const top = [...p.suitors].sort((x, y) => y.need - x.need)[0];
    return a + (top ? curve(p, top).best.ev : 0);
  }, 0);
  return { aum, count: players.length, expiring: expiring.length, pipeline };
}

export const fmtM = (v, d = 1) => v > 0 ? `€${v.toFixed(d)}M` : "Pendiente";
