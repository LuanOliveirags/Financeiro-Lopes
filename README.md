# 💰 WolfSource - Sistema de Gestão Financeira

Uma aplicação web moderna e completa para gestão financeira familiar, desenvolvida como PWA (Progressive Web App) com arquitetura modular, suporte offline e sincronização em tempo real com Firebase.

## 🎯 Características Principais

- ✅ **Autenticação Firebase**: Login seguro com Firebase Authentication
- 📊 **Dashboard Interativo**: Visualização de KPIs, gráficos e análises financeiras
- 💬 **Chat em Tempo Real**: Sistema de mensagens com notificações push
- 🛒 **Lista de Compras**: Gerenciamento colaborativo de compras
- 📝 **Gestão de Tarefas**: Sistema de tarefas domésticas compartilhadas
- 💳 **Controle de Transações**: Registro completo de entradas e saídas
- 💰 **Gestão de Salários**: Acompanhamento de rendas e orçamento
- 📉 **Controle de Dívidas**: Gerenciamento de dívidas e vencimentos
- 📱 **PWA**: Instalável como app nativo em qualquer dispositivo
- 🔄 **Modo Offline**: Funciona sem conexão com sincronização automática
- 🎨 **Interface Moderna**: Design responsivo e intuitivo
- 🔔 **Notificações Push**: Alertas em tempo real via Firebase Cloud Messaging

## 🚀 Início Rápido

### Pré-requisitos
- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Servidor web local (para desenvolvimento) ou hospedagem web
- Conta Firebase (opcional, mas recomendado)

### Instalação Frontend

1. **Clone o repositório**:
```bash
git clone https://github.com/seu-usuario/financeiro-lopes.git
cd financeiro-lopes
```

2. **Abra no navegador**:
- Abra o arquivo `index.html` em um navegador moderno
- Ou use um servidor local:
```bash
# Python
python -m http.server 8000

# Node.js
npx http-server
```

3. **Instale como PWA** (opcional):
- Acesse a aplicação no navegador
- Clique no ícone de instalação na barra de endereços
- Ou use "Menu" → "Instalar WolfSource"

### Configuração Firebase

O projeto já vem com Firebase configurado. Para usar sua própria instância:

1. **Crie um projeto no [Firebase Console](https://console.firebase.google.com)**

2. **Habilite os serviços**:
   - Firebase Authentication (Email/Password)
   - Firestore Database
   - Firebase Cloud Messaging (para notificações push)

3. **Atualize as credenciais** em `frontend/app/providers/firebase-config.js`:
```javascript
export const firebaseConfig = {
  apiKey: "sua-api-key",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "seu-messaging-id",
  appId: "seu-app-id",
  measurementId: "seu-measurement-id"
};
```

4. **Configure FCM** (para notificações push):
   - No Firebase Console → Configurações → Cloud Messaging
   - Gere um par de chaves Web Push
   - Atualize `FCM_VAPID_KEY` e `FCM_SERVER_KEY` no mesmo arquivo

### Instalação Backend (Opcional)

O backend Flask fornece APIs REST adicionais:

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Executar servidor
python app.py
```

**Com Docker**:
```bash
cd backend
docker-compose up
```

O backend estará disponível em `http://localhost:5000`

## 📚 Módulos e Funcionalidades

### 🔐 Login
- Autenticação via Firebase Authentication
- Interface moderna e responsiva
- Recuperação de senha
- Validação de formulários

### 📊 Dashboard
- **KPIs Principais**: Total de despesas, saldos, estatísticas mensais
- **Gráficos Interativos**: 
  - Despesas por categoria
  - Gastos por responsável
  - Evolução mensal
- **Transações Recentes**: Últimas movimentações financeiras
- **Filtros Avançados**: Por período, categoria e responsável

### 💳 Transações
- Registro de receitas e despesas
- Categorização automática
- Anexos e comprovantes
- Histórico completo
- Busca e filtros
- Exportação de dados

### 💰 Salários
- Gestão de rendas mensais
- Múltiplas fontes de renda
- Histórico anual
- Cálculo de renda combinada
- Planejamento orçamentário

### 📉 Dívidas
- Controle de dívidas ativas
- Status automático: Ativas, Atrasadas, Próximas do vencimento, Pagas
- Alertas de vencimento
- Histórico de pagamentos
- Cálculo de juros

### 🛒 Lista de Compras (Shopping)
- Criação de listas compartilhadas
- Marcação de itens comprados
- Categorização de produtos
- Sincronização em tempo real
- Histórico de compras

### 📝 Tarefas Domésticas (Chores)
- Sistema de tarefas compartilhadas
- Atribuição de responsáveis
- Definição de prioridades
- Status de conclusão
- Recorrência de tarefas

### 💬 Chat
- Mensagens em tempo real via Firebase
- Notificações push (FCM)
- Histórico de conversas
- Indicadores de mensagens não lidas
- Suporte para dispositivos móveis

### ⚙️ Configurações
- Gerenciamento de perfil
- Preferências da aplicação
- Exportação/Importação de dados
- Sincronização manual
- Limpeza de cache
- Informações de versão

## 🏗️ Arquitetura do Projeto

```
financeiro-lopes/
├── index.html                 # Ponto de entrada da aplicação
├── manifest.json             # Configuração PWA
├── service-worker.js         # Service Worker para modo offline
├── README.md                 # Documentação principal
│
├── frontend/                 # Aplicação Frontend
│   ├── app/
│   │   ├── bootstrap.js      # Inicialização da aplicação
│   │   ├── router.js         # Sistema de roteamento SPA
│   │   ├── providers/
│   │   │   ├── auth-provider.js      # Provider de autenticação
│   │   │   ├── firebase-config.js    # Configuração Firebase
│   │   │   └── firebase-provider.js  # Provider Firebase
│   │   └── state/
│   │       ├── session.js    # Gerenciamento de sessão
│   │       └── store.js      # Estado global da aplicação
│   │
│   ├── modules/              # Módulos da aplicação
│   │   ├── login/           # Tela de login
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── transactions/    # Gestão de transações
│   │   ├── salaries/        # Controle de salários
│   │   ├── debts/           # Gerenciamento de dívidas
│   │   ├── shopping/        # Lista de compras
│   │   ├── chores/          # Tarefas domésticas
│   │   ├── chat/            # Sistema de chat + FCM
│   │   └── settings/        # Configurações
│   │
│   ├── shared/              # Componentes e recursos compartilhados
│   │   ├── components/
│   │   │   ├── calendar/    # Componente de calendário
│   │   │   ├── forms/       # Componentes de formulários
│   │   │   ├── modal/       # Sistema de modais
│   │   │   └── navigation/  # Navegação e menu
│   │   ├── services/
│   │   │   └── notifications.js  # Serviço de notificações
│   │   ├── styles/
│   │   │   └── global/      # Estilos globais (base, animações, responsivo)
│   │   └── utils/
│   │       └── helpers.js   # Funções auxiliares
│   │
│   └── assets/              # Recursos estáticos
│       └── images/          # Ícones e imagens
│
├── backend/                 # Backend Python/Flask
│   ├── app.py              # Aplicação Flask principal
│   ├── config.py           # Configurações do backend
│   ├── requirements.txt    # Dependências Python
│   ├── Dockerfile          # Container Docker
│   ├── docker-compose.yml  # Orquestração Docker
│   └── README.md           # Documentação do backend
│
└── docs/                   # Documentação adicional
    ├── INSTALACAO.md       # Guia de instalação
    └── ROADMAP.md          # Roadmap do projeto
```

### Padrões de Arquitetura

- **SPA (Single Page Application)**: Navegação sem recarregamento
- **Modular**: Cada módulo é independente e reutilizável
- **Provider Pattern**: Gerenciamento centralizado de serviços
- **State Management**: Estado global com store centralizado
- **Service Layer**: Camada de serviços para lógica de negócio
- **Component-Based**: Componentes reutilizáveis e isolados

## 💻 Stack Tecnológica

### Frontend
- **HTML5** - Estrutura semântica
- **CSS3** - Estilos modernos (Grid, Flexbox, Custom Properties)
- **JavaScript (ES6+)** - Lógica e interatividade
  - Módulos ES6
  - Async/Await
  - Classes e OOP
- **Chart.js** - Gráficos e visualizações
- **Firebase SDK** - Integração completa
  - Firebase Authentication
  - Cloud Firestore
  - Firebase Cloud Messaging (FCM)
  - Firebase Analytics
- **PWA** - Progressive Web App
  - Service Worker
  - Web App Manifest
  - Cache API
  - IndexedDB

### Backend
- **Python 3.8+** - Linguagem principal
- **Flask** - Framework web minimalista
- **Flask-CORS** - Suporte CORS
- **SQLAlchemy** - ORM para banco de dados
- **Docker** - Containerização
- **Docker Compose** - Orquestração

### Banco de Dados
- **Cloud Firestore** - Banco NoSQL em tempo real
- **IndexedDB** - Armazenamento local do navegador
- **SQLite/PostgreSQL** - Backend (opcional)

### Ferramentas e Serviços
- **Git** - Controle de versão
- **Firebase Console** - Gerenciamento Firebase
- **VS Code** - IDE recomendada

## 📱 Responsividade e PWA

### Design Responsivo
A aplicação utiliza abordagem **mobile-first** com breakpoints otimizados:

- **Mobile** (320px - 768px): Layout vertical, navegação inferior
- **Tablet** (769px - 1024px): Layout híbrido, 2 colunas
- **Desktop** (1025px+): Layout completo, múltiplas colunas

### Recursos PWA
- ✅ **Instalável**: Adicione à tela inicial
- ✅ **Offline-First**: Funciona sem internet
- ✅ **Cache Inteligente**: Recursos essenciais sempre disponíveis
- ✅ **Atualizações Automáticas**: Service Worker gerencia versões
- ✅ **Notificações Push**: Alertas mesmo com app fechado
- ✅ **Ícones Adaptáveis**: Maskable icons para Android

## 🔐 Segurança

### Autenticação
- **Firebase Authentication**: Autenticação robusta e segura
- **Sessões**: Tokens JWT gerenciados pelo Firebase
- **Proteção de Rotas**: Middleware de autenticação no router
- **Logout Automático**: Timeout de sessão configurável

### Dados
- **Firestore Rules**: Regras de segurança no banco de dados
- **Validação**: Client-side e server-side validation
- **Sanitização**: Prevenção contra XSS e SQL Injection
- **HTTPS**: Recomendado para produção

### Boas Práticas
- Não armazenar credenciais no código
- Variáveis de ambiente para configurações sensíveis
- Auditoria de dependências
- Content Security Policy (CSP)

## 🔌 API Backend (Flask)

O backend fornece endpoints REST complementares:

### Endpoints de Transações
```
GET    /api/transactions           # Listar todas as transações
POST   /api/transactions           # Criar nova transação
GET    /api/transactions/:id       # Obter transação específica
PUT    /api/transactions/:id       # Atualizar transação
DELETE /api/transactions/:id       # Deletar transação
```

### Endpoints de Dívidas
```
GET    /api/debts                  # Listar dívidas
POST   /api/debts                  # Criar dívida
GET    /api/debts/:id              # Obter dívida específica
PUT    /api/debts/:id              # Atualizar dívida
DELETE /api/debts/:id              # Deletar dívida
```

### Endpoints de Salários
```
GET    /api/salaries               # Listar salários
POST   /api/salaries               # Registrar salário
GET    /api/salaries/:id           # Obter salário específico
DELETE /api/salaries/:id           # Deletar salário
```

### Endpoints de Usuários
```
POST   /api/auth/register          # Registrar usuário
POST   /api/auth/login             # Login de usuário
GET    /api/users/profile          # Obter perfil
PUT    /api/users/profile          # Atualizar perfil
```

**Nota**: A aplicação funciona completamente com Firebase. O backend Flask é opcional e fornece funcionalidades extras.

## �️ Roadmap e Melhorias Futuras

### Em Desenvolvimento
- [ ] Relatórios PDF exportáveis
- [ ] Gráficos avançados de análise financeira
- [ ] Sistema de metas e orçamentos mensais
- [ ] Alertas personalizados de gastos

### Planejado
- [ ] Múltiplos usuários e permissões
- [ ] Compartilhamento de despesas entre famílias
- [ ] Integração com bancos (Open Banking)
- [ ] Reconhecimento de recibos via OCR
- [ ] Dashboard com IA para insights financeiros
- [ ] Categorização automática com ML
- [ ] Modo escuro/claro personalizado
- [ ] Temas customizáveis
- [ ] Multi-idioma (i18n)
- [ ] Exportação para Excel/CSV
- [ ] Backup automático em nuvem
- [ ] Aplicativo mobile nativo (React Native)

### Concluído ✅
- [x] Autenticação Firebase
- [x] Sistema de roteamento SPA
- [x] Dashboard com gráficos
- [x] Gestão de transações
- [x] Controle de dívidas
- [x] Lista de compras
- [x] Sistema de tarefas
- [x] Chat em tempo real
- [x] Notificações push
- [x] PWA com modo offline
- [x] Backend Flask com Docker
- [x] Sincronização Firestore

## 🧪 Testes

Para executar os testes (quando disponíveis):

```bash
# Frontend (planejado)
npm test

# Backend
cd backend
pytest
```

## 📖 Documentação Adicional

- [Guia de Instalação](docs/INSTALACAO.md) - Instruções detalhadas de instalação
- [Roadmap Completo](docs/ROADMAP.md) - Planejamento e features futuras
- [Backend README](backend/README.md) - Documentação do backend Flask

## 🤝 Contribuindo

Contribuições são bem-vindas! Siga estas etapas:

1. **Fork** o repositório
2. **Crie** uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. **Commit** suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. **Push** para a branch (`git push origin feature/MinhaFeature`)
5. Abra um **Pull Request**

### Diretrizes
- Siga os padrões de código existentes
- Adicione comentários quando necessário
- Teste suas alterações antes de enviar
- Atualize a documentação se necessário

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Autores

Desenvolvido com ❤️ por **Luan Gs**

## 📞 Suporte

Para dúvidas, sugestões ou reportar problemas:
- Abra uma [issue](https://github.com/seu-usuario/financeiro-lopes/issues)
- Entre em contato via email

---

**💡 WolfSource** - Gestão Financeira Inteligente para Famílias Modernas
