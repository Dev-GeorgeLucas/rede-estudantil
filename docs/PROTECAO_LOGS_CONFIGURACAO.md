# Proteção dos logs de configuração

## Caminho confirmado

`admin/update-meta` busca `MiMeta` antes e depois da atualização por
`MetaService.fetch(true)`. Essa consulta não exclui credenciais; os campos
sensíveis de `Meta.ts` não têm `select: false`. Antes da correção, os snapshots
eram enviados para `ModerationLogService.log`, que os inseria sem projeção no
JSONB `moderation_log.info`.

`admin/show-moderation-logs` chama `ModerationLogEntityService.packMany`/`pack`.
Antes da correção, `pack` devolvia `log.info` diretamente. A interface
`pages/admin/modlog.ModLog.vue` exibe o diff e permite expandir o JSON recebido.
Isso confirma o comportamento do código, sem consultar ocorrências, logs,
credenciais ou configurações reais e sem afirmar comprometimento.

## Representação protegida

`sanitize-server-settings-log.ts` mantém uma lista explícita de campos revisados.
Só booleanos e números finitos autorizados conservam valores anteriores e novos.
Tipos inesperados não são copiados. Os demais campos conhecidos têm apenas seu
nome registrado em `changedFields` quando alterados; campos desconhecidos são
omitidos. Não há fragmentos, tamanhos, hashes ou valores mascarados de segredos.

Categorias protegidas:

- Segredos de hCaptcha, mCaptcha, reCAPTCHA e Turnstile.
- Chaves da detecção de mídia, DeepL, Verifymail e Truemail.
- Usuário/senha SMTP, chave privada Web Push e credenciais de object storage.
- URLs de integrações, proxies, armazenamento, imagens e links institucionais,
  incluindo credenciais em userinfo, caminho, query e fragmento.
- Textos livres, temas, manifesto, objetos/listas, chaves públicas e
  identificadores de integração também não conservam valores neste log.

Os endpoints criam uma representação separada antes de chamar o logger, que
reaplica a proteção antes da persistência. Os objetos que efetivamente aplicam
as configurações não são alterados pela sanitização. O evento continua sendo
`updateServerSettings`, com o mesmo autor e momento. A interface lista os nomes
alterados e mantém o diff seguro, reutilizando a tradução `settings`.

`admin/roles/update-default-policies` usa esse mesmo evento. Os novos registros
usam caminhos `policies.<campo>`; o histórico com políticas na raiz mantém seus
valores seguros legíveis. Alterações de `policies`/`clientOptions` também podem
ser indicadas pelo nome do grupo. Outros eventos de moderação não mudaram.

## Histórico, busca e limitações

A leitura aplica a mesma projeção, inclusive a snapshots completos antigos,
campos ausentes, nulos e registros já protegidos. A busca textual compara somente
o nome do evento de configuração, sem pesquisar seu JSON bruto e permitir
inferências sobre segredos antigos. Busca por valores de configuração deixa de
ser oferecida; filtros por tipo, autor e paginação continuam disponíveis. Outros
eventos preservam a busca existente.

**Os logs históricos permanecem no banco sem reescrita ou exclusão.** Backups,
exports e respostas já obtidas também não são removidos. Uma limpeza futura
exige autorização separada, inventário restrito, política de retenção, backup
protegido e validação isolada. Não houve migration, rotação ou alteração de
permissões. Atualização e leitura continuam exclusivas de administrador,
protegidas por `requireAdmin`, escopos existentes e `ApiCallService`.

Pendências fora do escopo: `SystemWebhookService` registra entidades contendo URL
e segredo em eventos próprios; `AbuseReportNotificationService` registra
snapshots de destinatários. Esses fluxos precisam de auditoria específica.
`metaUpdated` transporta snapshots internos para sincronização entre processos;
esse evento não é o registro de auditoria tratado aqui.

## Validação e alcance da evidência

Os testes de backend usam credenciais fictícias e repositórios simulados com os
executores, logger, serializador e autorização reais. Cobrem persistência,
resposta histórica, imutabilidade, campos novos, tipos inválidos, nulos,
políticas e valores efetivos aplicados pelo endpoint. Visitantes, usuários e
moderadores continuam impedidos de executar ações administrativas; o
administrador mantém acesso.

Os testes Vue montam o componente com payloads fictícios protegidos, incluindo
alteração exclusiva de segredo e snapshots nulos; conferem autor, momento,
campos alterados e diff seguro.

Na validação inicial, PostgreSQL e Redis isolados estavam indisponíveis.
A integração HTTP/SQL foi concluída posteriormente com o procedimento E2E do
repositório: cópia temporária das fontes, backend `NODE_ENV=test`, PostgreSQL 18
na porta de teste, banco descartável exclusivo, Redis de teste com prefixo
exclusivo e três contas fictícias. Asserções confirmaram o isolamento e a
ausência do banco/prefixo antes da primeira escrita. O backend foi iniciado pelo
`globalSetup` do Vitest e encerrado pelo `teardown`; os workers de filas não
foram iniciados, e o envio de e-mail permaneceu desabilitado.

O cenário integrado passou com **535 asserções**, sem mocks:

- `admin/update-meta` alterou um booleano e uma senha fictícia por HTTP. SQL
  confirmou os valores efetivos antigos/novos. O JSONB persistido continha os
  valores seguros e o nome do campo sensível, sem nenhum dos segredos. A
  resposta administrativa completa preservou autor, evento e momento.
- `admin/roles/update-default-policies` produziu o mesmo `updateServerSettings`.
  A política efetiva e os valores seguros anteriores/novos permaneceram
  auditáveis por SQL e HTTP, sem copiar credenciais de Meta.
- Um evento no formato antigo foi inserido somente no banco descartável, com
  marcadores em 13 campos de credenciais, 24 campos de URLs e objetos aninhados
  desconhecidos. SQL confirmou todos os marcadores antes da leitura. A resposta
  HTTP completa os omitiu e manteve as alterações seguras legíveis. SQL confirmou
  que o JSONB histórico continuou idêntico após leitura e busca.
- A pesquisa por marcadores sensíveis/desconhecidos não retornou o evento; a
  pesquisa pelo tipo continuou funcionando. Isso exercitou o `CASE` em
  PostgreSQL real.
- Uma conta com papel de moderador, sem privilégio administrativo, e uma conta
  comum receberam HTTP 403 com `ROLE_PERMISSION_DENIED` na consulta dos logs.

Não foi necessária alteração de código. O roteiro temporário foi ajustado para
usar nomes de conta dentro do limite existente e comparação estrutural de JSONB,
que desconsidera a ordem das chaves. As suítes já aprovadas não foram repetidas.
Não foram consultadas configurações ou registros da instância real.

Ao terminar, foram removidos o banco exclusivo, 33 chaves do prefixo Redis e a
cópia temporária. As portas HTTP/controlador de teste ficaram livres. Os
contêineres iniciados pelo usuário foram preservados; nenhum outro banco ou
prefixo Redis foi limpo. O relatório não inclui payloads, tokens ou marcadores
completos da execução.

Resultado dos testes focados: 53 testes de backend em duas suítes (52 novos e
um existente de `ApiCallService`) e três testes Vue. Typechecks de backend,
frontend e misskey-js aprovados. Lint direcionado, SPDX, locales e
`git diff --check` aprovados, sem exceção de locale nesta alteração.

`build-misskey-js-with-types` foi executado em uma cópia temporária das fontes,
com configuração fictícia do repositório e sem conexão ao banco. O build do
backend, a geração e o API Extractor concluíram com sucesso e não produziram
diferenças nos autogerados. Os schemas `meta`/`paramDef`/`res` permanecem iguais;
o tipo manual do payload de moderação em misskey-js foi ajustado.
