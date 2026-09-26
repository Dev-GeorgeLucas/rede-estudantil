# Configuração local

Este guia explica como executar a Rede Estudantil localmente para desenvolvimento.

O projeto é baseado no Misskey. As versões do Node.js e do pnpm são definidas pelo arquivo `mise.toml`.

## 1. Pré-requisitos

Instale:

- Git
- Docker e Docker Compose
- mise
- FFmpeg

Confirme as instalações:

```bash
git --version
mise --version
sudo docker --version
sudo docker compose version
ffmpeg -version
```

## 2. Clonar o projeto

```bash
git clone https://github.com/Dev-GeorgeLucas/rede-estudantil.git
cd rede-estudantil
```

## 3. Instalar Node.js e pnpm

```bash
mise install
hash -r
node --version
pnpm --version
```

Versões esperadas:

```text
Node.js 26.4.0
pnpm 11.25.0
```

Se o terminal continuar usando outra versão, execute:

```bash
mise exec -- node --version
mise exec -- pnpm --version
```

## 4. Preparar o projeto

Inicialize os submódulos e instale as dependências:

```bash
git submodule update --init
pnpm install --frozen-lockfile
```

Alguns avisos de download podem aparecer durante a instalação. Aguarde até aparecer uma mensagem indicando que o processo terminou com sucesso.

## 5. Criar os arquivos locais de configuração

```bash
cp .config/example.yml .config/default.yml
cp .config/docker_example.env .config/docker.env
```

Os arquivos criados são locais e não devem ser enviados ao GitHub.

Abra `.config/default.yml` e confira estas configurações:

```yaml
url: http://localhost:3000/
port: 3000
```

Na configuração do banco de dados, utilize:

```yaml
host: localhost
port: 5434
```

Na configuração do Redis, utilize:

```yaml
host: localhost
port: 6379
```

Defina também uma senha temporária para a configuração inicial:

```yaml
setupPassword: "crie-uma-senha-temporaria"
```

Não reutilize nenhuma senha pessoal.

## 6. Iniciar PostgreSQL e Redis

```bash
sudo docker compose -f compose.local-db.yml up -d
sudo docker compose -f compose.local-db.yml ps
```

Os dois contêineres devem aparecer como `healthy`.

O PostgreSQL deste projeto utiliza a porta local `5434`, evitando conflito com instalações que usam a porta padrão `5432`.

## 7. Compilar o projeto

```bash
pnpm build
```

A primeira compilação pode levar alguns minutos.

## 8. Testar a conexão

```bash
pnpm check:connect
```

Se o comando terminar sem erro, a conexão com PostgreSQL e Redis está funcionando.

## 9. Preparar o banco de dados

```bash
pnpm migrate
```

A migração estará concluída quando o terminal exibir `COMMIT` e retornar ao prompt.

## 10. Iniciar o ambiente de desenvolvimento

```bash
pnpm dev
```

Abra no navegador:

```text
http://localhost:3000
```

Na primeira execução, utilize a senha definida em `setupPassword` e crie o administrador local.

Depois de concluir a configuração inicial, comente ou remova `setupPassword` de `.config/default.yml`:

```yaml
# setupPassword: "senha-temporaria"
```

Nunca envie senhas, tokens ou os arquivos da pasta `.config` para o GitHub.

## Uso diário

Para iniciar os serviços:

```bash
sudo docker compose -f compose.local-db.yml up -d
pnpm dev
```

Para interromper o servidor de desenvolvimento, pressione `Ctrl + C`.

Para parar PostgreSQL e Redis:

```bash
sudo docker compose -f compose.local-db.yml down
```

Esse comando preserva os dados locais.

Não execute `docker compose down -v`, pois a opção `-v` remove os volumes e pode apagar o banco de dados local.

## Fluxo de colaboração

Antes de começar uma tarefa:

```bash
git switch main
git pull origin main
git switch -c tipo/nome-da-tarefa
```

Exemplos de nomes:

```text
feat/perfil-estudante
feat/tema-institucional
fix/menu-mobile
docs/atualiza-instalacao
```

Depois das alterações:

```bash
git add .
git commit -m "feat: descreve a alteração"
git push -u origin tipo/nome-da-tarefa
```

Em seguida, abra um Pull Request no GitHub para revisar e integrar a alteração na `main`.

## Arquivos que não devem ser enviados

Nunca adicione ao Git:

```text
.config/default.yml
.config/docker.env
node_modules/
built/
db/
redis/
files/
```

Antes de qualquer commit, confira:

```bash
git status
```

Se aparecer algum arquivo com senha, token ou configuração pessoal, não faça o commit.