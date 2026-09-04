# Activity Fisioterapia — Totem iPad Kiosk para Corredores

Aplicativo web progressivo (**PWA**) offline-first otimizado para **iPad 10** e tablets em modo quiosque (paisagem ou retrato), desenvolvido para check-in ágil de corredores que realizam massagem esportiva e liberação miofascial em eventos de corrida.

O sistema opera **100% offline** (salvando localmente no **IndexedDB** caso a rede 4G/5G oscile durante a prova), possui sincronização automática em nuvem (**Cloudflare** + **Neon PostgreSQL / FisioFlow**), seleção inteligente de eventos com base na data atual, exportação em **CSV** e hub completo de automação **Meta (WhatsApp Cloud API)** com template pós-evento e bot de auto-resposta para agendamento de horários.

---

## 🚀 Funcionalidades

- 📱 **Otimizado para iPad 10 (Sem App Store)**: Instalável direto pelo Safari via *"Adicionar à Tela de Início"*, rodando em tela cheia (standalone) como aplicativo nativo.
- 🔒 **Modo Quiosque Blindado**: Compatível com o recurso nativo **Acesso Guiado** (*Guided Access*) do iPad 10 (botão superior 3x) para travar a tela e impedir saída dos corredores.
- 📶 **Resiliência Total Offline (IndexedDB)**: Registra participantes mesmo sem internet. Identifica automaticamente a reconexão e sobe os dados em segundo plano com indicador visual em tempo real.
- 🏃 **2 Opções de Layout para Escolher**:
  - **Layout A (Lado a Lado)**: Formulário na esquerda com checkbox LGPD + QR Code oficial do Instagram (`@activityfisioterapia`) fixo na direita. Ao dar `Enter`, salva e reseta instantaneamente para o próximo corredor.
  - **Layout B (2 Etapas)**: Entrada minimalista com letras gigantes (apenas Nome e WhatsApp), avança para tela de celebração com QR Code em destaque e temporizador regressivo automático.
- 🎯 **Seleção Inteligente de Eventos**:
  - Ao abrir o app, o sistema detecta a data de hoje e pré-seleciona automaticamente o evento com a data mais próxima.
  - Modal para cadastrar novos eventos (Nome, Data, Categoria, Local, Meta de Atendimentos).
- 📊 **Gerenciamento Completo de Eventos**:
  - Painel com contagem de atendimentos em tempo real, taxa de opt-in LGPD e status de sincronização (Nuvem vs. Tablet).
  - Tabela com busca rápida por nome/telefone e links diretos para conversa no WhatsApp (`wa.me/...`).
  - **Exportação CSV** formatada com UTF-8 BOM (compatível com Excel sem desconfigurar acentos).
- 💬 **Template & Automação Meta WhatsApp**:
  - Simulador interativo idêntico à interface do WhatsApp da clínica com cabeçalho em vídeo.
  - Variáveis dinâmicas: `{{1}}` Primeiro Nome, `{{2}}` Data do Evento, `{{3}}` Nome da Corrida, `{{4}}` Validade do Bônus (+15 dias).
  - Botão de resposta rápida: **"Quero agendar!"**.
  - Simulador do bot respondendo com a grade de horários da clínica:
    > *"Para qual horario teria interesse de agendar ?*  
    > *Atendemos de segunda a sexta das 07h às 21h*  
    > *Sábado das 07h as 13h"*
  - Payload JSON pronto para submissão no Gerenciador de Negócios da Meta.
  - Código do Webhook handler para Cloudflare / FisioFlow.

---

## 🛠️ Como Executar Localmente

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Iniciar em modo de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse a URL exibida (ex: `http://localhost:5173`).

3. **Build de Produção e Teste do PWA**:
   ```bash
   npm run build
   npm run preview
   ```

---

## 📲 Como Instalar no iPad 10 (Passo a Passo)

### 1. Adicionar à Tela de Início (Sem Loja)
1. Abra a URL do sistema no navegador **Safari** do iPad 10.
2. Toque no ícone de **Compartilhar** do Safari (quadrado com seta para cima no topo da tela).
3. Role a lista e selecione **"Adicionar à Tela de Início"**.
4. Toque em **"Adicionar"**. Um ícone com o logo da Activity Fisioterapia aparecerá na tela inicial do iPad.
5. Ao abrir por este ícone, o app abrirá em tela cheia, sem barra de navegação.

### 2. Travar o iPad em Modo Totem (Acesso Guiado)
1. No iPad, abra os **Ajustes** > **Acessibilidade** > **Acesso Guiado**.
2. Ative o Acesso Guiado e configure uma senha numérica (ex: 1234).
3. Abra o aplicativo do Totem na tela de início.
4. **Pressione 3 vezes o botão superior** (botão de ligar / Touch ID) do iPad 10.
5. Toque em **"Iniciar"** no canto superior direito.
6. O iPad fica 100% bloqueado exclusivamente no aplicativo de massagem. Ninguém conseguirá sair ou acessar outros aplicativos.
7. Para desbloquear: pressione o botão superior 3 vezes e digite seu código.

---

## ☁️ Deploy no Cloudflare Pages (Gratuito)

1. Faça o commit e push do repositório para o seu GitHub.
2. Acesse o [Painel da Cloudflare](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Selecione o repositório e configure:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Em **Environment variables**, adicione (opcional):
   - `DATABASE_URL`: String de conexão do Neon PostgreSQL do projeto FisioFlow (`ep-purple-union-72678311.sa-east-1.aws.neon.tech`).
5. Clique em **Save and Deploy**. O Cloudflare fornecerá uma URL pública gratuita com HTTPS automático (ex: `https://activity-totem.pages.dev`).

---

## 🗄️ Integração com Neon PostgreSQL (FisioFlow)

O aplicativo sincroniza com a tabela relacional já existente no FisioFlow:
```sql
-- Estrutura da tabela participantes no Neon
INSERT INTO participantes (
  id, organization_id, evento_id, nome, contato, instagram, segue_perfil, observacoes, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW());
```
Se a conexão com o Neon estiver inativa no momento da corrida, os dados permanecem seguros no IndexedDB local do tablet e serão sincronizados automaticamente assim que reconectar.
