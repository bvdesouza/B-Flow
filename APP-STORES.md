# B-Flow nas lojas (Android e iOS)

O site continua funcionando igual (Vercel / AI Studio). O app de celular é gerado
a partir do mesmo código pelo Capacitor e compilado na nuvem pelo Codemagic.

## Comandos
- `npm run build:app`: gera a versão estática do app na pasta `out/`
- `npm run cap:sync`: build + copia para os projetos nativos (só se você criar `android/` ou `ios/` localmente)

## Passo a passo
1. Suba este projeto no GitHub (repositório privado).
2. Em codemagic.io, entre com o GitHub e adicione o repositório. O Codemagic lê o `codemagic.yaml`.
3. Em Environment variables, crie o grupo `supabase` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Android: crie uma keystore (o Codemagic gera uma em Code signing identities) com o nome `bflow_keystore`.
   **Guarde a keystore e as senhas em um lugar seguro.** Sem elas você não consegue atualizar o app.
5. Rode o workflow "B-Flow Android" e baixe o `.aab`. Envie esse primeiro arquivo manualmente no Play Console (teste interno).
6. iOS: depois de aprovado no Apple Developer Program, crie a chave de API no App Store Connect,
   adicione no Codemagic com o nome `bflow_asc` e rode o workflow "B-Flow iOS". Ele envia para o TestFlight.

## Para cada nova versão
Troque `APP_VERSION_NAME` no `codemagic.yaml` (ex.: 1.0.1). O número interno do build sobe sozinho.
