# SignFlow

Sistema interno de autorizações por PDF e assinatura eletrônica declarada. O cliente acessa um link público sem login; a equipe confere os dados com o cadastro depois da assinatura. Não utiliza OTP, e-mail, WhatsApp Business API, Docker ou serviços comerciais de assinatura. Nenhum deploy foi executado.

## Estrutura

```text
apps/api/          NestJS: REST, sessão, permissões, serviços e processamento
  src/common/      segurança, erros e criptografia
  src/database/    schema Drizzle e migrations
  src/modules/     auth, users, clients, templates, documents, signing,
                   pdf, storage, audit, verification, settings, jobs
  drizzle/         migration versionada com constraints e imutabilidade
  api/             entrada serverless para preparação de hospedagem
  test/            testes unitários e integração com PostgreSQL embarcado
apps/web/          Next.js App Router, painel e portal público
packages/shared/   contratos Zod, campos, permissões e estados
scripts/           ambiente E2E descartável e teste de conectividade Neon
tests/             testes Playwright de navegador
 docs/             arquitetura, operação e limites
```

As versões instaladas e as licenças estão em [docs/versions.md](docs/versions.md) e [docs/licenses.md](docs/licenses.md).

## Pré-requisitos e instalação

Node.js 24 LTS, npm 11, projeto Neon com PostgreSQL e Object Storage habilitado em região suportada, bucket **private**. A aplicação utiliza Argon2 nativo; em plataformas sem binário pré-compilado pode ser necessária uma toolchain de compilação.

```bash
npm install
cp .env.example .env
```

Preencha as variáveis antes de iniciar. O arquivo `.env` fica na raiz e não deve ser versionado. A aplicação está configurada para a branch `production` (`br-patient-salad-b824a7kv`) do projeto `ancient-wildflower-69128465`, com o bucket privado `uploads`. As migrations foram testadas em desenvolvimento e depois aplicadas em production. Não foram copiados cadastros fictícios. Credenciais não aparecem na documentação.

## Ambiente

O `.env` contém apenas **9 variáveis necessárias**:

| Variável                | Finalidade                                                     |
| ----------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`          | Conexão PostgreSQL pooled da branch production                 |
| `DATABASE_URL_UNPOOLED` | Conexão direta da mesma branch para migrations                 |
| `AWS_ENDPOINT_URL_S3`   | Endpoint Storage da branch, HTTPS                              |
| `AWS_REGION`            | Região do Storage (`us-east-1`)                                |
| `AWS_ACCESS_KEY_ID`     | Token ID da credencial S3                                      |
| `AWS_SECRET_ACCESS_KEY` | Segredo S3; somente backend                                    |
| `STORAGE_BUCKET`        | Bucket privado (`uploads`)                                     |
| `EVIDENCE_SECRET`       | Segredo independente para proteger a auditoria e as evidências |
| `JOB_SECRET`            | Segredo independente para autorizar chamadas de jobs           |

Os padrões locais ficam no código: API na porta 3001, frontend/origem em `http://127.0.0.1:3000`, upload até 3 MB, 30 páginas e proxy não confiável. Não é necessário repeti-los no arquivo. Se precisar, as variáveis opcionais `PORT`, `API_URL`, `WEB_ORIGIN`, `MAX_UPLOAD_MB`, `MAX_PDF_PAGES` e `TRUST_PROXY` continuam disponíveis. Na hospedagem, use `NODE_ENV=production` (normalmente definido pela plataforma) e configure `API_URL`/`WEB_ORIGIN` com as URLs HTTPS. Usar a branch Neon production não altera o modo de execução local da aplicação.

`ADMIN_NAME`, `ADMIN_LOGIN` e `ADMIN_PASSWORD` são temporárias, usadas apenas no provisionamento do primeiro administrador; adicione-as nessa ocasião e remova depois. Não fazem parte do `.env` permanente.

Gere os segredos com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Não rotacione o segredo de evidências sem preservar o anterior e planejar a verificação histórica. A duração efetiva das sessões é administrada nas configurações do sistema. E2E padrão utiliza PostgreSQL embarcado e armazenamento em memória, exclusivos de teste.

O Neon Storage é acessado por AWS SDK, SigV4 e `forcePathStyle: true`. O startup consulta a ACL e recusa buckets publicamente legíveis. Não presumimos Object Lock, versionamento S3 ou lifecycle efetivos: [compatibilidade oficial](https://neon.com/docs/storage/s3-compatibility), cuja referência consultada está em `docs/neon-storage-reference.md`.

## Banco e administrador

```bash
npm run db:generate
npm run db:migrate
```

A primeira migration cria 25 tabelas, perfis, permissões e triggers de imutabilidade. Não é um seed de clientes ou documentos.

Preencha `ADMIN_NAME`, `ADMIN_LOGIN` e `ADMIN_PASSWORD` no `.env` (senha de 9 a 128 caracteres) e execute:

```bash
npm run admin:create
```

O comando se recusa a provisionar se já houver administrador. Depois remova as três variáveis do arquivo. Não foi criada uma conta permanente com senha fixa. Funcionários podem se cadastrar em `/cadastro` com nome, login e senha de pelo menos 9 caracteres. O cadastro público sempre cria o perfil funcionário, sem permissões administrativas. O administrador também pode gerenciar acessos em `/usuarios`.

## Execução

```bash
npm run dev
```

Abra [SignFlow local](http://127.0.0.1:3000). Use `127.0.0.1` consistentemente: o controle de origem compara o valor exato de `WEB_ORIGIN`. A API está em `http://127.0.0.1:3001`; OpenAPI em `/api/openapi` pelo frontend, após login. Frontend e backend são processos e projetos separados; o proxy mantém os cookies no mesmo domínio do navegador.

Fluxo: cliente → PDF/modelo → solicitação em sete etapas → link/WhatsApp → portal → dados e desenho → PDF de revisão → aceite explícito → job → PDF final/evidências → conferência cadastral. O link é exibido apenas ao gerar e guardado na sessão do navegador do funcionário; no banco só há seu hash. Para recuperar o compartilhamento em outra sessão, gere um novo link, invalidando o anterior.

## Validação

```bash
npm run lint
npm run typecheck
npm run test
npm run test:browser:install
npm run test:e2e
npm run build
```

Unitários/integração usam PGlite (PostgreSQL embarcado), fixtures de PDF geradas e falhas injetadas no adaptador de armazenamento. Os testes E2E iniciam a API NestJS real em 3101 e o Next em 3100, com banco/storage descartáveis. Não há mock de endpoint nem bypass de autenticação. Não carregam cadastros fictícios no Neon. Chromium é instalado em `/tmp/signflow-browsers`; reinstale se o sistema limpar essa pasta.

Teste opcional real de conexão (usa a branch do `.env`, cria e remove um objeto temporário):

```bash
npx tsx --tsconfig apps/api/tsconfig.json scripts/neon-smoke.ts
```

Os resultados desta execução estão em [docs/validation.md](docs/validation.md). Os testes locais não representam validação de uma hospedagem Vercel ou certificação jurídica.

## Recuperação e operação

```bash
npm run jobs:run
```

Executa um job elegível e encerra. Jobs usam lease e `FOR UPDATE SKIP LOCKED`, cinco tentativas e intervalo mínimo de 30 segundos após falha. A confirmação tenta processar o próprio job dentro da requisição; interrupções ficam recuperáveis no banco. Chamadas futuras autenticadas `POST /jobs/run` podem ser agendadas externamente com `Authorization: Bearer <JOB_SECRET>`. Nenhum cron permanente é iniciado pela API. Após esgotar tentativas, o funcionário pode solicitar recuperação na tela de detalhes.

Não excluímos automaticamente arquivos ou evidências. A retenção é uma política mínima configurável para orientar operação; o responsável deve definir finalidade, base legal, acesso, backup e eventual expurgo documentado. Não use lifecycle do Neon como garantia de preservação.

## Limites conhecidos

- PDFs com criptografia, conteúdo ativo ou mais de 3 MB/30 páginas são rejeitados por padrão. Isso não substitui análise antimalware especializada.
- A camada PDF incorpora texto, checkboxes e PNG da assinatura em coordenadas normalizadas; o original é preservado. Campos longos que não cabem no retângulo são rejeitados para evitar truncamento silencioso.
- A fonte padrão cobre português e caracteres WinAnsi; caracteres não suportados são rejeitados. Fontes Unicode adicionais devem ser integradas antes de aceitar documentos com outras escritas.
- A signature pad tem desenho e limpeza/refação; assinatura somente por desenho exige um método assistido fora do sistema para quem não puder usar o canvas.
- Download público do assinado fica limitado a 48 horas após a conclusão. A equipe autenticada continua com acesso.
- HMAC e triggers detectam/proíbem alterações comuns; não fornecem WORM, carimbo do tempo externo ou proteção contra um administrador que controle banco e segredos.
- Objetos gravados antes de uma falha de transação podem ficar sem referência; são preservados para investigação. Não há expurgo automático de órfãos.
- Não há assinatura qualificada, ICP-Brasil ou comprovação definitiva de identidade. A conferência é cadastral interna.
- Hospedagem, domínio, limites reais de duração/memória, proxy e políticas de acesso da Vercel exigem validação após o deploy manual.

## Problemas frequentes

Erro de variável ausente: preencha `.env` na raiz. Erro CSRF/origem: abra a origem definida em `WEB_ORIGIN` e autentique novamente. Upload rejeitado: confirme MIME, integridade, tamanho, número de páginas e ausência de criptografia/conteúdo ativo. Job falhou: valide storage/banco, aguarde a próxima elegibilidade ou use recuperação na tela. Bucket não privado: altere acesso pelo Console Neon antes de iniciar; ACLs não são modificadas pela aplicação. Porta ocupada: ajuste `PORT`, `API_URL` e `WEB_ORIGIN` de forma consistente.

Consulte [arquitetura](docs/architecture.md), [banco](docs/database.md), [API](docs/api.md), [segurança](docs/security.md), [PDFs](docs/pdf.md), [assinatura](docs/signing.md), [auditoria/conferência](docs/audit.md) e [preparação de hospedagem](docs/deployment.md).

Se você já se cadastrou como funcionário e ainda não há administrador, habilite explicitamente sua conta pela CLI, sem alterar a senha:

```bash
npm run admin:promote -- --login seu.login
```

Esse comando exige acesso local ao ambiente do backend, só funciona quando não existe administrador, registra auditoria e revoga sessões anteriores. Entre novamente para carregar o perfil administrativo. Não há autopromoção pelo cadastro público.
