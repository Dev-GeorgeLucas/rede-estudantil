# Escopo do MVP — Rede Estudantil

## Informações do documento

| Item | Definição |
|---|---|
| Projeto | Rede Estudantil |
| Base técnica | Misskey 2026.9.1 |
| Prazo | 3 meses |
| Estado | Escopo inicial aprovado |
| Estratégia | Customização conservadora do Misskey |
| Público inicial | Pequeno grupo de estudantes convidados |
| Federação | Desativada no MVP |

## 1. Visão do produto

A Rede Estudantil será uma plataforma social open source voltada à convivência, à comunicação e à criação de comunidades entre estudantes.

A aplicação permitirá que estudantes publiquem conteúdo, interajam, descubram pessoas e participem de comunidades relacionadas a cursos, turmas, projetos e interesses.

O projeto utiliza o Misskey como base técnica, mas terá navegação, identidade visual, linguagem e experiência adaptadas ao contexto estudantil.

A Rede Estudantil é um projeto independente e não representa oficialmente nenhuma instituição de ensino. Nomes, marcas e símbolos institucionais somente poderão ser utilizados mediante autorização.

## 2. Objetivo do MVP

O MVP deverá entregar uma versão funcional, acessível e visualmente consistente da Rede Estudantil, capaz de demonstrar o fluxo completo de uso:

1. Receber um convite;
2. Criar uma conta;
3. Configurar o perfil;
4. Encontrar pessoas e comunidades;
5. Criar uma publicação;
6. Interagir com outras publicações;
7. Receber notificações;
8. Denunciar ou bloquear conteúdo inadequado;
9. Administrar usuários e denúncias.

O objetivo não é reconstruir todo o Misskey. O projeto deverá aproveitar sua infraestrutura existente e simplificar a experiência apresentada ao usuário.

## 3. Restrições do projeto

O desenvolvimento deverá considerar:

- prazo máximo de três meses;
- equipe pequena;
- prioridade para uma demonstração sólida;
- necessidade de documentação para novos colaboradores;
- manutenção futura do fork;
- compatibilidade com atualizações do Misskey;
- segurança e moderação de uma comunidade estudantil;
- funcionamento adequado em computadores e celulares;
- uso de tecnologias e serviços open source sempre que possível.

## 4. Princípios do produto

### 4.1 Simplicidade

As funcionalidades mais importantes devem estar visíveis. Recursos técnicos ou avançados não devem competir com as tarefas principais.

### 4.2 Acessibilidade

A acessibilidade deverá ser considerada durante todo o desenvolvimento, e não apenas na etapa final.

### 4.3 Personalização segura

O usuário poderá personalizar sua experiência dentro de limites que preservem legibilidade, segurança e consistência visual.

### 4.4 Comunidade

A organização por comunidades será uma parte central da experiência.

### 4.5 Moderação

Denúncia, bloqueio, silenciamento e administração deverão funcionar antes de qualquer teste público.

### 4.6 Aproveitamento da base existente

Sempre que possível, recursos do Misskey deverão ser configurados, renomeados ou ocultados, evitando alterações profundas no backend.

## 5. Público e papéis

### 5.1 Estudante

Pode:

- criar e editar seu perfil;
- publicar conteúdo;
- reagir e responder;
- seguir outros usuários;
- entrar em comunidades;
- receber notificações;
- salvar publicações;
- denunciar conteúdo;
- bloquear ou silenciar usuários;
- personalizar sua aparência.

### 5.2 Moderador

Pode:

- consultar denúncias;
- avaliar conteúdo denunciado;
- aplicar ações de moderação;
- ocultar conteúdo quando necessário;
- silenciar ou suspender usuários;
- consultar as regras da comunidade.

O uso de um papel separado de moderador poderá ser simplificado no MVP caso as tarefas sejam realizadas pelo administrador.

### 5.3 Administrador

Pode:

- gerenciar usuários;
- administrar convites;
- configurar a instância;
- gerenciar comunidades;
- consultar denúncias;
- moderar conteúdo;
- administrar emojis e elementos visuais;
- controlar configurações de segurança;
- acompanhar o funcionamento do servidor.

## 6. Decisões aprovadas para o MVP

| Decisão | Definição |
|---|---|
| Modelo de acesso | Cadastro por convite |
| Tamanho inicial | Menos de 100 usuários |
| Federação | Desativada |
| ActivityPub externo | Não será exposto no MVP |
| Nome dos canais | Comunidades |
| Mensagens privadas | Fora do MVP |
| Experiência principal | Feed e comunidades |
| Prioridade de interface | Mobile-first |
| Personalização | Temas, cores e perfil |
| Editor de CSS por usuário | Desativado |
| Vínculo institucional | Nenhum vínculo oficial sem autorização |
| Implantação inicial | Ambiente controlado de demonstração e testes |

## 7. Arquitetura da informação

A navegação principal deverá conter no máximo cinco áreas:

1. **Início**
2. **Explorar**
3. **Comunidades**
4. **Notificações**
5. **Perfil**

A criação de uma publicação deverá ter um botão visível chamado **Publicar**.

Configurações, ajuda, regras e administração deverão ficar em áreas secundárias.

### 7.1 Início

Deverá apresentar:

- publicações recentes da rede local;
- publicações de pessoas seguidas;
- acesso rápido ao compositor;
- alternância clara entre os feeds disponíveis.

### 7.2 Explorar

Deverá permitir encontrar:

- pessoas;
- comunidades;
- publicações;
- assuntos ou hashtags em destaque.

### 7.3 Comunidades

Deverá apresentar:

- comunidades das quais o usuário participa;
- comunidades disponíveis;
- descrição e regras de cada comunidade;
- publicações da comunidade;
- ação para entrar ou sair.

### 7.4 Notificações

Deverá organizar:

- respostas;
- menções;
- reações;
- novos seguidores;
- atividades relevantes das comunidades.

### 7.5 Perfil

Deverá apresentar:

- avatar;
- imagem de capa;
- nome;
- identificador;
- biografia;
- links;
- publicações;
- informações opcionais do contexto estudantil;
- ações de seguir, bloquear, silenciar e denunciar.

## 8. Correspondência com recursos do Misskey

Para reduzir alterações estruturais, os recursos existentes serão apresentados com linguagem mais simples.

| Misskey | Rede Estudantil |
|---|---|
| Notes | Publicações |
| Channels | Comunidades |
| Renote | Republicar |
| Reactions | Reações |
| Favorites | Salvos |
| Local timeline | Feed geral |
| Home timeline | Seguindo |
| Content warning | Aviso de conteúdo |
| Instance | Rede ou servidor |
| Drive | Arquivos, quando necessário |
| Moderation reports | Denúncias |

Essa adaptação deverá priorizar textos e componentes de interface. Não será realizada uma renomeação destrutiva das estruturas internas do Misskey.

## 9. Funcionalidades obrigatórias

### 9.1 Cadastro e acesso

O MVP deverá permitir:

- entrada por convite;
- criação de conta;
- login;
- encerramento de sessão;
- recuperação de acesso, se o ambiente estiver configurado para envio de e-mail;
- aceite das regras da comunidade;
- tratamento claro de erros.

#### Critérios de conclusão

- um convite válido permite criar uma conta;
- um convite inválido ou usado apresenta uma mensagem compreensível;
- o usuário consegue entrar e sair da conta;
- senhas nunca aparecem em logs ou no repositório;
- o fluxo funciona por teclado e em telas pequenas.

### 9.2 Onboarding

Após o cadastro, o usuário deverá conseguir:

- escolher nome de exibição;
- adicionar avatar;
- escrever uma biografia;
- selecionar interesses;
- descobrir comunidades;
- seguir algumas pessoas;
- concluir ou pular etapas opcionais.

#### Critérios de conclusão

- o onboarding utiliza linguagem simples;
- nenhuma etapa opcional impede o uso da rede;
- o usuário chega ao feed ao finalizar;
- o fluxo funciona no celular;
- o progresso e os erros são perceptíveis sem depender apenas de cor.

### 9.3 Perfil

O perfil deverá permitir:

- avatar;
- imagem de capa;
- nome;
- biografia;
- links;
- cor ou tema;
- edição das informações;
- visualização das publicações.

Informações como curso, turma ou área de interesse deverão ser opcionais. O usuário não deverá ser obrigado a divulgar dados acadêmicos ou pessoais.

#### Critérios de conclusão

- o perfil permanece legível com informações longas;
- avatar e capa têm texto alternativo ou tratamento acessível;
- links externos são identificados;
- o perfil funciona em diferentes tamanhos de tela;
- cores personalizadas não comprometem o contraste.

### 9.4 Publicações

O usuário deverá conseguir publicar:

- texto;
- imagens;
- enquete;
- aviso de conteúdo;
- menções;
- hashtags;
- publicação dentro de uma comunidade.

Recursos de vídeo poderão continuar tecnicamente disponíveis, mas não serão prioridade de personalização e validação no MVP.

#### Critérios de conclusão

- criar, editar e excluir uma publicação funciona;
- imagens permitem descrição alternativa;
- a ausência de descrição alternativa gera um lembrete não bloqueante;
- o compositor informa erros de forma clara;
- publicar em uma comunidade identifica corretamente o destino;
- conteúdo sensível pode ser sinalizado.

### 9.5 Interações

O usuário deverá conseguir:

- reagir;
- responder;
- republicar;
- salvar;
- seguir ou deixar de seguir;
- copiar o link de uma publicação.

#### Critérios de conclusão

- todas as ações possuem retorno visual e textual;
- botões possuem nomes acessíveis;
- o estado de cada ação é compreensível;
- ações destrutivas solicitam confirmação quando necessário.

### 9.6 Feed

O MVP deverá apresentar:

- feed de pessoas seguidas;
- feed geral local;
- feed de cada comunidade;
- carregamento progressivo;
- estado vazio;
- tratamento de falha.

#### Critérios de conclusão

- não existem feeds federados visíveis;
- o usuário entende qual feed está visualizando;
- novas publicações não causam perda inesperada da posição de leitura;
- estados de carregamento e erro são acessíveis;
- o feed funciona em telas a partir de 360 px.

### 9.7 Comunidades

Os canais do Misskey serão apresentados como comunidades.

Cada comunidade deverá possuir:

- nome;
- descrição;
- imagem;
- regras;
- administradores ou responsáveis;
- participantes;
- feed próprio;
- ação para entrar ou sair.

Exemplos possíveis:

- cursos;
- turmas;
- projetos;
- eventos;
- esportes;
- arte e cultura;
- tecnologia;
- oportunidades.

#### Critérios de conclusão

- o usuário consegue descobrir comunidades;
- entrar e sair funciona;
- publicações aparecem na comunidade correta;
- regras ficam visíveis antes da participação;
- comunidades vazias possuem orientação clara;
- administradores conseguem moderar conteúdo.

### 9.8 Pesquisa e descoberta

A busca deverá permitir encontrar:

- usuários;
- comunidades;
- publicações;
- hashtags.

#### Critérios de conclusão

- a busca possui rótulo acessível;
- resultados são separados por categoria;
- buscas sem resultado apresentam orientação;
- conteúdos ou usuários bloqueados respeitam as regras do sistema.

### 9.9 Notificações

O sistema deverá notificar:

- respostas;
- menções;
- reações;
- novos seguidores;
- atividades relevantes.

#### Critérios de conclusão

- notificações lidas e não lidas são distinguíveis sem depender somente de cor;
- o usuário consegue abrir o conteúdo relacionado;
- notificações possuem contexto suficiente;
- preferências existentes do Misskey são preservadas quando úteis.

### 9.10 Segurança e moderação

O usuário deverá conseguir:

- denunciar uma publicação;
- denunciar um perfil;
- bloquear um usuário;
- silenciar um usuário;
- marcar conteúdo sensível;
- consultar as regras.

Administradores deverão conseguir:

- receber denúncias;
- consultar o motivo;
- analisar o conteúdo relacionado;
- aplicar medidas de moderação;
- suspender contas;
- registrar a resolução.

#### Critérios de conclusão

- denúncias chegam ao painel administrativo;
- usuários bloqueados deixam de interagir conforme as regras do sistema;
- a denúncia não revela desnecessariamente a identidade do denunciante;
- ações administrativas críticas exigem confirmação;
- regras ficam disponíveis antes e depois do cadastro.

## 10. Personalização visual

O MVP poderá oferecer:

- tema claro;
- tema escuro;
- temas predefinidos;
- escolha de cor de destaque;
- avatar;
- imagem de capa;
- emojis personalizados;
- densidade confortável ou compacta, se viável;
- decoração de perfil limitada e moderada.

Não será permitido no MVP:

- executar JavaScript personalizado;
- inserir HTML arbitrário;
- editar CSS livremente;
- utilizar combinações que tornem conteúdo ilegível;
- alterar componentes essenciais da navegação por usuário.

Toda personalização deverá respeitar contraste, foco visível e legibilidade.

## 11. Acessibilidade

A meta será atender aos critérios essenciais da WCAG 2.2 nível AA nos fluxos principais.

### 11.1 Requisitos

- navegação completa por teclado;
- foco visível;
- ordem de foco coerente;
- uso correto de títulos e regiões;
- campos com rótulos;
- botões com nomes acessíveis;
- contraste mínimo adequado;
- suporte a zoom de 200%;
- suporte a redução de movimento;
- ausência de informação transmitida apenas por cor;
- mensagens de erro associadas ao campo correto;
- descrição alternativa para imagens;
- áreas clicáveis com tamanho adequado;
- interface funcional a partir de 360 px;
- textos compreensíveis em português do Brasil.

### 11.2 Validação

Os fluxos críticos deverão ser testados com:

- teclado;
- leitor de tela disponível no ambiente;
- zoom de 200%;
- preferência `prefers-reduced-motion`;
- tema claro;
- tema escuro;
- ferramentas automáticas de auditoria;
- pelo menos uma pessoa que não participou diretamente da implementação.

Ferramentas automáticas não substituem testes manuais.

## 12. Recursos ocultados ou desativados

Os seguintes recursos não farão parte da experiência principal do MVP:

- federação;
- feeds federados;
- relays;
- antenas;
- páginas;
- jogos;
- conquistas;
- anúncios;
- doações;
- webhooks;
- tokens de API para usuários comuns;
- integrações técnicas avançadas;
- painel dedicado de arquivos;
- listas avançadas;
- clips avançados;
- editor de CSS;
- ferramentas de desenvolvedor;
- configurações detalhadas de ActivityPub;
- mensagens privadas.

Sempre que possível, esses recursos deverão ser ocultados por configuração, permissão ou interface.

A remoção definitiva de backend somente deverá ocorrer quando:

1. o MVP estiver estável;
2. houver uma justificativa técnica;
3. existirem testes;
4. o impacto sobre atualizações do Misskey estiver documentado.

## 13. Itens fora do escopo

Não fazem parte do MVP:

- aplicativo móvel nativo;
- login institucional ou integração oficial com sistemas acadêmicos;
- federação pública;
- recomendação de conteúdo por inteligência artificial;
- transmissão ao vivo;
- chamadas de áudio ou vídeo;
- plataforma de vídeos;
- marketplace;
- pagamentos;
- sistema completo de eventos;
- gamificação avançada;
- editor visual de perfil;
- migração de contas externas;
- suporte a milhares de usuários;
- análise avançada de comportamento;
- reconstrução completa do backend.

Esses itens poderão ser avaliados após a entrega.

## 14. Direção de interface

A interface deverá ser:

- simples;
- contemporânea;
- jovem sem parecer infantil;
- organizada;
- mobile-first;
- consistente;
- acessível;
- visualmente personalizável;
- menos técnica que a interface original do Misskey.

### 14.1 Regras

- limitar a navegação principal a cinco destinos;
- evitar excesso de botões simultâneos;
- utilizar linguagem direta;
- esconder configurações avançadas;
- manter ações principais em posições previsíveis;
- evitar efeitos visuais que prejudiquem desempenho ou leitura;
- respeitar redução de movimento;
- manter componentes consistentes;
- priorizar hierarquia tipográfica e espaçamento;
- não depender de ícones sem rótulo em ações ambíguas.

## 15. Estratégia técnica

### 15.1 Ordem de preferência

Ao adaptar o Misskey, utilizar esta ordem:

1. configuração existente;
2. permissão ou papel;
3. alteração de texto;
4. alteração de tema e tokens visuais;
5. ocultação na interface;
6. adaptação de componente;
7. nova funcionalidade isolada;
8. alteração do backend;
9. remoção definitiva de código.

### 15.2 Áreas que devem ser preservadas

Evitar alterações profundas em:

- federação;
- ActivityPub;
- banco de dados central;
- autenticação;
- sistema de filas;
- armazenamento de arquivos;
- migrations existentes;
- APIs internas utilizadas pelo frontend;
- atualização e migração do Misskey.

### 15.3 Fluxo Git

Cada alteração deverá utilizar:

- uma branch própria;
- commits objetivos;
- Pull Request;
- revisão antes do merge;
- verificação de build;
- documentação quando necessária.

A branch `main` deverá permanecer utilizável.

## 16. Segurança e privacidade

O MVP deverá seguir estas regras:

- nenhum segredo no Git;
- senhas temporárias removidas após a configuração;
- produção somente com HTTPS;
- coleta mínima de dados pessoais;
- campos acadêmicos opcionais;
- acesso inicial por convite;
- regras claras de convivência;
- possibilidade de bloquear e denunciar;
- dependências instaladas pelo lockfile;
- backups antes de atualizações;
- arquivos enviados tratados como conteúdo não confiável;
- acesso administrativo restrito;
- logs sem exposição de senhas e tokens;
- nenhuma marca institucional sem autorização.

Antes de uma implantação pública, deverão ser definidos:

- política de privacidade;
- termos de uso;
- regras da comunidade;
- política de retenção de dados;
- processo de resposta a denúncias;
- rotina de backup;
- responsável pela administração.

## 17. Requisitos de qualidade

Uma entrega somente poderá ser considerada pronta quando:

- `pnpm build` finalizar com sucesso;
- conexões com PostgreSQL e Redis funcionarem;
- migrations estiverem atualizadas;
- não houver erro crítico no console;
- fluxos principais funcionarem em desktop e celular;
- navegação por teclado funcionar;
- contraste crítico estiver validado;
- nenhuma credencial estiver no commit;
- documentação relacionada estiver atualizada;
- a mudança tiver sido testada em uma conta comum;
- ações administrativas tiverem sido testadas em uma conta administrativa.

## 18. Critérios de sucesso do MVP

O MVP será considerado bem-sucedido quando:

- um novo colaborador conseguir instalar o projeto seguindo apenas a documentação;
- um estudante conseguir entrar por convite sem ajuda;
- um estudante conseguir configurar o perfil;
- um estudante conseguir publicar no feed e em uma comunidade;
- outro estudante conseguir reagir, responder e salvar;
- notificações funcionarem;
- denúncia, bloqueio e silenciamento funcionarem;
- um administrador conseguir analisar uma denúncia;
- a interface funcionar em celular e desktop;
- os principais fluxos puderem ser usados por teclado;
- a identidade da Rede Estudantil estiver aplicada;
- recursos fora do escopo não confundirem o usuário;
- uma demonstração completa puder ser realizada sem intervenção técnica.

## 19. Cronograma de 12 semanas

### Semanas 1 e 2 — Fundação

- configurar ambiente;
- criar repositório;
- documentar instalação;
- definir escopo;
- validar build, banco e migrations;
- registrar decisões técnicas.

### Semanas 3 e 4 — Identidade e navegação

- definir identidade visual;
- criar tokens de cor e tipografia;
- aplicar nome e elementos da marca;
- simplificar navegação;
- ajustar navegação mobile;
- ocultar recursos fora do escopo.

### Semanas 5 e 6 — Conta, onboarding e perfil

- adaptar cadastro por convite;
- simplificar onboarding;
- adaptar perfil;
- implementar personalização segura;
- revisar mensagens e linguagem em português.

### Semanas 7 e 8 — Feed e comunidades

- simplificar compositor;
- organizar feeds;
- transformar canais em comunidades;
- melhorar descoberta de comunidades;
- validar publicação e interação.

### Semana 9 — Acessibilidade

- revisar teclado;
- revisar foco;
- revisar contraste;
- revisar formulários;
- testar redução de movimento;
- testar leitor de tela;
- corrigir problemas críticos.

### Semana 10 — Moderação e segurança

- revisar denúncias;
- revisar bloqueio e silenciamento;
- configurar regras;
- testar administração;
- revisar exposição de dados;
- revisar dependências e configuração.

### Semana 11 — Testes e documentação

- executar testes completos;
- testar com usuários;
- corrigir falhas;
- atualizar documentação;
- preparar dados de demonstração;
- preparar apresentação.

### Semana 12 — Reserva e entrega

- corrigir problemas finais;
- validar instalação limpa;
- validar build final;
- preparar versão demonstrável;
- registrar limitações;
- concluir apresentação.

## 20. Prioridades

### P0 — Obrigatório para entrega

- instalação reproduzível;
- cadastro por convite;
- login;
- perfil;
- publicação;
- feed;
- comunidades;
- interações;
- notificações;
- denúncia;
- bloqueio;
- administração;
- interface responsiva;
- acessibilidade dos fluxos principais;
- documentação.

### P1 — Importante, mas negociável

- onboarding guiado;
- temas predefinidos;
- cor de destaque;
- descoberta aprimorada;
- decoração de perfil;
- melhorias de densidade;
- refinamentos de animação.

### P2 — Depois do MVP

- mensagens privadas;
- aplicativo nativo;
- integrações institucionais;
- eventos;
- gamificação;
- federação;
- recomendações;
- recursos avançados de personalização.

Uma tarefa P1 ou P2 não deverá atrasar uma tarefa P0.

## 21. Riscos e respostas

| Risco | Resposta |
|---|---|
| Complexidade do Misskey | Evitar alterações profundas no núcleo |
| Prazo curto | Manter o escopo congelado e priorizar P0 |
| Pouca participação da equipe | Documentar tarefas pequenas e independentes |
| Interface excessivamente complexa | Reduzir navegação e esconder recursos avançados |
| Problemas de acessibilidade | Testar durante todo o desenvolvimento |
| Abuso ou conteúdo inadequado | Exigir moderação funcional antes de testes públicos |
| Atualizações quebrarem o fork | Manter `upstream` e alterações isoladas |
| Vazamento de credenciais | Revisar `git status` e nunca versionar `.config` |
| Problemas de infraestrutura | Utilizar ambiente reproduzível com Docker e mise |
| Uso indevido de marca institucional | Manter identidade independente até obter autorização |

## 22. Controle de mudanças

Novas funcionalidades somente deverão entrar no MVP quando:

1. resolverem um problema importante do fluxo principal;
2. puderem ser concluídas dentro do prazo;
3. não atrasarem tarefas P0;
4. tiverem responsável;
5. possuírem critério de conclusão;
6. não aumentarem desnecessariamente o risco técnico.

Se uma nova funcionalidade for aceita, outra tarefa de esforço equivalente poderá precisar ser removida.

## 23. Definição de pronto

Uma tarefa está pronta quando:

- atende ao comportamento definido;
- funciona em desktop e celular;
- foi testada com teclado;
- possui estados de carregamento, vazio e erro quando aplicável;
- não introduz erro crítico no console;
- não expõe dados sensíveis;
- mantém o build funcionando;
- possui commit e Pull Request claros;
- atualiza a documentação quando necessário;
- foi integrada à `main`.

## 24. Pendências de definição visual e operacional

Antes da etapa de identidade, deverão ser definidos:

- nome final do produto;
- símbolo ou logotipo;
- paleta de cores;
- tipografia;
- tom de voz;
- categorias iniciais de comunidades;
- regras de convivência;
- domínio de demonstração;
- responsáveis pela moderação;
- quantidade de contas usadas nos testes.

Essas decisões não alteram o escopo funcional definido neste documento.