/* graficos.js: gráficos sin librerías externas (HTML + SVG), para que funcionen sin internet */
(function (g) {
  "use strict";
  const N = g.Nucleo;
  const G = {};

  function nice(max) {
    if (max <= 0) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
  }

  // ---------- Barras horizontales ----------
  // items: [{etiqueta, valor, clase?, nota?}]
  G.barrasH = function (el, items, o = {}) {
    const fmt = o.fmt || (v => N.fmtDec(v, 1));
    const max = o.max || Math.max(...items.map(i => i.valor), 1e-9);
    el.innerHTML = items.map(i => {
      const w = Math.max(0, Math.min(100, i.valor / max * 100));
      return `<div class="bh ${i.clase || ""}">
        <span class="bh-et" title="${N.esc(i.etiqueta)}">${N.esc(i.etiqueta)}</span>
        <div class="bh-pista"><div class="bh-barra" style="width:${w.toFixed(1)}%"></div></div>
        <span class="bh-val">${fmt(i.valor)}${i.nota ? ` <small>${N.esc(i.nota)}</small>` : ""}</span></div>`;
    }).join("");
  };

  // ---------- Columnas verticales ----------
  // items: [{etiqueta, valor, clase?}] ; o.escala = "sqrt" para valores muy desiguales
  G.columnas = function (el, items, o = {}) {
    const fmt = o.fmt || (v => N.fmtInt(v));
    const f = o.escala === "sqrt" ? Math.sqrt : (v => v);
    const max = Math.max(...items.map(i => f(i.valor)), 1e-9);
    el.innerHTML = `<div class="cols-graf">` + items.map(i => {
      const h = Math.max(1.5, f(i.valor) / max * 100);
      return `<div class="colv ${i.clase || ""}">
        <span class="colv-val">${fmt(i.valor)}</span>
        <div class="colv-barra" style="height:${h.toFixed(1)}%"></div>
        <span class="colv-et">${N.esc(i.etiqueta)}</span></div>`;
    }).join("") + `</div>`;
  };

  // ---------- Líneas ----------
  // series: [{nombre, valores, clase, etiquetar?}]
  G.lineas = function (el, etiquetas, series, o = {}) {
    const W = 800, H = 340, m = { l: 52, r: 20, t: 18, b: 40 };
    const todos = series.flatMap(s => s.valores).filter(v => v != null);
    let lo = o.min != null ? o.min : Math.min(...todos), hi = o.max != null ? o.max : Math.max(...todos);
    const pad = (hi - lo) * 0.12 || 1;
    lo = o.min != null ? lo : Math.floor(lo - pad); hi = Math.ceil(hi + pad);
    const x = i => m.l + (etiquetas.length === 1 ? 0 : i * (W - m.l - m.r) / (etiquetas.length - 1));
    const y = v => m.t + (hi - v) * (H - m.t - m.b) / (hi - lo);
    const paso = nice((hi - lo) / 5);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${N.esc(o.aria || "gráfico de líneas")}">`;
    for (let t = Math.ceil(lo / paso) * paso; t <= hi; t += paso) {
      svg += `<line class="eje-g" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text class="eje-t" x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${N.fmtInt(t)}</text>`;
    }
    etiquetas.forEach((e, i) => { svg += `<text class="eje-t" x="${x(i)}" y="${H - 14}" text-anchor="middle">${N.esc(e)}</text>`; });
    series.forEach((s, k) => {
      const cl = s.clase || ("s" + k);
      const pts = s.valores.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
      svg += `<polyline class="linea ${cl}" fill="none" points="${pts.map(p => p.join(",")).join(" ")}"/>`;
      pts.forEach(p => { svg += `<circle class="punto ${cl}" cx="${p[0]}" cy="${p[1]}" r="4.5"/>`; });
      if (s.etiquetar) s.valores.forEach((v, i) => { if (v != null) svg += `<text class="val-t ${cl}" x="${x(i)}" y="${y(v) - 10}" text-anchor="middle">${N.fmtDec(v, 1)}</text>`; });
    });
    svg += `</svg>`;
    const leyenda = `<div class="leyenda">` + series.map((s, k) => `<span><i class="sw ${s.clase || ("s" + k)}"></i>${N.esc(s.nombre)}</span>`).join("") + `</div>`;
    el.innerHTML = leyenda + svg;
  };

  // ---------- Calibración: lo que dijo el modelo contra lo que ocurrió ----------
  G.calibracion = function (el, tramos) {
    const S = 360, m = 44, mx = tramos.reduce((a, t) => Math.max(a, t.n), 1);
    const p = v => m + v / 100 * (S - 2 * m), q = v => S - m - v / 100 * (S - 2 * m);
    let svg = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="calibración">`;
    for (let t = 0; t <= 100; t += 20) {
      svg += `<line class="eje-g" x1="${p(0)}" x2="${p(100)}" y1="${q(t)}" y2="${q(t)}"/><line class="eje-g" x1="${p(t)}" x2="${p(t)}" y1="${q(0)}" y2="${q(100)}"/>`;
      svg += `<text class="eje-t" x="${p(0) - 6}" y="${q(t) + 4}" text-anchor="end">${t}</text><text class="eje-t" x="${p(t)}" y="${q(0) + 16}" text-anchor="middle">${t}</text>`;
    }
    svg += `<line class="diag" x1="${p(0)}" y1="${q(0)}" x2="${p(100)}" y2="${q(100)}"/>`;
    tramos.forEach(t => {
      const r = 4 + 9 * Math.sqrt(t.n / mx);
      svg += `<circle class="cal-punto" cx="${p(t.pred)}" cy="${q(t.real)}" r="${r.toFixed(1)}"><title>Dijo ${t.pred}% · ocurrió ${t.real}% · ${N.fmtInt(t.n)} casos</title></circle>`;
    });
    svg += `<text class="eje-t" x="${S / 2}" y="${S - 6}" text-anchor="middle">Probabilidad que dijo el modelo (%)</text>`;
    svg += `<text class="eje-t" transform="translate(12 ${S / 2}) rotate(-90)" text-anchor="middle">Lo que ocurrió (%)</text></svg>`;
    el.innerHTML = svg;
  };

  // ---------- Línea de tiempo entrenamiento / embargo / prueba ----------
  G.lineaTiempo = function (el, partes) {
    const meses = (a, b) => {
      const A = new Date(a), B = new Date(b);
      return (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + (B.getUTCMonth() - A.getUTCMonth()) + 1;
    };
    const nombres = { train: "Entrenamiento", embargo: "Embargo", test: "Prueba" };
    const total = partes.reduce((s, p) => s + Math.max(meses(p.desde, p.hasta), 4), 0);
    el.innerHTML = `<div class="tl">` + partes.map(p => {
      const w = Math.max(meses(p.desde, p.hasta), 4) / total * 100;
      return `<div class="tl-p ${p.split}" style="width:${w.toFixed(1)}%">
        <b>${nombres[p.split] || p.split}</b>
        <span>${N.fmtMes(p.desde)} → ${N.fmtMes(p.hasta)}</span>
        <small>${N.fmtInt(p.filas)} filas</small></div>`;
    }).join("") + `</div>`;
  };

  // ---------- Curva de probabilidad acumulada de una zona (simulador) ----------
  G.curva = function (el, curva, pred, cfg, marca) {
    const W = 640, H = 250, m = { l: 46, r: 16, t: 14, b: 36 };
    const pts = curva.map((q, i) => [N.limitar(pred * q, cfg), (i + 1) / curva.length]);
    const xmin = Math.min(pts[0][0], marca ? marca.x : Infinity);
    const xmax = Math.max(pts[pts.length - 1][0], marca ? marca.x : 0);
    const a = Math.max(0, Math.floor((xmin * 0.9) / 10) * 10), b = Math.ceil((xmax * 1.05) / 10) * 10 || 10;
    const x = v => m.l + (v - a) / (b - a) * (W - m.l - m.r), y = v => m.t + (1 - v) * (H - m.t - m.b);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="probabilidad acumulada">`;
    for (let t = 0; t <= 1.0001; t += 0.25) svg += `<line class="eje-g" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text class="eje-t" x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end">${Math.round(t * 100)}%</text>`;
    const paso = nice((b - a) / 6);
    for (let t = Math.ceil(a / paso) * paso; t <= b; t += paso) svg += `<text class="eje-t" x="${x(t)}" y="${H - 12}" text-anchor="middle">${t}</text>`;
    const d = `M ${x(a)} ${y(0)} ` + pts.map(p => `L ${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ");
    svg += `<path class="curva-rel" d="${d} L ${x(pts[pts.length - 1][0])} ${y(1)} L ${x(b)} ${y(1)} L ${x(b)} ${y(0)} Z"/><path class="curva-linea" d="${d}"/>`;
    if (marca) {
      svg += `<line class="marca" x1="${x(marca.x)}" x2="${x(marca.x)}" y1="${y(0)}" y2="${y(marca.p)}"/><line class="marca" x1="${m.l}" x2="${x(marca.x)}" y1="${y(marca.p)}" y2="${y(marca.p)}"/>`;
      svg += `<circle class="marca-pt" cx="${x(marca.x)}" cy="${y(marca.p)}" r="6"/>`;
    }
    svg += `<text class="eje-t" x="${W / 2}" y="${H - 1}" text-anchor="middle" font-size="11">días de venta</text></svg>`;
    el.innerHTML = svg;
  };

  g.Graficos = G;
})(window);