// Habilidades do usuário: golpes criados no editor de cenas e salvos neste navegador (localStorage).
// Cada habilidade pertence a um personagem; as "equipadas" entram no menu de golpes dele em qualquer
// batalha (chave "hab_<id>" em def.golpes). Ligar/desligar funciona até no meio da luta (menu de pausa).
window.FF = window.FF || {};

FF.Habilidades = {
  CHAVE: 'ff_habilidades',

  ler() { try { return JSON.parse(localStorage.getItem(this.CHAVE) || '{}'); } catch (e) { return {}; } },
  gravar(t) { try { localStorage.setItem(this.CHAVE, JSON.stringify(t)); return true; } catch (e) { return false; } },
  listar(personagem) {
    return Object.values(this.ler()).filter(h => !personagem || h.personagem === personagem)
      .sort((a, b) => (a.personagem + a.nome).localeCompare(b.personagem + b.nome));
  },

  // salva (nova ou atualizando a mesma id); devolve a habilidade
  salvar({ id, nome, personagem, forma, golpe }) {
    const t = this.ler();
    id = id || (nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'hab') + '_' + Date.now().toString(36).slice(-4);
    const g = JSON.parse(JSON.stringify(golpe));
    g.nome = nome;
    g.habId = id;
    if (!g.descricao) g.descricao = '⭐ Habilidade criada por você no editor de cenas.';
    const ant = t[id];
    t[id] = { id, nome, personagem, forma: forma || null, golpe: g, equipada: ant ? ant.equipada : true, criada: ant ? ant.criada : Date.now(), editada: Date.now() };
    this.gravar(t);
    return t[id];
  },
  apagar(id) { const t = this.ler(); delete t[id]; this.gravar(t); },
  equipar(id, sim) { const t = this.ler(); if (t[id]) { t[id].equipada = !!sim; this.gravar(t); } },

  // coloca/tira as habilidades equipadas no personagem (idempotente)
  sincronizar(def) {
    if (!def || !def.golpes) return;
    for (const k of Object.keys(def.golpes)) if (k.startsWith('hab_')) delete def.golpes[k];
    Object.values(def.formas).forEach(f => { f.golpes = (f.golpes || []).filter(k => !k.startsWith('hab_')); });
    for (const h of this.listar(def.id)) {
      if (!h.equipada) continue;
      const k = 'hab_' + h.id;
      def.golpes[k] = JSON.parse(JSON.stringify(h.golpe));
      // golpe com animações do próprio lutador só entra na forma em que foi criado (outra forma pode não ter a animação)
      const usaAnim = (h.golpe.roteiro || []).some(p => p.anim);
      const formas = usaAnim && h.forma && def.formas[h.forma] ? [h.forma] : Object.keys(def.formas);
      formas.forEach(fid => def.formas[fid].golpes.push(k));
    }
  },

  // carrega os sprites que as cenas livres das habilidades usam
  async preparar(defs) {
    const cenas = [];
    defs.forEach(d => Object.entries(d.golpes || {}).forEach(([k, g]) => {
      if (k.startsWith('hab_')) (g.roteiro || []).forEach(p => p.cena && cenas.push(p.cena));
    }));
    if (FF.Cena) await Promise.all(cenas.map(c => FF.Cena.preparar(c)));
  },

  // aplica de novo em todos os lutadores de uma batalha em andamento
  async atualizarBatalha(b) {
    if (!b) return;
    const defs = [...new Set(b.all.map(f => f.def))];
    defs.forEach(d => this.sincronizar(d));
    await this.preparar(defs);
  },

  // lista com liga/desliga, usada na seleção da Batalha Livre e no menu de pausa
  // opts: { personagens: [ids] (filtra e ordena), nomes: {id: nome}, aoMudar(), editar(h) }
  painel(box, opts = {}) {
    box.innerHTML = '';
    let lista = this.listar();
    if (opts.personagens) lista = lista.filter(h => opts.personagens.includes(h.personagem));
    if (!lista.length) {
      const p = document.createElement('p');
      p.className = 'hab-vazio';
      p.textContent = opts.personagens
        ? 'Nenhuma habilidade para esses lutadores. Crie no editor de cenas e use "⭐ Salvar como habilidade".'
        : 'Nenhuma habilidade ainda. Crie no editor de cenas e use "⭐ Salvar como habilidade".';
      box.appendChild(p);
      return;
    }
    const nomes = opts.nomes || {};
    let grupo = null;
    lista.forEach(h => {
      if (h.personagem !== grupo) {
        grupo = h.personagem;
        const t = document.createElement('div');
        t.className = 'hab-grupo';
        t.textContent = nomes[grupo] || grupo;
        box.appendChild(t);
      }
      const row = document.createElement('label');
      row.className = 'hab-item' + (h.equipada ? ' on' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!h.equipada;
      cb.onchange = () => { this.equipar(h.id, cb.checked); row.classList.toggle('on', cb.checked); opts.aoMudar && opts.aoMudar(h); };
      const n = document.createElement('span');
      n.className = 'hab-nome';
      n.textContent = '⭐ ' + h.nome;
      const info = document.createElement('small');
      const g = h.golpe;
      info.textContent = (g.custoKi ? g.custoKi + ' ki' : 'sem ki') + ' · poder ' + (g.poder || 1);
      row.append(cb, n, info);
      if (opts.editar) {
        const ed = document.createElement('button');
        ed.type = 'button'; ed.textContent = '✏'; ed.title = 'Editar no editor de cenas';
        ed.onclick = (e) => { e.preventDefault(); opts.editar(h); };
        row.appendChild(ed);
      }
      if (opts.apagar) {
        const x = document.createElement('button');
        x.type = 'button'; x.textContent = '🗑'; x.title = 'Apagar habilidade';
        x.onclick = (e) => {
          e.preventDefault();
          if (!confirm('Apagar a habilidade "' + h.nome + '"?')) return;
          this.apagar(h.id); this.painel(box, opts); opts.aoMudar && opts.aoMudar(h);
        };
        row.appendChild(x);
      }
      box.appendChild(row);
    });
  },
};
