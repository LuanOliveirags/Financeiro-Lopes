# 💰 WolfSource — Sistema de Gestão Financeira

Aplicação web e Android para gestão financeira familiar. Desenvolvida como PWA com arquitetura modular vanilla JS, suporte offline, sincronização em tempo real com Firestore e empacotamento Android via Capacitor — web e APK compartilham o mesmo código e backend.

## 🎯 Características Principais

- 🔐 **Autenticação Customizada**: Login com roles (superadmin / admin / user) e controle por família
- 📊 **Dashboard Interativo**: KPIs, gráficos Chart.js e análise financeira mensal
- 💳 **Controle de Transações**: Registro completo de entradas e saídas com categorias
- 📉 **Gestão de Dívidas**: Controle de vencimentos, status automático e alertas
- 💰 **Gestão de Salários**: Acompanhamento de rendas por membro da família
- 🛒 **Lista de Compras**: Colaborativa e sincronizada em tempo real
- 📝 **Tarefas Domésticas**: Sistema compartilhado de tarefas com responsáveis
- 💬 **Chat em Tempo Real**: Mensagens com notificações push via FCM
- 📱 **PWA + APK Android**: Instalável no browser ou como app nativo via Capacitor
- 🔄 **Modo Offline**: Cache-first com sincronização automática ao reconectar
- 🔔 **Notificações Push**: FCM web (Service Worker) + FCM nativo (Android)

## 🚀 Início Rápido

### Pré-requisitos

- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Servidor web local para desenvolvimento

### Rodar no Browser (dev)

```bash
# Clone o repositório
git clone https://github.com/LuanGs1/Financeiro-Lopes.git
cd Financeiro-Lopes
npm install

# Monta www/ e serve localmente
npm run dev
```

Acesse `http://localhost:3000` e instale como PWA pelo ícone na barra de endereços.

### Configurar Firebase

O projeto já vem com uma instância configurada. Para usar a sua própria:

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
2. Habilite **Cloud Firestore** e **Firebase Storage**
3. Atualize as credenciais em `packages/services/firebase/firebase.config.js`:

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

## 📱 Build Android (APK)

O frontend é empacotado com **Capacitor 6** — zero mudança no código, mesma lógica, mesmo Firebase.

### Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- [Android Studio](https://developer.android.com/studio) (com SDK Android 34 / API 34)
- `google-services.json` do Firebase Console → coloque em `android/app/`

### Gerar APK de Debug (testes)

```bash
npm install
npm run sync          # monta www/ + sincroniza com Android (cwd: apps/mobile/)

# APK via terminal (sem precisar do Android Studio)
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" \
  ./apps/mobile/android/gradlew -p apps/mobile/android assembleDebug
```

O APK ficará em `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

### Abrir no Android Studio (APK de Release)

```bash
npm run open:android
```

No Android Studio: **Build → Generate Signed App Bundle / APK → APK**.

### Deploy no GitHub Pages

```bash
npm run deploy   # monta www/ e publica no branch gh-pages
```

### Atualizar o app após mudanças no frontend

```bash
npm run sync   # remonta www/ e sincroniza com o projeto Android
```

## 🏗️ Arquitetura

```
Financeiro-Lopes/
├── package.json                      # Dependências Node / scripts de build
│
├── apps/
│   ├── web/
│   │   ├── public/                   # Assets estáticos (servidos na raiz do www/)
│   │   │   ├── index.html
│   │   │   ├── manifest.json
│   │   │   ├── service-worker.js
│   │   │   └── assets/images/
│   │   │
│   │   └── src/
│   │       ├── app/
│   │       │   ├── bootstrap.js      # Entry point — init Firebase, auth, UI
│   │       │   └── router.js         # Carrega fragmentos HTML dos módulos
│   │       │
│   │       ├── features/
│   │       │   ├── auth/             # Login + reset de senha
│   │       │   ├── dashboard/        # KPIs, gráficos, resumo mensal
│   │       │   ├── transactions/     # CRUD de transações
│   │       │   ├── salaries/         # Controle de salários
│   │       │   ├── debts/            # Gestão de dívidas
│   │       │   ├── shopping/         # Lista de compras colaborativa
│   │       │   ├── chores/           # Tarefas domésticas
│   │       │   ├── chat/             # Chat realtime (html, css, js)
│   │       │   └── settings/         # Perfil, usuários, família
│   │       │
│   │       └── styles/
│   │           ├── base.css
│   │           ├── animations.css
│   │           └── responsive.css
│   │
│   └── mobile/
│       ├── capacitor.config.json     # Config Capacitor (webDir: ../../www)
│       └── android/                  # Projeto Android gerado pelo Capacitor
│
├── packages/
│   ├── core/
│   │   └── state/
│   │       ├── store.js              # Estado global da aplicação
│   │       └── session.js            # Re-exports de helpers de sessão
│   │
│   ├── services/
│   │   ├── firebase/
│   │   │   ├── firebase.config.js    # Config pública + constantes (VAPID, URLs)
│   │   │   ├── firebase.service.js   # CRUD Firestore + listeners realtime
│   │   │   └── fcm.service.js        # Firebase Cloud Messaging (web + nativo)
│   │   │
│   │   ├── auth/
│   │   │   └── auth.service.js       # Autenticação, roles, família
│   │   │
│   │   └── notifications/
│   │       └── notification.service.js  # Notificações locais + debt alerts
│   │
│   ├── ui/
│   │   ├── navigation/               # Header, bottom nav, FAB (css + js)
│   │   ├── modal/                    # Sistema de modais (css)
│   │   ├── forms/                    # Estilos de formulários (css)
│   │   └── calendar/                 # Seletor de data (css)
│   │
│   └── utils/
│       ├── helpers.js                # Formatação, IDs, utilitários
│       └── capacitor.bridge.js       # Detecção de ambiente nativo (APK)
│
├── backend/                          # API Flask (opcional)
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   └── repositories/
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── infra/
│   ├── scripts/
│   │   ├── copy-web.js               # Monta www/ para Capacitor e GH Pages
│   │   ├── generate-icons.js         # Gera ícones PWA em múltiplos tamanhos
│   │   ├── generate-android-icons.js # Gera ícones para Android/Capacitor
│   │   ├── release.js                # Pipeline completo de release do APK
│   │   └── upload-apk.js             # Faz upload do APK e atualiza config
│   ├── ci/
│   └── docker/
│
└── docs/
    ├── INSTALACAO.md
    └── ROADMAP.md
```

### Padrões de Arquitetura

| Padrão | Aplicação |
|---|---|
| SPA sem framework | Navegação via `router.js` + fragmentos HTML |
| Apps / Packages | Web e mobile em `apps/`, compartilhados em `packages/` |
| Module-based | Cada feature tem seu HTML, CSS e JS isolados em `features/` |
| Build assembly | `copy-web.js` monta `www/` preservando paths relativos |
| Dual-environment | `capacitor.bridge.js` detecta APK vs browser em runtime |

## 💻 Stack

### Frontend
| Tecnologia | Uso |
|---|---|
| HTML5 / CSS3 / JS ES2022 | Vanilla — sem framework |
| ES Modules | Módulos nativos do browser |
| Chart.js 4 | Gráficos do dashboard |
| Firebase SDK 10 (compat) | Firestore, Storage, FCM |
| Capacitor 6 | Empacotamento Android (APK) |
| Service Worker + Cache API | Modo offline PWA |
| IndexedDB | Persistência local de notificações |

### Backend (opcional)
| Tecnologia | Uso |
|---|---|
| Python 3.8+ / Flask | API REST complementar |
| SQLAlchemy | ORM — SQLite local ou PostgreSQL |
| Docker / Docker Compose | Containerização |
| firebase-admin | Acesso admin ao Firestore |

### Banco de Dados
- **Cloud Firestore** — dados em tempo real (transações, dívidas, salários, chat, usuários)
- **Firebase Storage** — fotos de perfil e anexos
- **IndexedDB** — cache local de notificações de dívidas para o Service Worker

## 🔐 Segurança

| Área | Abordagem |
|---|---|
| Autenticação | Customizada com hash SHA-256, roles e controle por família no Firestore |
| Credenciais Firebase | Config de cliente é pública por design (Firebase SDK) |
| Segredos (FCM, EmailJS) | Em `firebase-secrets.local.js` — gitignored |
| Regras Firestore | Acesso restrito por `familyId` via Firestore Security Rules |
| Android Keystore | `.jks` e `*.keystore` no `.gitignore` |

## 🔌 API Backend (Flask)

O backend é opcional — a aplicação funciona completamente via Firebase. Quando rodando:

```
GET  /api/transactions        POST /api/transactions
GET  /api/transactions/:id    PUT  /api/transactions/:id    DELETE /api/transactions/:id

GET  /api/debts               POST /api/debts
GET  /api/debts/:id           PUT  /api/debts/:id           DELETE /api/debts/:id

GET  /api/salaries            POST /api/salaries
GET  /api/salaries/:id        DELETE /api/salaries/:id

GET  /api/stats
GET  /health
```

### Rodar o Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # venv\Scripts\activate no Windows
pip install -r requirements.txt
python app.py
```

Com Docker:

```bash
cd backend && docker-compose up
```

## 📱 PWA

| Recurso | Status |
|---|---|
| Instalável (Add to Home Screen) | ✅ |
| Offline-first (cache-first SW) | ✅ |
| Notificações push background | ✅ FCM Service Worker |
| Ícones maskable | ✅ 48px → 512px |
| Theme color | ✅ `#3D6A8E` |

## 🗺️ Roadmap

### Concluído ✅
- [x] Autenticação customizada com roles e família
- [x] Dashboard com gráficos (Chart.js)
- [x] CRUD de transações, dívidas e salários
- [x] Lista de compras e tarefas domésticas
- [x] Chat em tempo real com FCM
- [x] PWA com modo offline
- [x] Backend Flask + Docker
- [x] **APK Android via Capacitor** (web e app no mesmo Firebase)
- [x] Notificações push nativas Android
- [x] **Reestruturação modular** (apps / packages / infra)

### Em Desenvolvimento
- [ ] Relatórios PDF exportáveis
- [ ] Metas e orçamentos mensais
- [ ] Alertas personalizados de gastos por categoria

### Planejado
- [ ] Integração Open Banking
- [ ] Categorização automática com ML
- [ ] Reconhecimento de recibos via OCR
- [ ] Dashboard com insights de IA
- [ ] Exportação Excel / CSV
- [ ] Multi-idioma (i18n)

## 📖 Documentação Adicional

- [Guia de Instalação](docs/INSTALACAO.md)
- [Roadmap Completo](docs/ROADMAP.md)
- [Backend README](backend/README.md)

## 📄 Licença

MIT — veja [LICENSE](LICENSE) para detalhes.

## 👤 Autor

Desenvolvido por **Luan Gs**
