# Roadmap

Prioridade de cima para baixo. Marque `[x]` ao concluir e anote detalhes no DIARIO.

## Bloco 1 — Sistemas de combate do Goku
- [x] **Rage Gauge**: barra que enche ao causar e receber dano (e com guardas perfeitas). Cheia → libera o ataque supremo do personagem. Mostrar no HUD.
- [x] **Genki Dama** (supremo do Goku base): `Special_EveryoneLendMeYourEnergy` → `Special_SpiritBomb` → esfera `genkidama` (fx_extra) crescendo acima → arremesso → `genkidama_chao`/`genkidama_explosao` no inimigo. Sons goku_gnkdm_* / gnkdm_charge, vozes vgkn209 e vgkn201demo. Grande tremor + flash.
- [x] **Impactos melhores**: explosão no nocaute, rochas/poeira quando alguém é lançado (`impactoderochas`, `poeira4/5`), `hit_extremamente_forte` nos golpes finais, ondas de energia com explosão no alvo.
- [x] **HUD com as artes originais** (`hud_zl3`: barras de vida/ki, faces `faces_3v3`), legível no celular.

## Bloco 2 — Grupo de 3 heróis
- [x] Personagens jogáveis Piccolo e Kuririn (JSON com golpes: Makankosappo, Kienzan, Kamehameha do Kuririn, Masenko… ver animações em data/sprites).
- [x] Batalha 3 heróis vs 1 (posições, ordem de turno por velocidade, menu por herói, inimigo escolhe alvo).
- [x] **Sparking Combo**: ataque em dupla (dois heróis com ki/condição) — começar com Goku + Piccolo (Kamehameha + Makankosappo).
- [x] Guarda cronometrada funcionando para qualquer herói atacado.

- [ ] Kamehameha do Kuririn (o raio dele é um objeto separado no ZL3, t282–t284, ainda não extraído) e Masenko/outros golpes extras.
- [ ] Mais Sparking Combos (Goku + Kuririn, Piccolo + Kuririn) e destacar no HUD qual herói está agindo.
- [ ] Ataque supremo dos inimigos (Raditz já enche a Rage, mas não tem supremo) e supremos de Piccolo (Light Grenade) e Kuririn (Scattering Energy Wave).

## Bloco 3 — Saga Saiyajin jogável
- [ ] Inimigos: Saibaman (vários), Nappa, Vegeta (Galick Gun, etc.).
- [ ] Modo história: sequência de batalhas com telas de diálogo (texto próprio, retratos/faces), começando por Raditz → Saibamen → Nappa → Vegeta.
- [ ] Tela de título/menus (novo jogo, continuar, opções de volume), salvar progresso em localStorage (com try/catch).

## Bloco 4 — Progressão e polimento
- [ ] **AP**: ganhar AP ao vencer; gastar em melhorias de atributos e para desbloquear golpes (árvore simples por personagem). Salvar.
- [ ] Balanceamento por simulação (rodar várias lutas automáticas com taxas de erro 0 / 0.3 / 1 e ajustar para: jogador bom vence com folga, jogador ruim perde).
- [ ] Responsividade no celular (menus, botões grandes, orientação paisagem).
- [ ] Atualizar README.
