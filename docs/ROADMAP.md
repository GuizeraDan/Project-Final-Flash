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

- [ ] Kamehameha do Kuririn (o raio dele é um objeto separado no ZL3, t282–t284, ainda não extraído; precisa do APK).
- [x] Mais Sparking Combos (Piccolo + Kuririn, Kuririn + Goku) e destaque no HUD do herói da vez (moldura pulsante + seta).
- [x] Supremos: Raditz (Double Sunday), Piccolo (Granada de Luz), Kuririn (Onda de Energia Dispersa, chuva de rajadas do alto).
- [x] Golpes extras: Hellzone Grenade (Piccolo) e Taiyoken (Kuririn, novo estado **atordoado**: o alvo perde a vez).
- [ ] Sparking Combo de 3 (Goku + Piccolo + Kuririn) e Sparking do Goku SSJ.

## Bloco 3 — Saga Saiyajin jogável
- [x] Inimigos: Saibaman (vários), Nappa, Vegeta (Galick Gun, etc.).
- [x] Modo história: sequência de batalhas com telas de diálogo (texto próprio, retratos/faces), começando por Raditz → Saibamen → Nappa → Vegeta.
- [x] Tela de título/menus (novo jogo, continuar, opções de volume), salvar progresso em localStorage (com try/catch).
- [ ] Saibaman com animações próprias de dano/caído (o sprite do ZL3 só tem ataques; hoje usa quadros emprestados via `animsDerivadas`).
- [ ] Conferir quadro a quadro os golpes de Nappa/Vegeta (o Galick Ho e o Break Cannon usam projéteis `kiblast_amarelo` grandes; se o raio estiver desenhado nos quadros, trocar por acertos nos quadros como no Kamehameha).
- [ ] Cena de vitória/derrota do modo história com fundo do cenário (hoje o diálogo de abertura aparece sobre fundo escuro, antes de a batalha carregar).

## Bloco 4 — Progressão e polimento
- [x] **AP**: ganhar AP ao vencer; gastar em melhorias de atributos (Treinamento, 5 níveis por atributo por herói). Salvo.
- [ ] AP para desbloquear golpes (árvore por personagem) — aguardando decisão do usuário sobre quais golpes ficam bloqueados.
- [x] Balanceamento por simulação (erro 0 / 0.3 / 1 nas batalhas 02 e 04): bom vence com folga, ruim perde. Sparking Goku+Piccolo subiu para 3.4.
- [ ] Lutas 04/05 longas (~30 turnos, ~4 min). Considerar inimigos mais agressivos em vez de menos vida.
- [x] Responsividade no celular (aviso para girar em pé, botões ≥ 40px no toque, menu sem descrição, 100dvh). Não testado em aparelho real.
- [x] Atualizar README.
