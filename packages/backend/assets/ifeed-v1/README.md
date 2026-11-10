# Assets da marca IFEED

Origem: “Manual de Marca IFEED”, versão 1.0, novembro de 2026, fornecido pelo
responsável pelo projeto. SHA-256 do PDF de referência:
`8fadd836bcc018b21e3f1671efdfe376132846bd5415b27c03148aebe07dc650`.

A assinatura horizontal e o símbolo foram **extraídos como paths vetoriais**
da página 4 usando `pdftocairo -svg`. As letras são os contornos originais;
não foram redigitadas, reconstruídas por fonte ou geradas por IA. Foram
selecionados os paths efetivos das formas recortadas e dos cinco glifos,
removidos o restante da página e as dependências de fontes. As cores foram
expressas pelos HEX oficiais do manual.

- `symbol.svg`: símbolo com proteção interna, sem fundo.
- `horizontal.svg`: assinatura original com letras pretas e proteção de 42
  unidades (altura do I na extração).
- `horizontal-dark.svg`: mesmos contornos, letras brancas para fundo escuro;
  símbolo mantém verde/vermelho/branco oficiais.
- `favicon.svg` / `favicon.ico`: símbolo proporcional, com margem reduzida,
  sem reordenar ou suprimir linhas/ponto. ICO contém 16, 32, 48 e 64 px.
- `apple-touch-icon.png`: 180 × 180, fundo neutro opaco, proteção preservada.
- `icon-192.png`, `icon-512.png`, `splash.png` (300 × 300): versões transparentes.
- `maskable.svg`, `maskable-192.png`, `maskable-512.png`: composição própria,
  fundo neutro opaco; toda a arte fica no círculo seguro de raio 40% do canvas.

Rasterização por ImageMagick e empacotamento ICO com PNGs por Pillow, sem
sombra, contorno ou distorção. Os arquivos
maskable não são uma simples cópia ampliada dos ícones transparentes.

O favicon de 16 px é uma adaptação técnica abaixo do mínimo de 24 px do manual:
a margem foi reduzida para preservar a leitura das três linhas e do ponto.
Os indicadores inline que já usavam ícones menores também têm limitação física
de leitura; não são assinaturas principais. Na navegação principal o SVG de
38 px contém cerca de 24,8 px de arte mais a área de proteção. A assinatura
horizontal usa no mínimo 100 px de canvas, incluindo sua proteção.

A marca é utilizada conforme o manual fornecido para este projeto. Os créditos
e licenças do Misskey permanecem no código e nas áreas de atribuição. Não se
atribui à marca a licença das fontes ou dos componentes de software.
