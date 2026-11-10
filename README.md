# Criogenia · SENAI CIMATEC ISI-SAS

Site com o esquema de criogenia em 3D (ultrafreezers e botijões de nitrogênio líquido), copiado da tela de Criogenia do GIRA.
Sala → equipamento aberto → rack → caixa → vial. Arraste para girar, clique para abrir.

- Adicionar e excluir ultrafreezers e botijões de N₂ (modelos prontos: ColdLab CL374-86V, Thermo Scientific TSX, Indrel, Sempercrio SC-47, Worthington 20XTB-11M, ou "Outro").
- Guardar, retirar, mover e editar vials; leituras de temperatura e nível de N₂.
- Login com Google ou Microsoft. Cada inclusão, exclusão ou alteração fica no **Registro de atividades** com nome, e-mail, data e hora.
- Cada canister do botijão tem uma cor própria. Em **Editar** no botijão dá para trocar a cor de cada canister, a quantidade de caixas de cada um e pôr ou tirar canisters (o site não deixa sumir caixa com vial guardado).
- **Exportar Excel**: planilha com as abas Registro, Equipamentos, Vials (inclusive retirados) e Leituras.

Site estático (HTML + CSS + JS, sem build). Sem `config.js` preenchido, ele roda em **modo demonstração**: dados só no navegador e login simulado.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html`, `styles.css`, `app.js` | Página, visual e cena 3D (portados do GIRA) |
| `data.js` | Acesso aos dados: Supabase ou modo demonstração |
| `config.js` | URL e chave pública do Supabase (preencher) |
| `supabase/schema.sql` | Tabelas, permissões e funções do banco |
| `assets/logo-senai-cimatec.png` | Logo oficial SENAI CIMATEC |
| `vendor/` | supabase-js 2.45.4 e SheetJS 0.18.5 (cópias locais) |

## Publicar (Supabase + Cloudflare Pages)

### 1. Banco (Supabase)
1. Crie um projeto em <https://supabase.com> (plano gratuito serve).
2. Em **SQL Editor**, cole todo o `supabase/schema.sql` e rode.
3. (Opcional) Restringir quem entra: no SQL Editor,
   `insert into crio_acesso (padrao) values ('@fieb.org.br'), ('@senaicimatec.edu.br');`
   Sem linhas nessa tabela, qualquer conta Google/Microsoft pode entrar.
4. Em **Project Settings → API**, copie a *Project URL* e a chave *anon/publishable* para o `config.js`.

### 2. Login Google
1. No Google Cloud Console → APIs e serviços → Credenciais → *Criar ID do cliente OAuth* (Aplicativo da Web).
2. *URI de redirecionamento autorizado*: `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
3. No Supabase → **Authentication → Sign In / Providers → Google**: ative e cole Client ID e Secret.

### 3. Login Microsoft
1. No portal do Azure → **Microsoft Entra ID → Registros de aplicativo → Novo registro**.
   Tipos de conta: *contas em qualquer diretório organizacional e contas Microsoft pessoais* (ou só a organização, se preferir).
   URI de redirecionamento (Web): `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
2. Em *Certificados e segredos*, crie um segredo do cliente.
3. No Supabase → **Authentication → Providers → Azure**: ative, cole o *Application (client) ID* e o segredo.
   *Azure Tenant URL*: `https://login.microsoftonline.com/common` (ou o ID do locatário do SENAI para aceitar só contas institucionais).
4. **Libere o e-mail no token** (sem isso o login volta para a tela inicial com o erro
   *"Error getting user email from external provider"*): no registro do aplicativo → **Configuração de token →
   Adicionar declaração opcional → ID**, marque `email` e `xms_edov` e aceite adicionar a permissão do Microsoft Graph
   (`email`). Em **Permissões de API**, confira que `email`, `openid` e `profile` (Microsoft Graph, delegadas) estão lá
   e clique em *Conceder consentimento do administrador* se aparecer o aviso.
5. A conta precisa ter e-mail: em contas institucionais, o campo *E-mail* do usuário no Entra ID não pode estar vazio.

Se o login falhar, o site agora mostra o motivo na tela de entrada.

### Atualizações do banco
Quando o `supabase/schema.sql` mudar (ex.: a edição de canisters, função `crio_salvar_canisters`), cole o arquivo inteiro de novo
no **SQL Editor** e rode. Ele pode ser rodado várias vezes: não apaga tabelas nem dados.

### 4. Site (Cloudflare Pages)
1. Suba esta pasta para um repositório no GitHub.
2. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, escolha o repositório.
   *Framework preset*: None. *Build command*: vazio. *Build output directory*: `/`.
3. Depois do primeiro deploy, copie o endereço (ex.: `https://criogenia-isi-sas.pages.dev`) e, no Supabase →
   **Authentication → URL Configuration**, coloque-o em *Site URL* e em *Redirect URLs*.

## Segurança
- O navegador só lê as tabelas. Toda alteração passa pelas funções `crio_*` no banco, que pegam o nome e o e-mail
  do token do login; o site não consegue gravar outro nome.
- Vial retirado e equipamento excluído não são apagados: ficam marcados com quem e quando (o histórico não se perde).
- Só é possível excluir um equipamento sem vials guardados.
- Nunca coloque a chave `service_role` no `config.js`.
