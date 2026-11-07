# Revisão das sinalizações por regra

Esta entrega acrescenta configuração administrativa, consulta e encerramento aos
casos persistidos pelo PR #15. Não converte correspondências em denúncias humanas
e não aplica sanções, mudanças de alcance ou alertas externos.

## Configuração e acesso

Em `/admin/moderation`, administradores encontram **Termos para revisão**. A
interface usa `admin/meta` e `admin/update-meta`, mantendo sua autorização de
administrador no backend. A lista completa não é entregue ao moderador, ao
usuário comum ou ao meta público. O texto digitado permanece em caso de erro.

A validação é a já existente: até 100 entradas e 100 pontos de código Unicode
por entrada, comparação literal, normalização Unicode e de maiúsculas,
deduplicação, acentos preservados e limites de palavra. Não há duplicação do
comparador no frontend. A configuração continua vazia por padrão; a migration
não ativa termos. Apenas novas publicações públicas locais são examinadas.

O log de configuração continua registrando somente `reviewWords` em
`changedFields`, sem valores anteriores ou novos.

## Fila e navegação

- `/admin/abuses` mantém a fila e os links de denúncias humanas.
- `/admin/abuses#rules` abre diretamente **Sinalizações por regra**; o hash
  acompanha navegação, histórico e recarregamento.
- A nova aba começa em pendentes e permite consultar encerrados.
- Cada cartão identifica a origem automática, momento, termos correspondentes,
  estado e acesso à publicação. Não existe denunciante fictício.
- Moderadores recebem somente os termos correspondentes de cada caso, não a
  configuração completa.

`admin/note-reviews` exige credencial, função de moderador/administrador e o
escopo existente `read:admin:abuse-user-reports`. Aceita `limit` de 1 a 100,
`sinceId`, `untilId` e `state` (`pending`, `resolved`, `all`; padrão `pending`).
`caseIds` permite revalidar até 100 IDs distintos por requisição. A ordenação e
os cursores usam o ID original imutável, não a data de encerramento.

A atualização de casos carregados mantém cartões, cursores e seleção em vez de
reiniciar toda a paginação. Casos encerrados por outra sessão mostram o resultado
na mesma posição até a próxima atualização explícita ou troca de filtro, com
aviso na tela. Novos casos podem ser carregados pelo botão indicado. Ao encerrar
o próprio caso na fila pendente, o foco volta ao filtro; se outra sessão encerrar
o caso cujo controle estava focado, o foco passa ao resultado desse caso.

A prévia é consultada em `notes/show`, sem contornar suas regras de acesso.
`noteId = null` ou um evento explícito de exclusão permite mostrar **Publicação
excluída**. Um 404, falha de rede ou conteúdo oculto não confirma exclusão:
a interface mostra indisponibilidade e permite nova tentativa. Uma exclusão
confirmada remove a prévia; uma resposta atrasada não restaura o conteúdo.

## Encerramento e auditoria

O moderador precisa escolher um resultado antes de habilitar **Encerrar caso**:

- falso positivo / nenhuma ação necessária (`falsePositive`);
- revisão concluída (`reviewed`);
- conteúdo indisponível (`unavailable`).

`admin/resolve-note-review` exige credencial, função de moderador/administrador e
o escopo existente `write:admin:resolve-abuse-user-report`. Não há reabertura,
texto livre ou alteração automática de publicação/conta.

A migration incremental `1793969197734-NoteReviewResolution.js` acrescenta três
campos anuláveis: `resolvedById`, `resolvedAt` e `resolution`. O ID do responsável
é conservado como identificador de auditoria, sem copiar o perfil. A migration
do PR #15 não é alterada. `down` remove os três campos e seus dados; sua execução
foi restrita ao banco descartável.

`NoteReviewService.resolve` bloqueia a linha na transação. A primeira decisão é
persistida junto ao evento de moderação `resolveNoteReview`, pelo mesmo
`EntityManager`. O log contém somente ID do caso, resultado e momento; autor e
tipo seguem o formato normal do histórico. Não contém termos, texto ou
snapshots. Falha no log reverte também a resolução.

Requisições concorrentes ou repetidas retornam a primeira decisão com
`alreadyResolved: true`, sem trocar o responsável e sem duplicar o log ou o
evento. A interface apresenta a decisão existente. Eventos de criação e
resolução são emitidos após commit, com corpo vazio, apenas para invalidar o
estado administrativo. Não há dependência desses eventos para persistir o caso.

## Indicador compartilhado e sessão

O monitor existente consulta as duas filas com `limit: 1`: denúncias humanas
não resolvidas e sinalizações pendentes. Cada fila mantém resultado e erro
independentes. O indicador fica ativo se qualquer uma tem pendência confirmada;
falha não equivale a fila vazia e preserva o último resultado válido.

Há links distintos para as filas e acesso normal ao painel. Não são exibidas
contagens, nomes, conteúdo ou termos no indicador. São reutilizados eventos,
reconexão, retorno à aplicação, agrupamento de eventos e revalidação a cada 60
segundos somente com página visível. Os componentes compartilham uma única
assinatura administrativa.

Logout, troca de conta e perda de função removem estado, conteúdo da fila,
timers e assinaturas. Negativas explícitas de autorização do backend também
interrompem o monitor, inclusive quando a função local ainda estiver antiga.
Respostas de sessões anteriores não restauram o estado. Após uma negativa de
autorização, a mesma identidade antiga não reativa o monitor; é necessária uma
sessão atualizada ou recarregamento após a regularização do acesso. Falhas de rede
continuam recuperáveis, sem pop-ups ou sons repetitivos.

## Validação e limites

A validação usa dados fictícios. O Docker local estava sem permissão; foi criado
um cluster PostgreSQL 18 próprio e um Redis 7.2.4 compilado da distribuição
oficial, ambos em `/tmp`, loopback e portas exclusivas. Nenhuma configuração ou
dado da instância real foi consultado. Os workers de entrega externa não foram
iniciados e não foram configurados SMTP, destinatários ou webhooks.

- Unitários de backend: normalização, permissões declaradas, lock, log mínimo,
  espera pelo commit, idempotência e regressões dos logs de configuração/webhooks.
- Frontend com respostas simuladas: falhas parciais, sessão, assinaturas,
  paginação, foco, seleção, conteúdo excluído/indisponível e recuperação.
- HTTP/SQL/WebSocket reais: configuração, criação, fila, resultados concorrentes,
  repetição, histórico mínimo, paginação, exclusão, rollback por falha no log e
  regressão das denúncias humanas.
- Migration em banco exclusivo: `up → down → up`, 12 asserções e zero DDL pendente.

Resultados finais: 126 testes unitários de backend em cinco suítes e 536 testes
de frontend em 44 suítes, com `TZ=UTC`, aprovados. Os dois cenários integrados
HTTP/SQL/WebSocket também passaram em conjunto após as asserções finais.

O Chromium executou o fluxo real: administrador configura termos pela interface,
usuário publica, moderador encontra o caso pelo indicador e encerra por teclado;
o SQL confirma resultado e responsável e o indicador se atualiza. O resultado
continua disponível após recarregar. A navegação direta, histórico, exclusão da
nota, resolução por outra sessão e revogação real da permissão foram conferidos.

As larguras 1440, 390 e 320 px foram verificadas sem overflow horizontal da
página. Os novos controles têm nomes acessíveis, foco de teclado visível e alvos
de 44 px. Em 390 e 320 px, o menu e o encerramento por toque foram exercitados.
A configuração administrativa também foi exercitada em 320 px, com teclado,
rótulo associado ao campo e gravação por toque.
Falhas iniciais e parciais de rede foram injetadas interrompendo a requisição no
navegador; os dados e as demais chamadas continuaram vindo do backend real.
A recuperação ocorreu sem recarregar. Mobile usa emulação, sem aparelho físico.

Uma reexecução integrada não chegou aos testes porque o backend temporário da
validação visual ainda ocupava a porta do harness. Foi encerrado somente esse
processo, confirmadas as portas livres e repetidos os dois testes com sucesso.
Não foi necessária alteração do código da aplicação por essa falha de preparo.

Lint direcionado, typechecks de backend/frontend/SDK, geração de tipos,
verificação estrutural de locales, SPDX e `git diff --check` passaram.
O build completo do frontend fica pendente para o CI; o backend e o SDK são
compilados para os testes e geração de tipos.

A exceção de tradução autorizada inclui somente as novas chaves necessárias em
`ja-JP.yml` e `pt-BR.yml`, com tipos regenerados. O verificador permanece intacto:
`check-shipping --base main` sinaliza `pt-BR.yml` pela restrição de edição, não
por defeito de YAML, chaves, interpolação ou tipos. Esse check não deve ser
declarado integralmente aprovado enquanto a exceção for sinalizada.

O mecanismo continua limitado a correspondências textuais. Não determina
infração nem detecta todo conflito. Contexto, ironia, mídia, grafias evasivas e
conflitos sem os termos configurados exigem outros meios de identificação e
revisão humana. Não há atendimento automático 24 horas, alerta com o aplicativo
fechado, varredura retroativa nem mudança na detecção de notas remotas ou do
worker de agendamento da primeira etapa.

Ao terminar, foram encerrados os processos próprios de backend, Vite, PostgreSQL
e Redis; o banco exclusivo e o banco auxiliar da migration foram removidos.
A cópia de fontes, roteiros, capturas e demais artefatos descartáveis também
foram removidos, com as portas próprias livres. Os contêineres de teste iniciados
pelo usuário foram preservados. Não houve commit, push ou merge.
