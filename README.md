# Final Flash: Saga Saiyajin

> **Modo história:** na tela de título escolha *Novo Jogo* (4 capítulos: Raditz → Saibamen → Nappa → Vegeta, com diálogos entre as lutas). *Continuar* retoma o capítulo salvo no navegador; *Batalha Livre* abre qualquer luta; *Treinamento (AP)* gasta os pontos ganhos nas vitórias; *Opções* ajusta os volumes. Atalhos: `?historia=N` e `?batalha=saiyajin_0N` na URL.

Batalha por turnos em HTML/JavaScript puro que reaproveita os sprites e áudios do Z Legends 3. Não usa o editor do Construct.

## Como rodar

- **No PC:** abra o `index.html` direto no navegador. Os JSON já estão em `data/bundle.js`, então não precisa de servidor.
- **No GitHub Pages:** suba a pasta inteira para um repositório e ative o Pages. Pode ser privado, se o seu plano permitir.
- Se editar algum JSON, rode `python3 tools/build_bundle.py` para atualizar o `bundle.js`. Ele só é necessário para abrir pelo arquivo; servido por HTTP, o jogo também lê os JSON direto.

## Controles

- **Menu:** clique ou toque, setas + Enter, ou as teclas 1–9.
- **Botão de ação:** Espaço, Z, J, ou um toque/clique na tela da batalha.
  - **Anel azul em cima do Goku:** é a guarda cronometrada. Aperte quando o anel fechar.
    - Guarda normal: recebe 40% do dano.
    - Guarda perfeita (≤ 0,10 s antes do golpe): recebe 10% e ganha um pouco de ki.
  - **Anel dourado no inimigo:** é o golpe crítico. Ele multiplica o dano por 1,4, ou por 1,8 se for perfeito.
  - Apertar cedo demais trava o botão por um instante, para que ficar apertando sem parar não funcione.

## O que o Goku faz neste protótipo

| Golpe | Ki | Observação |
|---|---|---|
| Sequência de Golpes | 0 | Dash, 3 golpes leves e 1 pesado que lança o inimigo, depois teleporte de volta. São 4 anéis de crítico. |
| Kamehameha | 30 | 3 acertos, usando o raio que já vem desenhado nos quadros do Goku. |
| Kaioken | 20 | Buff de ataque ×1,5 com o Goku tingido de vermelho. Custa 3% da vida por turno. |
| Carregar Ki | 0 | +40 de ki. |
| Super Saiyajin | 50 | **Teste do motor:** transforma no meio da luta e troca sprite, atributos e golpes. Gasta 15 de ki por turno. Com o ki em 0, destransforma sozinho. |

Na forma SSJ os golpes passam a ser: Sequência Saiyajin, Super Kamehameha, Kamehameha e Destransformar.

O Raditz tem três ações: combo corpo a corpo, Rajada de Energia (2 projéteis, cada um com seu anel de guarda) e Carregar Ki. Ele escolhe a ação pelos pesos definidos no JSON.

## Estrutura

```
index.html, css/style.css
js/core/      clock (tempo de jogo/hitstop), assets, sprite (animador), audio, input
js/battle/    fighter, script (interpretador de roteiros), battle (turnos/dano/guarda), hud, ai
data/sprites/     animações extraídas (geradas pelo extract_sprites.py)
data/characters/  goku.json, raditz.json   ← atributos, formas, golpes, vozes, IA
data/battles/     saiyajin_01.json         ← quem luta, cenário, música, falas de intro
data/stages/      campo.json
assets/img, assets/audio                   ← atlas reempacotados + .ogg selecionados
tools/            extract_sprites.py, build_bundle.py
```

### Golpes são dados, não código

Cada golpe tem um `roteiro`, que é uma lista de passos:

- `irAte` (avançar até o alvo), `anim`, `voltar` (teleporte para a posição inicial), `esperar`
- `transformar`, `aplicar` (buff), `ki`, `mensagem`, `tremer`, `flash`

Os passos `anim` podem ter `eventos` presos a um quadro:

- `som`, `voz`, `acerto` (`fracao`, `forca`, `lanca`), `projetil`, `efeito`
- O quadro pode ser um número, `"pico"` (o quadro do golpe, detectado pelo image point do Construct ou pelo quadro mais esticado) ou `"fim"`.

Uma nova forma (Kaioken, SSJ, Golden Freeza, Perfect Cell...) é só mais uma entrada em `formas`, com seu sprite, multiplicadores, golpes e o roteiro de `reverter`. Uma nova saga entra como novos arquivos em `data/battles` e `data/characters`.

### Extrair outro personagem do Z Legends 3

Os nomes dos objetos no `data.js` vêm ofuscados (`t0`…`t412`). Para saber qual é qual, olhe as sprite sheets que cada um usa. Os que já foram mapeados:

| Objeto | Conteúdo |
|---|---|
| t70 | Goku base |
| t71 | Goku SSJ |
| t89 | Goku Blue |
| t54 | Goku UI |
| t98 | Goku GT |
| t2 | Raditz |
| t282–t284 | Kamehameha (objeto separado, usado por outros personagens) |
| t288 | Ki blasts |
| t335 | Hits |
| t344 | Guarda |
| t213 / t214 | Cenários (céu / chão) |

Exemplo de comando:

```
python3 -I tools/extract_sprites.py --www <pasta assets/www> --out . --id nappa --src t<N>
```

## Vozes do Goku (dublagem), mapeadas pelos eventos do jogo original

| Arquivos | Uso |
|---|---|
| `vgkn100–107` | Golpes |
| `vgkn002–004` | Dano |
| `vgkn012–014` | Lançado |
| `vgkn134` / `vgkn206` | Kamehameha |
| `vgkn211` / `vgkn213` | Kaioken |
| `vgkn209` | Genki Dama |
| `vgkn400–401` | Intro |
| `vgkn402–405` | Vitória |
| `vgks401` | Transformação em SSJ |
| `vgks209` | Super Kamehameha |

## AP e Treinamento

Cada vitória dá **AP** (30 + 1 por 100 de vida inimiga; no modo história vale o dobro; uma batalha pode fixar o valor com `"ap"` no JSON). Na tela de título, *Treinamento (AP)* compra níveis (até 5) para Goku, Piccolo e Kuririn:

| Atributo | Por nível | Custo |
|---|---|---|
| Vida | +8% | 40, 80, 120, 160, 200 AP |
| Ataque | +6% | idem |
| Defesa | +10% | idem |
| Ki por turno | +1 | idem |

Tudo fica salvo no navegador (`FF.Save`, chave `finalflash_save_v1`); *Opções → Apagar progresso* zera capítulos, AP e treino. As melhorias valem em todas as batalhas (código em `FF.Treino`, `js/main.js`).

## Celular

Jogue com o celular deitado (em pé aparece um aviso para girar). Em telas de toque os botões ficam maiores e o menu de golpes esconde a descrição para caber.

## Ainda não implementado (próximas etapas)

- Desbloquear golpes com AP (hoje o AP só melhora atributos).
- Kamehameha do Kuririn (precisa extrair o objeto do raio do APK).
- Sparking Combo de 3 heróis e Sparking do Goku SSJ.
- Saibaman com animações próprias de dano/caído; conferir quadro a quadro os golpes de Nappa/Vegeta.
- Cenas de diálogo do modo história com o cenário ao fundo.

## Ferramentas de desenvolvimento

- **Visualizador de animações** (`visualizador.html`, ou pelo botão na tela de título):
  - todas as animações de todos os sprites, quadro a quadro;
  - mostra o ponto dos pés, a caixa do quadro e os pontos de disparo;
  - marca na linha do tempo os quadros onde cada golpe tem acerto, som ou voz;
  - aba **Sons** para ouvir todos os áudios.
  - Atalhos: Espaço toca/pausa, ←/→ mudam o quadro, ↑/↓ mudam a animação. "Copiar referência" gera um texto pronto para relatar um problema.
- **Editor de cenas** (`index.html?editor=1&batalha=<id>`, ou "🎬 Editor de cenas" na tela de título):
  - sandbox para montar golpes: escolha quem solta e o alvo e monte o roteiro passo a passo (animações do lutador, avançar, teleporte, espera);
  - em cada quadro dá para prender efeitos visuais, sons, vozes, acertos, projéteis, tremor e flash;
  - 🎯 alinha um efeito clicando na tela; ▶ testa na batalha real; dá para abrir um golpe existente para modificar;
  - salva cenas no navegador; "Copiar JSON" gera o golpe pronto para entrar no jogo;
  - no visualizador, "➕ Enviar para o editor" (animações) e o ➕ ao lado dos sons mandam itens direto para o editor.
- **Sprites novos**: por enquanto não há importador no app. Mande as imagens ou sprite sheets na conversa com o Claude, que ele recorta, monta as animações e coloca no jogo (`data/sprites` + `assets/img`).
- **✂ Editar quadros** (visualizador): apagar, reordenar, duplicar quadros, mudar duração, posição e fps de qualquer animação, ou salvar como nova.
