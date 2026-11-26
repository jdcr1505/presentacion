/* presentacion.js: enlaza los datos, dibuja los gráficos y maneja la navegación */
(function (g) {
  "use strict";
  const N = g.Nucleo, G = g.Graficos, D = g.PRES, Z = g.ZIPS;

  if (!D) {
    const a = document.getElementById("aviso-datos");
    a.textContent = "Falta el archivo data/datos_presentacion.js. Genéralo con la celda de exportación del notebook y cópialo en la carpeta data.";
    a.classList.remove("oculto");
    document.getElementById("diapositivas").classList.add("oculto");
    return;
  }

  // ---------- Nombres legibles ----------
  const COLS = {
    homes_sold: "Casas vendidas", median_sale_price_nsa: "Precio mediano de venta",
    median_days_on_market_days: "Días en el mercado (objetivo)", average_sale_to_list_ratio: "Razón venta/lista",
    new_listings: "Nuevos anuncios", active_listings: "Anuncios activos", inventory: "Inventario",
    pending_sales: "Ventas pendientes", median_new_listing_price: "Precio mediano de lista",
    median_new_listing_price_per_sq_ft: "Precio de lista por pie²", median_sale_price_per_sq_ft: "Precio de venta por pie²",
    months_of_supply: "Meses de inventario", percent_off_market_in_two_weeks: "% fuera del mercado en 2 semanas"
  };
  const BANDERAS = {
    flag_objetivo_extremo: "Tiempo de venta extremo", flag_ratio_venta_lista_fuera_rango: "Razón venta/lista fuera de rango",
    flag_fecha_invalida: "Fecha inválida", flag_objetivo_negativo: "Tiempo negativo",
    flag_porcentaje_fuera_rango: "Porcentaje fuera de rango", flag_valores_negativos: "Valores negativos"
  };
  const MODELOS = {
    "Regresión lineal": "Regresión lineal", "GBT (pérdida absoluta)": "Árboles (GBT)",
    "media de entrenamiento": "Siempre el promedio", "mediana de entrenamiento": "Siempre la mediana",
    "persistencia (lag3)": "Valor de hace 3 meses", "promedio de lags": "Promedio de rezagos",
    "media histórica del ZIP": "Media histórica de la zona", "media histórica ponderada": "Media histórica ponderada",
    "últimos 12 meses ponderado": "Últimos 12 meses", "zona vecina (ZIP3) 12 meses": "Zona vecina (12 meses)"
  };

  // ---------- Valores derivados ----------
  (function derivar() {
    const r = D.modelo.resultados, refs = r.filter(x => x.es_referencia);
    const mejor = refs.reduce((a, b) => b.mae < a.mae ? b : a);
    const lineal = r.find(x => x.modelo === "Regresión lineal");
    const gbt = r.find(x => x.modelo.indexOf("GBT") === 0);
    const p = k => (D.calidad.percentiles.find(x => Math.abs(x.p - k) < 1e-9) || {}).dias;
    const baja = D.predicciones.por_confianza.find(x => x.nivel === "baja");
    D.der = {
      mejor_ref: mejor, lineal: lineal, gbt: gbt,
      mejora_pct: (mejor.mae - lineal.mae) / mejor.mae * 100,
      mejora_v4_pct: D.modelo.v4 ? (D.modelo.v4.mae_dias - D.modelo.v5.mae_dias) / D.modelo.v4.mae_dias * 100 : null,
      p99: p(0.99), p999: p(0.999),
      cols_orig: D.capas.bronze.columnas - D.capas.bronze.metadatos.length,
      n_tablas_bronze: D.capas.bronze.tablas.length,
      periodo_txt: N.fmtMes(D.meta.periodo_datos.desde) + " – " + N.fmtMes(D.meta.periodo_datos.hasta),
      pct_baja: baja ? baja.zips / D.predicciones.n * 100 : null
    };
  })();

  // ---------- Enlace de datos ----------
  const leer = (ruta) => ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), D);
  function formatear(v, f) {
    if (v == null || (typeof v === "number" && isNaN(v))) return null;
    switch (f) {
      case "int": return N.fmtInt(v);
      case "d0": return N.fmtDec(v, 0);
      case "d1": return N.fmtDec(v, 1);
      case "d2": return N.fmtDec(v, 2);
      case "d3": return N.fmtDec(v, 3);
      case "pct1": return N.fmtPct(v, 1);
      case "pct100": return N.fmtDec(v * 100, 0) + "%";
      case "fecha": return N.fmtFecha(v);
      case "mes": return N.fmtMes(v);
      default: return String(v);
    }
  }
  g.__SIN_DATO = [];
  document.querySelectorAll("[data-k]").forEach(el => {
    const t = formatear(leer(el.dataset.k), el.dataset.f);
    if (t == null) { el.textContent = "—"; el.classList.add("sin-dato"); g.__SIN_DATO.push(el.dataset.k); }
    else el.textContent = t;
  });
  document.querySelectorAll("[data-lista]").forEach(el => {
    const arr = leer(el.dataset.lista) || [];
    el.innerHTML = arr.map(t => `<li><span>${N.esc(t.nombre)}</span><b>${N.fmtInt(t.filas)}</b> filas</li>`).join("");
  });
  document.querySelectorAll("[data-chips]").forEach(el => {
    el.innerHTML = (leer(el.dataset.chips) || []).map(t => `<span class="chip-fijo">${N.esc(t)}</span>`).join("");
  });

  // ---------- Gráficos ----------
  const montar = (nombre, fn) => { const el = document.querySelector(`[data-chart="${nombre}"]`); if (el) fn(el); };

  montar("nulos", el => {
    const it = D.capas.silver.nulos.filter(x => x.pct > 0).slice(0, 8)
      .map(x => ({ etiqueta: COLS[x.columna] || x.columna, valor: x.pct }));
    if (!it.length) { el.innerHTML = `<p class="nota">Sin datos faltantes.</p>`; return; }
    G.barrasH(el, it, { fmt: v => N.fmtDec(v, 1) + "%" });
  });

  montar("banderas", el => {
    const it = Object.entries(D.capas.silver.banderas).filter(e => e[1] > 0)
      .map(e => ({ etiqueta: BANDERAS[e[0]] || e[0], valor: e[1], clase: "alerta" }));
    if (!it.length) { el.innerHTML = `<p class="nota">No se marcó ninguna fila.</p>`; return; }
    G.barrasH(el, it, { fmt: v => N.fmtInt(v) });
  });

  montar("histograma", el => {
    const it = D.calidad.histograma.map(h => ({ etiqueta: h.rango, valor: h.filas, clase: h.rango.charAt(0) === ">" ? "alerta" : "" }));
    G.columnas(el, it, { escala: "sqrt" });
  });

  montar("ventas", el => {
    const it = D.calidad.por_ventas.map((x, i) => ({ etiqueta: x.grupo + " ventas", valor: x.desv, clase: i === 0 ? "alerta" : "", nota: "días" }));
    G.barrasH(el, it, { fmt: v => N.fmtDec(v, 0) });
  });

  montar("particiones", el => G.lineaTiempo(el, D.capas.gold.particiones));

  montar("grupos", el => {
    const it = Object.entries(D.capas.gold.grupos_variables).map(e => ({ etiqueta: e[0], valor: e[1] }));
    G.barrasH(el, it, { fmt: v => N.fmtInt(v) });
  });

  montar("resultados", el => {
    const it = D.modelo.resultados.slice().sort((a, b) => a.mae - b.mae).map(r => ({
      etiqueta: MODELOS[r.modelo] || r.modelo, valor: r.mae,
      clase: r.modelo === "Regresión lineal" ? "destacado" : (r.modelo.indexOf("GBT") === 0 ? "contraste" : "ref")
    }));
    G.barrasH(el, it, { fmt: v => N.fmtDec(v, 1) });
  });

  montar("meses", el => {
    const m = D.modelo.mes_a_mes;
    G.lineas(el, m.map(x => N.fmtMes(x.mes)), [
      { nombre: "Modelo", valores: m.map(x => x.mae_modelo), clase: "s0", etiquetar: true },
      { nombre: "Referencia: media histórica de la zona", valores: m.map(x => x.mae_ref_historica), clase: "s1" }
    ], { min: 0, aria: "Error del modelo y de la referencia mes a mes" });
  });

  montar("confianza", el => {
    const NOM = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" };
    el.innerHTML = D.modelo.confianza.map(c => `
      <div class="card conf c-${c.nivel}">
        <h4>${NOM[c.nivel]}</h4>
        <b>${N.fmtDec(c.mae, 1)} días</b><small>error promedio</small>
        <p>${N.fmtDec(c.pct_filas, 0)}% de los casos</p>
        <p>Rango acierta ${N.fmtDec(c.cobertura, 0)}%</p>
      </div>`).join("");
  });

  // Calibración con selector de umbral
  (function calibracion() {
    const cont = document.querySelector('[data-selector="umbral"]');
    const graf = document.querySelector('[data-chart="calibracion"]');
    const nota = document.querySelector("[data-calibracion-nota]");
    if (!cont || !graf) return;
    const cal = D.modelo.calibracion;
    function dibujar(k) {
      cont.querySelectorAll("button").forEach((b, j) => b.classList.toggle("on", j === k));
      const c = cal[k];
      G.calibracion(graf, c.tramos);
      const e = c.error_por_confianza || {};
      nota.innerHTML = `Plazo de <b>${c.umbral} días</b>: el modelo se desvía en promedio <b>${N.fmtDec(c.error_pts, 1)} puntos</b> de lo que ocurrió.
        <small>Por confianza: alta ${N.fmtDec(e.alta, 1)} · media ${N.fmtDec(e.media, 1)} · baja ${N.fmtDec(e.baja, 1)}. Cada punto agrupa casos con una probabilidad parecida; mientras más cerca de la diagonal, mejor.</small>`;
    }
    cont.innerHTML = cal.map((c, k) => `<button type="button" data-k="${k}">${c.umbral} días</button>`).join("");
    cont.querySelectorAll("button").forEach(b => b.addEventListener("click", () => dibujar(+b.dataset.k)));
    dibujar(Math.min(1, cal.length - 1));
  })();

  // Simulador dentro de la diapositiva
  const simEl = document.getElementById("sim-diapositiva");
  if (simEl) g.Simulador.montar(simEl, Z);

  // ---------- Navegación ----------
  const slides = Array.from(document.querySelectorAll(".slide"));
  const barra = document.querySelector("#progreso i"), cont = document.getElementById("contador");
  const segEl = document.getElementById("seg-actual"), reloj = document.getElementById("reloj");
  let i = 0, inicio = null, relojVisible = false, tecleado = "";

  function ir(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, k) => s.classList.toggle("activa", k === i));
    barra.style.width = (slides.length === 1 ? 100 : i / (slides.length - 1) * 100) + "%";
    cont.textContent = (i + 1) + " / " + slides.length;
    segEl.textContent = slides[i].dataset.seg || slides[i].dataset.titulo || "";
    if (i > 0 && inicio == null) inicio = Date.now();
    try { history.replaceState(null, "", "#" + (i + 1)); } catch (e) { /* archivo local: se ignora */ }
  }
  function pintarReloj() {
    if (!relojVisible) return;
    const s = inicio == null ? 0 : Math.floor((Date.now() - inicio) / 1000);
    reloj.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " / 15:00";
    reloj.className = s >= 900 ? "alerta-t" : (s >= 720 ? "aviso-t" : "");
  }
  setInterval(pintarReloj, 1000);

  document.getElementById("btn-ant").addEventListener("click", () => ir(i - 1));
  document.getElementById("btn-sig").addEventListener("click", () => ir(i + 1));
  document.addEventListener("keydown", e => {
    const t = e.target, tag = (t && t.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); ir(i + 1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); ir(i - 1); }
    else if (k === "Home") ir(0);
    else if (k === "End") ir(slides.length - 1);
    else if (k === "f" || k === "F") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
    else if (k === "t" || k === "T") { relojVisible = !relojVisible; reloj.classList.toggle("oculto", !relojVisible); pintarReloj(); }
    else if (k === "r" || k === "R") { inicio = null; pintarReloj(); }
    else if (/^[0-9]$/.test(k)) { tecleado += k; }
    else if (k === "Enter" && tecleado) { ir(parseInt(tecleado, 10) - 1); tecleado = ""; }
    else tecleado = "";
  });

  const h = parseInt((location.hash || "").replace("#", ""), 10);
  ir(isNaN(h) ? 0 : h - 1);
  setTimeout(() => { const a = document.getElementById("ayuda-teclas"); if (a) a.classList.add("oculto"); }, 7000);
})(window);