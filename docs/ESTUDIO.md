# Estúdio Final Flash — guia de uso

Abra `estudio.html` (no jogo: **⚙ Ferramentas → Estúdio**; também no topo do visualizador).
Online: https://guizeradan.github.io/Project-Final-Flash/estudio.html

O Estúdio é pensado para PC (tela cheia), mas funciona no celular deitado. O Editor antigo
(`index.html?editor=1`) continua existindo.

## Abas

| Aba | Para quê |
|---|---|
| 🎬 **Golpes e cenas** | Linha do tempo + palco ao vivo + propriedades de qualquer golpe/habilidade |
| 🖼 **Sprites** | Editar quadros de qualquer animação (efeitos também), escala do sprite, exportar |
| 📥 **Importar** | Trazer animações de qualquer arquivo (imagem, GIF, vídeo, ZIP, sprite sheet…) |
| 🧑 **Personagens** | Atributos, formas, ordem dos golpes, buffs/aura, IA, criar personagem novo |
| 📦 **Projeto** | Tudo o que foi mudado, voltar ao original, exportar/importar o projeto inteiro |

Em todo o Estúdio: **Ctrl+Z / Ctrl+Y** desfazem/refazem; o trabalho em andamento fica num
**rascunho automático** no aparelho (se fechar a página, ele volta).

## Criar uma habilidade nova (passo a passo)

1. Aba **Golpes e cenas**. À esquerda escolha **Personagem** e **Forma** (e, em *Palco*, o **Alvo**,
   se quem solta é herói ou inimigo e um **Parceiro** para Sparking Combo).
2. Clique **＋ Novo**. Aparece um golpe com uma animação e um acerto.
3. **Animação do lutador:** clique no clipe azul da trilha *Quem solta*; em *Propriedades* troque a
   animação (🖼 mostra as miniaturas), fps, trecho de quadros (*do quadro / até o quadro*), duração,
   “segurar 1º quadro”, posição X/Y, tamanho, opacidade. Arrastar o lutador no palco muda a posição
   deste clipe. Para andar até o alvo/voltar: **＋** da trilha → *Mover* ou *Teleporte*.
4. **Efeito posicionado:** **＋** na trilha *Efeitos* (ou duplo clique na trilha, no tempo desejado).
   Escolha o efeito (🖼), onde ele fica preso (pés, peito, ponto de disparo, alvo, tela) e **arraste no
   palco**: alça branca = posição, amarela = tamanho, azul = giro (a roda do mouse também muda o tamanho).
5. **Projétil:** trilha *Projéteis*: escolha o desenho, velocidade, arco, rastro… No palco, a alça verde é
   a saída e a vermelha a chegada. Em *Acerto ao chegar* defina dano/força e a explosão.
6. **Acerto:** trilha *Acertos*: dano (fração do poder), força, lançar, empurrão, explosão (e posição).
   O primeiro acerto de cada grupo abre o anel de guarda/crítico automaticamente (campo *Anel* muda isso).
7. **Reação do alvo:** trilha *Alvo* → animação (ex.: `lancado`, `dano1`, `caido`) com empurrão e
   “voltar ao normal”.
8. **Som/voz:** trilha *Sons e vozes* (🎧 abre a lista com todos os áudios para ouvir).
9. Tela: tremor, flash, **câmera** (zoom/foco) e mensagens. Ações: ki, buff, transformar, curar, atordoar…
10. **Linha do tempo:** arraste clipes para mover, a borda direita para esticar, a régua para mover o
    cursor (scrub). 🧲 Ímã encaixa nos quadros das animações (Alt solta). Ctrl+roda = zoom. Shift+arrastar
    na régua marca um trecho para repetir (🔁 Trecho). ← → anda quadro a quadro; Espaço toca/pausa;
    velocidade de 0,25× a 2×; 🧅 casca de cebola, ▦ grade, ✚ pontos de referência.
11. **⚔ Na batalha** roda o golpe de verdade (dano, anéis — aperte Espaço/toque no palco).
12. Sem clipe escolhido, o painel da direita mostra o **golpe**: nome, descrição, tipo, custo de ki,
    poder, supremo, regras (mostrar/esconder com buff ou forma, requer parceiro).
13. **💾 Salvar no jogo** (Ctrl+S): golpe novo vira uma **⭐ habilidade** já equipada (aparece no menu de
    golpes em qualquer batalha). 🎮 abre uma Batalha Livre para testar.

## Editar um golpe que já existe

Escolha na lista (✎ = já alterado por você). Golpes antigos (roteiro em passos) são convertidos
automaticamente para a linha do tempo. Salvar substitui o golpe no jogo todo; **↺ Original** desfaz.
**⧉** duplica como habilidade nova. **{ }** mostra/aceita o JSON (inclusive os do Editor antigo).

## Sprites

Escolha o sprite e a animação. Na tira de baixo: apagar, duplicar, mover (arrastar), inverter, inserir
quadros de outras animações do mesmo sprite, "＋ Nova" animação. No palco: **✥ Origem** (arraste o
desenho), **▭ Recorte** (caixa no atlas), **🎯 Disparo** (ponto de onde saem os projéteis).
À direita: fps, loop, "repetir do quadro", duração de cada quadro, escala geral do sprite.
**📤 Exportar**: sprite sheet PNG + JSON, sequência de PNGs (ZIP), GIF animado, WebM, JSON do jogo.
Observação: abrindo pelo arquivo (`file://`) o navegador não deixa ler os pixels dos sprites do jogo
para exportar imagens — use o site do GitHub Pages.

## Importar

Solte arquivos (ou cole com Ctrl+V): PNG, JPG, WebP/GIF/APNG animados, BMP, SVG, AVIF, sprite sheet,
várias imagens (cada uma um quadro), vídeo MP4/WebM (escolha o fps), ZIP de imagens, `.ffpacote.json`
antigo, JSON de sprite + PNG. Sprite sheet: separar quadros automático ou por grade. Depois: remover fundo
(automático ou conta-gotas, tolerância), cortar bordas, escala, origem nos pés (lutador) ou no centro
(efeito), fps, ajuste fino por quadro. Salve como sprite novo (ou como mais uma animação de um sprite
importado). O sprite novo aparece na aba Sprites, como efeito/camada nos golpes e pode virar personagem.

## Personagens

Atributos, formas (sprite, multiplicadores, animações básicas, vozes, retrato, **ordem dos golpes no
menu**), buffs (turnos, multiplicadores, vida por turno, cor, **aura**, pose) e IA (pesos). **＋ Novo**
cria um personagem a partir de qualquer sprite (inclusive importado): ele aparece na Batalha Livre.

## Sincronizar (valer em todos os aparelhos)

Botão **☁** no topo (verde = sincronizado, laranja = só neste aparelho, vermelho = erro). Cole a chave
do GitHub uma vez por aparelho (a mesma do Editor). Tudo vai para `data/edicoes.js` e as imagens
importadas para `assets/img/usr/`. Sem chave/internet, fica guardado no aparelho e é enviado depois.
A aba **Projeto** exporta/importa tudo (inclusive imagens) num único JSON.

## Pendente / limitações conhecidas

- Câmera, teleporte e movimento são simulados, mas a prévia de “Na batalha” não mostra a câmera de um
  golpe em outro lado da tela de forma especial (usa o mesmo motor).
- No celular: arrastar quadros na tira do Sprites não reordena (use ◀ Mover ▶); o palco fica pequeno.
- Personagens: IA por forma, `reverter` e `vitoria` só em JSON; prévia sem sons.
- Importar: renomear uma animação não atualiza golpes que usam o nome antigo; MP4/AVIF dependem do navegador.
- O Editor antigo não sabe editar golpes salvos pelo Estúdio (passo `linha`); eles funcionam no jogo,
  mas edite-os no Estúdio.
- Batalhas/estágios (posições, escala, ajustes de vida) ainda não têm aba.
