// Pure portfolio maths, shared by the UI and the MCP server.
// Fórmulas puras (sin I/O) del negocio. Los parámetros de las curvas (0.85, 0.06, 5%…) son
// supuestos del modelo, no datos: ajustarlos cambia todos los números de la app.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const DAY = 864e5;

// Meses de contrato restantes (>= 0). 30.44 = días medios por mes.
export const monthsLeft = (p) => Math.max(0, Math.round((new Date(p.contractEnd) - Date.now()) / (30.44 * DAY)));

// Palanca 0-100: fuerza negociadora del agente ahora. Parte de lo cerca que está el fin de
// contrato (<=6 meses = 95) y suma/resta por racha, por cobrar menos de su valor justo y por edad.
export function leverage(p) {
  const m = monthsLeft(p);
  let s = m <= 6 ? 95 : m <= 12 ? 80 : m <= 18 ? 55 : m <= 30 ? 30 : 12;
  s += (p.momentum - 0.5) * 20;
  if (p.fair > 0 && p.salary > 0) s += clamp((p.fair - p.salary) / p.fair, 0, 0.6) * 15;
  if (p.age > 30) s -= 10;
  return Math.round(clamp(s, 0, 100));
}

// Comisión del agente: salario anual × años × porcentaje (5% por defecto).
export const commission = (salary, years = 3, rate = 0.05) => salary * years * rate;

// Simula una oferta de `ask` (salario pedido) a un club interesado:
//  - clubMax: lo máximo que pagaría el club (sube con su necesidad, 0-100);
//  - floor: lo mínimo que aceptaría el jugador (85% de su valor justo);
//  - pClub / pPlayer: probabilidad logística de que cada parte acepte; pDeal las multiplica;
//  - ev: comisión esperada = probabilidad de cierre × comisión.
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

// Evalúa `negotiate` para n peticiones entre 60% y 170% del valor justo y devuelve el punto
// de mayor comisión esperada (`best`): la "petición óptima" que muestra el simulador.
export function curve(p, suitor, n = 48) {
  const lo = p.fair * 0.6, hi = p.fair * 1.7;
  const pts = Array.from({ length: n }, (_, i) => {
    const ask = lo + ((hi - lo) * i) / (n - 1);
    return { ask, ...negotiate(p, suitor, ask) };
  });
  const best = pts.reduce((a, b) => (b.ev > a.ev ? b : a));
  return { pts, best, lo, hi };
}

// Totales de la cartera: valor total (aum), nº de jugadores, los que vencen en <=12 meses y
// el pipeline = suma de la mejor comisión esperada con el pretendiente más necesitado de cada uno.
export function portfolio(players) {
  const aum = players.reduce((a, p) => a + p.value, 0);
  const expiring = players.filter((p) => monthsLeft(p) <= 12);
  const pipeline = players.reduce((a, p) => {
    const top = [...p.suitors].sort((x, y) => y.need - x.need)[0];
    return a + (top ? curve(p, top).best.ev : 0);
  }, 0);
  return { aum, count: players.length, expiring: expiring.length, pipeline };
}

// Formato en millones; 0 significa "sin dato" y se muestra como Pendiente.
export const fmtM = (v, d = 1) => v > 0 ? `€${v.toFixed(d)}M` : "Pendiente";
