/* nucleo.js: formatos y cálculo de probabilidad (lo usan la presentación y el simulador) */
(function (g) {
  "use strict";
  const N = {};

  // ---------- Formatos (es-CO: punto en miles, coma en decimales) ----------
  N.fmtInt = n => (n == null || isNaN(n)) ? "—" : Math.round(n).toLocaleString("es-CO");
  N.fmtDec = (n, d = 1) => (n == null || isNaN(n)) ? "—"
    : Number(n).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
  N.fmtPct = (n, d = 1) => (n == null || isNaN(n)) ? "—" : N.fmtDec(n, d) + "%";
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  N.fmtFecha = s => {
    if (!s) return "—";
    const p = String(s).slice(0, 10).split("-");
    if (p.length < 3) return String(s);
    return `${parseInt(p[2], 10)} ${MESES[parseInt(p[1], 10) - 1]} ${p[0]}`;
  };
  N.fmtMes = s => {
    if (!s) return "—";
    const p = String(s).split("-");
    return `${MESES[parseInt(p[1], 10) - 1]} ${p[0].slice(2)}`;
  };
  N.esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Probabilidad ----------
  // curva: lista ordenada de 99 percentiles de la razón (tiempo real / tiempo predicho)
  N.limitar = (v, cfg) => Math.min(Math.max(v, cfg.pred_min), cfg.pred_max);

  // P(tiempo real <= x días) = porcentaje de razones que cumplen razón <= x / predicción
  N.probMenorIgual = function (curva, pred, x) {
    const lim = x / pred;
    let c = 0;
    for (let i = 0; i < curva.length; i++) { if (curva[i] <= lim) c++; else break; }
    return c / curva.length;
  };

  // Días que se cumplen con probabilidad p (0 a 1): percentil p de la curva por la predicción
  N.diasParaProb = function (curva, pred, p, cfg) {
    const idx = Math.min(curva.length - 1, Math.max(0, Math.round(p * 100) - 1));
    return N.limitar(pred * curva[idx], cfg);
  };

  // Rango esperado (por defecto 80%): percentiles inferior y superior de la curva
  N.rango = function (curva, pred, cfg) {
    return [N.limitar(pred * curva[cfg.idx_lo], cfg), N.limitar(pred * curva[cfg.idx_hi], cfg)];
  };

  // Redondeo a pasos de 5% para no aparentar más precisión de la que hay
  N.probTexto = function (p) {
    const pc = p * 100;
    if (pc < 2.5) return "menos de 5%";
    if (pc > 97.5) return "más de 95%";
    return "alrededor de " + (Math.round(pc / 5) * 5) + "%";
  };

  N.NIVELES = ["alta", "media", "baja"];

  N.indexar = function (Z) {
    const m = new Map();
    for (const f of Z.filas) m.set(f[0], { zip: f[0], dias: f[1], conf: N.NIVELES[f[2]], ventas: f[3] });
    return m;
  };

  // Comprueba que este cálculo da lo mismo que Spark (muestra exportada desde Databricks)
  N.verificar = function (Z) {
    let maxDif = 0, n = 0, malos = 0;
    for (const v of Z.verificacion) {
      const curva = Z.curva[v.conf];
      for (const x of Z.meta.umbrales) {
        const mio = N.probMenorIgual(curva, v.dias, x);
        const dif = Math.abs(mio - v["p" + x]);
        maxDif = Math.max(maxDif, dif); n++;
        if (dif > 1e-9) malos++;
      }
    }
    return { casos: Z.verificacion.length, comparaciones: n, discrepancias: malos, maxDif };
  };

  g.Nucleo = N;
})(window);