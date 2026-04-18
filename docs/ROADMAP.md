# 🌟 Roteiro de Funcionalidades - WolfSource

## ✅ Implementado

### Versão 1.0.0 — Base

#### Frontend
- ✅ Layout responsivo (Mobile-first)
- ✅ Sistema de autenticação customizado (SHA-256)
- ✅ Dashboard com KPIs e gráficos (Chart.js)
- ✅ CRUD de Transações (13 categorias, múltiplas formas de pagamento)
- ✅ CRUD de Dívidas (5 tipos: única, fixa, cartão, empréstimo, financiamento)
- ✅ CRUD de Salários (bruto → acréscimos → descontos → líquido)
- ✅ Exportação/importação de dados (JSON)
- ✅ Suporte offline (Service Worker + cache)
- ✅ PWA manifest
- ✅ Dark mode automático
- ✅ Indicador online/offline

#### Backend
- ✅ API REST com Flask
- ✅ CRUD completo (Transações, Dívidas, Salários)
- ✅ CORS habilitado
- ✅ SQLAlchemy ORM
- ✅ Docker + Docker Compose
- ✅ Suporte para PostgreSQL

---

### Versão 1.1.0 — Funcionalidades Avançadas

#### Autenticação e Usuários
- ✅ Roles: superadmin / admin / user
- ✅ Suporte a múltiplas famílias (familyId)
- ✅ Painel admin: CRUD de usuários e famílias
- ✅ Recuperação de senha via código EmailJS (6 dígitos, 15 min)
- ✅ Perfil com avatar (upload + redimensionamento + Firebase Storage)
- ✅ Telefone e recado editáveis no perfil

#### Dashboard
- ✅ Modo duplo: Geral ↔ VR/VA com slider animado
- ✅ KPIs: saldo líquido, receita, despesa, dívidas, pagas, responsáveis, descontos
- ✅ Sparkline (balanço diário), doughnut (categorias), bar (responsáveis), doughnut (tipo de dívida)
- ✅ Toggle para ocultar valores (blur CSS)
- ✅ Filtro por mês com scroller horizontal

#### Dívidas
- ✅ Sistema de parcelas com tracking de pagas/restante
- ✅ Cartão com sub-modalidades: única, recorrente, parcelado
- ✅ 3 formas de pagamento: parcela / fatura / mensal
- ✅ Filtros: mensais, financiamento, empréstimo, cartão por pessoa, pagas
- ✅ Alerta sino com badges (atrasadas / hoje / próximas)
- ✅ Cards overview por tipo com valores calculados
- ✅ Efeito visual para dívidas atrasadas

#### Lista de Compras
- ✅ Listas por loja (Ayumi, Assaí, Westboi, Outro)
- ✅ 11 categorias, 39 itens quick-add com autocomplete
- ✅ Checkout flow → cria transação automaticamente
- ✅ Swipe-back gesture no mobile

#### Tarefas da Casa (Chores)
- ✅ Day scroller semanal
- ✅ Tarefas por pessoa (Luan / Bianca)
- ✅ Progress ring SVG animado
- ✅ Modo edição com add/edit/delete
- ✅ Persistência em localStorage com tracking diário

#### Chat
- ✅ DMs entre usuários via Firestore (conversations + messages subcollection)
- ✅ Busca de contato por número de telefone
- ✅ Envio de imagens via Firebase Storage
- ✅ Emoji picker com 6 categorias
- ✅ Reações em mensagens
- ✅ Edição de mensagens (somente se não visualizada)
- ✅ Arquivamento e exclusão de conversas
- ✅ Seen/read receipts em tempo real
- ✅ FCM push notifications (app aberto, background e fechado)
- ✅ Layout desktop com sidebar

#### Notificações
- ✅ Notificações locais via Service Worker
- ✅ Verificação de dívidas: atrasadas / vencendo hoje / próximas
- ✅ Periodic Background Sync (verifica dívidas com app fechado)
- ✅ Configurações granulares: toggle, overdue, today, dias de antecedência
- ✅ IndexedDB compartilhado entre app e Service Worker

---

### Versão 1.2.0 — Arquitetura Modular

- ✅ Refatoração para arquitetura `app/` + `modules/` + `shared/`
- ✅ Cada módulo autocontido (html + js + css)
- ✅ Componentes shared isolados em pastas próprias
- ✅ Entry point único via `bootstrap.js`
- ✅ Router separado (`router.js`)
- ✅ Estado global centralizado em `app/state/store.js`
- ✅ Providers Firebase e Auth em `app/providers/`
- ✅ Sidebar desktop colapsada (ícones, 68px)
- ✅ Service Worker v20 com cache por nova estrutura

---

## 📋 Planejado

### Versão 2.0.0 (Médio Prazo)

#### Autenticação
- [ ] Migração para Firebase Auth (substituir SHA-256 custom)
- [ ] Two-factor authentication (2FA)
- [ ] Login com Google

#### Financeiro
- [ ] Orçamentos e metas por categoria
- [ ] Alertas de limite de gasto
- [ ] Recorrências automáticas (transações repetidas)
- [ ] Planejamento mensal
- [ ] Notas nas transações

#### Análises e Relatórios
- [ ] Relatórios PDF
- [ ] Comparativo de períodos
- [ ] Análise de tendências
- [ ] Exportação em Excel
- [ ] Relatórios automáticos por email

#### Integrações
- [ ] Integração com bancos (Open Banking)
- [ ] Integração com APIs de câmbio

### Versão 3.0.0 (Longo Prazo)

#### Inteligência Artificial
- [ ] Categorização automática com ML
- [ ] Recomendações de economia
- [ ] Previsões de gastos com IA
- [ ] Chatbot assistente

#### Funcionalidades Avançadas
- [ ] Investimentos e criptomoedas
- [ ] Síncronização com calendário
- [ ] QR code para rápido registro
- [ ] Reconhecimento de voz

#### Aplicativos Nativos
- [ ] App Android (PWA avançado ou React Native)
- [ ] Desktop app (Electron)

---

## 🐛 Melhorias Contínuas

- [ ] Testes automatizados (unitários e E2E)
- [ ] CI/CD via GitHub Actions
- [ ] Otimização de performance (paginação Firestore)
- [ ] Melhorias de acessibilidade (WCAG 2.1)
- [ ] Suporte a múltiplos idiomas (i18n)
- [ ] Temas customizáveis pelo usuário
- [ ] Tarefas dinâmicas por membros da família (não hardcoded)

---

## 🛣️ Prioridades

### Q2 2026
1. Testes automatizados
2. CI/CD Pipeline
3. Orçamentos/Metas

### Q3 2026
1. Migração Firebase Auth
2. Relatórios avançados
3. Alertas por email

### Q4 2026
1. Open Banking
2. IA/ML features
3. App Android

---

## 📊 Métricas de Sucesso

- [ ] 100% cobertura de testes
- [ ] Performance < 2s em mobile 4G
- [ ] PWA score 90+
- [ ] Lighthouse score 95+
- [ ] Zero critical security issues
- [ ] 99.9% uptime

---

**Última atualização**: Abril 2026
