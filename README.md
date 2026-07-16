# Nitro Studio

Assistente local de preparação inteligente de artes para impressão.

## O que já funciona

- Fluxo principal pela regra dos 3 cliques: importar arte, aceitar recomendação e imprimir/exportar.
- Upload local de PNG, JPG e WebP.
- Biblioteca local com múltiplas artes, seleção ativa, exclusão da imagem selecionada e limpeza do projeto.
- Seleção múltipla de artes para montagem automática ou exclusão em lote.
- Duplicação da arte ativa e centralização rápida.
- Destinos prontos: caneca 11 oz, camiseta A4/A3, azulejo 15 x 15 e medida livre.
- Encaixes: preservar tudo, preencher área e repetir padrão.
- Saída por folha A4, A3 ou 300 x 400 mm, com DPI, sangria, margem, espaçamento, cópias e espelhamento.
- Giro de papel em quatro modos: retrato, paisagem, retrato invertido e paisagem invertida.
- Controle de giro do papel também no palco central para alternar a orientação enquanto olha o preview.
- Palco de preview mais amplo, com faixa redundante removida para dar mais área ao papel.
- Indicador lateral de **DPI indicado**, mostrando o DPI efetivo calculado para o tamanho atual.
- Botão **Preparar com Nitro** para aplicar uma decisão automática coerente com o destino.
- Botão **Aceitar recomendação** para resolver o essencial em um clique: folha, encaixe, DPI, guias, espelhamento, margens e aproveitamento seguro.
- Botão **Arrumar Minha Arte** para aplicar correções seguras em um clique.
- Assistente Nitro com problema, causa, recomendação e ação de resolver.
- Autosave local de configurações, desfazer e refazer.
- Simulação real de impressão baseada no plano atual, sem inventar dados de impressora.
- Produção guiada com passos para usuários leigos.
- Perfis inteligentes para camisa, caneca, chinelo, mousepad e azulejo.
- Diagnóstico de resolução, proporção, DPI efetivo, prontidão, checklist, desperdício e recomendações.
- Corte inteligente por proporção de destino, seleção visual de área de interesse e botão **Cortar** para aplicar.
- Preview responsivo medido pelo espaço real da bancada, evitando folha cortada no centro.
- Ajustes de arte: zoom, largura, altura, deslocamento, rotação, espelhamento horizontal/vertical, inclinar, declinar, giro de 90°, brilho, contraste e saturação.
- Posicionamento manual no preview: arraste a arte no papel para controlar o preenchimento.
- Redimensionamento visual no preview: puxe bordas e cantos da arte para esticar horizontalmente, verticalmente ou nos dois eixos.
- Botão **Ajustar alças** para reenquadrar a imagem quando o ajuste visual ficar grande demais.
- Redimensionamento por medida física em mm, cm ou polegadas, com opção de travar proporção.
- Comando **Folha inteira** para preparar a arte de ponta a ponta no papel atual.
- Cálculo de DPI efetivo considera zoom e esticamento livre para manter a análise honesta.
- O fluxo tem uma única etapa de impressão: **Simular impressão** abre a pré-impressão antes do download final.
- A simulação mostra área utilizada, área perdida, corte, área segura, qualidade prevista, folha final e espelhamento.
- Assistente de Impressão com impressora, produto, sem bordas, qualidade, escala, orientação, tipo de papel e espelhamento.
- Botão **Imprimir agora** na simulação, abrindo a impressão real do navegador com a folha final renderizada.
- Ferramentas de produção: marcas de corte, área segura, guia da arte e etiqueta técnica.
- Preview em canvas e exportação PNG/PDF em tamanho físico da folha.
- Testes do motor de plano de impressão.

## Comandos

```bash
npm install
npm run dev
npm test
npm run build
```

## Arquitetura

- `src/App.tsx`: fluxo principal, controles e estado da interface.
- `src/lib/printPresets.ts`: presets, folhas, DPI e conversão mm/px.
- `src/lib/analysis.ts`: leitura local da imagem e insights iniciais.
- `src/lib/printPlan.ts`: cérebro de decisão, cálculo de folha, destino, encaixe e riscos.
- `src/lib/renderPrint.ts`: execução no canvas e exportação PNG.
- `src/lib/printPlan.test.ts`: cobertura inicial do motor de plano.

## Interface

A tela principal é uma bancada de produção: topo e preview permanecem estáveis, enquanto os painéis laterais têm rolagem própria. Isso evita espaço morto na página e mantém os controles próximos da arte.

## Norte do produto

Nitro Studio não tenta ser um editor gráfico tradicional. A proposta é entender a arte, decidir o melhor plano de impressão e executar uma saída confiável com linguagem simples.

Frase do projeto: o Nitro Studio não será conhecido por ter mais botões; será conhecido por fazer o trabalho difícil parecer simples.
