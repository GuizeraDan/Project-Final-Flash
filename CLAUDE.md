# Final Flash — instruções para o Claude

Jogo de Dragon Ball por turnos (projeto pessoal, não distribuído), inspirado nas mecânicas de *Dragon Ball Z: Attack of the Saiyans* (DS). Usa apenas assets do jogo do próprio usuário, o **Z Legends 3** (Construct 2). Idioma do projeto e das mensagens: **português do Brasil**.

## Regras
- HTML/JS puro, scripts clássicos (precisa abrir por `file://` e pelo GitHub Pages). Nada de build step, nada de dependência externa em runtime.
- **Motor separado do conteúdo.** Personagens, golpes, inimigos, falas e batalhas ficam em JSON (`data/`). Golpes são roteiros (veja README).
- Depois de editar qualquer JSON: `python3 tools/build_bundle.py`.
- Antes de cada commit: `node tools/testes/batalha.js --plano 1,2,4,5,1` precisa terminar com "luta terminou" e sem ERROS. Para batalhas novas use `--batalha <id>`.
- O motor deve continuar suportando transformação no meio da luta.
- Sprites novos só saem do APK do Z Legends 3 (`tools/extract_sprites.py`). Sem o APK, use o que já está em `data/sprites/` e `assets/`. `docs/catalogo_zl3.json` lista todos os objetos/animações do jogo original; `docs/audios_zl3_disponiveis.txt` lista todos os áudios.
- Falas/história: escreva texto próprio em português (pode resumir os acontecimentos da saga), sem copiar diálogos do anime/mangá.
- Commits com autor `GuizeraDan <GuizeraDan@users.noreply.github.com>` (nunca o e-mail pessoal).

## Onde está o quê
- `docs/ROADMAP.md` — lista priorizada de tarefas.
- `docs/DIARIO.md` — registro de cada sessão de trabalho (o que foi feito, o que falta). Leia antes de começar; atualize ao terminar.
- Sprites já extraídos: gokubase, gokussj, raditz, piccolo, krillin, nappa, vegeta_saiyajin, tienshinhan, saibaman, fx, fx_extra (explosões, impactos, poeira, rochas, Genki Dama, makankosappo, kienzan…), hud_zl3 (barras de vida/ki originais, faces 3v3, textos KO/vitória), stage_campo.
- Prefixos de voz (dublagem): vgkn Goku · vgks Goku SSJ · vpcn Piccolo · vkrn Kuririn · vnpn Nappa · vvgn Vegeta · vtnn Tenshinhan · raditz_*. Números: 0xx dano/lançado, 1xx golpes, 2xx especiais, 4xx intro/vitória (confirme pelo contexto).
