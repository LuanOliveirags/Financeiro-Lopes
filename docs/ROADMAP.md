# Roteiro de Funcionalidades — WolfSource

## Implementado

### v1.0.0 — Base

**Frontend**
- Layout responsivo (Mobile-first)
- Autenticação customizada (SHA-256)
- Dashboard com KPIs e gráficos (Chart.js)
- CRUD de Transações (13 categorias, múltiplas formas de pagamento)
- CRUD de Dívidas (5 tipos: única, fixa, cartão, empréstimo, financiamento)
- CRUD de Salários (bruto → acréscimos → descontos → líquido)
- Exportação/importação de dados (JSON)
- Suporte offline (Service Worker + cache-first)
- PWA manifest + dark mode automático
- Indicador online/offline

**Backend**
- API REST com Flask
- CRUD completo (Transações, Dívidas, Salários)
- CORS habilitado
- SQLAlchemy ORM
- Docker + Docker Compose
- Suporte a PostgreSQL e SQLite

---

### v1.1.0 — Funcionalidades Avançadas

**Autenticação e Usuários**
- Roles: superadmin / admin / user
- Suporte a múltiplas famílias (familyId)
- Painel admin: CRUD de usuários e famílias
- Recuperação de senha via código EmailJS (6 dígitos, 15 min)
- Perfil com avatar (upload + redimensionamento + Firebase Storage)
- Telefone e recado editáveis no perfil

**Dashboard**
- Modo duplo: Geral ↔ VR/VA com slider animado
- KPIs: saldo líquido, receita, despesa, dívidas, responsáveis, descontos
- Sparkline (balanço diário), doughnut (categorias), bar (responsáveis), doughnut (tipo de dívida)
- Toggle para ocultar valores (blur CSS)
- Filtro por mês com scroller horizontal

**Dívidas**
- Sistema de parcelas com tracking pago/restante
- Cartão com sub-modalidades: única, recorrente, parcelado
- Filtros: mensais, financiamento, empréstimo, cartão por pessoa, pagas
- Alerta sino com badges (atrasadas / hoje / próximas)
- Efeito visual para dívidas atrasadas

**Lista de Compras**
- Listas por loja (Ayumi, Assaí, Westboi, Outro)
- 11 categorias, 39 itens quick-add com autocomplete
- Checkout flow → cria transação automaticamente
- Swipe-back gesture no mobile

**Tarefas da Casa**
- Day scroller semanal
- Tarefas por pessoa com progress ring SVG animado
- Modo edição com add/edit/delete
- Persistência em localStorage com tracking diário

**Chat**
- DMs entre usuários via Firestore (conversations + messages subcollection)
- Busca de contato por número de telefone
- Envio de imagens via Firebase Storage
- Emoji picker com 6 categorias + reações em mensagens
- Edição e exclusão de mensagens
- Arquivamento de conversas e seen/read receipts
- FCM push notifications (app aberto, background e fechado)
- Layout desktop com sidebar

**Notificações**
- Notificações locais via Service Worker
- Verificação de dívidas: atrasadas / vencendo hoje / próximas
- Periodic Background Sync (verifica com app fechado)
- Configurações granulares por tipo de alerta

---

### v1.2.0 — Arquitetura Modular

- Refatoração para `app/` + `features/` + `packages/`
- Cada módulo autocontido (html + js + css)
- Entry point único via `bootstrap.js` + router separado
- Estado global centralizado em `packages/core/state/store.js`
- Firebase split: `firebase.init` / `firebase.crud` / `firebase.service`
- Sidebar desktop colapsada (ícones, 68px)
- Service Worker v23 com cache por nova estrutura
- Infra de staging (Firebase Hosting Preview Channel)

---

### v1.3.0 — Estabilização e Segurança *(Junho 2026)*

**Firestore Security Rules**
- Função `isAdmin()` nas rules (role == 'admin' — separada do superadmin)
- Superadmin pode criar/editar/excluir qualquer usuário
- Admin pode gerenciar usuários dentro da própria família
- Regras para coleção `conversations` e subcoleção `messages` (chat)
- Deploy automático via `firebase deploy --only firestore:rules`

**Firebase Auth — Custom Token Flow**
- `_waitForAuthReady()` — aguarda `onAuthStateChanged` antes de checar sessão, evitando re-auth desnecessária em page reload
- Timeout de `signInWithFirebase` aumentado de 8s para 30s (Railway cold start)
- `_ensureFirebaseAuth()` com retry e mensagem de status ao usuário
- `BACKEND_URL` dinâmico: `localhost:5000` em dev, Railway em produção

**Backend**
- `backend/Procfile` criado para deploy correto no Railway (`gunicorn app:app`)
- CORS corrigido: `OPTIONS` retorna headers explícitos em qualquer situação
- Compatibilidade com Python 3.14 (SQLAlchemy 2.0.36+)
- `.env` local para desenvolvimento sem Railway

**UI / UX**
- `showAlert` (toast) usa `position: fixed` com `z-index: var(--z-toast)` — visível acima de modais
- Classe `.alert-toast` no CSS com posicionamento top-right
- `loadFamilyMembers()` chamado após editar outro usuário — remove cache stale da família

---

## Planejado

### v2.0.0 — Médio Prazo

**Autenticação**
- [ ] Migração para Firebase Auth nativo (substituir SHA-256 custom)
- [ ] Two-factor authentication (2FA)
- [ ] Login com Google

**Financeiro**
- [ ] Orçamentos e metas por categoria
- [ ] Alertas de limite de gasto
- [ ] Recorrências automáticas (transações repetidas)
- [ ] Planejamento mensal
- [ ] Notas nas transações

**Análises e Relatórios**
- [ ] Relatórios PDF exportáveis
- [ ] Comparativo de períodos
- [ ] Análise de tendências
- [ ] Exportação Excel / CSV
- [ ] Relatórios automáticos por email

**Integrações**
- [ ] Open Banking (leitura de extrato bancário)
- [ ] APIs de câmbio em tempo real

---

### v3.0.0 — Longo Prazo

**Inteligência Artificial**
- [ ] Categorização automática com ML
- [ ] Recomendações de economia
- [ ] Previsões de gastos
- [ ] Chatbot assistente financeiro

**Funcionalidades Avançadas**
- [ ] Investimentos e criptomoedas
- [ ] Reconhecimento de recibos via OCR
- [ ] QR code para registro rápido
- [ ] Reconhecimento de voz
- [ ] Sincronização com calendário

**Plataformas**
- [ ] App Android via PWA avançado ou React Native
- [ ] Desktop app (Electron)

---

## Melhorias Contínuas

- [ ] Testes automatizados (unitários + E2E)
- [ ] CI/CD pipeline completo via GitHub Actions
- [ ] Paginação Firestore (performance em famílias com muitos dados)
- [ ] Acessibilidade (WCAG 2.1)
- [ ] Multi-idioma (i18n)
- [ ] Temas customizáveis pelo usuário
- [ ] Tarefas dinâmicas por membros da família (não hardcoded por nome)
- [ ] Railway auto-deploy via GitHub (root directory configurado para `backend/`)

---

## Prioridades

### Q2 2026 (atual)
1. ~~Correções de segurança e auth~~ ✅ concluído em junho
2. Testes automatizados (unitários)
3. Orçamentos / metas por categoria

### Q3 2026
1. Migração Firebase Auth nativo
2. Relatórios PDF e Excel
3. Alertas por email

### Q4 2026
1. Open Banking
2. IA / ML — categorização automática
3. App Android nativo

---

## Métricas de Sucesso

- [ ] Cobertura de testes > 80%
- [ ] Performance < 2s em mobile 4G
- [ ] PWA Lighthouse score 90+
- [ ] Zero issues críticos de segurança
- [ ] Uptime 99.9%

---

**Última atualização**: Junho 2026
