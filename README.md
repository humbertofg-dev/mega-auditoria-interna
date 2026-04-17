# Mega Auditoria Interna

Aplicativo web estatico para conduzir auditorias internas do Grupo Mega.

## O que esta pronto

- dashboard com indicadores e ultimas auditorias realizadas
- questionario com botoes `Conforme`, `Nao Conforme` e `N/A`
- campo obrigatorio de descricao e opcao de anexo de foto para nao conformidade
- classificacao de desempenho por percentual:
  - abaixo de 70% em vermelho
  - entre 70% e 89% em amarelo
  - entre 90% e 100% em verde
- edicao de auditorias ja concluidas diretamente pela aba de relatorios
- exportacao do relatorio via impressao do navegador para salvar em PDF
- importacao do banco de perguntas por `JSON`, `CSV`, `TXT` e `XLSX`
- banco de perguntas da planilha anexada ja incorporado ao aplicativo
- manutencao manual de perguntas com adicionar, editar e excluir
- persistencia local no navegador
- estrutura pronta para publicacao estatica em GitHub Pages e Netlify

## Como usar

1. Abra [index.html](./index.html) no navegador.
2. Va para a aba `Nova Auditoria`.
3. Importe um banco de perguntas estruturado ou use o padrao.
4. Preencha os dados da auditoria e responda o questionario.
5. Ao marcar `Nao Conforme`, registre a descricao e anexe a foto.
6. Conclua a auditoria para ve-la em `Relatorios`.
7. Use `Editar auditoria` para ajustar uma auditoria ja salva.
8. Use `Exportar PDF` para abrir a tela de impressao e salvar em PDF.

## Observacao sobre PDFs

O aplicativo importa perguntas automaticamente quando o arquivo estiver em formato estruturado. PDFs escaneados, como checklists em imagem, precisam ser convertidos antes para `TXT`, `CSV` ou `JSON`.
