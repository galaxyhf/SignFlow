# Auditoria, evidências e conferência

Evento contém sequência global, agregado, ator, ação, dados mínimos, horário, hash anterior e HMAC do conteúdo canônico. A inserção ocorre na transação da ação sob advisory lock. UPDATE/DELETE é proibido por trigger. `/audit/integrity` percorre a cadeia; auditor e administrador podem consultá-la. Preserve EVIDENCE_SECRET e cópias de cabeças da cadeia fora do banco se quiser detectar truncamento malicioso com privilégios totais.

Manifesto JSON inclui documento/versão/solicitação/transação, identificação declarada, abertura/aceite/assinatura, IP observado, User-Agent, declaração/versão, hashes original/apresentado/final/PNG, valores e eventos até o aceite. HMAC autentica o manifesto. A conclusão gera evento posterior com hash final e hash do pacote, consultável no histórico. O próprio hash do pacote não pode estar dentro do pacote.

Conferência mostra cadastro/expectativa e declaração/assinatura lado a lado. Resultados são eventos independentes e imutáveis, com funcionário, horário e observações. Uma nova avaliação nunca apaga a anterior. A conferência compara informações internas; não é prova de identidade civil. Integridade, registro, identidade declarada e conferência cadastral são conceitos separados nas telas e na verificação.
