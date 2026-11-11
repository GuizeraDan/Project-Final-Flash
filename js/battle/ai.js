// IA dos inimigos: escolhe um golpe pelos pesos definidos no JSON do personagem
// ("ia": [{golpe, peso, kiMin?, hpAbaixo?}]), respeitando o custo de ki.
window.FF = window.FF || {};

FF.AI = {
  choose(actor, target, battle) {
    const regras = actor.form.ia || actor.def.ia || [];
    const ok = regras.filter(r => {
      const m = actor.def.golpes[r.golpe];
      if (!m) return false;
      if ((m.custoKi || 0) > actor.ki) return false;
      if (r.hpAbaixo && actor.hp / actor.hpMax > r.hpAbaixo) return false;
      if (r.kiAbaixo && actor.ki >= r.kiAbaixo) return false;
      return true;
    });
    if (!ok.length) return actor.form.golpes[0];
    const total = ok.reduce((s, r) => s + (r.peso || 1), 0);
    let x = Math.random() * total;
    for (const r of ok) { x -= (r.peso || 1); if (x <= 0) return r.golpe; }
    return ok[0].golpe;
  },
};
