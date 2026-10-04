# Osasco Hot Dog — sem cadastro + banco online

Esta versão mantém o site sem cadastro/login, mas salva comentários, notas e fotos no Supabase para que todos os visitantes vejam as avaliações.

## Arquivos principais
- `index.html`
- `style.css`
- `script.js`
- `supabase-config.js`
- `supabase-anonymous-schema.sql`

## Configuração

### 1. Criar o projeto
Crie um projeto no Supabase.

### 2. Criar tabelas e Storage
Abra o SQL Editor e execute o arquivo:
`supabase-anonymous-schema.sql`

Ele cria:
- `establishments`
- `reviews`
- bucket público `review-photos`
- políticas RLS de leitura e publicação anônima

### 3. Colocar as chaves no site
Abra `supabase-config.js`:

```js
window.SUPABASE_URL = "SUA_URL";
window.SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_PUBLIC";
```

Use apenas a chave `anon public`.
NUNCA coloque a `service_role` no frontend.

### 4. Resultado
O visitante:
1. entra no site;
2. escolhe um estabelecimento;
3. dá uma nota;
4. escreve o nome e comentário;
5. opcionalmente envia uma foto;
6. publica sem criar conta.

A avaliação fica no banco e aparece para todos os visitantes.

## Segurança e spam
Sem cadastro, qualquer pessoa pode tentar publicar várias avaliações. As regras básicas de tamanho e nota estão no banco, mas para produção recomendo adicionar:
- Cloudflare Turnstile ou reCAPTCHA;
- rate limiting;
- moderação;
- painel administrativo;
- bloqueio de palavras/links suspeitos.

## Observação
A chave `anon public` pode ser exposta no frontend. A segurança deve ficar nas políticas RLS e em regras de Storage. Nunca exponha a `service_role`.
