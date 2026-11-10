# Fontes locais IFEED

Fontes obtidas do repositório oficial [Google Fonts](https://github.com/google/fonts),
commit `86aced91de05cd4f96a06838124cca45be337b2b`:

- [Montserrat](https://github.com/google/fonts/tree/86aced91de05cd4f96a06838124cca45be337b2b/ofl/montserrat):
  normal, faixa de peso 700–800.
- [Open Sans](https://github.com/google/fonts/tree/86aced91de05cd4f96a06838124cca45be337b2b/ofl/opensans):
  normal, largura 100, faixa de peso 400–600.

Os TTF variáveis oficiais foram convertidos em WOFF2 com FontTools, limitando
os eixos aos pesos usados. Não houve substituição de contornos ou redução do
repertório de caracteres. As declarações CSS usam nomes locais `IFEED Montserrat`
e `IFEED Open Sans`. `font-display: swap` e os fallbacks do projeto permanecem;
fontes de código, emojis e a preferência de fonte do sistema são preservadas.
Não há requisições a serviços de fontes externos em runtime.

Ambas são distribuídas sob SIL Open Font License 1.1. As licenças e os créditos
originais estão em `montserrat-OFL.txt` e `opensans-OFL.txt`. Esses arquivos não
são licenciados como AGPL.

As fontes e os avisos de licença têm uma única origem versionada em
`packages/frontend-shared/assets/fonts/ifeed-v1/`. As URLs em
`frontend-shared/ifeed-fonts.scss` são relativas ao próprio SCSS. O Vite resolve
esses arquivos para cada consumidor e emite os WOFF2 com hash em seus artefatos,
sob `/vite/assets/` ou `/embed_vite/assets/` na produção. Os aliases genéricos
`/client-assets/` e os assets exclusivos de cada frontend não são alterados.
