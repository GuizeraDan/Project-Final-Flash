// Final Flash — codecs e utilidades de imagem do Estúdio (script clássico, sem dependências).
// Funciona no navegador (file:// e GitHub Pages) e no Node (para testes: tools/testes/codecs.js).
//
// ============================== FF.Codecs ==============================
//  crc32(u8) -> número sem sinal
//  zipLer(arrayBufferOuU8) -> Promise<[{nome, dados: Uint8Array}]>   (métodos 0 store e 8 deflate; ignora pastas)
//  zipGravar([{nome, dados: Uint8Array|string}]) -> Uint8Array        (store, CRC, data DOS atual, nomes UTF-8)
//  gifDecodificar(u8) -> {largura, altura, quadros: [{rgba, atraso}], loop}
//       rgba: Uint8ClampedArray já composto no canvas lógico (disposal 0/1/2/3 + transparência);
//       atraso em segundos (0 no arquivo vira 0.1, como nos navegadores);
//       loop: 0 = infinito, N = repetições extras, null = sem extensão NETSCAPE (toca uma vez).
//  gifCodificar(quadros: [{rgba, largura, altura, atraso}], opts {loop: true, transparente: true, paletaGlobal: false})
//       -> Uint8Array   (até 255 cores por paleta + 1 índice transparente para alfa < 128; median cut;
//                        imagens com ≤ 255 cores opacas voltam idênticas)
//  pngQuadros(u8) -> Promise<null | {largura, altura, quadros: [{rgba, atraso}], loop}>
//       decodificador PNG/APNG próprio (inflate via DecompressionStream('deflate')); PNG estático = 1 quadro.
//       null se não for PNG ou for um caso não suportado (entrelaçado Adam7).
//  detectarTipo(u8, nome?, mime?) -> 'gif'|'png'|'webp'|'jpg'|'bmp'|'ico'|'svg'|'avif'|'heic'|'mp4'|'mov'|'webm'|'zip'|'json'|'desconhecido'
//  async decodificarArquivo(file|Blob, opts {fps: 12, maxQuadros: 300, aoProgresso(fração)})
//       -> {tipo: 'imagem'|'animacao'|'video'|'zip', itens: [{nome, largura, altura, quadros: [{canvas, atraso}]}]}
//       ou {tipo: 'json', texto}            (somente navegador)
//  async canvasParaPng(canvas) -> Blob
//  baixar(blobOuU8, nomeArquivo, mime)      (cria um link e clica)
//  async gravarWebm(desenharQuadro(ctx, i), n, fps, largura, altura) -> Blob | null
//
// ============================== FF.Imagem ==============================
//  "img" = {largura, altura, rgba: Uint8ClampedArray}
//  criar(largura, altura) -> img (transparente)
//  deCanvas(canvas) -> img                   paraCanvas(img) -> canvas        (navegador)
//  removerFundo(img, cor [r,g,b] | 'auto', tolerancia 0..255, opts {contiguo: false}) -> img
//  corDeFundo(img) -> [r,g,b,a]              (cor mais comum nas bordas; usada pelo 'auto')
//  corEm(img, x, y) -> [r,g,b,a]
//  aparar(img, limiarAlfa = 1) -> {img, x, y, largura, altura}
//  componentes(img, opts {limiarAlfa: 1, juntarDistancia: 2, minArea: 4}) -> [{x, y, w, h}]
//  grade(img, colunas, linhas, opts {margem: 0, espaco: 0, ignorarVazios: true}) -> [{x, y, w, h}]
//  detectarGrade(img) -> {colunas, linhas} | null
//  recortar(img, caixa {x, y, w, h}) -> img
//  escalar(img, fator, suave = false) -> img
//  empacotar(quadros: [img], opts {margem: 1, larguraMax: 2048}) -> {largura, altura, rgba, posicoes: [{x, y}]}
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var FF = root.FF = root.FF || {};

  // ------------------------------------------------------------------ utilidades
  var utf8Enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  function paraU8(x) {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    if (typeof x === 'string') return utf8Enc.encode(x);
    throw new Error('Esperava Uint8Array, ArrayBuffer ou texto.');
  }
  // Nomes no ZIP: UTF-8 (flag 11) ou, em ZIPs antigos, CP437 — lemos sempre como UTF-8 (ASCII é igual nos dois).
  function decodificarTexto(u8) { return new TextDecoder('utf-8').decode(u8); }
  function ordemNatural(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }

  // Descompacta com DecompressionStream ('deflate-raw' para ZIP, 'deflate' para zlib/PNG).
  function inflar(u8, formato) {
    if (typeof DecompressionStream === 'undefined')
      return Promise.reject(new Error('Este navegador não tem DecompressionStream: não dá para descompactar (' + formato + ').'));
    var fluxo = new Blob([u8]).stream().pipeThrough(new DecompressionStream(formato));
    return new Response(fluxo).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  // ------------------------------------------------------------------ CRC32
  var TABELA_CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8, inicio) {
    u8 = paraU8(u8);
    var c = (inicio === undefined ? 0 : inicio) ^ 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = TABELA_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ------------------------------------------------------------------ ZIP
  function zipLer(entrada) {
    return Promise.resolve().then(function () {
      var u8 = paraU8(entrada);
      var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      // Procura o "fim do diretório central" (EOCD) de trás para frente.
      var eocd = -1;
      for (var i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
        if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) throw new Error('Arquivo ZIP inválido (não achei o diretório central).');
      var total = dv.getUint16(eocd + 10, true);
      var pos = dv.getUint32(eocd + 16, true);
      if (pos === 0xFFFFFFFF || total === 0xFFFF) throw new Error('ZIP64 não é suportado.');
      var tarefas = [];
      for (var e = 0; e < total; e++) {
        if (dv.getUint32(pos, true) !== 0x02014b50) throw new Error('ZIP corrompido (entrada ' + e + ' do diretório central).');
        var flags = dv.getUint16(pos + 8, true);
        var metodo = dv.getUint16(pos + 10, true);
        var tamComp = dv.getUint32(pos + 20, true);
        var tamNome = dv.getUint16(pos + 28, true);
        var tamExtra = dv.getUint16(pos + 30, true);
        var tamComent = dv.getUint16(pos + 32, true);
        var local = dv.getUint32(pos + 42, true);
        var nome = decodificarTexto(u8.subarray(pos + 46, pos + 46 + tamNome));
        pos += 46 + tamNome + tamExtra + tamComent;
        if (/\/$/.test(nome)) continue; // pasta
        if (flags & 1) throw new Error('"' + nome + '" está criptografado; ZIP com senha não é suportado.');
        if (dv.getUint32(local, true) !== 0x04034b50) throw new Error('ZIP corrompido (cabeçalho local de "' + nome + '").');
        var ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        var bruto = u8.subarray(ini, ini + tamComp);
        tarefas.push(lerEntrada(nome, metodo, bruto));
      }
      return Promise.all(tarefas);
    });
  }
  function lerEntrada(nome, metodo, bruto) {
    if (metodo === 0) return Promise.resolve({ nome: nome, dados: bruto.slice() });
    if (metodo === 8) {
      if (typeof DecompressionStream === 'undefined')
        return Promise.reject(new Error('Este navegador não tem DecompressionStream: não dá para abrir o ZIP compactado ("' + nome + '").'));
      return inflar(bruto, 'deflate-raw').then(function (d) { return { nome: nome, dados: d }; });
    }
    return Promise.reject(new Error('"' + nome + '" usa o método de compressão ' + metodo + ', não suportado (só store e deflate).'));
  }

  function zipGravar(arquivos) {
    var agora = new Date();
    var hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
    var data = ((Math.max(1980, agora.getFullYear()) - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
    var partes = [], central = [], offset = 0;
    arquivos.forEach(function (a) {
      var nome = paraU8(String(a.nome));
      var dados = paraU8(a.dados);
      var crc = crc32(dados);
      var cab = new Uint8Array(30 + nome.length), dv = new DataView(cab.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x800, true);
      dv.setUint16(8, 0, true); dv.setUint16(10, hora, true); dv.setUint16(12, data, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, dados.length, true); dv.setUint32(22, dados.length, true);
      dv.setUint16(26, nome.length, true); dv.setUint16(28, 0, true); cab.set(nome, 30);
      var cen = new Uint8Array(46 + nome.length), dc = new DataView(cen.buffer);
      dc.setUint32(0, 0x02014b50, true); dc.setUint16(4, 20, true); dc.setUint16(6, 20, true);
      dc.setUint16(8, 0x800, true); dc.setUint16(10, 0, true); dc.setUint16(12, hora, true); dc.setUint16(14, data, true);
      dc.setUint32(16, crc, true); dc.setUint32(20, dados.length, true); dc.setUint32(24, dados.length, true);
      dc.setUint16(28, nome.length, true); dc.setUint32(42, offset, true); cen.set(nome, 46);
      partes.push(cab, dados); central.push(cen);
      offset += cab.length + dados.length;
    });
    var tamCentral = central.reduce(function (s, c) { return s + c.length; }, 0);
    var fim = new Uint8Array(22), df = new DataView(fim.buffer);
    df.setUint32(0, 0x06054b50, true); df.setUint16(8, arquivos.length, true); df.setUint16(10, arquivos.length, true);
    df.setUint32(12, tamCentral, true); df.setUint32(16, offset, true);
    return concatenar(partes.concat(central, [fim]));
  }
  function concatenar(lista) {
    var n = 0, i;
    for (i = 0; i < lista.length; i++) n += lista[i].length;
    var out = new Uint8Array(n), p = 0;
    for (i = 0; i < lista.length; i++) { out.set(lista[i], p); p += lista[i].length; }
    return out;
  }

  // ------------------------------------------------------------------ GIF: decodificador
  function lzwDecodificar(dados, minCodigo, nPixels) {
    var saida = new Uint8Array(nPixels);
    var prefixo = new Int16Array(4096), sufixo = new Uint8Array(4096), pilha = new Uint8Array(4097);
    var clear = 1 << minCodigo, eoi = clear + 1;
    for (var i = 0; i < clear; i++) sufixo[i] = i;
    var tam = minCodigo + 1, prox = eoi + 1, ant = -1, primeiro = 0;
    var bits = 0, acum = 0, p = 0, op = 0, n = dados.length;
    while (op < nPixels) {
      while (bits < tam) {
        if (p >= n) return saida; // dados acabaram (arquivo truncado): devolve o que tem
        acum |= dados[p++] << bits; bits += 8;
      }
      var cod = acum & ((1 << tam) - 1);
      acum >>>= tam; bits -= tam;
      if (cod === clear) { tam = minCodigo + 1; prox = eoi + 1; ant = -1; continue; }
      if (cod === eoi) break;
      if (ant === -1) {
        if (cod >= clear) break; // inválido
        saida[op++] = cod; ant = primeiro = cod; continue;
      }
      if (cod > prox) break; // inválido
      var topo = 0, c;
      if (cod === prox) { pilha[topo++] = primeiro; c = ant; } else c = cod;
      while (c > eoi) { pilha[topo++] = sufixo[c]; c = prefixo[c]; }
      primeiro = c; pilha[topo++] = c;
      while (topo > 0 && op < nPixels) saida[op++] = pilha[--topo];
      if (prox < 4096) {
        prefixo[prox] = ant; sufixo[prox] = primeiro; prox++;
        if (prox === (1 << tam) && tam < 12) tam++;
      }
      ant = cod;
    }
    return saida;
  }

  function gifDecodificar(entrada) {
    var u8 = paraU8(entrada), p = 0;
    var assin = String.fromCharCode(u8[0], u8[1], u8[2], u8[3], u8[4], u8[5]);
    if (assin !== 'GIF89a' && assin !== 'GIF87a') throw new Error('Não é um GIF válido.');
    var W = u8[6] | (u8[7] << 8), H = u8[8] | (u8[9] << 8), flags = u8[10];
    p = 13;
    var paletaGlobal = null;
    if (flags & 0x80) { var ng = 2 << (flags & 7); paletaGlobal = u8.subarray(p, p + ng * 3); p += ng * 3; }
    var tela = new Uint8ClampedArray(W * H * 4), salvo = null;
    var quadros = [], loop = null;
    var gce = null; // controle gráfico pendente
    var dispAnt = 0, rectAnt = null;
    function lerBlocos() {
      var partes = [], tot = 0;
      while (p < u8.length) {
        var t = u8[p++]; if (t === 0) break;
        partes.push(u8.subarray(p, p + t)); tot += t; p += t;
      }
      if (partes.length === 1) return partes[0];
      var out = new Uint8Array(tot), o = 0;
      for (var i = 0; i < partes.length; i++) { out.set(partes[i], o); o += partes[i].length; }
      return out;
    }
    while (p < u8.length) {
      var b = u8[p++];
      if (b === 0x3B) break;
      if (b === 0x21) {
        var rot = u8[p++];
        if (rot === 0xF9) {
          var tb = u8[p]; var pk = u8[p + 1];
          gce = { disposal: (pk >> 2) & 7, temTransp: (pk & 1) !== 0, atraso: u8[p + 2] | (u8[p + 3] << 8), transp: u8[p + 4] };
          p += 1 + tb; lerBlocos();
        } else if (rot === 0xFF) {
          var tamApp = u8[p++];
          var id = String.fromCharCode.apply(null, u8.subarray(p, p + tamApp));
          p += tamApp;
          var dadosApp = lerBlocos();
          if ((id === 'NETSCAPE2.0' || id === 'ANIMEXTS1.0') && dadosApp.length >= 3 && dadosApp[0] === 1)
            loop = dadosApp[1] | (dadosApp[2] << 8);
        } else lerBlocos();
        continue;
      }
      if (b !== 0x2C) break; // byte inesperado: para por aqui
      var fx = u8[p] | (u8[p + 1] << 8), fy = u8[p + 2] | (u8[p + 3] << 8);
      var fw = u8[p + 4] | (u8[p + 5] << 8), fh = u8[p + 6] | (u8[p + 7] << 8), ff = u8[p + 8];
      p += 9;
      var paleta = paletaGlobal;
      if (ff & 0x80) { var nl = 2 << (ff & 7); paleta = u8.subarray(p, p + nl * 3); p += nl * 3; }
      var entrelacado = (ff & 0x40) !== 0;
      var minCod = u8[p++];
      var idx = lzwDecodificar(lerBlocos(), minCod, fw * fh);
      // aplica o disposal do quadro anterior
      if (rectAnt) {
        if (dispAnt === 2) limparRet(tela, W, H, rectAnt);
        else if (dispAnt === 3 && salvo) tela.set(salvo);
      }
      var disp = gce ? gce.disposal : 0;
      if (disp === 3) salvo = tela.slice();
      var transp = gce && gce.temTransp ? gce.transp : -1;
      // desenha
      var passos = entrelacado ? [[0, 8], [4, 8], [2, 4], [1, 2]] : [[0, 1]];
      var linhaSrc = 0, np = paleta ? paleta.length / 3 : 0;
      for (var ps = 0; ps < passos.length; ps++) {
        for (var ly = passos[ps][0]; ly < fh; ly += passos[ps][1]) {
          var ty = fy + ly, base = linhaSrc * fw; linhaSrc++;
          if (ty >= H) continue;
          for (var lx = 0; lx < fw; lx++) {
            var tx = fx + lx; if (tx >= W) break;
            var ci = idx[base + lx];
            if (ci === transp || ci >= np) continue;
            var o4 = (ty * W + tx) * 4;
            tela[o4] = paleta[ci * 3]; tela[o4 + 1] = paleta[ci * 3 + 1]; tela[o4 + 2] = paleta[ci * 3 + 2]; tela[o4 + 3] = 255;
          }
        }
      }
      var atraso = gce ? gce.atraso / 100 : 0;
      quadros.push({ rgba: tela.slice(), atraso: atraso > 0 ? atraso : 0.1 });
      dispAnt = disp; rectAnt = { x: fx, y: fy, w: fw, h: fh };
      gce = null;
    }
    return { largura: W, altura: H, quadros: quadros, loop: loop };
  }
  function limparRet(rgba, W, H, r) {
    for (var y = r.y; y < Math.min(H, r.y + r.h); y++) {
      var ini = (y * W + r.x) * 4, fim = (y * W + Math.min(W, r.x + r.w)) * 4;
      rgba.fill(0, ini, fim);
    }
  }

  // ------------------------------------------------------------------ GIF: codificador
  // Quantização: lista de rgba -> {paleta: Uint8Array (k*3), mapa(r,g,b)->índice}. Ignora pixels com alfa < 128.
  function quantizar(listaRgba, maxCores) {
    var unicas = new Map(), estourou = false, li, i, rgba, k;
    for (li = 0; li < listaRgba.length && !estourou; li++) {
      rgba = listaRgba[li];
      for (i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3] < 128) continue;
        k = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
        if (!unicas.has(k)) {
          if (unicas.size >= maxCores) { estourou = true; break; }
          unicas.set(k, unicas.size);
        }
      }
    }
    if (!estourou) {
      var pal = new Uint8Array(unicas.size * 3);
      unicas.forEach(function (ind, cor) { pal[ind * 3] = cor >> 16; pal[ind * 3 + 1] = (cor >> 8) & 255; pal[ind * 3 + 2] = cor & 255; });
      return { paleta: pal, n: unicas.size, indice: function (r, g, b) { return unicas.get((r << 16) | (g << 8) | b); } };
    }
    // Median cut sobre um histograma de 15 bits (5 por canal).
    var cont = new Float64Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768);
    for (li = 0; li < listaRgba.length; li++) {
      rgba = listaRgba[li];
      for (i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3] < 128) continue;
        k = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
        cont[k]++; sr[k] += rgba[i]; sg[k] += rgba[i + 1]; sb[k] += rgba[i + 2];
      }
    }
    var bins = [];
    for (k = 0; k < 32768; k++) if (cont[k] > 0) bins.push(k);
    bins = Int32Array.from(bins);
    function canal(bin, c) { return c === 0 ? bin >> 10 : c === 1 ? (bin >> 5) & 31 : bin & 31; }
    function caixa(ini, fim) {
      var mn = [31, 31, 31], mx = [0, 0, 0], tot = 0;
      for (var j = ini; j < fim; j++) {
        var bn = bins[j];
        for (var c = 0; c < 3; c++) { var v = canal(bn, c); if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
        tot += cont[bn];
      }
      var eixo = 0, amp = -1;
      for (var c2 = 0; c2 < 3; c2++) if (mx[c2] - mn[c2] > amp) { amp = mx[c2] - mn[c2]; eixo = c2; }
      return { ini: ini, fim: fim, eixo: eixo, amp: amp, tot: tot };
    }
    var caixas = [caixa(0, bins.length)];
    while (caixas.length < maxCores) {
      var melhor = -1, nota = 0;
      for (i = 0; i < caixas.length; i++) {
        var cx = caixas[i];
        if (cx.fim - cx.ini < 2 || cx.amp <= 0) continue;
        var s = cx.amp * Math.sqrt(cx.tot);
        if (s > nota) { nota = s; melhor = i; }
      }
      if (melhor < 0) break;
      var cb = caixas[melhor], e = cb.eixo;
      var sub = Array.prototype.slice.call(bins.subarray(cb.ini, cb.fim));
      sub.sort(function (a, b) { return canal(a, e) - canal(b, e); });
      bins.set(sub, cb.ini);
      var meio = cb.tot / 2, acum = 0, corte = cb.ini + 1;
      for (i = cb.ini; i < cb.fim - 1; i++) { acum += cont[bins[i]]; if (acum >= meio) { corte = i + 1; break; } corte = i + 1; }
      caixas.splice(melhor, 1, caixa(cb.ini, corte), caixa(corte, cb.fim));
    }
    var paleta = new Uint8Array(caixas.length * 3), mapaBin = new Int16Array(32768).fill(-1);
    caixas.forEach(function (cx, ci) {
      var t = 0, r = 0, g = 0, b = 0;
      for (var j = cx.ini; j < cx.fim; j++) { var bn = bins[j]; t += cont[bn]; r += sr[bn]; g += sg[bn]; b += sb[bn]; mapaBin[bn] = ci; }
      paleta[ci * 3] = Math.round(r / t); paleta[ci * 3 + 1] = Math.round(g / t); paleta[ci * 3 + 2] = Math.round(b / t);
    });
    var nc = caixas.length;
    return {
      paleta: paleta, n: nc,
      indice: function (r, g, b) {
        var bn = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        var ci = mapaBin[bn];
        if (ci < 0) { // cor fora do histograma (não acontece com a mesma imagem, mas por segurança): mais próxima
          var md = 1e9;
          for (var j = 0; j < nc; j++) {
            var dr = paleta[j * 3] - r, dg = paleta[j * 3 + 1] - g, db = paleta[j * 3 + 2] - b, d = dr * dr + dg * dg + db * db;
            if (d < md) { md = d; ci = j; }
          }
          mapaBin[bn] = ci;
        }
        return ci;
      }
    };
  }

  // Tabelas do LZW reaproveitadas entre chamadas (código + "geração" para limpar em O(1)).
  var lzwTab = null, lzwGer = null, lzwGeracao = 0;
  function lzwCodificar(indices, minCodigo) {
    if (!lzwTab) { lzwTab = new Int32Array(4096 * 256); lzwGer = new Int32Array(4096 * 256); }
    // saída em sub-blocos de até 255 bytes: [tamanho][dados...]; buffer que cresce conforme a necessidade
    var saida = new Uint8Array(4096), ns = 2, posTam = 1, nb = 0;
    saida[0] = minCodigo;
    var acum = 0, bits = 0;
    function byte(v) {
      if (ns + 2 >= saida.length) { var maior = new Uint8Array(saida.length * 2); maior.set(saida); saida = maior; }
      saida[ns++] = v; nb++;
      if (nb === 255) { saida[posTam] = 255; posTam = ns++; nb = 0; }
    }
    function emitir(cod, tam) {
      acum |= cod << bits; bits += tam;
      while (bits >= 8) { byte(acum & 255); acum >>>= 8; bits -= 8; }
    }
    var clear = 1 << minCodigo, eoi = clear + 1, tam = minCodigo + 1, prox = eoi + 1;
    lzwGeracao++;
    emitir(clear, tam);
    var n = indices.length;
    if (n > 0) {
      var atual = indices[0];
      for (var i = 1; i < n; i++) {
        var k = indices[i], chave = (atual << 8) | k;
        if (lzwGer[chave] === lzwGeracao) { atual = lzwTab[chave]; continue; }
        emitir(atual, tam);
        if (prox === 4096) {
          emitir(clear, tam);
          tam = minCodigo + 1; prox = eoi + 1; lzwGeracao++;
        } else {
          if (prox >= (1 << tam)) tam++;
          lzwTab[chave] = prox++; lzwGer[chave] = lzwGeracao;
        }
        atual = k;
      }
      emitir(atual, tam);
    }
    emitir(eoi, tam);
    if (bits > 0) byte(acum & 255);
    if (ns + 1 >= saida.length) { var m2 = new Uint8Array(saida.length + 2); m2.set(saida); saida = m2; }
    if (nb > 0) { saida[posTam] = nb; saida[ns++] = 0; } // fecha o último sub-bloco + terminador
    else saida[posTam] = 0;                               // o "tamanho" reservado vira o terminador
    if (lzwGeracao > 2e9) { lzwGer.fill(0); lzwGeracao = 0; }
    return saida.slice(0, ns);
  }

  function gifCodificar(quadros, opts) {
    opts = opts || {};
    var usarTransp = opts.transparente !== false;
    var loop = opts.loop === undefined ? true : opts.loop;
    if (!quadros.length) throw new Error('gifCodificar: nenhum quadro.');
    var W = 0, H = 0;
    quadros.forEach(function (q) { W = Math.max(W, q.largura); H = Math.max(H, q.altura); });
    // Normaliza: alfa >= 128 vira opaco; sem transparência, alfa baixo vira preto opaco.
    var temTransp = false;
    var listas = quadros.map(function (q) {
      var src = q.rgba;
      if (!usarTransp) {
        var c = new Uint8ClampedArray(src.length);
        for (var i = 0; i < src.length; i += 4) {
          if (src[i + 3] < 128) { c[i + 3] = 255; } else { c[i] = src[i]; c[i + 1] = src[i + 1]; c[i + 2] = src[i + 2]; c[i + 3] = 255; }
        }
        return c;
      }
      for (var j = 3; j < src.length; j += 4) if (src[j] < 128) { temTransp = true; break; }
      return src;
    });
    // quadros menores que a tela deixam área descoberta, que precisa ser transparente
    if (usarTransp && quadros.some(function (q) { return q.largura !== W || q.altura !== H; })) temTransp = true;
    var maxCores = temTransp ? 255 : 256;
    var partes = [];
    var cab = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, W & 255, W >> 8, H & 255, H >> 8];
    var global = opts.paletaGlobal ? quantizar(listas, maxCores) : null;
    function paletaPotencia(q) {
      var nCores = q.n + (temTransp ? 1 : 0), bitsP = 1;
      while ((1 << bitsP) < nCores) bitsP++;
      var tab = new Uint8Array((1 << bitsP) * 3); tab.set(q.paleta);
      return { tab: tab, bits: bitsP };
    }
    var pg = global ? paletaPotencia(global) : null;
    if (pg) cab.push(0x80 | 0x70 | (pg.bits - 1), 0, 0); else cab.push(0x70, 0, 0);
    partes.push(Uint8Array.from(cab));
    if (pg) partes.push(pg.tab);
    if (loop !== false && loop !== null && quadros.length > 1) {
      var vezes = loop === true ? 0 : (loop | 0);
      partes.push(Uint8Array.from([0x21, 0xFF, 0x0B, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1, vezes & 255, vezes >> 8, 0]));
    }
    var disposal = temTransp ? 2 : 1;
    quadros.forEach(function (q, qi) {
      var rgba = listas[qi];
      var quant = global || quantizar([rgba], maxCores);
      var pl = global ? pg : paletaPotencia(quant);
      var iTransp = temTransp ? quant.n : 0;
      var idx = new Uint8Array(W * H);
      if (temTransp) idx.fill(iTransp);
      var ultimaCor = -1, ultimoInd = 0;
      for (var y = 0; y < q.altura; y++) {
        for (var x = 0; x < q.largura; x++) {
          var o = (y * q.largura + x) * 4;
          if (rgba[o + 3] < 128) continue;
          var cor = (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2];
          if (cor !== ultimaCor) { ultimaCor = cor; ultimoInd = quant.indice(rgba[o], rgba[o + 1], rgba[o + 2]); }
          idx[y * W + x] = ultimoInd;
        }
      }
      var atraso = Math.max(0, Math.round((q.atraso === undefined ? 0.1 : q.atraso) * 100));
      partes.push(Uint8Array.from([0x21, 0xF9, 4, (disposal << 2) | (temTransp ? 1 : 0), atraso & 255, atraso >> 8, iTransp, 0]));
      var desc = [0x2C, 0, 0, 0, 0, W & 255, W >> 8, H & 255, H >> 8, global ? 0 : (0x80 | (pl.bits - 1))];
      partes.push(Uint8Array.from(desc));
      if (!global) partes.push(pl.tab);
      partes.push(lzwCodificar(idx, Math.max(2, pl.bits)));
    });
    partes.push(Uint8Array.from([0x3B]));
    return concatenar(partes);
  }

  // ------------------------------------------------------------------ PNG / APNG
  function pngQuadros(entrada) {
    var u8 = paraU8(entrada);
    var sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (var s = 0; s < 8; s++) if (u8[s] !== sig[s]) return Promise.resolve(null);
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var p = 8, ih = null, plte = null, trns = null, actl = null, fcAtual = null;
    var quadros = [], padrao = []; // padrao = IDAT quando não faz parte da animação
    while (p + 8 <= u8.length) {
      var len = dv.getUint32(p), tipo = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
      var d = u8.subarray(p + 8, p + 8 + len);
      p += 12 + len;
      if (tipo === 'IHDR') {
        ih = { w: dv.getUint32(p - 12 - len + 8), h: dv.getUint32(p - 12 - len + 12), prof: d[8], cor: d[9], entrelacado: d[12] };
      } else if (tipo === 'PLTE') plte = d;
      else if (tipo === 'tRNS') trns = d;
      else if (tipo === 'acTL') actl = { n: lerU32(d, 0), loop: lerU32(d, 4) };
      else if (tipo === 'fcTL') {
        fcAtual = { w: lerU32(d, 4), h: lerU32(d, 8), x: lerU32(d, 12), y: lerU32(d, 16),
          num: (d[20] << 8) | d[21], den: (d[22] << 8) | d[23], dispose: d[24], blend: d[25], partes: [] };
        quadros.push(fcAtual);
      } else if (tipo === 'IDAT') {
        // IDAT depois de um fcTL = quadro 0 da animação; antes = imagem padrão fora da animação
        if (actl && fcAtual) fcAtual.partes.push(d); else padrao.push(d);
      } else if (tipo === 'fdAT') { if (fcAtual) fcAtual.partes.push(d.subarray(4)); }
      else if (tipo === 'IEND') break;
    }
    if (!ih || ih.entrelacado) return Promise.resolve(null);
    if (!actl || !quadros.length) {
      quadros = [{ w: ih.w, h: ih.h, x: 0, y: 0, num: 0, den: 0, dispose: 0, blend: 0, partes: padrao }];
    }
    var W = ih.w, H = ih.h;
    return Promise.all(quadros.map(function (q) { return inflar(concatenar(q.partes), 'deflate'); })).then(function (brutos) {
      var tela = new Uint8ClampedArray(W * H * 4), saida = [];
      quadros.forEach(function (q, qi) {
        var px = pngParaRgba(brutos[qi], q.w, q.h, ih, plte, trns);
        var antes = q.dispose === 2 ? tela.slice() : null;
        for (var y = 0; y < q.h; y++) {
          var ty = q.y + y; if (ty >= H) break;
          for (var x = 0; x < q.w; x++) {
            var tx = q.x + x; if (tx >= W) break;
            var so = (y * q.w + x) * 4, to = (ty * W + tx) * 4, sa = px[so + 3];
            if (q.blend === 0 || sa === 255) { tela[to] = px[so]; tela[to + 1] = px[so + 1]; tela[to + 2] = px[so + 2]; tela[to + 3] = sa; }
            else if (sa > 0) {
              var a = sa / 255, da = tela[to + 3] / 255, oa = a + da * (1 - a);
              for (var c = 0; c < 3; c++) tela[to + c] = (px[so + c] * a + tela[to + c] * da * (1 - a)) / oa;
              tela[to + 3] = oa * 255;
            }
          }
        }
        var den = q.den || 100;
        saida.push({ rgba: tela.slice(), atraso: actl ? (q.num / den || 0.1) : 0 });
        if (q.dispose === 1 || (q.dispose === 2 && qi === 0)) limparRet(tela, W, H, { x: q.x, y: q.y, w: q.w, h: q.h });
        else if (q.dispose === 2) tela.set(antes);
      });
      return { largura: W, altura: H, quadros: saida, loop: actl ? actl.loop : null };
    });
  }
  function lerU32(d, o) { return ((d[o] << 24) >>> 0) + (d[o + 1] << 16) + (d[o + 2] << 8) + d[o + 3]; }
  function pngParaRgba(bruto, w, h, ih, plte, trns) {
    var canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ih.cor], prof = ih.prof;
    var bitsPx = canais * prof, bpp = Math.max(1, bitsPx >> 3), linha = (w * bitsPx + 7) >> 3;
    var atual = new Uint8Array(linha), anterior = new Uint8Array(linha);
    var out = new Uint8ClampedArray(w * h * 4), p = 0;
    var tGray = trns && ih.cor === 0 ? (trns[0] << 8) | trns[1] : -1;
    var tR = -1, tG = -1, tB = -1;
    if (trns && ih.cor === 2) { tR = (trns[0] << 8) | trns[1]; tG = (trns[2] << 8) | trns[3]; tB = (trns[4] << 8) | trns[5]; }
    var escala = prof < 8 ? 255 / ((1 << prof) - 1) : 1;
    for (var y = 0; y < h; y++) {
      var filtro = bruto[p++];
      for (var i = 0; i < linha; i++) {
        var x = bruto[p++] || 0, a = i >= bpp ? atual[i - bpp] : 0, b = anterior[i], c = i >= bpp ? anterior[i - bpp] : 0, v;
        switch (filtro) {
          case 1: v = x + a; break;
          case 2: v = x + b; break;
          case 3: v = x + ((a + b) >> 1); break;
          case 4: var pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
            v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break;
          default: v = x;
        }
        atual[i] = v;
      }
      for (var px = 0; px < w; px++) {
        var o = (y * w + px) * 4, r, g, bl, al = 255;
        if (prof === 16) {
          var q = px * canais * 2;
          var s0 = (atual[q] << 8) | atual[q + 1];
          if (ih.cor === 0) { r = g = bl = atual[q]; if (s0 === tGray) al = 0; }
          else if (ih.cor === 4) { r = g = bl = atual[q]; al = atual[q + 2]; }
          else if (ih.cor === 2) { r = atual[q]; g = atual[q + 2]; bl = atual[q + 4];
            if (s0 === tR && ((atual[q + 2] << 8) | atual[q + 3]) === tG && ((atual[q + 4] << 8) | atual[q + 5]) === tB) al = 0; }
          else { r = atual[q]; g = atual[q + 2]; bl = atual[q + 4]; al = atual[q + 6]; }
        } else if (prof < 8) {
          var bitPos = px * prof, byteV = atual[bitPos >> 3];
          var val = (byteV >> (8 - prof - (bitPos & 7))) & ((1 << prof) - 1);
          if (ih.cor === 3) { r = plte[val * 3]; g = plte[val * 3 + 1]; bl = plte[val * 3 + 2]; al = trns && val < trns.length ? trns[val] : 255; }
          else { r = g = bl = val * escala; if (val === tGray) al = 0; }
        } else {
          var k = px * canais;
          switch (ih.cor) {
            case 0: r = g = bl = atual[k]; if (atual[k] === tGray) al = 0; break;
            case 2: r = atual[k]; g = atual[k + 1]; bl = atual[k + 2]; if (r === tR && g === tG && bl === tB) al = 0; break;
            case 3: var vi = atual[k]; r = plte[vi * 3]; g = plte[vi * 3 + 1]; bl = plte[vi * 3 + 2]; al = trns && vi < trns.length ? trns[vi] : 255; break;
            case 4: r = g = bl = atual[k]; al = atual[k + 1]; break;
            default: r = atual[k]; g = atual[k + 1]; bl = atual[k + 2]; al = atual[k + 3];
          }
        }
        out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = al;
      }
      var t = anterior; anterior = atual; atual = t;
    }
    return out;
  }

  // ------------------------------------------------------------------ detecção de tipo
  var MIMES = { gif: 'image/gif', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', bmp: 'image/bmp', ico: 'image/x-icon',
    svg: 'image/svg+xml', avif: 'image/avif', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    zip: 'application/zip', json: 'application/json' };
  var EXTENSOES = { gif: 'gif', png: 'png', apng: 'png', webp: 'webp', jpg: 'jpg', jpeg: 'jpg', jfif: 'jpg', bmp: 'bmp', ico: 'ico', cur: 'ico',
    svg: 'svg', avif: 'avif', heic: 'heic', heif: 'heic', mp4: 'mp4', m4v: 'mp4', mov: 'mov', webm: 'webm', mkv: 'webm',
    zip: 'zip', json: 'json', ogv: 'webm' };
  function detectarTipo(entrada, nome, mime) {
    var u8 = paraU8(entrada);
    function asc(o, n) { return String.fromCharCode.apply(null, u8.subarray(o, o + n)); }
    if (u8.length >= 4) {
      if (asc(0, 4) === 'GIF8') return 'gif';
      if (u8[0] === 0x89 && asc(1, 3) === 'PNG') return 'png';
      if (asc(0, 4) === 'RIFF' && asc(8, 4) === 'WEBP') return 'webp';
      if (u8[0] === 0xFF && u8[1] === 0xD8) return 'jpg';
      if (u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 3 && u8[3] === 4) return 'zip';
      if (u8[0] === 0x1A && u8[1] === 0x45 && u8[2] === 0xDF && u8[3] === 0xA3) return 'webm';
      if (asc(4, 4) === 'ftyp') {
        var marca = asc(8, 4);
        if (marca === 'avif' || marca === 'avis') return 'avif';
        if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(marca)) return 'heic';
        if (marca === 'qt  ') return 'mov';
        return 'mp4';
      }
      if (u8[0] === 0 && u8[1] === 0 && (u8[2] === 1 || u8[2] === 2) && u8[3] === 0) return 'ico';
      if (u8[0] === 0x42 && u8[1] === 0x4D) return 'bmp';
      var ini = asc(0, Math.min(u8.length, 512)).replace(/^﻿/, '').replace(/^[\sï»¿]+/, '');
      if (/^<svg[\s>]/i.test(ini) || (/^<\?xml/i.test(ini) && /<svg[\s>]/i.test(ini)) || (/^<!DOCTYPE svg/i.test(ini))) return 'svg';
      if (/^[\[{]/.test(ini)) return 'json';
    }
    var ext = nome ? String(nome).toLowerCase().split('.').pop() : '';
    if (EXTENSOES[ext]) return EXTENSOES[ext];
    mime = mime || '';
    for (var t in MIMES) if (MIMES[t] === mime) return t;
    if (/^video\//.test(mime)) return 'mp4';
    if (/svg/.test(mime)) return 'svg';
    if (/json/.test(mime)) return 'json';
    return 'desconhecido';
  }
  var TIPOS_VIDEO = { mp4: 1, mov: 1, webm: 1 };
  var TIPOS_IMAGEM = { gif: 1, png: 1, webp: 1, jpg: 1, bmp: 1, ico: 1, svg: 1, avif: 1, heic: 1 };

  // ------------------------------------------------------------------ navegador: canvas
  function novoCanvas(w, h) {
    var c;
    if (typeof document !== 'undefined') { c = document.createElement('canvas'); c.width = w; c.height = h; }
    else if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(w, h);
    else throw new Error('Sem canvas neste ambiente.');
    return c;
  }
  function rgbaParaCanvas(rgba, w, h) {
    var c = novoCanvas(w, h);
    c.getContext('2d').putImageData(new ImageData(rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba), w, h), 0, 0);
    return c;
  }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // tam: {w, h} forçado (SVG sem largura/altura)
  function carregarImg(blob, tam) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var w = im.naturalWidth || 0, h = im.naturalHeight || 0;
        if (tam) { w = tam.w; h = tam.h; }
        if (!w || !h) { URL.revokeObjectURL(url); falha(new Error('Imagem sem tamanho.')); return; }
        var c = novoCanvas(w, h);
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url); ok(c);
      };
      im.onerror = function () { URL.revokeObjectURL(url); falha(new Error('O navegador não conseguiu abrir esta imagem.')); };
      im.src = url;
    });
  }
  function decodificarEstatica(blob, tipo) {
    if (tipo === 'svg') {
      return blob.text().then(function (txt) {
        // sem width/height o navegador usaria 300x150: usa 256 no lado maior, mantendo a proporção do viewBox
        var tag = (txt.match(/<svg\b[^>]*>/i) || [''])[0], tam = null;
        var temW = /\swidth\s*=\s*["']?\s*\d/i.test(tag), temH = /\sheight\s*=\s*["']?\s*\d/i.test(tag);
        if (!temW || !temH) {
          var vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
          var pw = vb ? parseFloat(vb[1]) : 1, ph = vb ? parseFloat(vb[2]) : 1;
          if (!(pw > 0 && ph > 0)) { pw = ph = 1; }
          tam = pw >= ph ? { w: 256, h: Math.max(1, Math.round(256 * ph / pw)) } : { w: Math.max(1, Math.round(256 * pw / ph)), h: 256 };
        }
        return carregarImg(new Blob([txt], { type: 'image/svg+xml' }), tam);
      });
    }
    var b2 = blob.type ? blob : new Blob([blob], { type: MIMES[tipo] || '' });
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(b2).then(function (bmp) {
        var c = novoCanvas(bmp.width, bmp.height);
        c.getContext('2d').drawImage(bmp, 0, 0);
        if (bmp.close) bmp.close();
        return c;
      }, function () { return carregarImg(b2, null); });
    }
    return carregarImg(b2, null);
  }

  function decodificarComImageDecoder(buf, mime, opts) {
    var dec = new ImageDecoder({ data: buf, type: mime });
    return dec.tracks.ready.then(function () { return dec.completed.catch(function () {}); }).then(function () {
      // escolhe a track com mais quadros (ex.: AVIF com imagem fixa + animação)
      var melhor = dec.tracks.selectedTrack, idxMelhor = -1;
      for (var t = 0; t < dec.tracks.length; t++) {
        var tr = dec.tracks[t];
        if (!melhor || tr.frameCount > melhor.frameCount) { melhor = tr; idxMelhor = t; }
      }
      if (idxMelhor >= 0 && !melhor.selected) melhor.selected = true;
      var n = Math.min(melhor ? melhor.frameCount : 1, opts.maxQuadros), quadros = [];
      var i = 0;
      function proximo() {
        if (i >= n) { dec.close(); return quadros; }
        return dec.decode({ frameIndex: i }).then(function (r) {
          var vf = r.image, w = vf.displayWidth, h = vf.displayHeight;
          var c = novoCanvas(w, h);
          c.getContext('2d').drawImage(vf, 0, 0, w, h);
          var dur = vf.duration ? vf.duration / 1e6 : 0;
          vf.close();
          quadros.push({ canvas: c, atraso: dur > 0 ? dur : 0.1 });
          i++;
          if (opts.aoProgresso) opts.aoProgresso(i / n);
          return proximo();
        });
      }
      return proximo();
    });
  }

  function decodificarImagem(blob, buf, tipo, nome, opts) {
    var mime = MIMES[tipo];
    var animavel = tipo === 'gif' || tipo === 'png' || tipo === 'webp' || tipo === 'avif';
    var viaDecoder = (animavel && typeof ImageDecoder !== 'undefined')
      ? ImageDecoder.isTypeSupported(mime).catch(function () { return false; }) : Promise.resolve(false);
    return viaDecoder.then(function (suporta) {
      if (suporta) return decodificarComImageDecoder(buf, mime, opts).catch(function () { return null; });
      return null;
    }).then(function (quadros) {
      if (quadros && quadros.length) return quadros;
      if (tipo === 'gif') {
        try {
          var g = gifDecodificar(buf);
          return g.quadros.slice(0, opts.maxQuadros).map(function (q) { return { canvas: rgbaParaCanvas(q.rgba, g.largura, g.altura), atraso: q.atraso }; });
        } catch (e) { /* cai no estático */ }
      }
      var apng = tipo === 'png' && typeof DecompressionStream !== 'undefined' && temChunk(buf, 'acTL') ? pngQuadros(buf).catch(function () { return null; }) : Promise.resolve(null);
      return apng.then(function (pq) {
        if (pq && pq.quadros.length) return pq.quadros.slice(0, opts.maxQuadros).map(function (q) { return { canvas: rgbaParaCanvas(q.rgba, pq.largura, pq.altura), atraso: q.atraso || 0.1 }; });
        return decodificarEstatica(blob, tipo).then(function (c) { return [{ canvas: c, atraso: 0.1 }]; });
      });
    }).then(function (quadros) {
      return { nome: nome, largura: quadros[0].canvas.width, altura: quadros[0].canvas.height, quadros: quadros };
    });
  }
  function temChunk(u8, nomeChunk) {
    var p = 8, dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    while (p + 8 <= u8.length) {
      var t = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
      if (t === nomeChunk) return true;
      if (t === 'IDAT') return false;
      p += 12 + dv.getUint32(p);
    }
    return false;
  }

  function esperarEvento(alvo, evento, ms, erroMsg) {
    return new Promise(function (ok, falha) {
      var tm = setTimeout(function () { limpar(); ms && erroMsg ? falha(new Error(erroMsg)) : ok(); }, ms || 5000);
      function fim() { limpar(); ok(); }
      function erro() { limpar(); falha(new Error(erroMsg || 'Erro ao abrir o vídeo.')); }
      function limpar() { clearTimeout(tm); alvo.removeEventListener(evento, fim); alvo.removeEventListener('error', erro); }
      alvo.addEventListener(evento, fim);
      alvo.addEventListener('error', erro);
    });
  }
  function decodificarVideo(blob, nome, opts) {
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    var url = URL.createObjectURL(blob);
    var msg = 'O navegador não conseguiu abrir este vídeo ("' + nome + '"). Tente converter para MP4 (H.264) ou WebM.';
    var meta = esperarEvento(v, 'loadeddata', 15000, msg);
    v.src = url;
    var fps = opts.fps || 12;
    return meta.then(function () {
      if (isFinite(v.duration) && v.duration > 0) return;
      // WebM gravado pelo MediaRecorder não traz duração: força o navegador a calculá-la
      var p = esperarEvento(v, 'seeked', 5000);
      v.currentTime = 1e7;
      return p.then(function () { var p2 = esperarEvento(v, 'seeked', 5000); v.currentTime = 0; return p2; });
    }).then(function () {
      var w = v.videoWidth, h = v.videoHeight;
      if (!w || !h) throw new Error(msg);
      var dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1 / fps;
      var n = Math.max(1, Math.min(opts.maxQuadros, Math.floor(dur * fps + 1e-6) || 1));
      var quadros = [], i = 0;
      function proximo() {
        if (i >= n) return quadros;
        var t = Math.min(i / fps, Math.max(0, dur - 0.001));
        var p = esperarEvento(v, 'seeked', 5000);
        v.currentTime = t;
        return p.then(function () {
          var c = novoCanvas(w, h);
          c.getContext('2d').drawImage(v, 0, 0, w, h);
          quadros.push({ canvas: c, atraso: 1 / fps });
          i++;
          if (opts.aoProgresso) opts.aoProgresso(i / n);
          return proximo();
        });
      }
      return proximo().then(function (q) { return { nome: nome, largura: w, altura: h, quadros: q }; });
    }).then(function (r) { URL.revokeObjectURL(url); v.removeAttribute('src'); return r; },
      function (e) { URL.revokeObjectURL(url); throw e; });
  }

  function decodificarArquivo(arquivo, opts) {
    opts = Object.assign({ fps: 12, maxQuadros: 300, aoProgresso: null }, opts || {});
    var nome = arquivo.name || 'arquivo';
    return arquivo.arrayBuffer().then(function (ab) {
      var buf = new Uint8Array(ab);
      var tipo = detectarTipo(buf, nome, arquivo.type);
      if (tipo === 'json') return { tipo: 'json', texto: new TextDecoder('utf-8').decode(buf) };
      if (tipo === 'zip') {
        return zipLer(buf).then(function (lista) {
          var imgs = lista.filter(function (e) {
            var t = detectarTipo(e.dados, e.nome);
            return TIPOS_IMAGEM[t] && !/(^|\/)(__MACOSX|\.)/.test(e.nome);
          }).sort(function (a, b) { return ordemNatural(a.nome, b.nome); });
          if (!imgs.length) throw new Error('O ZIP não tem nenhuma imagem.');
          var itens = [], k = 0;
          function proximo() {
            if (k >= imgs.length) return { tipo: 'zip', itens: itens };
            var e = imgs[k], t = detectarTipo(e.dados, e.nome);
            var sub = Object.assign({}, opts, { aoProgresso: null });
            return decodificarImagem(new Blob([e.dados], { type: MIMES[t] }), e.dados, t, e.nome, sub).then(function (it) {
              itens.push(it); k++;
              if (opts.aoProgresso) opts.aoProgresso(k / imgs.length);
              return proximo();
            });
          }
          return proximo();
        });
      }
      if (TIPOS_VIDEO[tipo] || (/^video\//.test(arquivo.type || '') && !TIPOS_IMAGEM[tipo])) {
        if (typeof document === 'undefined') throw new Error('Vídeo só pode ser lido no navegador.');
        return decodificarVideo(arquivo, nome, opts).then(function (it) { return { tipo: 'video', itens: [it] }; });
      }
      if (TIPOS_IMAGEM[tipo] || tipo === 'desconhecido') {
        return decodificarImagem(arquivo, buf, tipo, nome, opts).then(function (it) {
          return { tipo: it.quadros.length > 1 ? 'animacao' : 'imagem', itens: [it] };
        }, function (e) {
          throw tipo === 'desconhecido' ? new Error('Formato de arquivo não reconhecido: "' + nome + '".') : e;
        });
      }
      throw new Error('Formato de arquivo não reconhecido: "' + nome + '".');
    });
  }

  function canvasParaPng(canvas) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/png' });
    return new Promise(function (ok, falha) {
      canvas.toBlob(function (b) { b ? ok(b) : falha(new Error('Não foi possível gerar o PNG.')); }, 'image/png');
    });
  }
  function baixar(dados, nomeArquivo, mime) {
    var blob = dados instanceof Blob ? dados : new Blob([paraU8(dados)], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nomeArquivo || 'arquivo';
    a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function gravarWebm(desenharQuadro, n, fps, largura, altura) {
    if (typeof MediaRecorder === 'undefined' || typeof document === 'undefined') return Promise.resolve(null);
    var c = novoCanvas(largura, altura);
    if (!c.captureStream) return Promise.resolve(null);
    var tipo = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0];
    if (!tipo) return Promise.resolve(null);
    var ctx = c.getContext('2d');
    var stream = c.captureStream(0), trilha = stream.getVideoTracks()[0];
    var rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 8e6 }), pedacos = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) pedacos.push(e.data); };
    var parou = new Promise(function (ok) { rec.onstop = ok; });
    rec.start();
    var i = 0, inicio = performance.now();
    function proximo() {
      if (i >= n) {
        return esperar(1000 / fps).then(function () { rec.stop(); trilha.stop(); return parou; })
          .then(function () { return new Blob(pedacos, { type: 'video/webm' }); });
      }
      ctx.clearRect(0, 0, largura, altura);
      desenharQuadro(ctx, i);
      if (trilha.requestFrame) trilha.requestFrame();
      i++;
      var alvo = inicio + i * 1000 / fps;
      return esperar(Math.max(0, alvo - performance.now())).then(proximo);
    }
    return Promise.resolve().then(proximo).catch(function () { try { rec.stop(); } catch (e) {} return null; });
  }

  FF.Codecs = {
    crc32: crc32, zipLer: zipLer, zipGravar: zipGravar,
    gifDecodificar: gifDecodificar, gifCodificar: gifCodificar, pngQuadros: pngQuadros,
    detectarTipo: detectarTipo, decodificarArquivo: decodificarArquivo,
    canvasParaPng: canvasParaPng, baixar: baixar, gravarWebm: gravarWebm,
    ordemNatural: ordemNatural, MIMES: MIMES
  };

  // =================================================================== FF.Imagem
  function criar(w, h) { return { largura: w, altura: h, rgba: new Uint8ClampedArray(w * h * 4) }; }
  function deCanvas(canvas) {
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var d = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { largura: canvas.width, altura: canvas.height, rgba: d.data };
  }
  function paraCanvas(img) { return rgbaParaCanvas(img.rgba, img.largura, img.altura); }
  function copiar(img) { return { largura: img.largura, altura: img.altura, rgba: new Uint8ClampedArray(img.rgba) }; }

  function corEm(img, x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= img.largura || y >= img.altura) return [0, 0, 0, 0];
    var o = (y * img.largura + x) * 4, d = img.rgba;
    return [d[o], d[o + 1], d[o + 2], d[o + 3]];
  }

  // Cor mais comum na borda (quadros que viram "cor de fundo").
  function corDeFundo(img) {
    var W = img.largura, H = img.altura, d = img.rgba, cont = new Map(), melhor = 0, cor = 0;
    function conta(x, y) {
      var o = (y * W + x) * 4;
      var k = d[o + 3] === 0 ? -1 : (((d[o] << 16) | (d[o + 1] << 8) | d[o + 2]) * 256 + d[o + 3]);
      var n = (cont.get(k) || 0) + 1; cont.set(k, n);
      if (n > melhor) { melhor = n; cor = k; }
    }
    var x, y;
    for (x = 0; x < W; x++) { conta(x, 0); if (H > 1) conta(x, H - 1); }
    for (y = 1; y < H - 1; y++) { conta(0, y); if (W > 1) conta(W - 1, y); }
    if (cor === -1) return [0, 0, 0, 0];
    var rgb = Math.floor(cor / 256);
    return [rgb >> 16, (rgb >> 8) & 255, rgb & 255, cor % 256];
  }

  function removerFundo(img, cor, tolerancia, opts) {
    opts = opts || {};
    var tol = tolerancia === undefined ? 0 : tolerancia;
    var out = copiar(img), d = out.rgba, W = img.largura, H = img.altura, n = W * H;
    if (cor === 'auto' || !cor) {
      cor = corDeFundo(img);
      if (cor[3] === 0) return out; // a borda já é transparente
    }
    var r0 = cor[0], g0 = cor[1], b0 = cor[2];
    function casa(i) {
      var o = i * 4;
      return d[o + 3] > 0 && Math.abs(d[o] - r0) <= tol && Math.abs(d[o + 1] - g0) <= tol && Math.abs(d[o + 2] - b0) <= tol;
    }
    if (!opts.contiguo) {
      for (var i = 0; i < n; i++) if (casa(i)) d[i * 4 + 3] = 0;
      return out;
    }
    // flood fill a partir das bordas (pixels já transparentes também propagam)
    var visto = new Uint8Array(n), fila = new Int32Array(n), ini = 0, fim = 0;
    function entra(i) {
      if (visto[i]) return;
      if (d[i * 4 + 3] === 0 || casa(i)) { visto[i] = 1; fila[fim++] = i; }
    }
    var x, y;
    for (x = 0; x < W; x++) { entra(x); entra((H - 1) * W + x); }
    for (y = 0; y < H; y++) { entra(y * W); entra(y * W + W - 1); }
    while (ini < fim) {
      var p = fila[ini++], px = p % W;
      d[p * 4 + 3] = 0;
      if (px > 0) entra(p - 1);
      if (px < W - 1) entra(p + 1);
      if (p >= W) entra(p - W);
      if (p < n - W) entra(p + W);
    }
    return out;
  }

  function limitesAlfa(img, limiar, x0, y0, x1, y1) {
    var W = img.largura, d = img.rgba, mnx = x1, mny = y1, mxx = x0 - 1, mxy = y0 - 1;
    for (var y = y0; y < y1; y++) {
      var base = y * W;
      for (var x = x0; x < x1; x++) {
        if (d[(base + x) * 4 + 3] >= limiar) {
          if (x < mnx) mnx = x; if (x > mxx) mxx = x;
          if (y < mny) mny = y; if (y > mxy) mxy = y;
        }
      }
    }
    return mxx < mnx ? null : { x: mnx, y: mny, w: mxx - mnx + 1, h: mxy - mny + 1 };
  }
  function aparar(img, limiarAlfa) {
    var lim = limiarAlfa === undefined ? 1 : limiarAlfa;
    var b = limitesAlfa(img, lim, 0, 0, img.largura, img.altura);
    if (!b) return { img: criar(1, 1), x: 0, y: 0, largura: 1, altura: 1 };
    return { img: recortar(img, b), x: b.x, y: b.y, largura: b.w, altura: b.h };
  }

  function recortar(img, c) {
    var out = criar(c.w, c.h), W = img.largura, H = img.altura;
    for (var y = 0; y < c.h; y++) {
      var sy = c.y + y; if (sy < 0 || sy >= H) continue;
      var sx0 = Math.max(0, c.x), sx1 = Math.min(W, c.x + c.w);
      if (sx1 <= sx0) continue;
      out.rgba.set(img.rgba.subarray((sy * W + sx0) * 4, (sy * W + sx1) * 4), (y * c.w + (sx0 - c.x)) * 4);
    }
    return out;
  }

  function escalar(img, fator, suave) {
    var W = img.largura, H = img.altura;
    var nw = Math.max(1, Math.round(W * fator)), nh = Math.max(1, Math.round(H * fator));
    var out = criar(nw, nh), s = img.rgba, d = out.rgba, x, y, c;
    var fx = W / nw, fy = H / nh;
    if (!suave) {
      var mapX = new Int32Array(nw);
      for (x = 0; x < nw; x++) mapX[x] = Math.min(W - 1, Math.floor((x + 0.5) * fx));
      for (y = 0; y < nh; y++) {
        var sy = Math.min(H - 1, Math.floor((y + 0.5) * fy)) * W;
        for (x = 0; x < nw; x++) {
          var so = (sy + mapX[x]) * 4, o = (y * nw + x) * 4;
          d[o] = s[so]; d[o + 1] = s[so + 1]; d[o + 2] = s[so + 2]; d[o + 3] = s[so + 3];
        }
      }
      return out;
    }
    // bilinear com alfa pré-multiplicado
    for (y = 0; y < nh; y++) {
      var gy = Math.max(0, Math.min(H - 1, (y + 0.5) * fy - 0.5)), y0 = Math.floor(gy), y1 = Math.min(H - 1, y0 + 1), ty = gy - y0;
      for (x = 0; x < nw; x++) {
        var gx = Math.max(0, Math.min(W - 1, (x + 0.5) * fx - 0.5)), x0 = Math.floor(gx), x1 = Math.min(W - 1, x0 + 1), tx = gx - x0;
        var i00 = (y0 * W + x0) * 4, i10 = (y0 * W + x1) * 4, i01 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4;
        var w00 = (1 - tx) * (1 - ty) * s[i00 + 3], w10 = tx * (1 - ty) * s[i10 + 3], w01 = (1 - tx) * ty * s[i01 + 3], w11 = tx * ty * s[i11 + 3];
        var a = w00 + w10 + w01 + w11, o2 = (y * nw + x) * 4;
        d[o2 + 3] = a;
        if (a > 0) for (c = 0; c < 3; c++) d[o2 + c] = (s[i00 + c] * w00 + s[i10 + c] * w10 + s[i01 + c] * w01 + s[i11 + c] * w11) / a;
      }
    }
    return out;
  }

  function componentes(img, opts) {
    opts = opts || {};
    var lim = opts.limiarAlfa === undefined ? 1 : opts.limiarAlfa;
    var dist = opts.juntarDistancia === undefined ? 2 : opts.juntarDistancia;
    var minArea = opts.minArea === undefined ? 4 : opts.minArea;
    var W = img.largura, H = img.altura, d = img.rgba, n = W * H;
    var rot = new Int32Array(n), pilha = new Int32Array(n);
    var caixas = []; // [x0, y0, x1, y1, area]
    for (var i = 0; i < n; i++) {
      if (rot[i] || d[i * 4 + 3] < lim) continue;
      var id = caixas.length + 1, topo = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, area = 0;
      rot[i] = id; pilha[topo++] = i;
      while (topo) {
        var p = pilha[--topo], px = p % W, py = (p - px) / W;
        area++;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        for (var dy = -1; dy <= 1; dy++) {
          var ny = py + dy; if (ny < 0 || ny >= H) continue;
          for (var dx = -1; dx <= 1; dx++) {
            var nx = px + dx; if (nx < 0 || nx >= W) continue;
            var q = ny * W + nx;
            if (!rot[q] && d[q * 4 + 3] >= lim) { rot[q] = id; pilha[topo++] = q; }
          }
        }
      }
      caixas.push([x0, y0, x1, y1, area]);
    }
    // junta caixas que se tocam ou estão a <= dist px (repete até estabilizar)
    var mudou = true;
    while (mudou && caixas.length > 1) {
      mudou = false;
      caixas.sort(function (a, b) { return a[0] - b[0]; });
      var vivas = [];
      for (var a = 0; a < caixas.length; a++) {
        var A = caixas[a]; if (!A) continue;
        for (var b = a + 1; b < caixas.length; b++) {
          var B = caixas[b]; if (!B) continue;
          if (B[0] > A[2] + dist + 1) break;
          if (B[0] <= A[2] + dist + 1 && A[0] <= B[2] + dist + 1 && B[1] <= A[3] + dist + 1 && A[1] <= B[3] + dist + 1) {
            A[0] = Math.min(A[0], B[0]); A[1] = Math.min(A[1], B[1]); A[2] = Math.max(A[2], B[2]); A[3] = Math.max(A[3], B[3]);
            A[4] += B[4]; caixas[b] = null; mudou = true;
            b = a; // a caixa cresceu: recomeça a busca a partir dela
          }
        }
        vivas.push(A);
      }
      caixas = vivas;
    }
    var lista = caixas.filter(function (c) { return c[4] >= minArea; })
      .map(function (c) { return { x: c[0], y: c[1], w: c[2] - c[0] + 1, h: c[3] - c[1] + 1 }; });
    return ordenarEmLinhas(lista);
  }
  function ordenarEmLinhas(lista) {
    lista.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var linhas = [];
    lista.forEach(function (c) {
      var alvo = null;
      for (var i = 0; i < linhas.length; i++) {
        var L = linhas[i], sob = Math.min(L.y1, c.y + c.h) - Math.max(L.y0, c.y);
        if (sob > 0 && sob >= 0.5 * Math.min(c.h, L.y1 - L.y0)) { alvo = L; break; }
      }
      if (!alvo) { alvo = { y0: c.y, y1: c.y + c.h, itens: [] }; linhas.push(alvo); }
      else { alvo.y0 = Math.min(alvo.y0, c.y); alvo.y1 = Math.max(alvo.y1, c.y + c.h); }
      alvo.itens.push(c);
    });
    linhas.sort(function (a, b) { return a.y0 - b.y0; });
    var out = [];
    linhas.forEach(function (L) { L.itens.sort(function (a, b) { return a.x - b.x; }); out.push.apply(out, L.itens); });
    return out;
  }

  function grade(img, colunas, linhas, opts) {
    opts = opts || {};
    var m = opts.margem || 0, e = opts.espaco || 0, ignorar = opts.ignorarVazios !== false;
    var cw = Math.floor((img.largura - 2 * m - (colunas - 1) * e) / colunas);
    var ch = Math.floor((img.altura - 2 * m - (linhas - 1) * e) / linhas);
    var out = [];
    if (cw <= 0 || ch <= 0) return out;
    for (var l = 0; l < linhas; l++) {
      for (var c = 0; c < colunas; c++) {
        var caixa = { x: m + c * (cw + e), y: m + l * (ch + e), w: cw, h: ch };
        if (ignorar && !limitesAlfa(img, 1, caixa.x, caixa.y, caixa.x + cw, caixa.y + ch)) continue;
        out.push(caixa);
      }
    }
    return out;
  }

  // Palpite de grade: colunas/linhas vazias (transparentes ou da cor de fundo) em intervalos regulares.
  function detectarGrade(img) {
    var W = img.largura, H = img.altura, d = img.rgba;
    var fundo = corDeFundo(img), opaco = fundo[3] > 0;
    function vazio(o) {
      if (d[o + 3] === 0) return true;
      return opaco && Math.abs(d[o] - fundo[0]) <= 8 && Math.abs(d[o + 1] - fundo[1]) <= 8 && Math.abs(d[o + 2] - fundo[2]) <= 8;
    }
    var colVazia = new Uint8Array(W).fill(1), linVazia = new Uint8Array(H).fill(1);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (!vazio((y * W + x) * 4)) { colVazia[x] = 0; linVazia[y] = 0; }
      }
    }
    function eixo(vaz, tam) {
      // 1) divisores do tamanho: todas as fronteiras vazias e toda faixa com conteúdo (escolhe o maior)
      var melhor = 0;
      for (var c = 2; c <= Math.min(64, tam >> 2); c++) {
        if (tam % c) continue;
        var passo = tam / c, ok = true, k;
        for (k = 1; k < c && ok; k++) { var f = k * passo; if (!(vaz[f] || vaz[f - 1])) ok = false; }
        for (k = 0; k < c && ok; k++) {
          var tem = false;
          for (var j = k * passo; j < (k + 1) * passo; j++) if (!vaz[j]) { tem = true; break; }
          if (!tem) ok = false;
        }
        if (ok) melhor = c;
      }
      if (melhor) return melhor;
      // 2) faixas de conteúdo com inícios espaçados regularmente
      var inicios = [], dentro = false;
      for (var i = 0; i < tam; i++) {
        if (!vaz[i] && !dentro) { inicios.push(i); dentro = true; } else if (vaz[i]) dentro = false;
      }
      if (inicios.length < 2) return 1;
      var difs = [], soma = 0;
      for (i = 1; i < inicios.length; i++) { difs.push(inicios[i] - inicios[i - 1]); soma += difs[i - 1]; }
      var media = soma / difs.length, varia = 0;
      difs.forEach(function (v) { varia += (v - media) * (v - media); });
      return Math.sqrt(varia / difs.length) <= 0.15 * media ? inicios.length : 1;
    }
    var colunas = eixo(colVazia, W), linhas = eixo(linVazia, H);
    if (colunas <= 1 && linhas <= 1) return null;
    return { colunas: colunas, linhas: linhas };
  }

  function empacotar(quadros, opts) {
    opts = opts || {};
    var m = opts.margem === undefined ? 1 : opts.margem;
    var largMax = opts.larguraMax || 2048;
    var maiorW = 0;
    quadros.forEach(function (q) { maiorW = Math.max(maiorW, q.largura + 2 * m); });
    var ordem = quadros.map(function (q, i) { return i; })
      .sort(function (a, b) { return quadros[b].altura - quadros[a].altura || quadros[b].largura - quadros[a].largura || a - b; });
    function tentar(larg) {
      var pos = new Array(quadros.length), x = m, y = m, altPrat = 0, usadoW = 0;
      ordem.forEach(function (i) {
        var q = quadros[i];
        if (x + q.largura + m > larg && x > m) { y += altPrat + m; x = m; altPrat = 0; }
        pos[i] = { x: x, y: y };
        x += q.largura + m; usadoW = Math.max(usadoW, x);
        altPrat = Math.max(altPrat, q.altura);
      });
      return { pos: pos, largura: Math.max(1, usadoW), altura: Math.max(1, y + altPrat + m) };
    }
    var larg = Math.max(largMax, maiorW), r = tentar(larg);
    while (r.altura > 2048 && larg < 4096) { larg = Math.min(4096, larg * 2); r = tentar(Math.max(larg, maiorW)); }
    var out = new Uint8ClampedArray(r.largura * r.altura * 4);
    quadros.forEach(function (q, i) {
      var p = r.pos[i];
      for (var y = 0; y < q.altura; y++)
        out.set(q.rgba.subarray(y * q.largura * 4, (y + 1) * q.largura * 4), ((p.y + y) * r.largura + p.x) * 4);
    });
    return { largura: r.largura, altura: r.altura, rgba: out, posicoes: r.pos };
  }

  FF.Imagem = {
    criar: criar, deCanvas: deCanvas, paraCanvas: paraCanvas, copiar: copiar,
    removerFundo: removerFundo, corDeFundo: corDeFundo, corEm: corEm, aparar: aparar,
    componentes: componentes, grade: grade, detectarGrade: detectarGrade,
    recortar: recortar, escalar: escalar, empacotar: empacotar
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Codecs: FF.Codecs, Imagem: FF.Imagem };
})();
