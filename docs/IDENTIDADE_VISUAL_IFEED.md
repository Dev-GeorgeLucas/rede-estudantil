# Identidade visual IFEED

Implementação na branch `feat/identidade-visual-ifeed`, baseada na `main`
`1dacc3b691dd3d134ee03ee45e50708d8531baf0`. Nenhuma configuração, preferência
ou dado da instância real foi consultado ou alterado. Não há migration.

## Temas e preferências

`frontend-shared/themes/l-ifeed.json5` e `d-ifeed.json5` acrescentam **IFEED
Claro** e **IFEED Escuro** ao registro existente, sem retirar os 19 temas
anteriores. IDs dos temas antigos e temas instalados/personalizados permanecem.

A ordem de resolução em `frontend-shared/js/default-theme.ts` é:

1. escolha pessoal explícita para o modo atual;
2. padrão correspondente configurado pela instância;
3. IFEED Claro ou IFEED Escuro.

Preferências pessoais continuam iniciando com `lightTheme` e `darkTheme` nulos:
resolver um padrão não o transforma numa escolha salva. Foi removida a gravação
que copiava o padrão da instância para a preferência durante o boot. Não se
sobrescrevem temas no login, na sincronização, na restauração ou a cada início.
As refs de preferências e de modo são observadas pelo mecanismo existente para
atualizar a interface em runtime, inclusive após a carga assíncrona do meta.

A preferência `syncDeviceDarkMode` permanece com seu comportamento anterior,
inclusive o padrão `true`: o padrão **claro** é IFEED Claro; quando o sistema
está escuro e seu acompanhamento está ativo, inicia em IFEED Escuro. Quem já
selecionou manualmente um modo ou desativou o acompanhamento mantém essa escolha.
O controle existente de alternância passou a ser um botão acessível como switch,
com rótulo, estado e foco visível, reutilizando a mesma ação e confirmação.

A seleção de temas, o realce de código e o frontend de embeds usam os mesmos
padrões. O modo seguro ignora escolhas e padrões da instância, como antes, e usa
os dois padrões IFEED. JSON de padrão inválido não impede a inicialização.

## Paleta, tipografia e acabamento

Os tokens de tema concentram as cores. O logotipo preserva os HEX oficiais.
O verde `#32A041` com branco mede somente **3,37:1**; portanto não é usado como
fundo de texto branco pequeno. Exemplos de pares medidos pela fórmula WCAG:

| Uso | Primeiro plano / fundo | Contraste |
| --- | --- | --- |
| Botão primário claro | `#FFFFFF` / `#23732E` | 5,89:1 |
| Link claro | `#23732E` / `#F2F4F5` | 5,34:1 |
| Erro claro | `#C8191E` / `#FFFFFF` | 5,81:1 |
| Botão primário escuro | `#121713` / `#78D587` | 10,08:1 |
| Link/destaque escuro | `#78D587` / `#171C19` | 9,59:1 |
| Erro escuro | `#FF8588` / `#171C19` | 7,37:1 |

Os testes compilam os temas com suas bases e exigem pelo menos 4,5:1 para os
pares de texto, links, botões e estados semânticos testados; 3:1 para foco e
borda de campo. Aviso permanece âmbar, informação azul e erro/destruição vermelho.
Disabled continua usando o comportamento do componente; não se confunde com ação
ativa. A tarefa não troca indiscriminadamente as cores de gráficos ou todos os
ícones por verde. Os cantos existentes já usam `--MI-radius: 12px`; o layout e as
barras laterais não foram redesenhados.

Montserrat 700–800 para títulos e Open Sans 400–600 para texto são WOFF2 locais,
com `font-display: swap`, créditos e SIL OFL 1.1 ao lado dos arquivos em
`frontend-shared/assets/fonts/ifeed-v1/`. O cabeçalho de página usa a família de títulos.
Fallbacks, escolha de fonte do sistema, fontes monoespaçadas e emojis permanecem.
As letras da assinatura não usam essas fontes em runtime: são paths extraídos.
A origem e o commit das fontes constam no README dessa pasta.

## Marca, assets e cache

O símbolo e a assinatura foram **extraídos como vetores** da página 4 do manual,
sem geração de marca ou reconstrução de letras. A variante escura mantém os
contornos e usa letras brancas, preservando as cores do símbolo. Origem, hash do
PDF, proteção, tamanhos e adaptação técnica do favicon estão documentados em
`backend/assets/ifeed-v1/README.md`.

A marca padrão aparece na navegação lateral/horizontal/mobile, entrada,
carregamento, cabeçalhos, QR, áreas de instância e widgets que já exibiam a marca.
O logotipo não recebe sombra, borda ou distorção. Ícones de ações permanecem com
seus significados. O ponto vermelho é estático, parte do arquivo da marca; não
está ligado ao indicador de notificações ou de moderação.

Os assets de marca novos usam `/static-assets/ifeed-v1/`. As fontes têm origem
única em `frontend-shared/assets/fonts/ifeed-v1/`, referenciada por URLs relativas
ao SCSS compartilhado. O Vite emite os WOFF2 com hash sob `/vite/assets/` e
`/embed_vite/assets/`, conforme o consumidor. O link do manifest usa
`?v=ifeed-v1`. Os caminhos e hashes evitam reutilizar URLs antigas em cache. As rotas de compatibilidade
`/favicon.ico` e `/apple-touch-icon.png` servem os arquivos novos com revalidação.
O manifest mantém seu cache de cinco minutos, compartilhamento e atalho de modo
seguro. Há PNGs transparentes e composições maskable distintas (192/512), Apple
180, splash 300 e ICO com 16/32/48/64 px. A arte maskable cabe inteiramente no
círculo seguro de raio 40%.

Não há limpeza global de Cache Storage, IndexedDB ou localStorage. O cache de tema
compilado é atualizado pelo ThemeManager normal. Arquivos anteriores e créditos,
licenças, identificadores técnicos e a página sobre o Misskey são preservados.

## Configurações administrativas que podem prevalecer

Nenhum valor real foi inspecionado. Para uma instalação que queira adotar os
padrões novos, o administrador deve revisar, em momento separado:

- `/admin/settings`: `name` e `shortName`; nomes já configurados são preservados.
- `/admin/branding`: `defaultLightTheme` e `defaultDarkTheme`. Deixá-los vazios
  permite o fallback IFEED; também é possível definir os novos temas pelo fluxo
  administrativo existente. Isso não muda escolhas pessoais explícitas.
- `iconUrl`: prevalece nos pontos que já aceitavam o ícone da instância, incluindo
  a declaração de favicon. Deixar vazio permite o símbolo novo.
- `app192IconUrl` e `app512IconUrl`: prevalecem nos ícones do manifest; o segundo
  também é usado pelo fluxo atual como Apple touch icon. Deixar vazios permite
  os arquivos novos, ou apontar para uma composição apropriada de mesma dimensão.
- `logoImageUrl`: a assinatura personalizada prevalece no componente de marca e
  no QR. É um campo já existente da API administrativa; não foi criado um novo
  campo nem editada a configuração para preenchê-lo.
- `themeColor` e `manifestJsonOverride`: continuam prevalecendo; overrides podem
  manter nome, cores ou ícones antigos. Revisá-los evita atribuir ao cache uma
  preferência administrativa deliberada.

Uma PWA já instalada pode depender do ciclo de atualização de ícones do navegador
ou do sistema operacional. Não se promete troca imediata no launcher nem se
apagam dados do usuário para forçá-la.

## Validação e limites

Os testes novos cobrem resolução de padrões, preservação de temas/preferências,
atualização reativa, contraste, precedência de imagens, manifest, dimensões e
área segura. A revisão Vue encontrou o uso incorreto de snapshots estáticos na
primeira versão do observador; foi corrigido para refs e coberto por regressão.

A validação visual usa o frontend Vue, o Layout HTML e os arquivos reais da
aplicação com **respostas de API simuladas e dados fictícios**, em servidor HTTP
exclusivo em loopback. Não é uma integração com banco, autenticação ou entrega
externa reais. Não houve consulta à aplicação local, a usuários ou configurações
reais; requisições externas do navegador foram bloqueadas.

Foram conferidos os dois temas em 1440, 390 e 320 px: Feed, publicação aberta,
perfil, Chat, seleção de temas, visitante e fila de moderação. O roteiro principal
concluiu 42 cenários e 391 asserções, incluindo teclado e acompanhamento do modo,
sem overflow horizontal da página e sem `pageerror`. Uma segunda verificação
seleciona Mi Light e um tema pessoal, recarrega e alterna o sistema para conferir
que escolhas explícitas e temas instalados permanecem; também confere fontes e
respostas dos arquivos do manifest.

Mobile é validado por emulação, sem aparelho físico. A instalação/update real de
PWA e o comportamento de launcher ficam para validação em dispositivos. O build
completo permanece para o CI; não há mudança de contratos de API ou tipos gerados.
Nenhum locale ou verificador foi alterado.

A primeira execução ampla foi iniciada no fuso local e revelou os testes de
aniversário que dependem de UTC. Em UTC, uma execução ampla também excedeu a
espera de 1 segundo do autocomplete do Chat ao carregar o componente assíncrono.
A suíte da main em cópia descartável passou com 536 testes; as seis suítes focadas
passaram em conjunto. A execução ampla seguinte em UTC passou com 547 testes,
sem aumentar timeout, retirar testes ou alterar o Chat. Após a revisão reativa,
foi acrescentada mais uma regressão; o resultado final é registrado no relatório
de entrega. Não se considera uma falha intermitente reproduzida como prova de
um defeito novo no Chat ou de sua correção nesta tarefa.


O assistente inicial de instalação também foi conferido visualmente nas seis
combinações de largura/modo (18 asserções), sem submeter formulário ou criar
contas. A verificação de preferências, fontes e ícones concluiu 21 asserções.
O ICO foi conferido diretamente por HTTP e decodificado no Chromium em 16, 32,
48 e 64 px; a prancha usa uma URL de prévia separada do recurso que o navegador
já carregou como favicon. Os testes verificam cada quadro PNG do ICO.

As capturas ficam em `/tmp/ifeed-brand-captures/` (arquivos de validação locais,
fora do conjunto de fontes). Servidores temporários foram encerrados; nenhum
serviço ou contêiner do usuário foi parado. A cópia usada para comparar a main
é descartável e não corresponde à instância real.

## Resultado da etapa inicial de identidade

- Backend: **11 testes** em `test/unit/ifeed-branding.ts`, aprovados.
- Frontend focado: **54 testes em seis suítes**, aprovados em conjunto.
- Frontend completo: **548 testes em 46 suítes**, com cobertura e `TZ=UTC`,
  aprovados com `pnpm --filter frontend test-and-coverage --maxWorkers=2`.
- A execução final com a concorrência padrão teve **547 aprovados e um timeout**
  no `waitFor` do primeiro autocomplete do Chat (`@ali`), antes de exibir as
  sugestões. A passagem com dois workers é evidência de sensibilidade à carga,
  não prova de ausência de todo possível problema de concorrência. Essa pendência
  deve continuar visível na avaliação do CI. Nenhum timeout, teste ou código do
  Chat foi alterado para obter aprovação.
- Typechecks de backend, frontend, frontend-shared e frontend-embed: aprovados.
- `node scripts/check-shipping.mjs --base main`: lint, SPDX e locale safety
  aprovados integralmente nesta tarefa. Nenhuma exceção nova de locale.
- Lint adicional dos templates TSX e do novo teste de backend: aprovado.
- Revisão Vue e `git diff --check`: aprovados.

## Arquivos da entrega

Lista de fontes e assets da tarefa (inclui os novos que ainda não aparecem em
`git diff --stat`):

- `packages/backend/src/server/web/ClientServerService.ts`
- `packages/backend/src/server/web/HtmlTemplateService.ts`
- `packages/backend/src/server/web/manifest.json`
- `packages/backend/src/server/web/views/_splash.tsx`
- `packages/backend/src/server/web/views/base-embed.tsx`
- `packages/backend/src/server/web/views/base.tsx`
- `packages/frontend-embed/src/boot.ts`
- `packages/frontend-embed/src/components/EmInstanceTicker.vue`
- `packages/frontend-embed/src/components/EmNoteDetailed.vue`
- `packages/frontend-embed/src/pages/clip.vue`
- `packages/frontend-embed/src/pages/tag.vue`
- `packages/frontend-embed/src/pages/user-timeline.vue`
- `packages/frontend-embed/src/style.scss`
- `packages/frontend-shared/js/config.ts`
- `packages/frontend-shared/js/theme.ts`
- `packages/frontend/public/loader/style.css`
- `packages/frontend/src/boot/common.ts`
- `packages/frontend/src/components/MkInstanceTicker.vue`
- `packages/frontend/src/components/MkVisitorDashboard.vue`
- `packages/frontend/src/components/global/MkPageHeader.vue`
- `packages/frontend/src/pages/about.overview.vue`
- `packages/frontend/src/pages/admin/index.vue`
- `packages/frontend/src/pages/qr.show.vue`
- `packages/frontend/src/pages/settings/theme.vue`
- `packages/frontend/src/pages/welcome.entrance.classic.vue`
- `packages/frontend/src/pages/welcome.entrance.simple.vue`
- `packages/frontend/src/pages/welcome.setup.vue`
- `packages/frontend/src/style.scss`
- `packages/frontend/src/ui/_common_/navbar-h.vue`
- `packages/frontend/src/ui/_common_/navbar.vue`
- `packages/frontend/src/ui/_common_/titlebar.vue`
- `packages/frontend/src/ui/visitor.vue`
- `packages/frontend/src/utility/code-highlighter.ts`
- `packages/frontend/src/widgets/WidgetInstanceInfo.vue`
- `docs/IDENTIDADE_VISUAL_IFEED.md` (novo)
- `packages/backend/assets/ifeed-v1/README.md` (novo)
- `packages/backend/assets/ifeed-v1/apple-touch-icon.png` (novo)
- `packages/backend/assets/ifeed-v1/favicon.ico` (novo)
- `packages/backend/assets/ifeed-v1/favicon.svg` (novo)
- `packages/backend/assets/ifeed-v1/horizontal-dark.svg` (novo)
- `packages/backend/assets/ifeed-v1/horizontal.svg` (novo)
- `packages/backend/assets/ifeed-v1/icon-192.png` (novo)
- `packages/backend/assets/ifeed-v1/icon-512.png` (novo)
- `packages/backend/assets/ifeed-v1/maskable-192.png` (novo)
- `packages/backend/assets/ifeed-v1/maskable-512.png` (novo)
- `packages/backend/assets/ifeed-v1/maskable.svg` (novo)
- `packages/backend/assets/ifeed-v1/splash.png` (novo)
- `packages/backend/assets/ifeed-v1/symbol.svg` (novo)
- `packages/backend/src/server/web/branding.ts` (novo)
- `packages/backend/test/unit/ifeed-branding.ts` (novo)
- `packages/frontend-shared/ifeed-fonts.scss` (novo)
- `packages/frontend-shared/js/branding.ts` (novo)
- `packages/frontend-shared/js/default-theme.ts` (novo)
- `packages/frontend-shared/themes/d-ifeed.json5` (novo)
- `packages/frontend-shared/themes/l-ifeed.json5` (novo)
- `packages/frontend-shared/assets/fonts/ifeed-v1/README.md` (novo)
- `packages/frontend-shared/assets/fonts/ifeed-v1/montserrat-OFL.txt` (novo)
- `packages/frontend-shared/assets/fonts/ifeed-v1/montserrat.woff2` (novo)
- `packages/frontend-shared/assets/fonts/ifeed-v1/opensans-OFL.txt` (novo)
- `packages/frontend-shared/assets/fonts/ifeed-v1/opensans.woff2` (novo)
- `packages/frontend/src/components/MkBrandLogo.stories.impl.ts` (novo)
- `packages/frontend/src/components/MkBrandLogo.vue` (novo)
- `packages/frontend/src/utility/watch-theme.ts` (novo)
- `packages/frontend/test/unit/ifeed-brand.test.ts` (novo)
- `packages/frontend/test/unit/ifeed-theme.test.ts` (novo)

## Ajustes incrementais de layout

Correções na mesma branch, preservando o trabalho de identidade visual:

- O acesso a denúncias e sinalizações tinha padding, fonte e estrutura diferentes
  da navbar. Agora recebe as mesmas classes de item, ícone, texto e estado ativo
  usadas pelo painel, inclusive nas variantes compacta e horizontal. Autorizações,
  rótulos, indicadores e recuperação de erro não mudaram.
- A coluna direita já existia, mas seu breakpoint era calculado uma única vez ao
  montar a interface. Agora acompanha o viewport, com limiar único de 1100 px.
  Páginas que solicitam área ampla continuam com acesso pelo drawer. A coluna
  reserva 350 px no flex layout e tem rolagem própria; o conteúdo principal mantém
  seu scroller e o cache de navegação existentes.
- `widget-panel.vue` mantém uma única árvore de widgets e usa Teleport para movê-la
  ao contêiner da coluna. Só fecha o drawer após existir o destino, para não
  desmontar/remontar os widgets durante o resize. Na apresentação móvel, preserva
  acesso pelo botão, oferece Fechar e Escape e usa a rotina de foco existente.
  A limpeza do foco ocorre antes de mover o painel, sem deixar backdrop ou inert
  residual. Configurações, ordem e filtros dos widgets permanecem no mecanismo
  existente, sem alteração das preferências.
- O controle ilustrado de tema ainda posicionava a bolinha como conteúdo inline,
  herdando o alinhamento de texto de um botão nativo. Ela agora é absoluta dentro
  da trilha de 90 × 50 px, com diâmetro de 44 px e deslocamento de 40 px. Rótulos
  ficam em colunas próprias e passam para baixo quando o contêiner é estreito.
  A ilustração, a confirmação do modo manual e a sincronização com o sistema foram
  preservadas. A regra de redução de movimento tem precedência sobre as transições
  legadas com `!important`.

Arquivos desta correção incremental:

- `packages/frontend/src/ui/_common_/admin-access.vue`
- `packages/frontend/src/ui/_common_/navbar.vue`
- `packages/frontend/src/ui/_common_/navbar-h.vue`
- `packages/frontend/src/ui/_common_/mobile-footer-menu.vue`
- `packages/frontend/src/ui/_common_/common.vue`
- `packages/frontend/src/ui/universal.vue`
- `packages/frontend/src/pages/settings/theme.vue`
- `packages/frontend/src/composables/use-widget-layout.ts` (novo)
- `packages/frontend/src/ui/_common_/widget-panel.vue` (novo)
- `packages/frontend/test/unit/widget-layout.test.ts` (novo)
- este documento.

Validação incremental, separada das suítes completas da etapa anterior:

- **178 testes em dez suítes**, incluindo 13 testes de layout/painel, navegação,
  Feed, indicador, sinalizações, filtros do MVP e preferências de tema.
- **366 verificações visuais**: IFEED Claro, IFEED Escuro e Mi Light em
  1920, 1440, 1100, 1099, 390 e 320 px; Feed, publicação, perfil e configurações.
- **18 verificações adicionais**: navbar compacta/horizontal, foco e teclado,
  retorno à âncora do Feed com histórico, nenhuma nova consulta de widgets ao
  trocar de rota, confirmação de modo manual, zoom de 200% e redução de movimento.
- Zoom simulado por viewport CSS com metade da largura e densidade de pixels
  duplicada no Chromium, em larguras físicas de 1440, 390 e 320 px. As capturas
  desse cenário usam o protocolo do navegador para manter as métricas da emulação.
- Navegador e componentes são reais; APIs, contas, publicações e respostas dos
  widgets são simulados, sem acessar dados ou configurações reais. O teste de
  montagem confirma que o resize não duplica nem remonta os widgets abertos.
- Capturas temporárias de validação em `/tmp/ifeed-layout-captures/`, fora do Git.
  Mobile e zoom foram emulados; não houve teste em aparelho físico. A suíte
  completa e o build não foram repetidos nesta correção de layout.
- Typecheck do frontend, revisão Vue, lint direcionado, SPDX, locale safety e
  `git diff --check`: aprovados no fechamento desta etapa. Nenhum locale foi
  alterado.


## Revisão para commit

O conjunto final contém 72 arquivos da tarefa: 38 modificados e 34 novos. Inclui
identidade, assets/fontes com seus avisos de licença, temas, ajustes de navegação,
coluna de widgets, controle de modo e respectivas regressões/documentação. Não
inclui scripts temporários, capturas, credenciais, dados reais, migrations,
configuração da instância ou alterações de testes do Chat.

A versão final de código está coberta pelos 178 testes focados em dez suítes e
pelo typecheck do frontend executados depois dos ajustes. Os arquivos de backend,
frontend-shared e frontend-embed não mudaram após seus testes/typechecks aprovados.
As 384 verificações visuais adicionais usam dados simulados e preservam as
limitações de mobile/zoom por emulação.

A suíte completa de 548 testes com dois workers pertence à etapa anterior aos
ajustes incrementais. Ela não é apresentada como uma execução completa da versão
final de layout. O timeout intermitente do autocomplete permanece uma limitação
aberta para acompanhamento do CI: aparece na execução ampla com concorrência
padrão; a passagem com concorrência limitada indica sensibilidade à carga, sem
comprovar causa única ou ausência de interferência. Não houve aumento de timeout,
remoção de teste ou alteração no Chat para obter aprovação. Não foi identificada
falha relacionada à tarefa nas regressões finais. O build completo fica para o CI.

O primeiro check do staging detectou um espaço final no aviso OFL da Montserrat,
que ainda era um arquivo não rastreado. Foi removido somente esse espaço, sem
alterar texto, créditos ou termos da licença. Não houve mudança de código após
as validações finais; os checks do staging foram repetidos antes do commit.


## Correção da resolução de fontes no PR #17

O primeiro CI de produção falhou antes dos testes com `ENOENT` no embed:
`/client-assets/` resolve para a pasta de assets de cada frontend, mas os WOFF2
estavam somente em `frontend/assets/`. Os builds de desenvolvimento e os
typechecks não detectaram a resolução incorreta de arquivos no build do embed.

Os cinco arquivos de fontes/documentação/licenças foram movidos para uma origem
compartilhada versionada, com os WOFF2 e licenças preservados byte a byte. As duas
URLs do SCSS agora são relativas à origem compartilhada; o mecanismo de assets do
Vite faz a emissão para cada build, sem cópia manual ou mudança do alias inteiro
do embed. Pesos, famílias, `font-display`, fallbacks e preferência de fonte do
sistema não mudaram. Consumidores diretos: os SCSS principais de frontend e
frontend-embed; o Storybook importa o estilo principal do frontend.

A validação usa a configuração fictícia versionada do CI por caminho temporário,
sem sobrescrever `.config/default.yml`, iniciar a instância ou consultar o banco.
Não foram reexecutados jobs remotos. Os resultados desta correção são registrados
ao terminar sua validação local.

Resultados locais da correção de fontes:

- Build isolado: `NODE_ENV=production pnpm --filter frontend-embed build`, aprovado.
- Build completo: `NODE_ENV=production pnpm build`, o comando do workflow de
  produção, aprovado. Foi usado `MISSKEY_CONFIG_YML` apontando para uma cópia
  temporária da configuração fictícia versionada do CI. O lockfile não mudou.
- Suíte completa: `TZ=UTC pnpm --filter frontend test-and-coverage`, aprovada com
  **561 testes em 47 suítes**, cobertura e concorrência padrão do CI, sem
  `--maxWorkers` ou ajustes de timeout. Não ocorreu timeout do Chat nesta execução;
  isso não elimina a intermitência observada na etapa anterior.
- Artefatos: **49 asserções** com os CSS/WOFF2 realmente gerados. Os dois CSS
  referenciam suas próprias URLs com hash sob `/vite/assets/` e
  `/embed_vite/assets/`; os WOFF2 são idênticos aos fontes compartilhados.
  As dez requisições HTTP do ensaio responderam 200, e o Chromium carregou
  Open Sans 400/600 e Montserrat 700/800 em ambos os consumidores. Nenhuma URL
  de fonte depende de CDN, do alias antigo ou do caminho da máquina.
- O ensaio HTTP serviu somente arquivos de produção em loopback temporário;
  não iniciou o backend nem fez consultas a banco, contas ou configurações reais.
  O navegador e o servidor temporários foram encerrados após as asserções.
- Os builds de produção do SDK e dos jogos omitem `.d.ts` por projeto. A primeira
  tentativa de typecheck depois de `NODE_ENV=production pnpm build` apontou as
  declarações ausentes. Foram preparadas as dependências com
  `NODE_ENV=test pnpm --filter 'frontend^...' run build`, seguindo a etapa do
  workflow de lint/typecheck, para gerar as declarações locais. Os arquivos de
  build ignorados não alteram SDK versionado, contratos ou tipos autogerados da API.
- Lint direcionado: sem arquivos nos padrões ESLint alterados (SCSS, documentos
  e assets). SPDX e locale safety aprovados; nenhum verificador, teste ou
  configuração de concorrência do CI foi alterado.

A origem compartilhada é consumida pelos builds de frontend e frontend-embed;
o Storybook recebe o mesmo SCSS pelo preview. O Storybook completo não foi
executado nesta correção. A instalação/atualização real de PWA e a execução remota
do CI continuam pendentes até um futuro envio, não realizado nesta etapa.

Após preparar as dependências de typecheck, os três checks (`frontend`,
`frontend-embed` e `frontend-shared`) passaram. SPDX, locale safety e
`git diff --check` também passaram. As falhas preliminares de typecheck eram a
falta das declarações locais omitidas no build de produção; não exigiram mudanças
em código, tipos versionados ou testes. Não houve commit, push, merge, execução de
migrations ou alteração da instância real nesta correção.
