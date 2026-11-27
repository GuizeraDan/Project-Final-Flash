# Revisão do motor e do Estúdio — 27/11/2026

Revisão só de leitura (nada foi mudado por ela). Cada item: o que é, por que atrapalha, proposta, risco.
O usuário escolhe o que fazer e em que ordem.

## 1. Arquivo de edições gigante (prioridade alta)
- `data/edicoes.js` está com **2,75 MB** (o jogo e o Estúdio carregam ele inteiro ao abrir).
- **2,1 MB** são os **4474 sprites do ⇱ Separar** (`spritesNovos`): cada um guarda uma cópia da lista de quadros e dos atlas.
- `spritesInfo` tem 6861 entradas (520 KB), quase todas `nome + pasta`.
- **Proposta:** sprite separado guarda só a referência (`ref: "sprite#anim"`) e o motor monta os quadros na hora → ~250 KB (8× menor). Converter os 4474 existentes de uma vez.
- **Risco:** baixo/médio (precisa tratar "tirar do original", que apaga a animação de origem: a referência lê a versão original, sem as edições de apagar).

## 2. Palco ≠ jogo em golpes de energia
- Antes de raios/rajadas o jogo dá um passo até a fileira do alvo (`alinharFileira`); o palco não faz isso, então a prévia mostra o raio "errando" o alvo.
- **Proposta:** o palco repetir exatamente os passos automáticos do jogo antes do golpe (sem opção nova).
- **Risco:** baixo (a prévia de alguns golpes muda, mas passa a bater com a luta).

## 3. Dois formatos de golpe convivendo
- **49 dos 51 golpes** dos personagens (data/characters) ainda estão no formato antigo (lista de passos: `anim`, `eventos`, `irAte`…, `js/battle/script.js`); só os editados no Estúdio estão em linha do tempo. O Estúdio converte ao abrir (`FF.Linha.converter`).
- Duas lógicas fazem a mesma coisa (avançar até o alvo, efeitos, acertos), com comportamentos levemente diferentes.
- **Proposta:** converter todos para linha do tempo com uma ferramenta, conferir com fotos de batalha, e deixar o formato antigo só como leitura de compatibilidade.
- **Risco:** médio (mudanças sutis de tempo/posição em golpes antigos; dá para comparar quadro a quadro).

## 4. Posição dos efeitos: muitas regras somadas
- Na diagonal há 3 mecanismos mexendo em posição: passo até a fileira do alvo, deslize de quem avança (`atualizarPerspectiva`) e a conversão dos pontos pela diagonal (`mapaPersp`) com inclinação automática. Por cima: "Acompanha", "📍 Ficar junto", "📌 Fixar", "✏ ajuste por combinação".
- É a origem dos efeitos que "fogem" conforme a fileira.
- **Proposta:** uma regra só: efeito fica junto de quem está preso (sem diagonal) — a diagonal/inclinação só para efeitos marcados "↔ Até o alvo" (raios). "Ficar junto" deixa de existir como opção.
- **Risco:** médio (efeitos sem "Acompanha" que hoje vão pela diagonal mudam de lugar; dá para listar quais).

## 5. Opções de efeito sobrepostas (interface)
- Preso em · Acompanha · Ficar junto · Fixar · Até o alvo · Camada (frente/profundidade/atrás) · Ordem.
- **Proposta:** reorganizar em 3 grupos: **Onde** (preso em + acompanha/fixar), **Camada** (frente/profundidade/atrás + ordem), **Raio** (até o alvo: cortar/esticar). Juntar "Acompanha" e "Ficar junto".
- **Risco:** baixo (só interface; os dados continuam).

## 6. Movimentos repetidos
- "Mover → qualquer lugar da tela" faz o mesmo que um 〰 Caminho de 1 ponto (o Caminho tem mais recursos: saída, giro/tamanho por ponto, sem pulo).
- **Proposta:** Mover fica para "até o alvo / casa / frente / trás"; pontos da tela = Caminho. Converter os "Mover para x" existentes em Caminho.
- **Risco:** baixo/médio.

## 7. Camadas livres × efeitos
- Camada livre ≈ efeito com chaves de animação (posição/tamanho ao longo do tempo); dois jeitos de pôr um desenho na tela.
- **Proposta:** por enquanto nada; mais tarde, efeito ganha chaves e camada vira só um atalho.
- **Risco:** —

## 8. Código do Estúdio repetido (invisível para o usuário)
- `sprites.js` (1925 linhas) e `golpes.js` (1390) muito grandes; `confirmar` duplicado em sprites.js; listas de sprites/miniaturas em 3 lugares (navegador, seletor, organizar); renomear no lugar repetido.
- **Proposta:** juntar os auxiliares no `nucleo.js` e quebrar sprites.js/golpes.js em partes.
- **Risco:** baixo (testes cobrem).

## 9. Testes lentos
- `batalha.js --plano 1,2,4,5,1` leva ~2,5 min e às vezes "não terminou no tempo" (sorteio).
- **Proposta:** sorteio fixo e velocidade maior no teste obrigatório.
- **Risco:** baixo.

## Ordem sugerida
1 (arquivo) → 2 (palco = jogo) → 5 e 6 (simplificar opções) → 4 (regra única de posição) → 3 (formato único) → 8 e 9.
