# Final Flash — instruções para o Claude

Jogo de Dragon Ball por turnos (projeto pessoal, não distribuído), inspirado nas mecânicas de *Dragon Ball Z: Attack of the Saiyans* (DS). Usa apenas assets do jogo do próprio usuário, o **Z Legends 3** (Construct 2). Idioma do projeto e das mensagens: **português do Brasil**.

## Regras
- HTML/JS puro, scripts clássicos (precisa abrir por `file://` e pelo GitHub Pages). Nada de build step, nada de dependência externa em runtime.
- **Motor separado do conteúdo.** Personagens, golpes, inimigos, falas e batalhas ficam em JSON (`data/`). Golpes são roteiros (veja README).
- Antes de cada commit (e sempre depois de editar JSON): `python3 tools/build_bundle.py` — gera o bundle e o `versao.json` (usado pelo aviso de "nova versão" do app instalado).
- Antes de cada commit: `node tools/testes/batalha.js --plano 1,2,4,5,1` precisa terminar com "luta terminou" e sem ERROS. Para batalhas novas use `--batalha <id>`.
- O motor deve continuar suportando transformação no meio da luta.
- Sprites novos saem do APK do Z Legends 3 (`tools/extract_sprites.py`) ou de imagens/sprite sheets que o usuário mandar na conversa (você recorta, monta as animações e grava como sprite fixo). Sem isso, use o que já está em `data/sprites/` e `assets/`. `docs/catalogo_zl3.json` lista todos os objetos/animações do jogo original; `docs/audios_zl3_disponiveis.txt` lista todos os áudios.
- Falas/história: escreva texto próprio em português (pode resumir os acontecimentos da saga), sem copiar diálogos do anime/mangá.
- Ao terminar cada pedido, mande os links do GitHub Pages do que mudou: jogo https://guizeradan.github.io/Project-Final-Flash/ · visualizador https://guizeradan.github.io/Project-Final-Flash/visualizador.html · Editor https://guizeradan.github.io/Project-Final-Flash/index.html?editor=1&batalha=saiyajin_01
- O Editor grava `data/edicoes.js` direto no GitHub (commits do próprio usuário pelo navegador): **antes de commitar, rode `git pull --rebase origin main`** e nunca sobrescreva esse arquivo com uma versão antiga.
- Commits com autor `GuizeraDan <GuizeraDan@users.noreply.github.com>` (nunca o e-mail pessoal).

## Ferramentas
- **Estúdio** (`estudio.html`, guia em `docs/ESTUDIO.md`) — o editor completo novo. Arquivos: `js/estudio/nucleo.js` (abas, desfazer, rascunho, ☁), `palco.js` (simulação determinística do golpe com o motor real), `linha_ui.js` (linha do tempo), `props.js`, `golpes.js` (aba Golpes), `sprites.js`, `importar.js`, `codecs.js` (GIF/ZIP/APNG/imagem, testes em `tools/testes/codecs*.js`), `personagens.js`, `projeto.js`; CSS `css/estudio*.css`. Teste: `node tools/testes/estudio.js`.
- Motor da linha do tempo: passo de roteiro `{"linha": {duracao, trilhas}}` em `js/battle/linha.js` (formato no topo do arquivo; `FF.Linha.converter` transforma roteiros antigos). Campos novos compatíveis: `offX/offY/escExtra/flipExtra` no Fighter, câmera `b.cam`/`b.camAlvo`, `rot` e `sprite` em efeitos, `deDx/deDy/alvoDx/alvoDy/sprite` no projétil.
- `visualizador.html` (animações quadro a quadro + eventos dos golpes + sons) e o **Editor** `index.html?editor=1&batalha=<id>` (monta e testa golpes, inclusive os existentes — o laboratório de golpes foi removido, tudo novo é feito aqui; exporta o JSON do roteiro; o usuário pode colar esse JSON na conversa). O `data/bundle.js` traz `_indice` (sprites, personagens, batalhas, áudios) usado por elas.

## Sprites enviados pelo usuário
- O importador no app foi descontinuado (o usuário ainda vai decidir como quer). Quem importa é você: quando o usuário mandar imagens/sprite sheets, recorte os quadros (fundo transparente), empacote num atlas em `assets/img/<id>.png` e crie `data/sprites/<id>.json` no mesmo formato dos outros (quadro `[atlas, x, y, w, h, ox, oy, dur, pontos?]`, origem nos pés para lutadores e no centro para efeitos) e rode o build (o índice do bundle pega os sprites novos sozinho). O código antigo (`js/ferramentas/importador.js`, `js/core/biblioteca.js`) está no histórico do Git.

## Edições do usuário (valem no jogo todo e em todos os aparelhos)
- `data/edicoes.js` (`window.FF_EDICOES`) + `js/core/edicoes.js` (`FF.Edicoes`): seções `golpes[personagem][golpe]` (substitui o golpe original; aplicado em `FF.Assets.loadCharacter`), `habilidades[id]` (golpes novos ⭐, `js/core/habilidades.js`), `sprites[sprite][anim]` (✂ Editar quadros, `js/core/modificacoes.js`, aplicado em `loadSprite`), `personagens[id]` (Estúdio: campos de topo que substituem os do JSON — nome, atributos, formas, buffs, ia, vozes, formaInicial; ou `{novo: true, def}` = personagem criado, listado por `FF.Assets.listaPersonagens()`), `spritesNovos[id]` (sprite importado, atlas em `assets/img/usr/<id>.png`, listado por `FF.Assets.listaSprites()`) e `spritesInfo[id]` (`{escala}`).
- Imagens importadas: `js/core/imagens_usr.js` (`FF.ImagensUsr`, IndexedDB do aparelho); `FF.Edicoes.enviar()` sobe as pendentes pela API de contents antes do `edicoes.js`; `loadSprite` usa a cópia local enquanto existir.
- O Editor ("💾 Salvar no jogo", "↺ Original") e o visualizador gravam via `FF.Edicoes.set(caminho, valor)`: vale na hora no aparelho e, se ele estiver conectado (chave fine-grained do GitHub com Contents: Read and write, guardada em localStorage `ff_github_token`, painel "☁"), faz um commit em `data/edicoes.js` pela API (autor GuizeraDan noreply). Sem chave, fica em `ff_edicoes_pendentes` e é enviado depois.
- Para tornar uma edição parte "de verdade" dos JSON (ex.: limpar o arquivo), copie de `data/edicoes.js` para `data/characters`/`data/sprites`, remova de lá e rode o build.

## Retratos e seleção
- Sprite `retratos`: anim `retrato` (46 rostos de seleção do ZL3) e `banner` (44 artes inclinadas). Cada forma do personagem aponta os seus em `"retrato": {"quadro": N, "banner": M}` (sem isso, usa o sprite de batalha). Personagem sem arte no ZL3 (ex.: Saibaman): `tools/gerar_retrato.py` cria retrato + banner a partir do sprite e grava em `assets/img/retratos_extra.png`. `cenarios_preview` tem as 32 prévias de cenário do ZL3 (para uma futura escolha de cenário).
- Batalha Livre: `js/ui/selecao.js` monta a batalha na hora (até 3 por lado, qualquer personagem). Personagens sem `ia` usam a IA automática de `js/battle/ai.js`.

## Onde está o quê
- `docs/ROADMAP.md` — lista priorizada de tarefas.
- `docs/DIARIO.md` — registro de cada sessão de trabalho (o que foi feito, o que falta). Leia antes de começar; atualize ao terminar.
- Sprites já extraídos: gokubase, gokussj, raditz, piccolo, krillin, nappa, vegeta_saiyajin, tienshinhan, saibaman, fx, fx_extra (explosões, impactos, poeira, rochas, Genki Dama, makankosappo, kienzan…), hud_zl3 (barras de vida/ki originais, faces 3v3, textos KO/vitória), stage_campo.
- Prefixos de voz (dublagem): vgkn Goku · vgks Goku SSJ · vpcn Piccolo · vkrn Kuririn · vnpn Nappa · vvgn Vegeta · vtnn Tenshinhan · raditz_*. Números: 0xx dano/lançado, 1xx golpes, 2xx especiais, 4xx intro/vitória (confirme pelo contexto).
