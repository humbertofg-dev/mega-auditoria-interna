# Publicacao no GitHub

Este projeto esta pronto para ser publicado como site estatico no GitHub Pages.

## Estrutura

- `index.html`: entrada principal do aplicativo
- `styles.css`: identidade visual
- `app.js`: regras de negocio
- `question-bank.js`: banco padrao de perguntas
- `.nojekyll`: evita tratamento Jekyll no GitHub Pages

## Publicacao manual

1. Crie um repositório novo no GitHub.
2. Envie todos os arquivos desta pasta para a raiz do repositório.
3. Abra `Settings > Pages`.
4. Em `Build and deployment`, selecione:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` e pasta `/root`
5. Salve as configuracoes.
6. Aguarde a geracao do site e use o link publico do GitHub Pages.

## Publicacao no Netlify

1. Acesse o painel do Netlify.
2. Escolha `Add new site` e depois `Deploy manually`.
3. Envie a pasta do projeto ou o arquivo `.zip` pronto.
4. O arquivo `netlify.toml` ja esta configurado para publicar a raiz do projeto.
5. Ao final do upload, o Netlify gera um link web publico.
