# Validação de respostas e originais indisponíveis

Validação em 22/10/2026, na branch `feat/publicacoes-interacoes-mvp`.

## Suítes em conjunto

As mesmas 11 suítes da execução que apresentou timeout foram reexecutadas
em conjunto duas vezes: **207/207 testes aprovados em ambas**. Na segunda
execução, lint e typecheck também estavam em andamento. Não houve aumento
de timeout, remoção de teste ou alteração de configuração de isolamento.

```sh
pnpm --filter frontend test \
  test/unit/note-context.test.ts \
  test/unit/feed-notes.test.ts \
  test/unit/discovery-paginator.test.ts \
  test/unit/note-capture-sync.test.ts \
  test/unit/feed.test.ts \
  test/unit/note-heart.test.ts \
  test/unit/note-navigation.test.ts \
  test/unit/note-hotkeys.test.ts \
  test/unit/mvp-navigation.test.ts \
  test/unit/mvp-secondary.test.ts \
  test/unit/chat-composer.test.ts
```

Foi utilizado Node 26.4.0 para executar o pnpm instalado no projeto.
O timeout anterior não foi reproduzido; isso não permite atribuir uma causa
definitiva nem garantir a ausência de toda intermitência futura.

## Alerta de locales

Comando executado:

```sh
node scripts/check-shipping.mjs --base main
```

Resultado: lint e SPDX aprovados; `Locale safety: FAIL`, com
`forbidden locale change: locales/pt-BR.yml`.

A função `runLocaleSafety` desse script sinaliza qualquer arquivo alterado
cujo caminho começa com `locales/`, termina com `.yml` e é diferente de
`locales/ja-JP.yml`. O conjunto inclui alterações commitadas desde a base,
não commitadas e arquivos novos. Essa verificação não analisa o conteúdo
YAML: aplica a restrição de edição dos arquivos mantidos pelo Crowdin.

O usuário autorizou expressamente a exceção para somente estas traduções:

| Chave | pt-BR |
|---|---|
| `originalNoteDeleted` | A publicação original foi excluída. |
| `originalNoteUnavailable` | A publicação original não está disponível. |

A verificação complementar confirmou:

- YAML válido, sem chaves duplicadas;
- duas chaves novas de tipo string em ja-JP e pt-BR;
- nenhuma outra tradução alterada em relação ao HEAD;
- ausência de parâmetros de interpolação em ambos os idiomas;
- tipos gerados presentes e reprodução exata por `pnpm --filter i18n generate`;
- typecheck do frontend aprovado.

O verificador não foi alterado nem desativado. Sua regra continuará
sinalizando a exceção, inclusive em automações que executem esse comando.
O risco de uma sincronização futura do Crowdin sobrescrever traduções
manuais permanece; a autorização local não modifica a política do Crowdin.

## Limitação histórica

A publicação investigada contém uma menção, mas os dados
consultados apresentam `replyId`, `replyUserId` e `threadId` nulos. Isso não
comprova que tenha sido uma resposta, nem que um original tenha sido excluído.
Ela deve continuar visível no Feed, sem inferência baseada no texto.

O modelo atual mantém a relação `replyId` quando um original é excluído;
essa relação permite filtrar respostas órfãs no Feed. Entretanto, a API não
expõe um motivo persistido para a indisponibilidade do original. Um original
ausente, um objeto `reply` nulo ou um erro `NO_SUCH_NOTE` não comprovam exclusão.

O frontend só afirma exclusão quando recebe evidência explícita, como o evento
de exclusão do servidor ou a conclusão bem-sucedida da ação local. Essa
evidência é limitada à sessão, guarda somente IDs e tem limite de 500 entradas.
Sem essa evidência, apresenta indisponibilidade; falhas temporárias oferecem
nova tentativa. Não recupera o conteúdo do original de um snapshot embutido.

Para distinguir exclusão histórica permanentemente, seria necessário avaliar
um registro mínimo de exclusão e uma indicação segura na API, respeitando
permissões. Essa proposta não foi implementada: não há alterações de backend,
banco, migrations ou contratos de API nesta correção.

## Caso real controlado: aprovado

Após disponibilizar os serviços de teste, o ciclo criar → responder → excluir
→ observar → recarregar foi executado duas vezes contra a API e o streaming
reais, com contas e publicações descartáveis. Serviços utilizados:

```sh
sudo docker compose -f packages/backend/test/compose.yml up -d dbtest redistest
sudo docker compose -f packages/backend/test/compose.yml ps -a
```

O backend foi iniciado em `http://localhost:61812`, com `NODE_ENV=test`, a partir
de uma cópia temporária dos artefatos compilados. Usou o banco descartável
`orphan_validation_20261022` no PostgreSQL de teste (`54312`) e um namespace
próprio no Redis de teste (`56312`). A configuração da aplicação em uso não foi
sobrescrita; nenhum arquivo de backend ou migration foi alterado.

O navegador carregou o frontend atual, encaminhando todas as chamadas de API
e mensagens WebSocket ao servidor isolado. Não houve simulação de respostas da
API nem fabricação do evento de exclusão. A consulta SQL serviu para conferir
a relação persistida; criação, resposta e exclusão ocorreram pela API existente.

Resultados observados na segunda execução:

- Antes da exclusão, a API retornava a resposta com `replyId` apontando para o
  original e o objeto `reply` disponível.
- Após `notes/delete`, o original deixou de existir no banco; a resposta
  permaneceu com os mesmos `replyId`, `replyUserId` e `threadId`.
- A API continuou retornando o mesmo `replyId`, sem conteúdo do original.
- O evento real `noteUpdated` de tipo `deleted` chegou ao navegador. A UI mostrou
  “A publicação original foi excluída.” e removeu o conteúdo e links do original.
- Após recarregar a página da resposta, a relação permaneceu no banco e na API.
  A UI mostrou “A publicação original não está disponível.”, pois não havia
  evidência de exclusão na nova sessão.
- A resposta e seu compositor permaneceram visíveis antes e depois do reload.
  Não houve erros JavaScript no navegador. As capturas foram inspecionadas em
  viewport de 390 × 900 px.

O roteiro, as capturas e a saída de execução foram produzidos em armazenamento
temporário local e não integram este repositório. Este documento registra os
resultados observados; não depende desses artefatos como evidência permanente
e não inclui identificadores das contas ou publicações descartáveis.

Ao terminar, o servidor temporário foi encerrado, o banco descartável foi
removido e as chaves do namespace Redis `localhost:61812` foram limpas.
Os contêineres de teste iniciados pelo usuário permaneceram disponíveis.

A confirmação real elimina a pendência de infraestrutura. Permanece somente
a limitação histórica descrita acima: a relação sobrevive, mas não há um motivo
persistido exposto pela API que autorize afirmar exclusão após recarregar.
