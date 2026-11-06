# Sinalizações por regra: configuração e persistência

Esta entrega implementa somente o backend. Os casos ficam persistidos em
`note_review`; não há tela, endpoint de listagem/resolução nem ampliação do
indicador de denúncias. Não se trata de uma denúncia humana e não existe
atribuição a denunciante.

## Configuração

`admin/update-meta` aceita `reviewWords`; `admin/meta` permite consultar a lista.
Ambos conservam `requireAdmin` e seus escopos existentes. Usuários comuns,
moderadores sem privilégio administrativo e visitantes não podem gerir a lista.
O meta público não recebe a propriedade nem seus valores.

A configuração é independente de `prohibitedWords` e `sensitiveWords`, começa
vazia e não altera suas regras. Não há configuração pela interface nesta fase.
`updateServerSettings` registra apenas `reviewWords` em `changedFields`, nunca
os termos anteriores/novos, inclusive na leitura histórica do log.

Limites da primeira versão:

- Até 100 entradas por requisição, incluindo duplicadas/vazias antes da limpeza.
- Cada entrada tem até 100 pontos de código Unicode, tanto na entrada da API
  quanto após normalização. Uma expansão de compatibilidade que ultrapasse o
  limite é rejeitada.
- NFKC, minúsculas e NFKC são aplicados às regras e a cada campo examinado.
  A comparação literal Unicode sem distinção de maiúsculas (`iu`) também é
  usada na deduplicação, incluindo variantes de sigma grego.
- Acentos são preservados: `CAFÉ` e `café` são equivalentes; `cafe` não é igual
  a `café`. Formas de largura completa são normalizadas por NFKC.
- Espaços nas pontas são removidos e entradas vazias são ignoradas. Espaços
  internos não são condensados; frases continuam sendo literais.
- Curingas `*`/`?`, caracteres de controle/formatação e padrões na notação
  `/expressão/flags` são rejeitados. Outros metacaracteres, como `+`, são
  escapados e comparados literalmente; nunca executam uma expressão fornecida
  pelo administrador.

Uma palavra é delimitada pela ausência de letra, marca combinante, número ou
underscore Unicode imediatamente antes/depois do literal. Para `termoalfa`:

| Conteúdo | Corresponde? |
| --- | --- |
| `termoalfa!`, `(TERMOALFA)` | Sim |
| `supertermoalfa`, `termoalfabeta` | Não |
| `_termoalfa`, `termoalfa2` | Não |
| `étermoalfa`, `termoalfa` seguido de acento combinante | Não |

## Detecção e transação

O ponto central é `NoteCreateService.insertNote`, após os ajustes finais de
visibilidade e preparação do conteúdo já feitos por `create`.
`matchedReviewWords` verifica `userHost === null` e `visibility === 'public'`
antes de acessar os campos. Com a lista vazia, o caminho de criação nem chama
o comparador.

São examinados separadamente texto próprio, aviso de conteúdo e cada
alternativa de enquete. Não se concatenam esses campos. Respostas e citações
públicas locais são elegíveis pelo próprio conteúdo; o original de resposta,
citação ou republicação não é percorrido. Republicações sem texto próprio não
herdam correspondências do original. `localOnly` não exclui uma nota pública.
Agendadas passam pelo mesmo serviço quando efetivamente publicadas; salvar o
rascunho não cria caso. Não há varredura retroativa ao mudar a configuração.

Chat, notas remotas e visibilidades `home`, `followers` e `specified` não são
examinados. A elegibilidade usa a visibilidade final, inclusive quando outra
política existente reduz uma solicitação inicialmente pública para `home`.

O comportamento anterior usava transação explícita apenas para notas com
enquete. Agora, notas com correspondência também usam uma transação:

1. Inserção da nota pelo `EntityManager` da transação.
2. Inserção da enquete, quando presente, pelo mesmo manager.
3. Inserção do caso, com o mesmo manager e `ON CONFLICT DO NOTHING`.
4. Commit; somente então `insertNote` retorna e `create` agenda
   `postNoteCreated`.

Uma falha no caso rejeita a operação e reverte nota/enquete, em vez de publicar
uma nota sem a pendência exigida. É falha técnica de persistência, não rejeição
por palavra. O erro encaminhado ao logger não inclui parâmetros SQL com a lista
privada. O caminho sem correspondência e sem enquete mantém a inserção simples.

A persistência não depende de Redis, WebSocket, `setImmediate`, navegador ou
sessão de moderador. Não há alteração de visibilidade, recomendação, alcance ou
conta pela regra. Não são chamados os fluxos de denúncia humana, e-mail ou
webhook de moderação; os efeitos normais de uma publicação continuam existindo.

## Dados e migration

`MiNoteReview`/`note_review` guardam somente:

- `originalNoteId`: chave primária, um caso por ID original;
- `noteId`: referência anulável à nota, com `ON DELETE SET NULL`;
- `matchedWords`: termos normalizados da configuração que corresponderam,
  sem repetições;
- `createdAt`: momento de criação do caso no banco;
- `state`: inicialmente `pending`.

Não são copiados corpo, trechos, CW, alternativas ou perfil. Várias ocorrências
ou termos geram um único caso. Reprocessar o ID não substitui os termos iniciais,
não altera a data e não redefine o estado, inclusive após exclusão da nota.
Excluir/republicar gera outro ID e pode gerar outro caso.

Ao excluir a nota, o caso continua com o ID original, `noteId = null` e seus
metadados mínimos. A futura interface não poderá recuperar o texto desse caso.
Falsos positivos serão tratados por revisão humana numa entrega posterior;
nesta fase nenhum caso aplica sanção automática.

A migration `1793907376174-NoteReviews.js` cria tabela, índice de estado/ID,
referência e coluna administrativa. `down` remove essas estruturas e seus dados;
não deve ser executado indiscriminadamente numa instalação em uso. A validação
nos dois sentidos ocorreu exclusivamente no banco descartável.

## Validação

Os testes unitários exercitam normalização, limites, literalidade, Unicode,
campos separados, elegibilidade antes do conteúdo, lista vazia, configuração e
log protegido. O teste da transação usa managers simulados para confirmar que
nota/enquete/caso são inseridos juntos e que o retorno aguarda o commit.
As regressões existentes dos logs de configuração e webhooks também são usadas.

`test/e2e/note-review.ts` usa API, banco e WebSocket reais no ambiente E2E do
repositório, sem simular os transportes. A execução desta tarefa usou cópia
temporária das fontes, banco PostgreSQL exclusivo, Redis de teste com DB/prefixo
exclusivos, contas fictícias e termos neutros. Isolamento e ausência dos recursos
foram confirmados antes da primeira escrita. Workers de entrega externa não
foram iniciados e não foram configurados destinatários ou webhooks.

O cenário HTTP/SQL cobre configuração e permissões, lista vazia, ausência de
varredura retroativa, múltiplas ocorrências/termos, `localOnly`, respostas,
citações/republicações, CW, enquete, visibilidades excluídas e redução para
`home`. Consultas SQL verificam diretamente unicidade, estado, referências e as
cinco colunas permitidas. Reprocessamentos concorrentes usam transações reais.
Uma trigger temporária provoca falha depois de inserir nota/enquete para
comprovar rollback, sem eventos de publicação observados no WebSocket. A trigger
é removida no próprio teste. A exclusão por HTTP conserva o caso em SQL, sem
conteúdo copiado; nenhum registro de denúncia humana é criado.

A migration foi gerada a partir das entidades e exercitada em `up → down → up`,
com 15 asserções e zero DDL pendente. `pnpm --filter backend check-migrations`
confirmou o alinhamento do schema. Essa execução valida a nova migration sobre
um schema de referência; não substitui a execução de todo o histórico de
migrations no CI.

A prova de reinício encerrou o servidor E2E e iniciou um novo processo pela
entrada normal `built/entry.js`, em modo somente servidor, sem clustering,
daemons ou workers de filas. Foi usado o mesmo banco exclusivo com
`NODE_ENV=development`, pois o modo de testes padrão recria o schema ao iniciar
e não serve para comprovar persistência entre processos. Não houve mudança no
código da aplicação para essa prova. Quinze asserções confirmaram que os cinco
casos existentes ficaram idênticos, incluindo as pendências, e que uma nova
publicação pública após o reinício criou seu caso. O processo foi encerrado ao
terminar. Nenhuma sessão de navegador de moderador participou dessa prova.

Resultado: 113 testes unitários em quatro suítes (35 da funcionalidade e 78 de
regressão), uma suíte integrada HTTP/SQL/WebSocket com vários cenários, 15
asserções de migration e 15 de reinício aprovados. A exclusão por HTTP e a
concorrência por SQL foram exercitadas; notas remotas foram cobertas pela
verificação unitária de elegibilidade. O caminho de agendadas foi conferido no
código do processor, que chama `NoteCreateService.fetchAndCreate`; não se iniciou
um worker de agendamento nesta validação.

Typechecks de backend, frontend e SDK, lint direcionado de implementação e
testes, SPDX, segurança de locales e diff aprovados. A geração de
`misskey-js`/API Extractor foi executada na cópia descartável e produziu somente
a inclusão de `reviewWords` nos tipos de leitura/escrita do meta administrativo.
Não houve alteração de locales nem do meta público. Não foi executado build
completo do frontend nesta entrega.

Limitações: os termos apenas identificam correspondências textuais. Não avaliam
contexto, ironia, imagens/áudio, grafias evasivas ou conflitos sem os termos
configurados. A revisão humana, tratamento de falsos positivos, retenção dos
casos e interface pertencem à próxima etapa; um caso pendente não aplica punição
nem representa atendimento de moderação 24 horas.

Ao concluir a validação, foram removidos apenas o banco descartável, 72 chaves
Redis do prefixo exclusivo e a cópia temporária com seus roteiros/resultados.
As portas HTTP/controlador ficaram livres. Os contêineres de teste e outros
bancos/prefixos foram preservados. Nenhum dado real foi consultado ou alterado;
nenhum commit, push ou merge foi feito nesta etapa.
