# Processamento de PDFs

Uploads MIME application/pdf, cabeçalho %PDF-, limite padrão 3 MiB/30 páginas, parser pdf-lib sem ignorar criptografia e inspeção de conteúdo ativo. Original preservado byte a byte no storage; PDF apresentado é derivado independente com campos internos. Renderização usa PDF.js no navegador. Licenças: pdf-lib MIT, fontkit MIT, PDF.js Apache-2.0, signature_pad MIT, pngjs MIT. Consulte também docs/licenses.md.

A inspeção percorre objetos, referências e dicionários de streams. `OpenAction` é aceito quando contém um destino de visualização (página/zoom ou destino nomeado); dicionários de ações automáticas continuam rejeitados. Palavras como `/JavaScript` em texto ou metadados não são tratadas como scripts. Entradas estruturais JavaScript/JS, Launch, EmbeddedFile, RichMedia, AA e XFA continuam bloqueadas.

Campos têm página zero-based, x/y/width/height em frações [0,1], origem superior esquerda. No PDF: x=x_normalizado*largura; y=(1-y_normalizado-altura_normalizada)*altura. O editor limita o retângulo à página e ajusta pelo tamanho real do canvas em cada zoom. Coordenadas numéricas oferecem ajuste por teclado, além do arraste/redimensionamento.

A revisão é PDF real gerado pela mesma rotina de preenchimento do final. Texto é quebrado em linhas pelo tamanho da fonte/retângulo; excesso é rejeitado. Assinatura PNG mantém proporção dentro do campo. A geração final adiciona uma página de comprovante sem substituir as páginas originais. Hash final e dados técnicos completos ficam no manifesto, evitando circularidade de incluir o próprio hash no arquivo.

pdf-lib não remove nem revalida assinaturas digitais anteriores; um documento previamente assinado digitalmente pode perder validade criptográfica ao ser modificado. A fonte Helvetica suporta português/WinAnsi; entradas não suportadas são recusadas. O posicionamento considera CropBox e rotação de 0/90/180/270 graus, com teste de transformação. O comprovante cria páginas adicionais quando necessário, preservando declarações longas. Páginas muito grandes/complexas podem estourar duração ou memória mesmo dentro do limite de tamanho.
