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
- Tela de fim de luta: "Menu principal" sempre visível e "Trocar lutadores" na Batalha Livre (rota `?selecao=1` abre a seleção direto).
- Menu de título refeito no estilo da inspiração do usuário: coluna única de faixas inclinadas roxas com borda dourada, escolhido maior/dourado com ▶ (mouse também seleciona), "⚙ Ferramentas" no canto (Visualizador e Editor) e rodapé de controles. Removido o botão Instalar no celular. Ordem: Continuar, Novo Jogo, Batalha Livre, Treinamento, Opções.
- Tela de título usa a arte enviada pelo usuário (`assets/img/titulo_fundo.jpg`: título 3D FINAL FLASH / SAGA SAIYAJIN, Goku, Vegeta e raios; botões desenhados e barra de baixo da imagem cobertos por painel escuro). h1/h3 e banners do ZL3 escondidos no título; menus começam abaixo do logo.
- Posição de explosões: projétil ganhou `impactoDx/impactoDy` e acerto usa `fx/dx/dy/fxEscala` (dx espelhado pelo lado de quem bate; a explosão final automática segue o mesmo ponto). Editor: campos x/y + 🎯 (alinhador genérico `alinhar({obj,kx,ky,ponto,ver})`) e 👁 na explosão do projétil e na de cada acerto.
- Submenus no padrão novo (arte do título + faixas): Novo Jogo virou escolha de capítulo (liberados até concluidos+1, ✔ nos vencidos), Opções em faixas, Treinamento com cartões e retratos, Batalha Livre com fundo da arte e botões inclinados, fim de luta com a arte e VITÓRIA/DERROTA em letras douradas, pausa no mesmo estilo.
- Menu de golpes da batalha no padrão novo (faixas inclinadas, borda dourada, nomes em caixa alta; supremo laranja e Sparking azul mantidos).
- Genki Dama corrigida: carga usa só Special_EveryoneLendMeYourEnergy 0-9 e segura Ultimate_SuperSpiritBomb 3-7 (braços erguidos) enquanto a bola cresce; arremesso com Ultimate_SuperSpiritBomb 7-10 lançando no quadro 9 (antes usava Special_SpiritBomb, que é um empurrão de energia). Bola desceu (dy -78). Motor: passo de animação aceita `de`/`ate` (trecho de quadros; eventos contam a partir de `de`), com campos no Editor.

## 12/11/2026 00:05–08:40 — Estúdio Final Flash (sessão noturna)
**Feito:**
- `estudio.html` + `js/estudio/*` + `css/estudio*.css`: abas Golpes e cenas, Sprites, Importar, Personagens e Projeto; desfazer/refazer, rascunho automático, ☁ sincronização (mesma chave do Editor). Guia em `docs/ESTUDIO.md`.
- **Motor:** passo `linha` (`js/battle/linha.js`) com trilhas e tempos absolutos (lutador/parceiro/alvo, efeitos, projéteis, camadas, sons, acertos com anéis automáticos, tela com câmera, ações). Conversor de roteiros antigos (tempos conferidos: Kamehameha 2,00 s × 1,92 s, Sequência 3,55 × 3,50). Extensões compatíveis: offsets/escala por passo no Fighter, câmera na Battle, efeitos com giro e de sprites importados, projétil com saída/chegada ajustáveis, trecho `de/ate` também na linha.
- **Edições:** seções `personagens`, `spritesNovos`, `spritesInfo`; imagens importadas no IndexedDB (`FF.ImagensUsr`) e enviadas para `assets/img/usr/`. `loadCharacter`/`loadSprite` trabalham sobre cópias (o original do JSON fica intacto). Batalha Livre lista personagens criados.
- Menu ⚙ Ferramentas ganhou "Estúdio"; visualizador e `sw.js` (cache v2) também.
- Testes: `tools/testes/estudio.js` (habilidade do zero com efeito arrastado no palco, projétil, acerto, reação, som → salva → usa na Batalha Livre; golpe existente editado → muda na batalha), `tools/testes/codecs.js` e `codecs_navegador.js` (ZIP, GIF, APNG, imagem), `tools/testes/estudio_importar.js`.

**Decisões:** o Estúdio salva golpes como `roteiro: [{linha}]`; golpes antigos continuam como estavam até serem salvos no Estúdio. Prévia determinística: a batalha é recriada e simulada em passos de 1/60 s até o instante do cursor (sorteios com semente, sem som); tocar segue em tempo real com som.

**Pendente:** aba de batalhas/estágios; IA por forma; edição de pixels; Editor antigo não edita golpes `linha`; ver lista em `docs/ESTUDIO.md`.
- Estúdio: avisos de "mudanças não salvas" agora têm 3 opções (💾 Salvar e trocar · Trocar sem salvar · Ficar), em Golpes, Sprites e nos botões de testar; todos os confirm() do navegador viraram janelas próprias (`FF.Estudio.escolha`/`confirmar`, botão "Não" em vez de "Cancelar").
- Estúdio/Sprites: apagar animações (🗑 no topo e em cada linha). Criada pelo usuário → some (`FF.Mods.restaurar`); de sprite importado → sai de `spritesNovos[id].anims`; do jogo original → `sprites[id][anim] = {"apagada": true}` (`FF.Mods.apagar`, aplicado em `Mods.aplicar`), listada em "Apagadas" com "Trazer de volta". O aviso lista os golpes que usam a animação. Avisos do Estúdio foram para baixo da tela.

## 12/11/2026 — Importar dentro da aba Sprites
**Pedido:** importação direto no menu de Sprites (escolher imagens do computador, exportar a sheet, montar animações, apagar sprites, mudar tamanho).

**Feito:**
- A aba **Importar** saiu do topo: o importador (`js/estudio/importar.js`, agora `FF.EstudioImportar.montar/abrir`) abre por cima da aba Sprites com **📂 Importar**, ao **soltar arquivos** na aba ou **colar** (Ctrl+V). Destino: sprite novo ou **animação de qualquer sprite** (do jogo também). Ao salvar, fecha e abre o sprite/animação na aba Sprites. `?aba=importar` antigo cai na aba Sprites com o importador aberto.
- **Imagens do computador direto na animação** (`js/estudio/sprites_arq.js`, `FF.EstudioArq`): “📂 Do computador” na tira e em “＋ Inserir quadros…”, e “＋ Nova → 📂 Do computador…”. Janela com prévia: fundo automático/remover/manter, cortar bordas, origem pés/centro, escala, separar sprite sheet. As imagens vão para um **atlas extra** (`assets/img/usr/<id>__<marca>.png`): sprite importado → `spritesNovos[id].atlases`; sprite do jogo → `spritesInfo[id].atlas` (somado em `FF.Assets.loadSprite`, campo `_atlasBase`).
- **Tamanho:** grupo “📐 Tamanho e sprite” aberto por padrão: escala no jogo + **Redimensionar pixels** (todos/escolhidos, 25–400%, origem e disparo acompanham). Escala grava só `spritesInfo[id].escala` (antes sobrescrevia o objeto inteiro).
- **Sprites importados:** 📥 na lista, 🗑 para apagar o sprite, **Aa** renomear animação, **🧹 Juntar imagens** (atlas extras → 1). Animações de sprite importado agora salvam direto em `spritesNovos[id].anims` (antes iam para `sprites[id]` como “alteração”).
- **Bug corrigido:** o sprite `bills_20261112t114850z_1_001` ficou sem animações porque “Salvar como nova” (Parado2) ia para `sprites[...]` e a checagem de “última animação” só contava as do sprite importado; apagando Parado e depois Parado2 sobrou um sprite vazio. Agora não deixa apagar a última (oferece apagar o sprite) e um sprite vazio mostra “Trazer do computador / Nova vazia / Apagar sprite”. O Parado (78 quadros) dele ainda está no histórico do Git (commit 2c60b7b) se o usuário quiser de volta.
- **Exportar sprite inteiro** (todas as animações numa sheet PNG + JSON, .zip).
- Projeto: `spritesInfo` com atlas extras só deixa voltar a escala (as imagens ficam porque animações usam).
- `sw.js` cache v3 (arquivo novo).

**Testes:** `tools/testes/estudio_importar.js` (adaptado ao fluxo novo, 38 verificações), `tools/testes/estudio_sprites.js` (novo: folha de fundo branco → animação nova no gokubase com atlas extra; PNGs soltos no meio da animação de um sprite importado; desfazer; redimensionar 200%; juntar imagens; exportar sprite inteiro; última animação; sprite vazio; soltar arquivo), `estudio.js`, `codecs.js`, `batalha.js --plano 1,2,4,5,1`.

**Pendente:** “juntar imagens” para sprites do jogo; renomear não atualiza golpes que usam o nome antigo.

## 12/11/2026 — Bills no jogo; Estúdio sem importar/exportar
**Pedido:** o importador no Estúdio “não tá dando certo”: o usuário passa a mandar os sprites na conversa e o Claude monta personagem e golpes; a aba Sprites fica só para editar; tirar as funções de exportação.

**Feito:**
- Estúdio: removidos importador (`js/estudio/importar.js`, `css/estudio_importar.css`, teste `estudio_importar.js`) e exportações da aba Sprites (sheet/GIF/WebM/PNG/JSON, sprite inteiro), “📂 Do computador”, soltar/colar arquivos. Ficou: editar quadros, nova/renomear/apagar animação, redimensionar, escala, juntar imagens e apagar sprite (importados antigos). `sw.js` v4.
- **Ferramenta nova** `tools/importar_sprites.py` + receita `tools/receitas/<id>.json`: imagens soltas (pasta ou ZIP) → atlas + `data/sprites/<id>.json` (fundo da borda transparente, recorte, origem nos pés alinhada pelo centro da cabeça, `origem: centro` para efeitos, ponto de disparo automático).
- **Bills** (zip do usuário, sprites de MV95): sprite `bills` com 44 animações (77 imagens, atlas 1017×213) e personagem `bills` (HP 1900, atq 125, def 70, IA automática): Golpes Divinos (soco, chute, cauda, golpe forte), Rajada de Ki (2 rajadas amarelas), Esferas Divinas (3 faíscas roxas girando em arco), Carregar Ki (aura do próprio sprite), supremo **Esfera da Destruição** (ergue o dedo, esfera cresce acima da cabeça, aponta e arremessa; explosão do pacote + Explosao15). Retrato/banner gerados (`gerar_retrato.py` ganhou `--topo`, `--banner-dy`, `--centrar-cabeca`). Sem sons próprios (os `bills_*.ogg` do ZL3 não estão no repositório; usei sons genéricos).
- Motor: `Battle.fxSet` também procura o efeito nos sprites carregados (efeitos que vêm no sprite do lutador).
- Testado: batalha temporária Bills × Raditz (`--plano 5,2,3,1,4,3,2,1 --rage 100`, luta terminou, sem erros; fotos conferidas), `tools/testes/estudio_sprites.js` (reescrito), `estudio.js`, `batalha.js --plano 1,2,4,5,1`.

**Observação:** nas edições do usuário, o sprite `cenarios_preview` tem a animação original `cenarios` apagada e duas animações de teste (`bills`, `billsparadao`) com atlas extra — sobra das tentativas no importador. Perguntar se pode limpar/restaurar.

## 12/11/2026 — Editor de cenas removido; melhorias no Estúdio
**Pedido:** tirar o Editor (o Estúdio já faz tudo) e ver o que melhorar no Estúdio.

**Feito:**
- Removidos `js/ferramentas/editor.js`, `editor_cena.js`, `previa.js` (≈2.200 linhas). Menu ⚙ Ferramentas sem "Editor"; endereços antigos `index.html?editor=1…` redirecionam para `estudio.html?aba=golpes` (com `&hab=` quando havia). Batalha Livre → Habilidades: "＋ Criar no Estúdio" abre `estudio.html?aba=golpes&novo=1&personagem=<1º herói>&alvo=<1º inimigo>`; ✏ abre a habilidade no Estúdio. Visualizador: link "Editor" e "➕ Enviar para o editor" (e os ➕ dos sons) saíram; novo "🎬 Editar no Estúdio" abre a animação na aba Sprites. Textos de mensagens/comentários "Editor" → "Estúdio" (inclusive a mensagem dos commits do ☁). `sw.js` v5. README, ESTUDIO.md e CLAUDE.md atualizados (links do fim de cada pedido agora: jogo, visualizador, Estúdio).
- **Estúdio — bug:** abrir a aba Golpes com um personagem sem "kamehameha" (ex.: Bills) deixava tudo vazio ("Golpe não encontrado"). Agora abre o primeiro golpe da forma (`abrirPrimeiro`). URL aceita `personagem`, `alvo` e `novo=1`.
- **Estúdio — melhorias:** lista de golpes mostra "fúria" nos supremos e "grátis"/vazio em vez de "0 ki"; ações da trilha Ações com campos próprios (ki, buff, tirar buff, forma, atordoar, curar, **criar objeto** com tamanho inicial/final/tempo/posição e lista de desenhos, **lançar objeto** com tempo/tremor/flash/som e resumo dos acertos); Personagens → Formas ganhou **Pose de vitória** visual (passos com animação, duração, voz/som, ↑, ✕, ＋ Passo, ▶ Ver) — antes só em JSON; linha do tempo com **▤ Compacto** (trilhas de 20 px, lembrado no aparelho).
- Testes: `tools/testes/estudio_melhorias.js` (novo), `estudio.js`, `estudio_sprites.js`, `batalha.js --plano 1,2,4,5,1`.

**Ideias que ficaram para depois (não feitas):** aba de batalhas/estágios; IA por forma e `reverter` com campos; prévia de Personagens com som; inserir quadros de outro sprite na aba Sprites; renomear animação atualizando os golpes que usam o nome.

## 12/11/2026 — Miniaturas animadas nos efeitos; visualizador removido
- Estúdio: todo campo de animação/efeito (projétil, efeito na mão, explosão, efeito visual, explosão do acerto, animação do lutador e da camada) ganhou **miniatura animada** ao lado (`FF.Estudio.miniAnim` + `setDoEfeito` em `nucleo.js`: um laço só, respeita fps e duração de cada quadro, "?" vermelho se o nome não existe). Clicar na miniatura abre o seletor. Nos seletores, o cartão anima com o mouse em cima. O seletor de efeitos mostra primeiro os efeitos do próprio lutador (ex.: `Bills_*`), que antes nem apareciam.
- **Visualizador removido** (a aba Sprites e o 🎧 do Estúdio cobrem tudo): `js/ferramentas/visualizador.js` e `css/ferramentas.css` apagados; `visualizador.html` virou um redirecionamento para `estudio.html?aba=sprites` (mantém `sprite`/`anim`). Tela de título: o botão do canto agora é **⚙ Estúdio** e abre direto (o submenu Ferramentas ficaria com um item só). `sw.js` v6. Links do fim de cada pedido: jogo e Estúdio.
- Testes: `estudio_melhorias.js` (redirecionamento, menu, miniaturas, seletor), `estudio.js`, `estudio_sprites.js`, `batalha.js --plano 1,2,4,5,1`.

## 12/11/2026 — Retrato e banner do Bills com a arte do usuário
- `tools/retrato_de_imagem.py` (novo): arte → rosto (80×112, usado na seleção e no HUD/faixa de turnos) e banner (268×326 no recorte inclinado do molde 41, com contorno). Remonta `assets/img/retratos_extra.png` trocando os quadros antigos do personagem (Bills continua nos quadros 47/45; Saibaman intacto). Arte guardada em `tools/receitas/arte/bills.png`; caixas usadas: `--rosto 255,170,705,800 --banner 275,140,745,712`.
- Conferido na Batalha Livre (grade, cartão do time) e no HUD da batalha.

## 12/11/2026 — HUD novo (arte do usuário)
- `tools/hud_moderno.py` + arte em `tools/receitas/arte/hud.png` → `assets/img/hud_moderno.png`: moldura com retrato, vida, ki, nome, KI e rage apagados (fundo escuro em volta vira transparente pelo contorno `CONTORNO`), mais uma camada com os cantos ciano da janela do retrato (desenhada por cima do rosto).
- `FF.HUD.panelModerno` (`js/battle/hud.js`): retrato na janela (com cantos por cima), vida em paralelogramo com rastro vermelho e cor por faixa (verde/amarelo/laranja), número "atual / máx", ki em 7 gomos inclinados (último parcial), NOME em itálico (amarelo transformado), "KI n", RAGE em 5 gomos + ícone do sol apagado até encher e pulsando cheio, "SUPREMO PRONTO!" e buffs embaixo. Inimigo espelhado. 1×1: 400 px de largura; 3×3: 288 px empilhados (destaque dourado acompanha). A imagem é carregada em `FF.start` (main.js); sem ela, volta ao HUD do ZL3.
- Conferido em 1×1 (Goku × Raditz, com Rage cheia) e 3×3 (Goku/Piccolo/Bills × Raditz/Nappa/Vegeta).

## 12/11/2026 — Explosões do impacto na trilha Efeitos
- Estúdio (`golpes.js`): ao abrir um golpe, as explosões de `lancarObjeto.impacto` viram clipes `efeito` na trilha Efeitos (`em: alvo`, ou `alvoPes` se `chao`), com `prende: <id do clipe que lança>` e `extra` (ajuste em s); `impacto` fica `[]`. `sincronizarPresos()` (em cada mudança) recoloca os presos em `início do lançamento + tempo até chegar + extra`; arrastar o próprio efeito atualiza o `extra`; apagar o lançamento solta os efeitos. No jogo são efeitos comuns (o motor ignora `prende/extra`).
- Props: efeito preso mostra 🔗 com "Ir para o lançamento"/"Soltar"; o Lançar objeto lista as explosões presas (miniatura animada + Editar) e tem "＋ Explosão no impacto".
- Linha do tempo: linha tracejada ciano do lançamento até cada explosão presa; explosões de projéteis/acertos aparecem como marca tracejada laranja na trilha Efeitos (clique abre o clipe dono).
- Teste: `estudio_melhorias.js` (extração, acompanhar o lançamento, ajuste, lista, marcas).

## 12/11/2026 — Linha do tempo em camadas
- `linha_ui.js`: `calcularLayout()` distribui os clipes de cada trilha em camadas (o primeiro que não se sobrepõe fica em cima; os outros descem), como num editor de vídeo. Clipes instantâneos (som, acerto…) ocupam a largura do nome; clipes encostados ficam na mesma linha; as marcas das explosões de projéteis/acertos também entram nas camadas da trilha Efeitos. A trilha cresce (nome à esquerda acompanha); desenho, clique (`achar`), linhas dos efeitos presos e marcas usam `yDe(c, tr)`. É só visual (nada muda no golpe salvo).
- Teste em `estudio_melhorias.js` (3 explosões da Genki Dama em 3 camadas; clique na 2ª camada acha o clipe).
- Música do menu: `assets/audio/menu_chala.ogg` (arquivo enviado pelo usuário, convertido de MP3 para OGG, 2,6 MB). `FF.Audio.musicaMenu()` (nome em `FF.Audio.MENU`) toca no 1º toque da tela de título e na volta direta para a seleção; continua nos submenus e na Batalha Livre e é trocada pela música da luta. `FF.Audio.music` não reinicia a mesma música e, se o navegador bloquear o som, tenta de novo no primeiro toque/tecla.
- Música do menu também na tela "Toque ou aperte Enter": tenta tocar ao abrir a página; se o navegador bloquear som antes de um gesto, começa no primeiro toque/tecla (sem reiniciar nem tocar em dobro).

- Nome do jogo: **Project Final Flash** (arte do título editada: "PROJECT" acima do logo e "SAGA SAIYAJIN" removido; título da página e manifest). Novo Jogo agora escolhe a saga primeiro (`FF.NovoJogo.SAGAS`: Saga Saiyajin + 3 vagas "🚧 Em produção"); dentro da saga, os capítulos, e "Voltar" volta para as sagas.

- Kuririn ganhou **Kamehameha** (30 KI, poder 2,6; 2º no menu): roteiro em linha do tempo com as animações Special_Kamehameha_Chao_Pt1–Final do próprio sprite (o raio já vem desenhado nos quadros — a nota antiga de que precisava extrair o objeto estava errada), carga de 1,5 s, som krillin_kmhm_charge, voz vkrn134 (palpite pelo número, igual ao vgkn134 do Goku; troque no Estúdio se não for), 3 acertos de energia (o último lança).

- Kamehameha do Kuririn: o raio agora atravessa a tela. Duas camadas `Kamehameha_Raio_Extensao` (anim nova no sprite krillin, recorte do corpo do raio dos quadros Pt5) continuam o feixe depois do fim do quadro e somem no começo do Final. Camadas aceitam `px: "sprite"` (x/y em pixels do sprite × escala da batalha, para alinhar com o lutador em 1×1 e 3×3); campo "Unidade X/Y" no Estúdio.

- Onda de Energia Dispersa (supremo do Kuririn) refeita como na ilustração do usuário: rajadas Krillin_2 sobem em arcos da mão até o céu acima do alvo, explodem e viram uma chuva de 10 raios (EnergyWave_Effect1, impacto EnergyWave_Effect2) + 1 rajada grande final que lança. Motor: projétil aceita `deAlvo` (saída a partir do peito do alvo) e `semAcerto` (só visual, sem dano/anel).

- Estúdio: seletor de sprites global (`js/estudio/seletor.js`, `FF.Estudio.escolherSprite`): todas as animações de todos os sprites (efeitos, lutadores, importados) para qualquer personagem, com lista de fontes (Efeitos, Tudo, cada sprite) e busca em tudo. Usado no efeito, projétil/explosões, camada e na animação do lutador. Animação emprestada: clipe `anim` com `sprite` faz o lutador usar a animação de outro sprite (motor troca o desenho e devolve no próximo clipe/fim). Golpes salvos no Estúdio guardam `spritesUsados` e o jogo (`FF.start`) carrega esses sprites antes da luta.

- Estúdio/Sprites: modo **✂ Cortar** — arrastar um retângulo no palco (vale para os quadros escolhidos, que aparecem sobrepostos) e "Criar animação nova" só com aquele pedaço (ex.: o raio do Break Cannon sem o Nappa), com nova origem no centro, na borda esquerda (raio saindo da mão) ou mantida; ou "Cortar aqui mesmo". Só muda as caixas dos quadros no atlas (não mexe nos pixels). Teste: `tools/testes/estudio_corte.js`.


## 12/11/2026 — Acervo de sprites (extração de tudo)
**Pedido:** extrair todas as sprites possíveis e deixar disponíveis no Estúdio (aba Sprites e seletor das cenas/golpes), sem criar personagem nem habilidade. Depois: "pode incluir todas as pastas".

**Feito:**
- **Z Legends 3 inteiro:** `tools/extrair_acervo.py` lê o `data.js` e gera 326 sprites (53 personagens com as versões inimigo+jogador juntas, 86 efeitos, 24 cenários por cenário, 97 de interface, 66 cutscenes por luta/personagem; ~9.800 animações). Objetos invisíveis (caixas de colisão, câmera) ficaram de fora.
- **Twiss Dragno** (GameMaker, `game.droid`): 49 sprites (45 lutadores + habilidades, efeitos, cenários, interface). Nomes dos lutadores são palpites pela abreviação (código entre parênteses).
- Acervo fora do bundle (bundle cresceu só ~20 KB): `FF.Assets.loadSprite` carrega `data/acervo/<id>.js` por `<script>` (funciona em file://). Pedidos simultâneos do mesmo sprite agora compartilham o carregamento (vale para todos os sprites).
- Estúdio: seletor de sprites com categorias do acervo (abre/fecha), "Efeitos (todos)" inclui os efeitos do acervo, busca nos nomes de animação sem baixar imagens, miniaturas só quando aparecem na tela. Aba Sprites agrupada (Do jogo + categorias). Forma de personagem aceita sprites de tipo "personagens" de qualquer fonte.
- `tools/extrair_jogos.py` pronto para Construct 3 (Mini Champion, Super Pixel Warriors, Ultimate Heroes), GDevelop (Super Warriors Z), Unity 2017–2021 sem compressão (Drag Warriors testado com uma textura) e pastas de PNG (pasta Assets).
- Teste novo `tools/testes/acervo.js`. Observação: `estudio_melhorias.js` já falhava em "seletor de efeito mostra os do Bills primeiro" antes desta sessão (conferido no código anterior).

**Falta:** os outros jogos e a pasta Assets. Têm milhares de arquivos; pedi ao usuário um .zip por pasta em `T:\Project Final Flash Sprites` para trazer de uma vez. Unity: animações originais (AnimationClip) não são lidas — cada textura vira "Todos" + grupos por nome; texturas comprimidas (ETC/ASTC) não são decodificadas.

## 13/11/2026 — Acervo completo + animações nomeadas nas pastas de fãs
**Pedido:** incluir todas as pastas de `T:\Project Final Flash Sprites` no acervo e, nos "Assets (Sprites Soltos)", separar as animações por função (parado, golpes, poderes…), pasta por pasta.

**Feito:**
- Acervo completo: 11.002 sprites de 11 fontes (Z Legends 3, Twiss, Mini Champion, Super Pixel Warriors, Ultimate Heroes, Super Warriors Z, Drag Warriors, Power Warrior, Legendary Warrior, DLZ, Assets). Leitores novos: Unity (UnityFS LZ4/LZMA, ETC1/ETC2/DXT em `tools/etc.py`), .7z (`tools/sete_zip.py`).
- As 136 pastas de sprites de fãs (`ast_*`) ganharam animações com nome (Parado, Avanco, Rastro_Dash, Rastro_Teleporte, Golpes/Combo, Corte, Dano, Lancado, Caido, Carregar_Ki, Disparo, Projetil_Ki, Kamehameha, Transformacao, Aura, efeitos próprios de cada personagem, Retrato, Separador…). Receitas em `tools/receitas/acervo/`, aplicadas por `tools/aplicar_receitas_acervo.py`; "Todos" continua lá com todos os quadros. Leitura feita olhando a folha numerada de cada pasta: os nomes são uma interpretação e podem ser corrigidos no Estúdio ou na receita.
- As pastas "Assets Separados" já vinham com nomes do jogo original (Attack1, Skill2, Explosion…) e ficaram como estão.

**Falta:** nada do pedido. Possíveis ajustes finos de fps/loop/nomes conforme o usuário for usando.


## 13/11/2026 — Correção: explosão escolhida no seletor saía diferente no alvo
- Causa: nos campos "Explosão" do acerto, "Explosão" do projétil (impacto) e "Efeito na mão" (disparo), o Estúdio guardava só o nome da animação e jogava fora o sprite de onde ela veio. Na luta, o motor procurava qualquer sprite carregado com aquele nome (ex.: "Default") e pegava outro.
- Agora: o acerto usa `sprite`, o projétil guarda `impactoSprite` e `disparoSprite`; `FF.Battle.spawnFx` recebe o sprite certo e `FF.Linha.spritesUsados` também conta esses campos (inclusive dentro de `acerto`, `acertos` e `impacto[]`), para o sprite ser carregado antes da luta. Golpes já salvos com o problema precisam ter a explosão escolhida de novo.

## 13/11/2026 — Acervo por tipo + efeito que acompanha o lutador
- Estúdio: cada jogo do acervo (Drag Warriors, Power Warrior…) agora abre em subgrupos 🥋 Personagens / ✺ Efeitos / 🏞 Cenários / 🖥 Interface e outros, no seletor de sprites (com "☰ Todos: efeitos" etc.; fonte `cat:<jogo>:<tipo>`) e na aba Sprites.
- `tools/reclassificar_acervo.py`: corrigiu 268 tipos pelo nome (pacotes de efeito grandes que tinham virado "cenários" pelo tamanho; texturas internas do Unity como LDR_*, toggle, slider, SearchTex foram para "interface").
- Efeito na linha do tempo ganhou "Acompanha o lutador" (`seguir: true`): o efeito anda junto com o lutador em que está preso (ex.: aura durante o "→ até o alvo").
- Linha do tempo: **guias de alinhamento** ao arrastar/esticar um clipe (`alinhamentos()` em `linha_ui.js`): linha ciano tracejada onde o início ou o fim bate exatamente com o início/fim de outro clipe (losango), um quadro de animação (traço), o cursor ou o fim do golpe, com o tempo numa etiqueta na régua; some ao soltar. Ímã corrigido: um encaixe de verdade (clipe/quadro/cursor) pelo início ou pelo fim agora ganha da grade de 1/60 s (antes o fim podia "grudar" na grade e desalinhar o início por alguns ms). Teste em `estudio_melhorias.js`.

## 13/11/2026 — Cena de KO editável + crítico só ao acertar
- **Cena de KO** (`js/battle/ko.js`): o que era fixo no motor (lançado → caído, Explosao11, flash, tremor, sons blow_down/explosão, voz de lançado) virou uma linha do tempo. Padrão do jogo em `FF.KO.PADRAO`; no Estúdio (aba Golpes → "💀 Cena de KO") dá para editar a padrão de todos e criar a própria de cada personagem (o personagem derrotado é o Alvo do palco). Salva em `data/edicoes.js` → `ko[id|padrao]`; "↺ Original" volta. O golpe espera a cena terminar antes de seguir.
- Motor: `FF.Linha.iniciar` com `{ko: true}` (alvo nocauteado anima; ao terminar só mexe nele; acertos ignorados). Clipe de voz com `vozTipo`/`quem` ("Voz do personagem": dano/lançado de quem solta ou do alvo).
- Correção: um golpe defendido que zerava a vida deixava o lutador de pé com 0 de vida (a luta não acabava). Agora ele cai.
- Anel de crítico sem o texto "CRÍTICO" em cima (aparecia o tempo todo, e duplicado quando havia dois anéis); "CRÍTICO!" só aparece quando o jogador acerta. O anel de guarda continua com "GUARDA".
- Teleporte/movimento "qualquer lugar da tela" (`para: "x"` agora com `y` = altura em relação ao chão, negativo = no ar): no Estúdio aparece uma alça verde com a silhueta do lutador no destino, arrastável no palco; campos "X na tela" e "Altura (Y)". O lutador volta ao chão no fim da linha (`encerrar`).
- Projétil: clicar no projétil voando no palco seleciona o clipe e arrastar move só o desenho (`spriteDx`/`spriteDy`, alça roxa com a caixa do quadro); opção "Centralizar o desenho no caminho" (`centro`) para sprites cuja origem fica num canto (comum no acervo). Motor: `desvioProjetil`/`caixaProjetil` em `battle.js`; o projétil guarda `clipe` (id do clipe).
- Palco do Estúdio: ao arrastar qualquer alça (saída/chegada do projétil, desenho, efeito, acerto, lutador, destino do teleporte, camada) ela encaixa na mesma linha horizontal/vertical das outras alças do clipe (prioridade) e da mão, peito e pés dos lutadores, com guia ciano e o nome do ponto; Shift trava o eixo (guia amarela); Alt solta. `pontosRef`/`alinharPalco` em `golpes.js`.
- Projétil com as mesmas alças dos efeitos no palco (com ele voando): branca = mover o desenho, amarela = tamanho (`escala`), azul = giro (`rot`, gira em volta do meio do quadro); roda do mouse = tamanho.
- **Cor do projétil** (`cor` = matiz 0–359, `corForca`): círculo cromático no Estúdio com os nomes das cores escritos em volta e no centro (o usuário é daltônico), 8 botões com o nome da cor, ajuste fino em graus e intensidade. Motor: `FF.Battle.filtroCor` → `ctx.filter` (grayscale+sepia+saturate+hue-rotate, base 38°), aplicado ao projétil e ao rastro.
- IA e ⭐ habilidades: inimigos com IA de lista fixa (Raditz, Nappa, Vegeta, Saibaman) agora também sorteiam as habilidades equipadas que não estão na lista, com o peso automático (`FF.AI.choose`). Estúdio → Personagens → IA: o seletor de golpes das regras lista as ⭐ habilidades do personagem (`golpesDisp(true)`), para dar peso/condição próprios.
- Lutador (clipe de animação) com as mesmas alças dos efeitos no palco: branca = mover, amarela = tamanho, azul = giro (`rot` no clipe → `Fighter.rotExtra`, gira em volta do meio do corpo; volta a 0 no fim da linha). Campo "Giro (°)" em Posição e aparência. Arrastar/girar o alvo agora respeita o lado dele.
- Correção: a IA podia sortear um golpe supremo (ex.: ⭐ habilidade supremo colocada numa regra) sem a Fúria cheia. `FF.AI.choose` agora ignora supremos (eles só saem pelo caminho da Fúria cheia em `battle.turn`). Estúdio → IA avisa que o peso não vale para supremos e tira eles do cálculo de chance.
- Música da seleção da Batalha Livre: `assets/audio/selecao_chala.ogg` (arquivo enviado pelo usuário, "Cha-la Head-Cha-La Prologue", convertido de MP3, 63 s em loop). `FF.Audio.musicaSelecao()` toca ao abrir a seleção (`FF.Selecao.abrir`); ao sair para os menus (`fechar`) volta a música do menu; a luta troca pela música dela.
- **Favoritos** (`js/core/favoritos.js`, `FF.Favoritos`; `data/edicoes.js` → `favoritos["sprite"|"sprite#anim"] = tipo`): ☆ em cada cartão (animação) do seletor de sprites, em cada sprite da lista do seletor e da aba Sprites → menu Efeito / Personagem / Cenário / Interface (ou tirar). Seletor ganhou "⭐ Meus favoritos" com uma fonte por tipo (`fav:<tipo>`); aba Sprites, grupos "⭐ … favoritos" no topo. O tipo escolhido para um sprite inteiro do acervo vira o tipo dele (`FF.Assets.tipoSprite`), e "Efeitos (todos)" respeita o que o usuário marcou. Envio ao GitHub agrupado (`FF.Edicoes.setDepois`, 4 s).

## 13/11/2026 — Acervo de sons + aba Favoritos
- `tools/extrair_sons.py` + `tools/fsb.py`: 992 sons de 10 jogos convertidos para OGG em `assets/audio/acervo/` (136 MB; músicas > 30 s em qualidade menor). Super Warriors Z 628, Power Warrior 86, Legend Warrior 64, Ultimate Heroes 58, Mini Champion 35, Super Pixel Warriors 33, Assets 27, Dragon Legend Z 26, Twiss 18, Drag Warriors 17. FSB5 do Unity: PCM/IMA ADPCM viram WAV; Vorbis é remontado em OGG com o setup achado codificando com o libvorbis (CRC32 bate); 75 sons Vorbis usam setups do FMOD que o libvorbis não gera (6 CRCs) e ficaram de fora (a maioria da pasta "Sons_fsb" dos Assets e do Drag Warriors). Nomes dos AudioClip do Unity lidos dos SerializedFile ao lado do .resource (Legend Warrior fica com nomes genéricos).
- Seletor de sons 🎧 refeito: coluna com Todos / ⭐ Meus favoritos por categoria / cada jogo; chips de categoria automática pelo nome (explosões, golpes, ki, auras, vozes, movimentos, músicas, interface, outros); ▶/■ para ouvir; ☆ para favoritar.
- Aba **⭐ Favoritos** no Estúdio: sprites (💥 Explosões, ✺ Efeitos, 🥋 Personagens, 🏞 Cenários, 🖥 Interface — "Explosão" entrou nos favoritos de sprite e conta como efeito) e sons (por categoria), com miniatura/ouvir, mudar categoria, tirar, abrir o sprite na aba Sprites e copiar o nome do som.
