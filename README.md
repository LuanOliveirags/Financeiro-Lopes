# 💰 WolfSource - Gestão de Despesas PWA

Uma aplicação web moderna e responsiva para gestão completa de despesas financeiras, funcionando tanto online quanto offline com suporte a PWA (Progressive Web App).

## 🎯 Características Principais

- ✅ **Autenticação Segura**: Login com credenciais
- 📊 **Dashboard Interativo**: Gráficos e KPIs em tempo real
- ✨ **Responsivo**: Funciona perfeitamente em celulares, tablets e desktops
- 📱 **PWA**: Instale como app nativo no seu dispositivo
- 🔄 **Suporte Offline**: Funciona sem conexão com internet
- 💾 **Sincronização**: Sincronização automática com Firebase
- 📈 **Análises**: Gráficos interativos com Chart.js
- 🎨 **Dark Mode**: Suporte a modo escuro do sistema

## 🚀 Como Começar

### 1. Credenciais de Login (Padrão)
```
Usuário: root
Senha: root
```

### 2. Instalação

#### No navegador:
1. Abra `index.html` em um navegador moderno
2. A aplicação carregará automaticamente

#### Como PWA (App Nativo):
1. Acesse a aplicação no navegador
2. Clique em "Instalar App" (Chrome, Edge, Firefox)
3. Ou toque em "Compartilhar" → "Adicionar à Tela Inicial" (Mobile)

### 3. Configuração do Firebase

Para sincronizar dados com Firebase:

1. **Criar Projeto Firebase**:
   - Acesse [Firebase Console](https://console.firebase.google.com)
   - Clique "Add Project"
   - Preencha os dados do projeto

2. **Habilitar Realtime Database**:
   - Vá em "Realtime Database"
   - Clique "Create Database"
   - Escolha localização
   - Selecione "Start in test mode" (para desenvolvimento)

3. **Copiar Configuração**:
   - Vá em "Project Settings" → "Apps" → "Web"
   - Copie o objeto de configuração
   - Cole em `js/script.js` na seção `CONFIG.firebase`

```javascript
const CONFIG = {
  firebase: {
    apiKey: "sua-api-key",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "seu-messaging-id",
    appId: "seu-app-id"
  }
};
```

## 📚 Funcionalidades

### 📊 Dashboard
- Visualização de KPIs (Despesas, Saldos, Gastos)
- Gráficos interativos por categoria, responsável e evolução mensal
- Transações recentes
- Filtro por mês

### ➕ Adicionar Transação
- Registro de entradas e saídas
- Categorização (Alimentação, Transporte, Saúde, etc.)
- Atribuição de responsável
- Descrição customizável

### 📉 Controle de Dívidas
- Registro de dívidas ativas
- Status: Ativas, Atrasadas, Próximas do vencimento, Pagas
- Marcar como paga
- Organização por data de vencimento

### 💵 Financeiro (Salários)
- Registro de salários de Luan e Bianca
- Visualização de renda individual
- Cálculo de renda combinada
- Histórico anual

### ⚙️ Configurações
- Exportar dados (JSON)
- Importar dados (JSON)
- Sincronizar com Firebase
- Limpar cache
- Status de sincronização

## 🔧 Estrutura do Projeto

```
.
├── index.html              # Arquivo HTML principal
├── manifest.json           # Configuração PWA
├── service-worker.js       # Service Worker para offline
├── css/
│   ├── style.css          # Estilos globais
│   ├── app-style.css      # Estilos da aplicação
│   ├── sections.css       # Estilos das seções
│   ├── calendar-style.css # Estilos de calendário
│   ├── animations.css     # Animações
│   └── base/
│       └── responsive.css # Media queries
├── js/
│   └── script.js          # Lógica principal
├── img/                   # Ícones e imagens
└── Phyton/               # Backend Python (em desenvolvimento)
```

## 💻 Tecnologias Utilizadas

### Frontend
- **HTML5** - Estrutura
- **CSS3** - Estilos (com Grid, Flexbox, Media Queries)
- **JavaScript (ES6+)** - Lógica e interatividade
- **Chart.js** - Gráficos interativos
- **PWA** - Progressive Web App
- **Service Worker** - Suporte offline

### Backend (em desenvolvimento)
- **Python** - Servidor
- **Flask/FastAPI** - Framework web
- **SQLAlchemy** - ORM
- **Firebase Admin SDK** - Integração Firebase

### Banco de Dados
- **Firebase Realtime Database** - Armazenamento em cloud
- **LocalStorage** - Cache local

## 📱 Responsividade

A aplicação foi desenvolvida com "mobile-first" approach:

- **Mobile** (320px - 480px): Layout vertical, botões maiores
- **Tablet** (481px - 1024px): Layout adaptado, 2-3 colunas
- **Desktop** (1025px+): Layout completo, 4 colunas

Breakpoints personalizáveis em `css/base/responsive.css`

## 🔐 Segurança

### Autenticação Local
- Credentials no frontend (apenas para demo)
- Para produção, implementar backend de autenticação

### Dados
- Armazenamento em LocalStorage (navegador)
- Backup em Firebase (quando configurado)
- Exportação em JSON para backup manual

### PWA
- HTTPS recomendado para produção
- Manifest com ícones

## 📊 API Endpoints (Backend Python - em desenvolvimento)

```
GET    /api/transactions    - Listar transações
POST   /api/transactions    - Criar transação
PUT    /api/transactions/:id - Atualizar transação
DELETE /api/transactions/:id - Deletar transação

GET    /api/debts          - Listar dívidas
POST   /api/debts          - Criar dívida
PUT    /api/debts/:id      - Atualizar dívida
DELETE /api/debts/:id      - Deletar dívida

GET    /api/salaries       - Listar salários
POST   /api/salaries       - Criar salário
DELETE /api/salaries/:id   - Deletar salário
```

## 🚀 Próximas Melhorias

- [ ] Backend Python completo
- [ ] Autenticação com Firebase Auth
- [ ] Sincronização em tempo real
- [ ] Notificações push
- [ ] Relatórios PDF
- [ ] Múltiplos usuários
- [ ] Compartilhamento de despesas
- [ ] Orçamentos e metas
- [ ] Previsões com IA
- [ ] Integração com bancos

## 🤝 Contribuindo

Faça forks, crie branches e envie PRs!

## 📄 Licença

MIT License - Sinta-se livre para usar, modificar e distribuir

## 📞 Contato

Desenvolvido por: Luan e Bianca
GitHub: [WolfSource](https://github.com)

---

**Desenvolvido com ❤️ para gestão financeira eficiente**
