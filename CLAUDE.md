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
- Ao terminar cada pedido, mande os links do GitHub Pages do que mudou: jogo https://guizeradan.github.io/Project-Final-Flash/ · Estúdio https://guizeradan.github.io/Project-Final-Flash/estudio.html
- O Estúdio grava `data/edicoes.js` direto no GitHub (commits do próprio usuário pelo navegador): **antes de commitar, rode `git pull --rebase origin main`** e nunca sobrescreva esse arquivo com uma versão antiga.
- Commits com autor `GuizeraDan <GuizeraDan@users.noreply.github.com>` (nunca o e-mail pessoal).

## Ferramentas
- **Estúdio** (`estudio.html`, guia em `docs/ESTUDIO.md`) — o editor do jogo (o antigo Editor de cenas `index.html?editor=1` foi removido; esses endereços redirecionam para o Estúdio). Arquivos: `js/estudio/nucleo.js` (abas, desfazer, rascunho, ☁), `palco.js` (simulação determinística do golpe com o motor real), `linha_ui.js` (linha do tempo), `props.js`, `seletor.js` (seletor global de sprites: qualquer animação de qualquer sprite, `FF.Estudio.escolherSprite`), `golpes.js` (aba Golpes; golpes salvos guardam `spritesUsados`, carregados por `FF.start`), `sprites.js` (aba Sprites: só edição, sem importar/exportar — pedido do usuário; redimensionar/juntar imagens em `sprites_arq.js`), `codecs.js` (GIF/ZIP/APNG/imagem, testes em `tools/testes/codecs*.js`), `personagens.js`, `projeto.js`; CSS `css/estudio*.css`. Testes: `node tools/testes/estudio.js`, `estudio_sprites.js`, `estudio_melhorias.js`.
- Motor da linha do tempo: passo de roteiro `{"linha": {duracao, trilhas}}` em `js/battle/linha.js` (formato no topo do arquivo; `FF.Linha.converter` transforma roteiros antigos). Campos novos compatíveis: clipe `anim` com `sprite` (animação emprestada de outro sprite), `offX/offY/escExtra/flipExtra` no Fighter, câmera `b.cam`/`b.camAlvo`, `rot` e `sprite` em efeitos, `deDx/deDy/alvoDx/alvoDy/sprite` no projétil.
- O visualizador e o Editor de cenas foram removidos (o Estúdio faz tudo); `visualizador.html` só redireciona para `estudio.html?aba=sprites`. Golpes se montam no Estúdio (aba Golpes e cenas; o botão { } mostra o JSON do roteiro, que o usuário pode colar na conversa). O `data/bundle.js` traz `_indice` (sprites, personagens, batalhas, áudios) usado pelas ferramentas.

## Sprites enviados pelo usuário
- **Quem importa é você** (o usuário pediu: ele manda as imagens na conversa, você monta tudo e ele só ajusta no Estúdio). Fluxo:
  1. Abra/olhe as imagens (folha de contato ampliada) e identifique as animações (parado, golpes, dano, lançado, caído, teleporte, carregar ki, efeitos/projéteis…).
  2. Escreva a receita `tools/receitas/<id>.json` (quadros de cada animação, fps, loop, `origem: centro` para efeitos, `disparo: auto` onde sai energia) e rode `python3 -I tools/importar_sprites.py tools/receitas/<id>.json --origem <pasta ou zip>` → `assets/img/<id>_0.png` + `data/sprites/<id>.json` (fundo da borda vira transparente, origem nos pés alinhada pela cabeça).
  3. Nomeie efeitos com prefixo do personagem (ex.: `Bills_Esfera`): o motor acha efeitos no sprite de qualquer lutador carregado (`fxSet`).
  4. Crie `data/characters/<id>.json` (formas/anims/golpes) e o retrato: `tools/gerar_retrato.py` (`--topo`, `--centrar-cabeca` para orelhas/cabelo altos).
     Se o usuário mandar uma **arte** do personagem, use `tools/retrato_de_imagem.py --imagem … --personagem <id> --rosto x0,y0,x1,y1 --banner x0,y0,x1,y1` (rosto da seleção e do HUD + banner, em 2× de resolução; troca os antigos dele). Guarde a arte em `tools/receitas/arte/<id>.png`.
  5. Teste numa batalha temporária (`data/battles/teste_<id>.json` + `node tools/testes/batalha.js --batalha teste_<id> --plano … --rage 100 --fotos …`), apague o arquivo de teste e rode o build.
- O importador do Estúdio foi removido (histórico do Git: commit "Estúdio: importar dentro da aba Sprites"). Sprites já importados por ele (`spritesNovos`, `spritesInfo[id].atlas`) continuam funcionando e editáveis.

## Edições do usuário (valem no jogo todo e em todos os aparelhos)
- `data/edicoes.js` (`window.FF_EDICOES`) + `js/core/edicoes.js` (`FF.Edicoes`): seções `golpes[personagem][golpe]` (substitui o golpe original; aplicado em `FF.Assets.loadCharacter`), `habilidades[id]` (golpes novos ⭐, `js/core/habilidades.js`), `sprites[sprite][anim]` (✂ Editar quadros; `{"apagada": true}` = animação apagada no Estúdio, `js/core/modificacoes.js`, aplicado em `loadSprite`), `personagens[id]` (Estúdio: campos de topo que substituem os do JSON — nome, atributos, formas, buffs, ia, vozes, formaInicial; ou `{novo: true, def}` = personagem criado, listado por `FF.Assets.listaPersonagens()`), `spritesNovos[id]` (sprite importado, atlas em `assets/img/usr/<id>.png`, listado por `FF.Assets.listaSprites()`) e `spritesInfo[id]` (`{escala, atlas: [caminhos]}` — atlas extras somados aos do JSON em `loadSprite`).
- Imagens importadas: `js/core/imagens_usr.js` (`FF.ImagensUsr`, IndexedDB do aparelho); `FF.Edicoes.enviar()` sobe as pendentes pela API de contents antes do `edicoes.js`; `loadSprite` usa a cópia local enquanto existir.
- O Estúdio ("💾 Salvar no jogo", "↺ Original") grava via `FF.Edicoes.set(caminho, valor)`: vale na hora no aparelho e, se ele estiver conectado (chave fine-grained do GitHub com Contents: Read and write, guardada em localStorage `ff_github_token`, painel "☁"), faz um commit em `data/edicoes.js` pela API (autor GuizeraDan noreply). Sem chave, fica em `ff_edicoes_pendentes` e é enviado depois.
- Para tornar uma edição parte "de verdade" dos JSON (ex.: limpar o arquivo), copie de `data/edicoes.js` para `data/characters`/`data/sprites`, remova de lá e rode o build.

## HUD da batalha
- HUD novo com a arte do usuário (`tools/receitas/arte/hud.png`): `python3 -I tools/hud_moderno.py` gera `assets/img/hud_moderno.png` (moldura com as partes que mudam apagadas + camada dos cantos ciano). O desenho fica em `FF.HUD.panelModerno` (`js/battle/hud.js`; posições em `FF.HUD.L`, em pixels da arte recortada 2125×545; inimigo = espelhado). Sem a imagem, cai no HUD antigo do ZL3 (`hud_zl3`).

## Retratos e seleção
- Sprite `retratos`: anim `retrato` (46 rostos de seleção do ZL3) e `banner` (44 artes inclinadas). Cada forma do personagem aponta os seus em `"retrato": {"quadro": N, "banner": M}` (sem isso, usa o sprite de batalha). Personagem sem arte no ZL3 (ex.: Saibaman): `tools/gerar_retrato.py` cria retrato + banner a partir do sprite e grava em `assets/img/retratos_extra.png`. `cenarios_preview` tem as 32 prévias de cenário do ZL3 (para uma futura escolha de cenário).
- Batalha Livre: `js/ui/selecao.js` monta a batalha na hora (até 3 por lado, qualquer personagem). Personagens sem `ia` usam a IA automática de `js/battle/ai.js`.

## Onde está o quê
- `docs/ROADMAP.md` — lista priorizada de tarefas.
- `docs/DIARIO.md` — registro de cada sessão de trabalho (o que foi feito, o que falta). Leia antes de começar; atualize ao terminar.
- **Acervo de sprites** (`docs/ACERVO.md`): todos os sprites dos jogos da pasta do usuário, prontos no Estúdio (aba Sprites e seletor de sprites, agrupados por categoria/jogo) e no jogo. Ficam em `data/acervo/<id>.js` + `assets/img/acervo/` (fora do bundle; `FF.Assets.loadSprite` carrega por `<script>` quando alguém usa). Índice: `data/acervo/indice.json` → `FF_BUNDLE._indice.acervo` (`FF.Assets.acervo()/categoriaSprite/tipoSprite/nomeSprite`); nomes de animação para a busca em `data/acervo/indice_anims.js`. Ferramentas: `tools/extrair_acervo.py` (Z Legends 3, ids `zl3_*`), `tools/extrair_jogos.py` (GameMaker, Construct 3, GDevelop, Unity, pastas de PNG), `tools/acervo_comum.py` (gravação/índice; uma ficha por jogo em `data/acervo/fontes/`). Teste: `node tools/testes/acervo.js`. Os sprites do acervo são material bruto: não crie personagem/golpe com eles sem o usuário pedir.
- Sprites já extraídos: gokubase, gokussj, raditz, piccolo, krillin, nappa, vegeta_saiyajin, tienshinhan, saibaman, fx, fx_extra (explosões, impactos, poeira, rochas, Genki Dama, makankosappo, kienzan…), hud_zl3 (barras de vida/ki originais, faces 3v3, textos KO/vitória), stage_campo.
- Prefixos de voz (dublagem): vgkn Goku · vgks Goku SSJ · vpcn Piccolo · vkrn Kuririn · vnpn Nappa · vvgn Vegeta · vtnn Tenshinhan · raditz_*. Números: 0xx dano/lançado, 1xx golpes, 2xx especiais, 4xx intro/vitória (confirme pelo contexto).
