# Proteção dos logs de webhooks de sistema

## Caminho e escopo

A implementação parte da `main` limpa em
`9a19e56370b78de0a91dd5075d2d26ed75d172ee`. Antes desta correção,
`SystemWebhookService.createSystemWebhook`, `updateSystemWebhook` e
`deleteSystemWebhook` enviavam entidades completas para
`ModerationLogService.log`. Na edição, o payload continha os snapshots
`before` e `after`; na criação e exclusão, `webhook`.

O logger persistia esses três payloads em `moderation_log.info` (JSONB).
`admin/show-moderation-logs` os devolvia por
`ModerationLogEntityService.packMany`/`pack`. A interface
`pages/admin/modlog.ModLog.vue` apresenta o evento, o diff da edição e o
JSON recebido em detalhes. URL, segredo e nome livre podiam acompanhar esses
snapshots. Esta conclusão vem do código e de dados fictícios em testes;
nenhum dado da instância real foi consultado.

## Novas gravações

`sanitize-system-webhook-log.ts` constrói uma representação separada.
A lista explícita de campos seguros retém somente:

- `systemWebhookId` e `id`, validados como identificadores alfanuméricos de até
  32 caracteres, compatíveis com os formatos de ID existentes;
- `isActive`, somente quando booleano;
- `on`, somente com os cinco tipos de evento revisados e já existentes.

`name` é texto livre e pode conter credenciais; seu valor também é omitido.
Na edição, `changedFields` registra apenas os nomes conhecidos dos campos
alterados (`isActive`, `on`, `name`, `url`, `secret`). URL e segredo não têm
valores anteriores/novos, placeholders, domínio, caminho, fragmento, tamanho ou
hash no log. Campos desconhecidos e valores aninhados inesperados não são
copiados. Novos campos e novos tipos de evento exigem revisão explícita antes
de entrar na projeção.

A projeção ocorre no serviço de webhook e é reaplicada no logger antes da
persistência. Não modifica a entidade efetiva, os retornos das APIs de gestão
nem os eventos internos de sincronização. Autor, tipo e momento continuam
associados ao registro; o momento é obtido do ID pelo `IdService`.

A tela usa o ID para identificar o webhook e mantém o diff dos campos seguros.
Na edição, lista também os nomes dos campos alterados, reutilizando a tradução
`settings`. Não há alteração de locales.

## Leitura histórica e busca

`sanitize-moderation-log.ts` centraliza a escolha da proteção por tipo de evento.
`pack`, a leitura por ID e `packMany` aplicam a mesma projeção aos três formatos
históricos, inclusive campos ausentes/nulos e registros já protegidos. A
proteção existente de `updateServerSettings` continua usando seu sanitizador
original, sem mudança de regras.

A pesquisa de histórico compara apenas o tipo dos quatro eventos protegidos,
em vez do JSON bruto. Isso impede inferências sobre segredos históricos por
correspondência de busca. Filtros por tipo/autor e paginação permanecem; a busca
por valores dos snapshots deixa de ser oferecida nesses eventos. Outros
eventos conservam seu comportamento.

**A proteção da resposta HTTP não remove segredos já armazenados no banco.**
Nenhum registro histórico foi reescrito ou apagado pela aplicação. Backups,
exports e respostas obtidas anteriormente também não são limpos. Uma eventual
limpeza ou rotação de credenciais depende de tarefa e autorização próprias.

Não foram alteradas permissões, APIs de gestão, entrega/teste de webhooks,
destinatários, payloads de denúncia, retentativas, entidades ou migrations.
O histórico continua exclusivo de administrador (`requireAdmin` e o escopo
`read:admin:show-moderation-log`); moderadores mantêm o acesso de gestão de
webhooks que já tinham. Logs de destinatários de denúncias e webhooks pessoais
não foram incluídos silenciosamente neste escopo.

## Evidência dos testes

### Testes focados

- 25 testes em `packages/backend/test/unit/system-webhook-log.ts`: projeção no
  logger e no CRUD, leitura histórica por entidade/ID/listagem, execução do
  endpoint, autor/momento, busca, ausência de mutação, idempotência, campos
  desconhecidos, tipos inválidos e dados ausentes/nulos. Repositórios e
  dependências de transporte são simulados nesses testes.
- Regressão de configurações: 53 testes de `server-settings-log.ts` e
  `server/ApiCallService.ts`, executados em conjunto com os 25 acima
  (78 testes aprovados).
- 32 testes existentes de `SystemWebhookService.ts` e `WebhookTestService.ts`
  aprovados no banco/Redis descartáveis, com as filas de entrega simuladas
  conforme as suítes existentes.
- 6 testes Vue em `server-settings-log.test.ts`: três de configurações e três
  dos eventos de webhook; componente real com Folder/CodeDiff simulados,
  conferindo identificação, autor e apresentação do diff/campos alterados.

### Integração HTTP e SQL

O procedimento E2E do repositório foi executado em cópia temporária das fontes,
com configuração fictícia, `NODE_ENV=test`, PostgreSQL 18 na porta de teste,
Redis de teste com DB/prefixo exclusivos e banco descartável exclusivo.
Asserções confirmaram isolamento e ausência dos recursos antes da primeira
escrita. Os usuários e papéis foram criados somente nesse ambiente.
O `globalSetup` iniciou o backend e o `teardown` o encerrou. Webhooks ficaram
inativos; workers de entrega não foram iniciados e não houve envio externo.

O cenário concluiu **684 asserções sem mocks na integração**, separando:

- **Gravação SQL:** os três eventos foram consultados diretamente no JSONB,
  mantendo identificação, autor, ação e momento e contendo apenas a projeção
  segura. Na edição, foram usados valores antigos e novos distintos.
- **Configuração efetiva:** criação, edição, consulta de gestão e exclusão por
  HTTP foram confrontadas com SQL; URLs, segredos e nomes fictícios mantiveram
  os valores corretos na entidade efetiva, sem a sanitização do histórico.
- **Leitura HTTP:** os três eventos novos conservaram dados seguros na resposta
  administrativa completa, sem os marcadores protegidos.
- **Compatibilidade histórica:** exemplos dos três formatos antigos foram
  inseridos somente no banco descartável. SQL confirmou os marcadores antes da
  consulta; HTTP os omitiu, inclusive dados desconhecidos/aninhados. Uma nova
  leitura SQL confirmou o JSONB original intacto. Listagem sem filtro de tipo,
  paginação e busca também foram exercitadas.
- **Permissões:** visitante recebeu HTTP 401; usuário comum e moderador sem
  privilégio administrativo receberam HTTP 403 ao consultar o histórico. O
  moderador continuou podendo criar e excluir um webhook inativo.
- **Regressão histórica de configuração:** um `updateServerSettings` antigo
  continuou exibindo o booleano seguro e o nome da senha alterada, sem valores
  secretos na resposta.

Não foram incluídos neste documento payloads completos, tokens, credenciais,
identificadores de usuários descartáveis nem links temporários como evidência
permanente. O roteiro HTTP/SQL foi temporário; a regressão automatizada
versionável permanece nos testes focados. A validação não comprova limpeza de
bancos reais nem comportamento de entregas externas, que não foram executadas.

### Verificações finais e limpeza

Typechecks de backend (incluindo testes e federação), frontend e misskey-js
aprovados. Lint direcionado de implementação e testes, revisões backend/Vue,
SPDX, segurança de locales e `git diff --check` aprovados. O teste novo recebeu
apenas o espaçamento exigido pelo ESLint após a validação funcional.

`pnpm build-misskey-js-with-types` concluiu na cópia temporária com configuração
fictícia: build do backend, geração do OpenAPI/tipos, build do SDK e API
Extractor. Não houve diferença em `src/autogen` nem no relatório público do
SDK; somente o tipo manual dos payloads foi ajustado. O build completo do
frontend não foi executado. A tela foi validada por teste Vue, sem nova sessão
de inspeção visual no navegador nesta tarefa.

Após o término, foram removidos o banco exclusivo, suas 33 chaves Redis e a
cópia temporária com roteiros/resultados. As portas HTTP e do controlador
ficaram livres. Os contêineres de teste iniciados pelo usuário e todos os
outros bancos/prefixos foram preservados. Não houve commit, push ou merge.
