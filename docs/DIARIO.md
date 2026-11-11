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
