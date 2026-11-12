# Diário de desenvolvimento

## 11/11/2026 01:15 — preparação para as sessões noturnas
- Branch de trabalho: `aprimoramentos-noturnos` (não mexer na `main`; o usuário revisa e faz o merge de manhã).
- Extraídos do APK: piccolo, krillin, nappa, vegeta_saiyajin, tienshinhan, saibaman, fx_extra, hud_zl3. Copiados ~530 áudios (vozes dos personagens da saga, efeitos, narrador).
- Criados: CLAUDE.md, docs/ROADMAP.md, docs/catalogo_zl3.json, docs/audios_zl3_disponiveis.txt, tools/testes/batalha.js.
- Próximo: Bloco 1 do ROADMAP.

## 11/11/2026 01:30–01:55 — sessão noturna 1 de 4
**Feito (Bloco 1 inteiro + boa parte do Bloco 2):**
- **Rage Gauge** (`fighter.rage`, 0–100): enche ao causar dano (×90 da fração da vida do alvo) e mais ao receber (×120; só 40% disso se o golpe recebido for supremo), +8 com guarda perfeita. Constantes em `FF.RAGE_CAUSAR`/`FF.RAGE_RECEBER` (battle.js). Golpe com `"supremo": true` só libera com a Rage cheia e zera a barra. Inimigo com Rage cheia usa o supremo dele se tiver.
- **Genki Dama** (supremo do Goku base): pedido de energia → esfera `genkidama` cresce acima do Goku com partículas `genkidama_efeito` → arremesso (anel de crítico) → `genkidama_chao` + `genkidama_explosao` + `Explosao15`, 5 acertos, flash e tremor fortes. Vozes vgkn201demo/vgkn209 e sons goku_gnkdm_*.
- Novos passos de roteiro: `objeto` (efeito persistente que cresce), `lancarObjeto` (arremessa no alvo com efeitos de impacto e série de acertos), `curar` (fração da vida, `todos` para o time) e `quem` + `paralelo` (parceiro executa um sub-roteiro ao mesmo tempo: base do Sparking Combo). Efeitos aceitam `duracao` (loop por N s) e procuram no `fx` e no `fx_extra`. Projéteis aceitam `fx` do fx_extra e `escala`.
- **Impactos**: golpe final corpo a corpo solta `Extreme`; onda de energia que lança solta `Explosao4`; nocaute = `Explosao11` + som de explosão + flash + tremor + hitstop maior; quem é lançado solta `Poeira_De_Colisao_Com_O_Solo_Frente` + `Rochas` ao parar.
- **HUD com as artes do hud_zl3**: placa com o dragão (`fundo_barras`, metade esquerda para herói e direita para inimigo), barras `vida_*` (verde/amarelo/vermelho + rastro `vida_red_*`), `ki_*` sobre `fundo_ki_jogador`, retrato = cabeça do próprio sprite (acompanha a forma, ex.: SSJ), Rage com ícone `Empty`/`Full` pulsando e “SUPREMO PRONTO!”. Com 3 heróis os painéis ficam empilhados em escala 1.05. O painel antigo continua como reserva (`panelSimples`).
- **Piccolo** (Sequência, Makankosappo com o raio espiral `Pt1`/`Pt2` do fx_extra, Rajada Teleguiada) e **Kuririn** (Sequência, Kienzan com o disco `Krillin_1`, Semente dos Deuses que cura 30% do time).
- **Batalha 3 vs 1** `saiyajin_02` (Goku, Piccolo, Kuririn vs Raditz com `ajustes` de vida/ataque por batalha). Ordem de turno por `velocidade` (Kuririn 12, Goku 10, Piccolo 9, Raditz 8). Inimigo escolhe herói ao acaso, com mais chance no mais ferido. Guarda cronometrada vale para qualquer herói.
- **Sparking Combo** Goku + Piccolo (30 KI de cada, `requer.parceiro`): Piccolo dispara o Makankosappo enquanto o Goku solta o Kamehameha.
- Tela inicial com botões para escolher a batalha (`?batalha=` na URL continua tendo prioridade). Teste aceita `--rage 100`.

**Decisões:** retrato pelo sprite em vez de `faces_3v3` (não achei com certeza os rostos de Raditz/Piccolo/Kuririn entre os 45; dá para trocar depois). Kamehameha do Kuririn ficou de fora (o raio é objeto separado ainda não extraído).

**Problemas/observações:** com guardas perfeitas o Raditz da batalha 3v1 ainda causa pouco dano (o jogador automático defende tudo); balancear no Bloco 4. A Rage do inimigo enche e fica parada porque o Raditz não tem supremo. O feixe do Makankosappo passa “por cima” dos aliados que estão na frente (é só visual).

**Próxima sessão:** começar o Bloco 3 (Saibamen, Nappa, Vegeta com Galick Gun; modo história com telas de diálogo; título/menus e salvamento). Se sobrar tempo: supremos de Piccolo/Kuririn/inimigos e destacar no HUD o herói da vez. Testes: `node tools/testes/batalha.js --plano 1,2,4,5,1` e `--batalha saiyajin_02 --plano 1,7,1 --tempo 250` (a 3v1 demora mais de 2 min).

## 11/11/2026 02:30–02:50 — sessão noturna 2 de 4
Os 4 itens principais do Bloco 2 já tinham sido feitos na sessão 1, então esta sessão fechou os subitens que sobraram.

**Feito:**
- **Supremos** (`"supremo": true`, só com a Rage cheia): Piccolo — *Granada de Luz* (`Ultimate_LightGrenade_*`, esfera `Homing_Energy_Blast` grande + `Explosao_Granada2`, sons `piccolo_gkrtkdn_*`); Kuririn — *Onda de Energia Dispersa* (`Ultimate_ScatteringEnergyWave_*`, 8 rajadas caindo do alto + 1 grande que lança, sons `krillin_kksne_*`); Raditz — *Double Sunday* (`UltimateAttack_*`, dois disparos grandes; a IA já usava o supremo quando a Rage enche).
- **Sparking Combos** novos: Piccolo + Kuririn (Makankosappo + Kienzan) e Kuririn + Goku (Kienzan + Kamehameha), 30 KI de cada, poder 3.4 (mais forte que o Kienzan sozinho, para valer o ki dos dois).
- **Golpes extras:** *Hellzone Grenade* (Piccolo, 30 KI: 6 esferas `HellzoneGrenade_InAir` + explosão que fecha o cerco) e *Taiyoken* (Kuririn, 25 KI).
- **Estado atordoado** (motor): passo de roteiro `{"atordoar": N}` deixa o alvo sem as próximas N vezes (`fighter.atordoado`, não acumula). Na vez dele aparece “ATORDOADO!” e só roda o fim de turno (regenera ki).
- **Projétil `deCima`**: a rajada nasce acima do alvo e cai em diagonal (usado na chuva do Kuririn).
- **HUD:** `battle.atual` = quem está escolhendo/agindo; moldura dourada pulsante no painel dele (com 3 heróis) e seta sobre a cabeça enquanto escolhe.

**Menus agora:** Piccolo = Sequência, Makankosappo, Rajada Teleguiada, Hellzone, Sparking c/ Kuririn, Granada de Luz, Carregar Ki. Kuririn = Sequência, Kienzan, Taiyoken, Semente, Sparking c/ Goku, Onda Dispersa, Carregar Ki.

**Observações:** o Sparking Goku + Piccolo continua com poder 2.6 (ficou mais fraco que os novos; revisar no balanceamento). O Taiyoken torna o Raditz bem mais fácil na 3v1; se ficar forte demais, subir o custo ou dar chance de falhar. Os quadros reais do `UltimateAttack` do Raditz não foram conferidos um a um (pode ser que o original seja outro tipo de golpe).

**Testes:** `--plano 1,2,4,5,1` (1v1) termina sem erros; 3v1: `--batalha saiyajin_02 --plano 6,1 --rage 100` (supremo do Kuririn), `--plano 3,1,4,1` (Taiyoken → Raditz perde a vez), `--plano 1,1,4,1` (Hellzone).

**Próxima sessão:** Bloco 3 (Saibamen, Nappa, Vegeta; modo história com diálogos; título/menus e salvamento).


## 11/11/2026 03:30–03:55 — sessão noturna 3 de 4
Nada pela metade da sessão 2. Foco: Bloco 3 inteiro.

**Feito:**
- **Inimigos novos** (`data/characters/`): **Saibaman** (Garras, Cuspe Ácido, Autodestruição quando a vida cai abaixo de 30%: agarra o alvo, explode e sai da luta), **Nappa** (Fúria de Nappa, Tempestade Ardente, Quebra-Braço, supremo Break Cannon) e **Vegeta** (Orgulho Saiyajin, Rajada Contínua, Joelhada Mortal, Galick Ho, supremo Galaxy Breaker). Vozes vnpn/vvgn e sons nappa_*/galickgun_*.
- **Batalhas** `saiyajin_03` (trio vs 3 Saibamen), `saiyajin_04` (trio vs Nappa, vida 3600) e `saiyajin_05` (trio vs Vegeta, vida 4200).
- **Motor:** vários inimigos — o jogador escolhe o alvo num submenu (“Escolha o alvo”, seta vermelha sobre o inimigo marcado) quando o golpe é ofensivo (`FF.Battle.ofensivo`: tem acerto/projétil/objeto/atordoar); painéis dos inimigos empilham como os dos heróis; nomes repetidos ganham sufixo (Saibaman A, B, C). Novo passo de roteiro `{"autoNocaute": true}`. Formas aceitam `animsDerivadas` (monta animações a partir de quadros de outras — o sprite do Saibaman só tem ataques).
- **Modo história** (`data/historia.json`): 4 capítulos (Raditz → Saibamen → Nappa → Vegeta) com diálogos próprios antes e depois de cada luta, retrato desenhado do sprite, efeito de máquina de escrever (toque completa/avança, Esc pula). URL `?historia=N`. Ao vencer, salva o próximo capítulo e mostra “Próximo capítulo”; ao perder, “Tentar de novo”.
- **Tela de título:** Novo Jogo, Continuar (mostra o capítulo salvo), Batalha Livre (todas as 5 batalhas), Opções (volume de música/efeitos/vozes, apagar progresso). Navegação por setas/Enter ou toque.
- **Salvamento:** `FF.Save` em `localStorage` (`finalflash_save_v1`), tudo em try/catch (sem armazenamento o jogo funciona, só não salva).
- **Teste:** sem `--batalha` usa `?batalha=saiyajin_01`; submenu de alvo é respondido sozinho (não gasta o plano); novos `--historia N` (avança os diálogos) e `--hpInimigos N`.

**Testes rodados (todos sem ERROS):** `--plano 1,2,4,5,1`; `--batalha saiyajin_03 --plano 1,2,1,4,1`; `--batalha saiyajin_03 --plano 7,4,7 --hpInimigos 150` (autodestruição); `--batalha saiyajin_04 --plano 1,2,1,4,1 --rage 100`; `--historia 2`. A luta contra o Vegeta (antes com vida 5200) não terminou em 280 s só com a Sequência — baixei para 4200; use `--tempo 300`.

**Observações:** com guarda perfeita automática os inimigos causam pouco dano (balancear no Bloco 4). Os golpes de Nappa/Vegeta não foram conferidos visualmente quadro a quadro (economia de uso). Só existem 2 músicas (tournament_theme e results_victory_theme).

**Próxima sessão:** Bloco 4 — AP e melhorias salvas no `FF.Save`, balanceamento por simulação (as batalhas 04/05 estão longas), responsividade no celular e README.


## 11/11/2026 04:30–04:55 — sessão noturna 4 de 4
Jogo estável no início (1v1 e todas as batalhas novas terminaram sem ERROS). Foco: Bloco 4.

**Feito:**
- **AP e Treinamento** (`FF.Treino`, `js/main.js`): vitória dá 30 + vida inimiga/100 de AP (dobro no modo história; `"ap"` no JSON da batalha sobrescreve). Tela *Treinamento (AP)* no título: Goku/Piccolo/Kuririn × Vida (+8%), Ataque (+6%), Defesa (+10%), Ki/turno (+1), até 5 níveis, custo 40×(nível+1). Salvo em `FF.Save` (`ap`, `treino`). Aplicado em `Battle.addFighter` só para heróis. Tela de fim mostra “+N AP”.
- **Balanceamento por simulação** (sem plano = só Sequência): saiyajin_02 erro 0 → vence (todos > 790 de vida); 0.3 → vence (Piccolo 372); 1 → Piccolo e Kuririn caem, não termina. saiyajin_04 erro 0 → vence; 0.3 → vence (Kuririn 248); 1 → Kuririn cai, Nappa com 487. saiyajin_05 erro 0 → vence (Kuririn 68). Curva boa; só mudei o Sparking Goku+Piccolo 2.6 → 3.4 (igual aos outros).
- **Celular:** aviso “Gire o celular” em retrato com toque; botões maiores (`pointer: coarse`); descrição dos golpes some no toque; altura com `100dvh`.
- README: seções AP/Treinamento e Celular; lista de pendências atualizada.

**Testes (novo código):** `--plano 1,2,4,5,1`; `--batalha saiyajin_03 --plano 1,2,1,4,1`; `--batalha saiyajin_02 --erro 0.3` (sem ERROS; com o tempo padrão de 170 s não chega ao fim rodando em paralelo — use `--tempo 240`); tela de Treinamento testada por script (compra, desconto de AP, salvamento).

**Pendente:** AP para desbloquear golpes; lutas 04/05 longas; testar no celular de verdade; itens antigos do Bloco 2/3 (Kamehameha do Kuririn, Sparking de 3, quadros de Nappa/Vegeta, cenário nos diálogos).

## 2026-11-11 — Cena livre no editor de cenas
- Novo passo de roteiro `cena` (motor em `js/battle/cena.js`): camadas de sprites com âncora (quem solta/alvo/tela), x/y, escala, giro, opacidade, espelhar, fps, início/fim e quadros-chave interpolados; eventos no tempo (sons/vozes, acertos com QTE, tremores, flashes); pode esconder atacante/alvo.
- Editor (`js/ferramentas/editor_cena.js`): paleta com miniaturas de todos os sprites (inclui pacotes 📦 da biblioteca), arrastar na tela, alça/rodinha/+/- para tamanho, setas para ajuste fino, gravar posição por tempo, linha do tempo com ▶.
- Falta: arrastar quadros-chave numa linha do tempo visual; giro pela tela (hoje só pelo campo).

## 2026-11-11 — Habilidades do usuário
- `js/core/habilidades.js` (`FF.Habilidades`): golpes criados no editor salvos no navegador (`ff_habilidades`), por personagem; as equipadas entram como `hab_<id>` no menu de golpes (⭐) em qualquer batalha. Golpe com passos `anim` entra só na forma em que foi criado; só com cena livre, em todas.
- Editor: "⭐ Salvar como habilidade" (nome + custo de ki; atualiza se já for uma habilidade), habilidades no "Abrir golpe existente", rota `?editor=1&hab=<id>`.
- Seleção da Batalha Livre: botão "⭐ Habilidades" (liga/desliga, editar, apagar, criar no editor com os times). Pausa: "⭐ Habilidades" liga/desliga no meio da luta.
- IA: inimigos com `ia` própria (Raditz, Nappa…) não usam habilidades; os de IA automática usam.

## 2026-11-11 — Prévias de sprites no roteiro
- `js/ferramentas/previa.js` (`FF.Previa`): miniatura animada ao lado de cada campo de animação/efeito do roteiro (animação do passo, animação do avançar, efeito visual, projétil, efeito na mão e no alvo); "?" vermelho quando o nome não existe. Botão 🖼 abre seletor em grade com todas as animações (efeitos extras, básicos e pacotes 📦 da biblioteca), filtro e prévia grande animada. O cartão da cena livre mostra as miniaturas das camadas.
- Botão ▶ em cada etapa do roteiro: toca só aquela etapa (sem anúncio nem gasto de ki); se houver "Avançar até o alvo" antes, o lutador já começa perto do alvo.
- Navegador de sons (`FF.Sons` em `js/ferramentas/previa.js`): botão 🎧 em todo campo de som/voz do editor (roteiro, projétil e cena livre). Lista os 638 áudios agrupados (vozes por personagem com tipo dano/golpes/especiais/intro, golpes por personagem, narrador, impactos, energia, outros), filtro, toque para ouvir, ✔ usa um, ＋ junta vários (sorteio), ↑↓ e Enter pelo teclado. Campo de voz abre direto nas vozes do lutador.
- Etapa "Animação do alvo" (`animAlvo` em `js/battle/script.js`): toca animação no inimigo. Nomes genéricos (caido, lancado, dano1/2, guarda, parado, avancar, recuar) servem para qualquer personagem. Opções: empurrao (desliza; espera o deslize sem duracao), fps, duracao, semEsperar (roda junto com a próxima etapa), voltarNormal; eventos de som/voz/efeito/tremer/flash (acertos são ignorados). No fim do golpe o alvo não derrotado volta ao lugar (resetPositions).
- Editor de quadros no visualizador (botão ✂ Editar quadros, também no importador em "Sprites já existentes"): apagar, duplicar, mover/arrastar, duração por quadro, ajuste de posição (origem), fps/repete, inserir quadros de outra animação do mesmo sprite, desfazer, salvar na animação ou como nova, voltar ao original, exportar. Guardado em `FF.Mods` (localStorage) e aplicado ao carregar sprites, então vale em batalhas, editor e prévias.
- Importador de sprites e "Minha biblioteca" removidos a pedido do usuário (vai repensar a implementação). Sprites novos: o usuário manda as imagens na conversa e o Claude grava como sprite fixo (`data/sprites` + `assets/img`). Código antigo no histórico do Git (commit anterior a esta remoção).
- Laboratório de golpes removido a pedido do usuário: tudo novo (e testar golpes existentes) passa a ser no editor de cenas. Menu de título ficou com Instalar, Visualizador e Editor de cenas.
- "Editor de cenas" virou **Editor**. "💾 Salvar no jogo": golpe aberto do jogo substitui o original (↺ Original desfaz); golpe novo vira habilidade. Edições (golpes, habilidades, quadros de sprites) agora em `data/edicoes.js` via `FF.Edicoes`, sincronizadas por commit na API do GitHub com chave por aparelho (painel ☁); sem chave ficam pendentes no aparelho. Dados antigos do localStorage migram para pendentes. Aviso de nova versão também detecta mudança em `data/edicoes.js`.
- Combo Kaioken do Goku (`combo_kaioken`, anims Special_Kaioken_Entrada*): só aparece com o buff Kaioken ativo e substitui a Sequência de Golpes no menu. Novos campos de golpe `mostrar`/`esconder` ({buff, forma}) em `FF.UI.visivel` (menu e IA). Editor: campo "tempo (s)" no efeito visual (`duracao`: repete o efeito por esse tempo).
- Golpe alterado pelo usuário mantém do original os campos que o Editor não mostra (mostrar, esconder, requer, supremo), para não perder regras novas como o esconder do combo durante o Kaioken.
- Buffs com aura e pose: `buffs.<id>.aura` ({fx, escala, dx, dy, em: pés|peito, frente, alpha, fps}) desenhada pelo Fighter enquanto o buff durar, e `buffs.<id>.parado` (pose parada). Kaioken do Goku: aura Efeito3_Loop + Special_Kaioken_Parado. Removida da edição do usuário (data/edicoes.js) a etapa de 50 s que travava o turno.
- Kamehameha Kaioken (`kamehameha_kaioken`, anims Special_20xKaiokenKamehameha_*, voz vgkn214 e sons goku_spkame_charge/fire copiados do APK): só com Kaioken, substitui o Kamehameha no menu. Tirado do combo_kaioken salvo pelo usuário o Kamehameha que ele tinha anexado (combo voltou ao original, removido de data/edicoes.js).
- Anéis de tempo: acerto no quadro 0 disparava antes do anel (onFrame(0) no play). Agora `Animator.play` aceita `hold` e adia os eventos do quadro 0 até a espera acabar; `playAnim` calcula a espera antes de tocar e soma ao `duracao`. Medido: acerto e anel com ≤ 1 quadro de diferença.
- Sincronização: após enviar, o aparelho guarda a versão enviada (`ff_edicoes_ultimo`, campo `rev`) e usa ela até o site publicar — antes, recarregar no 1º minuto mostrava a versão velha ("salvar inconsistente").
