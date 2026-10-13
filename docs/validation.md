# Validação executada — 13/10/2026

| Verificação                      | Resultado                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `npm run lint`                   | Sem erros                                                                         |
| `npm run typecheck`              | API, frontend e contratos sem erros                                               |
| `npm run test`                   | 21 testes de regras e integração aprovados                                        |
| `npm run test:e2e`               | 6 testes Playwright aprovados, incluindo fluxo completo                           |
| `npm run build`                  | NestJS e Next.js compilados                                                       |
| Auditoria npm de produção        | Zero vulnerabilidades informadas na consulta                                      |
| Migração Neon de desenvolvimento | Aplicada; 25 tabelas                                                              |
| Storage Neon real                | ACL privada, PDF enviado/lido, SHA-256 correspondente; objeto temporário removido |

## Abrangência

Regras e integração: CPF/CNPJ, campos internos/públicos, posicionamento normalizado e transformações de rotação/CropBox, comprovante multipágina longo, PDFs inválidos, PNG vazio, duplicidade cadastral, sessão/CSRF/expiração/revogação, RBAC, versões imutáveis, audit append-only/HMAC, links, preparação, assinatura, idempotência/dupla submissão, recuperação após falha de storage e lease expirada, conferências com histórico, renovação e recusa. PostgreSQL embarcado PGlite é usado para exercitar SQL e transações; execução concorrente nessa instância é serializada pelo engine. Isso não é teste de carga distribuída do Neon.

Navegador: administrador entra, cadastra cliente, envia PDF de duas páginas, publica modelo, cria solicitação em etapas, copia link (conteúdo da área de transferência verificado), verifica URL WhatsApp, cliente abre em contexto sem sessão e viewport de celular, preenche, desenha, revisa, aceita, obtém PDF final com três páginas; funcionário confere e recupera documento/evidências. Também: bloqueio de acesso público interno e mutação sem origem, verificação mínima pública/layout móvel, arraste/redimensionamento/editor multipágina, cadastro de auditor e bloqueio de escrita, PDF avulso oculto da lista de modelos e cancelamento que invalida link.

O E2E usa a API NestJS real e a interface Next.js, com providers de banco e armazenamento **exclusivos de teste**, descartáveis. Não há endpoints simulados no produto nem fixtures persistidas na branch Neon.

Integração real: projeto `ancient-wildflower-69128465`, branch `signflow-development` (`br-purple-river-b8dnwfzg`), PostgreSQL 18, região `aws-us-east-1`, bucket privado herdado `uploads`. Foram aplicadas migrations nessa branch e realizado upload/leitura/hash de um PDF temporário, removido ao concluir. A branch original `production` não recebeu alterações da aplicação. Nenhuma conta administrativa permanente foi provisionada.

## Limites da evidência

Não houve deploy, teste de limites de funções na Vercel, carga concorrente distribuída, teste físico em aparelhos iOS/Android, auditoria independente, antimalware especializado, configuração de backup/WORM/carimbo do tempo ou avaliação jurídica. O desenho móvel foi testado em Chromium com viewport móvel, não num aparelho físico. A preparação serverless compila localmente; o empacotador Vercel precisa ser validado na hospedagem manual.

## Atualização autorizada da branch production

Em 13/10/2026, após autorização do usuário, o schema foi aplicado à branch `production` (`br-patient-salad-b824a7kv`). A branch de desenvolvimento não continha usuários, clientes, modelos, solicitações ou arquivos, portanto não houve dados de negócio a transferir. O schema `neon_auth` existente foi preservado. O `.env` passou a apontar para production, com credencial Storage da própria branch, bucket privado `uploads` e os mesmos segredos de auditoria/jobs. O arquivo foi reduzido de 16 para 9 variáveis; parâmetros com padrões locais saíram do arquivo. Não houve deploy da aplicação.

A verificação posterior confirmou 25 tabelas do SignFlow em `public`, as 9 tabelas existentes de `neon_auth` preservadas, conexão válida com production e bucket privado. Upload, leitura e correspondência SHA-256 passaram; o objeto de teste foi removido.

## Cadastro com login e senha mínima de 9 caracteres

Foram adicionados testes para rejeitar senhas de 8 caracteres, cadastrar com 9 caracteres, autenticar por login normalizado, rejeitar login duplicado e tentativas de definir perfil/permissões, e trocar senha revogando sessões. A suíte de regras/integração passou a 26 testes. O build passou incluindo a nova rota estática `/cadastro`; lint e typecheck também passaram. O cenário de navegador cobre criação da conta e login sem e-mail.
