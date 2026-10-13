# Fluxo de assinatura

Criação congela PDF-base, campos, valores internos, versão do modelo, texto e hash da declaração. Compartilhamento manual abre wa.me com telefone normalizado e mensagem codificada; clique nunca é tratado como entrega.

Abrir link muda pending→viewed e registra abertura. Prepare valida campos do signatário, nome/CPF declarados e PNG não vazio; gera revisão e salva preparação válida por 30 minutos, mudando para filling. Campos de funcionário não podem ser enviados como campos públicos.

Confirm exige revisão, accepted=true, versão de declaração e idempotencyKey. Sob lock da solicitação, verifica validade/revogação/estado e hash do apresentado. Cria assinatura, valores e job na mesma transação; estado processing. Nenhuma segunda assinatura pode ser criada pela constraint request_id única. Mesmo idempotencyKey permite retry de resposta perdida.

Worker reclama lease, baixa/verifica base, gera PDF final e comprovante, persiste PDF/PNG/manifesto com hashes e só então grava metadados e estado signed. Em falha registra evento, status failed e próximo horário. Outro executor pode reclamar lease expirada; apenas o token de lease atual conclui. Os objetos de tentativas anteriores não substituem o objeto publicado.

Assinado aguarda conferência. Conferências mudam para reviewed/divergent sem modificar o PDF. Divergência exige justificativa. Recusa e cancelamento invalidam o link. Expiração é verificada em cada acesso e materializada com evento na listagem/execução de jobs. Renewal permite pending/viewed/filling/expired, troca token e prazo, sem mudar conteúdo. Mudança de conteúdo requer nova solicitação.
