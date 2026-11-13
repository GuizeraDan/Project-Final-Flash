// IA dos inimigos: escolhe um golpe pelos pesos definidos no JSON do personagem
// ("ia": [{golpe, peso, kiMin?, hpAbaixo?}]), respeitando o custo de ki.
// Personagens sem "ia" (ex.: heróis usados como inimigos na Batalha Livre) ganham regras automáticas.
// Habilidades criadas no Estúdio (hab_*) equipadas entram sempre: com a regra da lista, se houver, ou com a automática.
window.FF = window.FF || {};

FF.AI = {
  regrasAuto(actor) {
    return (actor.form.golpes || []).map(id => {
      const m = actor.def.golpes[id];
      if (!m || m.supremo) return null;
      if (FF.UI && FF.UI.visivel && !FF.UI.visivel(actor, m)) return null;
      const txt = JSON.stringify(m.roteiro || []);
      if (m.requer && FF.UI && FF.UI.meets && !FF.UI.meets(actor, m.requer)) return null;
      if (/"transformar"/.test(txt)) return { golpe: id, peso: actor.formId === (actor.def.formaInicial || 'base') ? 1 : 0 };
      if (/"ki"\s*:/.test(txt) && !/"(acerto|projetil)"/.test(txt)) return { golpe: id, peso: actor.ki < 30 ? 3 : 0.3 };
      if (/"(acerto|projetil|lancarObjeto|atordoar)"/.test(txt)) return { golpe: id, peso: m.custoKi ? 3 : 4 };
      return { golpe: id, peso: 1 };
    }).filter(r => r && r.peso > 0);
  },

  choose(actor, target, battle) {
    let regras = actor.form.ia || actor.def.ia || this.regrasAuto(actor);
    // IA de lista fixa: as ⭐ habilidades equipadas que não estão na lista entram com o peso automático
    if (actor.form.ia || actor.def.ia) {
      const na = new Set(regras.map(r => r.golpe));
      regras = regras.concat(this.regrasAuto(actor).filter(r => r.golpe.startsWith('hab_') && !na.has(r.golpe)));
    }
    const ok = regras.filter(r => {
      const m = actor.def.golpes[r.golpe];
      if (!m) return false;
      if (FF.UI && FF.UI.visivel && !FF.UI.visivel(actor, m)) return false;
      if ((m.custoKi || 0) > actor.ki) return false;
      if (m.requer && FF.UI && FF.UI.meets && !FF.UI.meets(actor, m.requer)) return false;
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
