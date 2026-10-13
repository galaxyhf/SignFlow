# API REST

Base local: `http://localhost:3001`; navegador: `/api` via proxy Next. OpenAPI autenticado em `/api/openapi`. Corpos JSON validados por Zod estão em `packages/shared/src/index.ts`; erros são `{message,status}`. Não são registrados payloads, cookies ou URLs públicas contendo token.

| Grupo              | Operações                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| auth               | POST register/login/logout/password, GET me                                                                                         |
| users              | GET/POST, PATCH :id, GET responsibles                                                                                               |
| clients            | GET/POST, GET/PATCH/DELETE :id (DELETE desativa)                                                                                    |
| templates          | GET/POST, GET :id, POST :id/versions, POST preview                                                                                  |
| files              | POST upload multipart `file`, GET :id autenticado                                                                                   |
| documents          | GET listagem, GET :id, GET :id/files, GET :id/original, POST :id/reviews                                                            |
| signature-requests | POST criação, POST :id/cancel, :id/revoke, :id/renew, :id/retry                                                                     |
| public/sign        | GET :token, GET :token/pdf, POST :token/prepare, GET :token/preview/:id, POST :token/confirm, GET :token/signed, POST :token/refuse |
| dashboard          | GET indicadores com from/to/responsible                                                                                             |
| audit              | GET events, GET integrity                                                                                                           |
| verification       | POST check multipart id e file opcional                                                                                             |
| settings           | GET, PUT administradores                                                                                                            |
| jobs               | POST run com Bearer JOB_SECRET                                                                                                      |

Listagens usam search/page e limite 20 (auditoria 50); clientes usam active/sort; documentos usam status/client/responsible/from/to. Identificadores são UUID. Mutação interna exige `X-CSRF-Token` igual ao token do cookie `sf_csrf` e `Origin` igual a WEB_ORIGIN. Todas as chamadas de mutação pública vindas do navegador também exigem origem autorizada, mas não sessão/CSRF de funcionário.

Prepare recebe nome/CPF declarados, values por ID de campo e PNG data URL. Confirm recebe preparationId, idempotencyKey UUID, accepted=true e consentVersion. A repetição com mesma chave retorna a assinatura já criada; outra chave para solicitação assinada retorna 409.

Downloads são autorizados na própria API e transmitidos sem cache. Isso evita repassar credenciais ou URLs de objeto ao browser. Downloads públicos são limitados ao documento do token e 48 horas depois de assinar.

`POST /auth/register` é público, exige origem autorizada e recebe somente `name`, `login` e `password`. A senha tem de 9 a 128 caracteres. O servidor atribui o perfil funcionário; campos extras como role/permissions são rejeitados. O cadastro é limitado a 5 tentativas por IP por hora. Login usa `login` e `password`, sem campo de e-mail obrigatório.
