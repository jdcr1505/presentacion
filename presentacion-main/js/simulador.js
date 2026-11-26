/* simulador.js: formulario con dos modos. Lo usan simulador.html y la diapositiva 12 de index.html */
(function (g) {
  "use strict";
  const N = g.Nucleo, G = g.Graficos;

  const TXT_CONF = {
    alta: "Zona con muchas ventas recientes: es donde la predicción es más fiable.",
    media: "Zona con ventas moderadas: predicción razonable, con un rango intermedio.",
    baja: "Zona con pocas ventas recientes: la predicción es solo orientativa y el rango es amplio."
  };
  const AVISO = "Es el tiempo típico de venta de la zona, para viviendas que se venden. No es una garantía para una propiedad concreta.";

  function ejemplos(Z) {
    const pick = (cond) => { const f = Z.filas.find(cond); return f ? f[0] : null; };
    return [
      { nivel: "alta", zip: pick(f => f[2] === 0 && f[3] >= 50) || pick(f => f[2] === 0) },
      { nivel: "media", zip: pick(f => f[2] === 1) },
      { nivel: "baja", zip: pick(f => f[2] === 2 && f[3] >= 1) || pick(f => f[2] === 2) }
    ].filter(e => e.zip);
  }

  function plantilla(ej, Z) {
    return `
      <div class="sim-izq">
        <div class="sim-tabs" role="tablist">
          <button type="button" class="on" data-modo="A">Tengo un plazo</button>
          <button type="button" data-modo="B">Quiero una certeza</button>
        </div>
        <label class="sim-et">Código postal (ZIP, 5 dígitos)</label>
        <div class="sim-zip">
          <input class="in-zip" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="Ej.: 07002" aria-label="Código postal">
          <div class="ejemplos"><span>Probar con:</span>${ej.map(e => `<button type="button" data-zip="${N.esc(e.zip)}">${N.esc(e.zip)} <small>${e.nivel}</small></button>`).join("")}</div>
        </div>
        <div class="ctl ctl-A">
          <label class="sim-et">¿En cuántos días quieres vender? <b class="v-a">60</b> días</label>
          <input class="r-a" type="range" min="15" max="180" step="5" value="60" aria-label="Plazo en días">
          <div class="chips">${[30, 60, 90, 120].map(d => `<button type="button" data-dias="${d}">${d} días</button>`).join("")}</div>
        </div>
        <div class="ctl ctl-B oculto">
          <label class="sim-et">¿Con qué certeza? <b class="v-b">80</b>%</label>
          <input class="r-b" type="range" min="50" max="95" step="5" value="80" aria-label="Certeza en porcentaje">
          <div class="chips">${[50, 70, 80, 90].map(p => `<button type="button" data-pc="${p}">${p}%</button>`).join("")}</div>
        </div>
      </div>
      <div class="sim-der">
        <div class="sim-res"></div>
        <p class="sim-pie">Ventana predicha: <b>${N.fmtFecha(Z.meta.ventana_inicio)}</b> a <b>${N.fmtFecha(Z.meta.ventana_fin)}</b> · Predicciones generadas: ${N.esc(Z.meta.generado)}</p>
      </div>`;
  }

  function montar(el, Z) {
    if (!Z || !Z.filas) { el.innerHTML = `<p class="sim-error">Falta el archivo data/datos_zip.js.</p>`; return; }
    const idx = N.indexar(Z), cfg = Z.meta;
    el.classList.add("sim");
    el.innerHTML = plantilla(ejemplos(Z), Z);
    const q = s => el.querySelector(s);
    const qa = s => Array.from(el.querySelectorAll(s));
    let modo = "A";

    function render() {
      const res = q(".sim-res"), zip = q(".in-zip").value;
      if (zip.length === 0) { res.innerHTML = `<p class="sim-vacio">Escribe un código postal de 5 dígitos o prueba con un ejemplo.</p>`; return; }
      if (zip.length < 5) { res.innerHTML = `<p class="sim-vacio">Faltan dígitos: el código postal tiene 5.</p>`; return; }
      const d = idx.get(zip);
      if (!d) { res.innerHTML = `<p class="sim-error">No hay predicción para el código <b>${N.esc(zip)}</b>. Puede que no tenga ventas recientes en los datos.</p>`; return; }

      const curva = Z.curva[d.conf];
      const [lo, hi] = N.rango(curva, d.dias, cfg);
      let msg, marca, nota = "";
      if (modo === "A") {
        const x = +q(".r-a").value;
        const p = N.probMenorIgual(curva, d.dias, x);
        msg = `En el código postal <b>${N.esc(zip)}</b>, el tiempo típico de venta es de <b>${x} días o menos</b> con una probabilidad de <b>${N.probTexto(p)}</b>.`;
        marca = { x, p };
        if (x <= 30) nota = "Para plazos de 30 días o menos, el modelo tiende a subestimar un poco la probabilidad: la real suele ser algo mayor.";
      } else {
        const pc = +q(".r-b").value;
        const dd = N.diasParaProb(curva, d.dias, pc / 100, cfg);
        const txt = dd >= cfg.pred_max ? `más de ${cfg.pred_max} días` : `${Math.round(dd)} días o menos`;
        msg = `En el <b>${pc}%</b> de los casos, el tiempo típico de venta en tu zona es de <b>${txt}</b>.`;
        marca = { x: dd, p: pc / 100 };
      }

      res.innerHTML = `
        <div class="res-msg">${msg}</div>
        <div class="res-datos">
          <div><small>Predicción central</small><b>${N.fmtInt(d.dias)} días</b></div>
          <div><small>Rango esperado del ${cfg.nivel_intervalo}%</small><b>${N.fmtInt(lo)} a ${N.fmtInt(hi)} días</b></div>
          <div><small>Confianza</small><b class="chip c-${d.conf}">${d.conf}</b></div>
          <div><small>Ventas del periodo previo</small><b>${d.ventas < 0 ? "sin dato" : N.fmtInt(d.ventas)}</b></div>
        </div>
        <div class="res-graf"></div>
        <p class="res-conf">${TXT_CONF[d.conf]}</p>
        ${nota ? `<p class="res-nota">${nota}</p>` : ""}
        <p class="aviso">${AVISO}</p>`;
      G.curva(res.querySelector(".res-graf"), curva, d.dias, cfg, marca);
    }

    qa(".sim-tabs button").forEach(b => b.addEventListener("click", () => {
      modo = b.dataset.modo;
      qa(".sim-tabs button").forEach(x => x.classList.toggle("on", x === b));
      q(".ctl-A").classList.toggle("oculto", modo !== "A");
      q(".ctl-B").classList.toggle("oculto", modo !== "B");
      render();
    }));
    q(".in-zip").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 5); render(); });
    qa(".ejemplos button").forEach(b => b.addEventListener("click", () => { q(".in-zip").value = b.dataset.zip; render(); }));
    q(".r-a").addEventListener("input", e => { q(".v-a").textContent = e.target.value; render(); });
    q(".r-b").addEventListener("input", e => { q(".v-b").textContent = e.target.value; render(); });
    qa(".chips button[data-dias]").forEach(b => b.addEventListener("click", () => { q(".r-a").value = b.dataset.dias; q(".v-a").textContent = b.dataset.dias; render(); }));
    qa(".chips button[data-pc]").forEach(b => b.addEventListener("click", () => { q(".r-b").value = b.dataset.pc; q(".v-b").textContent = b.dataset.pc; render(); }));
    render();
  }

  g.Simulador = { montar };
})(window);