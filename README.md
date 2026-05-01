# WolfSource — Sistema de Gestão Financeira

Aplicação web e Android para gestão financeira familiar. Desenvolvida como PWA com arquitetura modular vanilla JS, suporte offline, sincronização em tempo real com Firestore e empacotamento Android via Capacitor — web e APK compartilham o mesmo código e backend.

**Produção:** https://luanoliveirags.github.io/Financeiro-Lopes/

## Características Principais

- **Autenticação Customizada**: Login com hash SHA-256, roles (superadmin / admin / user) e Firebase Auth via custom token
- **Isolamento Multiusuário**: Dados isolados por família via Firestore Security Rules + claim `familyId` no JWT
- **Dashboard Interativo**: KPIs, gráficos Chart.js e análise financeira mensal
- **Controle de Transações**: Registro completo de entradas e saídas com categorias
- **Gestão de Dívidas**: Controle de vencimentos, status automático e alertas
- **Gestão de Salários**: Acompanhamento de rendas por membro da família
- **Lista de Compras**: Colaborativa e sincronizada em tempo real
- **Tarefas Domésticas**: Sistema compartilhado com responsáveis
- **Chat em Tempo Real**: Mensagens com notificações push via FCM
- **PWA + APK Android**: Instalável no browser ou como app nativo via Capacitor
- **Modo Offline**: Cache-first com sincronização automática ao reconectar
- **Notificações Push**: FCM web (Service Worker) + FCM nativo (Android)

## Início Rápido

### Pré-requisitos

- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Node.js 18+

### Rodar no Browser (dev)

```bash
git clone https://github.com/LuanOliveirags/Financeiro-Lopes.git
cd Financeiro-Lopes
npm install
npm run dev
```

Acesse `http://localhost:3000` e instale como PWA pelo ícone na barra de endereços.

### Configurar Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
2. Habilite **Cloud Firestore**, **Firebase Storage** e **Firebase Authentication**
3. Adicione o domínio de produção em Authentication → Settings → Authorized domains
4. Atualize as credenciais em `packages/services/firebase/firebase.config.js`:

```js
export const firebaseConfig = {
  apiKey:            'sua-api-key',
  authDomain:        'seu-projeto.firebaseapp.com',
  projectId:         'seu-projeto-id',
  storageBucket:     'seu-projeto.appspot.com',
  messagingSenderId: 'seu-messaging-id',
  appId:             'seu-app-id'
};
```

5. Configure o backend Flask com a variável `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON da service account do Firebase)

## Build Android (APK)

O frontend é empacotado com **Capacitor 6** — zero mudança no código, mesma lógica, mesmo Firebase.

### Pré-requisitos

- [Android Studio](https://developer.android.com/studio) (SDK Android 34)
- `google-services.json` do Firebase Console → coloque em `android/app/`

### Gerar APK de Debug

```bash
npm install
npm run sync   # monta www/ + sincroniza com Android (cwd: apps/mobile/)

JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" \
  ./apps/mobile/android/gradlew -p apps/mobile/android assembleDebug
```

APK em: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

### APK de Release

```bash
npm run open:android
# Android Studio → Build → Generate Signed App Bundle / APK → APK
```

## Arquitetura

```
Financeiro-Lopes/
├── apps/
│   ├── web/
│   │   ├── public/                    # Assets estáticos (index.html, SW, manifest)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── bootstrap.js       # Entry point — init Firebase, auth, UI
│   │       │   └── router.js          # Carrega fragmentos HTML dos módulos
│   │       └── features/
│   │           ├── dashboard/         # KPIs, gráficos, resumo mensal
│   │           ├── transactions/      # Controller CRUD de transações
│   │           ├── salaries/          # Controller de salários
│   │           ├── debts/             # Controller de dívidas
│   │           ├── shopping/          # Controller lista de compras
│   │           ├── chores/            # Controller tarefas domésticas
│   │           └── chat/              # Chat realtime
│   └── mobile/
│       ├── capacitor.config.json
│       └── android/
│
├── packages/
│   ├── core/state/
│   │   └── store.js                   # Estado global (isLoggedIn, currentUser, etc.)
│   ├── services/
│   │   ├── firebase/
│   │   │   ├── firebase.config.js     # Config pública + BACKEND_URL + constantes
│   │   │   ├── firebase.init.js       # Live-bindings: db, storage, auth, firebaseReady
│   │   │   ├── firebase.crud.js       # saveToFirebase, deleteFromFirebase, updateInFirebase
│   │   │   ├── firebase.service.js    # Orquestração + sync + re-exports (compat)
│   │   │   └── fcm.service.js         # Firebase Cloud Messaging
│   │   ├── auth/
│   │   │   └── auth.service.js        # Login SHA-256, signInWithFirebase, roles, família
│   │   ├── transactions/
│   │   │   └── transactions.service.js  # buildTransactionObject, filterTransactions, groupByDate
│   │   ├── salaries/
│   │   │   └── salaries.service.js    # buildSalaryObject, computeSalaryStats
│   │   ├── debts/
│   │   │   └── debts.service.js       # buildDebtObject, computeDebtStats, computeAlerts
│   │   ├── shopping/
│   │   │   └── shopping.service.js    # createList, addItem, toggleItem, finalizeList
│   │   ├── chores/
│   │   │   └── chores.service.js      # loadChores, saveChores, computeStats
│   │   └── notifications/
│   │       └── notification.service.js
│   ├── ui/navigation/
│   │   └── navigation.js              # Header, bottom nav, login form, FAB
│   └── utils/
│       ├── helpers.js
│       └── capacitor.bridge.js
│
├── backend/                           # API Flask — Railway
│   ├── app.py                         # Rotas Flask + endpoint /api/auth/token
│   └── requirements.txt
│
├── firestore.rules                    # Regras de segurança do Firestore
├── firestore.indexes.json
└── firebase.json                      # Hosting + Firestore config
```

### Padrão Service / Controller

Toda feature segue separação estrita:

| Camada | Local | Responsabilidade |
|---|---|---|
| **Service** | `packages/services/{mod}/{mod}.service.js` | Lógica pura — sem DOM, sem Firebase |
| **Controller** | `apps/web/src/features/{mod}/{mod}.js` | DOM, eventos, Firebase, orquestração |

## Stack

### Frontend
| Tecnologia | Uso |
|---|---|
| HTML5 / CSS3 / JS ES2022 | Vanilla — sem framework |
| ES Modules nativos | Módulos do browser sem bundler |
| Chart.js 4 | Gráficos do dashboard |
| Firebase SDK 10 (compat) | Firestore, Storage, Auth, FCM |
| Capacitor 6 | Empacotamento Android |
| Service Worker v23 | Cache-first offline PWA |

### Backend
| Tecnologia | Uso |
|---|---|
| Python 3.8+ / Flask | API REST + emissão de custom tokens |
| firebase-admin 6 | Firestore Admin + Firebase Auth Admin |
| Flask-CORS | Suporte a preflight CORS |
| Railway | Deploy contínuo do backend |

### Banco de Dados
- **Cloud Firestore** — dados em tempo real (transações, dívidas, salários, chat, usuários, famílias)
- **Firebase Storage** — fotos de perfil
- **localStorage** — cache offline por família (`familyId`)

## Segurança

### Fluxo de Autenticação

```
Login SHA-256 (browser)
  → POST /api/auth/token (Railway)
      → Valida users/{userId}.familyId no Firestore Admin
      → set_custom_user_claims(uid, { familyId })
      → create_custom_token(uid)
  → signInWithCustomToken(token) (Firebase Auth SDK)
  → request.auth.token.familyId ativo nas Firestore Rules
```

### Firestore Security Rules

```
transactions / debts / salaries
  → read/write somente se request.auth.token.familyId == doc.familyId

users / families
  → read: público (necessário para login e cadastro)
  → write: autenticado

passwordResets
  → read/write: público (fluxo sem auth)
```

### Resumo de Segurança

| Área | Abordagem |
|---|---|
| Autenticação | SHA-256 + Firebase Auth custom token com claim `familyId` |
| Isolamento de dados | Firestore Security Rules — nenhuma família acessa dados de outra |
| Claims JWT | `set_custom_user_claims` — persistentes em todos os refreshes |
| Credenciais Firebase | Config de cliente é pública por design (Firebase SDK) |
| Service Account | Variável de ambiente `FIREBASE_SERVICE_ACCOUNT_JSON` no Railway |
| Domínios autorizados | Firebase Console → Authentication → Authorized domains |

## API Backend (Flask)

### Autenticação
```
POST /api/auth/token     Valida userId+familyId → retorna Firebase custom token
```

### Dados (complementar ao Firestore direto)
```
GET  /api/transactions        POST /api/transactions
PUT  /api/transactions/:id    DELETE /api/transactions/:id

GET  /api/debts               POST /api/debts
PUT  /api/debts/:id           DELETE /api/debts/:id

GET  /api/salaries            POST /api/salaries
DELETE /api/salaries/:id

GET  /health
```

### Rodar o Backend Localmente

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' python app.py
```

## Infra e Deploy

| Ambiente | URL | Trigger |
|---|---|---|
| Produção | https://luanoliveirags.github.io/Financeiro-Lopes/ | Push em `main` via `deploy.yml` |
| Staging | https://financeiro-lopes--staging-9u9590k6.web.app | Push em `dev` via `deploy-staging.yml` |
| Backend | https://aware-delight-production-2e59.up.railway.app | Deploy manual via Railway CLI |

### Workflow de Desenvolvimento

```
feature branch → dev → validar staging → PR → merge main → produção automática
```

Nunca commitar direto em `main` — o merge para produção sempre passa pelo staging.

### Deploy das Firestore Rules

As rules **não** fazem parte do CI — deploy manual:

```bash
firebase deploy --only firestore:rules
```

## PWA

| Recurso | Status |
|---|---|
| Instalável (Add to Home Screen) | Sim |
| Offline-first (cache-first SW) | Sim |
| Notificações push background | Sim — FCM Service Worker |
| Ícones maskable | Sim — 48px → 512px |
| Service Worker | v23 |

## Roadmap

### Concluído
- [x] Autenticação customizada com roles e família
- [x] Dashboard com gráficos (Chart.js)
- [x] CRUD de transações, dívidas e salários
- [x] Lista de compras e tarefas domésticas
- [x] Chat em tempo real com FCM
- [x] PWA com modo offline
- [x] APK Android via Capacitor
- [x] Notificações push nativas Android
- [x] Arquitetura service/controller — 6 módulos refatorados
- [x] Firebase split — firebase.init / firebase.crud / firebase.service
- [x] Infra de staging (Firebase Hosting Preview Channel)
- [x] Segurança multiusuário — Firebase Auth custom token + Firestore rules
- [x] Isolamento por família via claim `familyId` no JWT

### Em Desenvolvimento
- [ ] Relatórios PDF exportáveis
- [ ] Metas e orçamentos mensais
- [ ] Alertas personalizados por categoria

### Planejado
- [ ] Integração Open Banking
- [ ] Categorização automática com ML
- [ ] Reconhecimento de recibos via OCR
- [ ] Exportação Excel / CSV
- [ ] Multi-idioma (i18n)

## Autor

Desenvolvido por **Luan Gs**
