# WolfSource - Gerenciamento de Despesas

Este repositório contém uma aplicação web completa para gestão de despesas financeiras, desenvolvida com HTML, CSS, JavaScript (frontend) e Python/Flask (backend), com suporte a PWA e sincronização com Firebase.

## 📁 Estrutura do Projeto

```
.
├── index.html                 # Página principal
├── manifest.json             # Configuração PWA
├── service-worker.js         # Service Worker para offline
├── README.md                 # Este arquivo
├── css/                      # Estilos
│   ├── style.css            # Estilos globais
│   ├── app-style.css        # Estilos da aplicação
│   ├── sections.css         # Estilos das seções
│   ├── calendar-style.css   # Estilos de calendário
│   ├── animations.css       # Animações
│   └── base/
│       └── responsive.css   # Media queries/Responsividade
├── js/
│   └── script.js            # Lógica principal
├── img/                     # Ícones e imagens (adicionar)
└── Phyton/                  # Backend Python
    ├── app.py              # Aplicação Flask
    ├── config.py           # Configurações
    ├── requirements.txt    # Dependências
    ├── .env.example        # Template de variáveis
    ├── Dockerfile          # Container Docker
    ├── docker-compose.yml  # Orquestração de serviços
    └── README.md          # Documentação backend
```

## 🚀 Quick Start

### Frontend

1. **Abra no navegador**:
   - Simplesmente abra o arquivo `index.html` em um navegador moderno
   - Ou acesse `http://localhost:3000` se usando live server

2. **Credenciais Padrão**:
   - Usuário: `root`
   - Senha: `root`

3. **Instale como PWA**:
   - Chrome/Edge: Menu → Instalar app
   - Mobile: Compartilhar → Adicionar à tela inicial

### Backend

1. **Instale Python 3.8+**

2. **Navegue até a pasta Phyton**:
   ```bash
   cd Phyton
   ```

3. **Crie um ambiente virtual**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # macOS/Linux
   venv\Scripts\activate     # Windows
   ```

4. **Instale as dependências**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure o arquivo .env**:
   ```bash
   cp .env.example .env
   ```

6. **Execute o servidor**:
   ```bash
   python app.py
   ```
   - API disponível em `http://localhost:5000`

### Com Docker

```bash
cd Phyton
docker-compose up
```

- API: `http://localhost:5000`
- Banco: `http://localhost:5432`
- Adminer: `http://localhost:8080`

## 🔐 Credenciais Padrão

| Campo | Valor |
|-------|-------|
| Usuário | root |
| Senha | root |

⚠️ **Altere em produção!**

## 📊 Recursos

### Dashboard
- KPIs em tempo real (Despesas, Saldos, Gastos)
- Gráficos interativos (Chart.js)
- Transações recentes
- Filtro por mês

### Transações
- Registro de entradas e saídas
- Categorização (8 categorias)
- Atribuição de responsável
- Histórico completo

### Dívidas
- Registro de dívidas ativas
- Status automático (Ativa, Atrasada, Próxima do vencimento, Paga)
- Marcação rápida como paga
- Histórico de dívidas

### Salários
- Registro de salários (Luan e Bianca)
- Cálculo individual e combinado
- Histórico anual
- Visualização gráfica

### Configurações
- ✅ Exportar dados (JSON)
- ✅ Importar dados (JSON)
- 🔄 Sincronização com Firebase
- 🗑️ Limpar cache
- 📱 Instalar app PWA

## 🔌 API Endpoints

### Transações
```
GET    /api/transactions       # Listar todas
POST   /api/transactions       # Criar
PUT    /api/transactions/<id>  # Atualizar
DELETE /api/transactions/<id>  # Deletar
```

### Dívidas
```
GET    /api/debts             # Listar todas
POST   /api/debts             # Criar
PUT    /api/debts/<id>        # Atualizar
DELETE /api/debts/<id>        # Deletar
```

### Salários
```
GET    /api/salaries          # Listar todos
POST   /api/salaries          # Criar
DELETE /api/salaries/<id>     # Deletar
```

### Estatísticas
```
GET    /api/stats             # Estatísticas gerais
```

## 🔧 Configuração Firefox

### Ativar HTTPS local (para PWA)
1. Vá para `about:config`
2. Procure `security.ssl.enforce_legacy_renegotiation`
3. Mude para `true`

### Ou use localhost:
- Firefox permite PWA em `localhost` sem HTTPS

## 🌐 Configuração Firebase

1. **Criar Projeto**:
   - Firebase Console → Add Project

2. **Copiar Config**:
   - Project Settings → Apps → Web
   - Copie as credenciais

3. **Cole em `js/script.js`**:
   ```javascript
   const CONFIG = {
     firebase: {
       apiKey: "sua-api-key",
       authDomain: "seu-projeto.firebaseapp.com",
       projectId: "seu-projeto",
       // ...
     }
   };
   ```

## 📱 Responsividade

- **Mobile** (320px - 480px): Layout vertical otimizado
- **Tablet** (481px - 1024px): 2-3 colunas
- **Desktop** (1025px+): Layout completo 4 colunas

## 🎨 Customizações

### Cores
Edite em `css/style.css`:
```css
:root {
  --primary-color: #4CAF50;
  --secondary-color: #2196F3;
  /* ... */
}
```

### Categorias
Adicione em `index.html` na seção de Transações:
```html
<option value="nova-categoria">Nova Categoria</option>
```

### Temas
Edite em `css/style.css` na seção Dark Mode

## 🚀 Deploy

### Frontend (Netlify/Vercel)
```bash
# Commit e push para GitHub
# Conecte o repositório em Netlify/Vercel
# Deploy automático ao fazer push
```

### Backend (Heroku)
```bash
heroku login
heroku create seu-app
git push heroku main
```

### Docker (AWS/GCP/Azure)
```bash
docker build -t seu-app .
docker run -p 5000:5000 seu-app
```

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| PWA não funciona | Use HTTPS ou localhost (não funciona em 0.0.0.0) |
| Gráficos não aparecem | Verifique console para erros do Chart.js |
| Firebase não sincroniza | Verifique as credenciais e regras de segurança |
| Porta 5000 em uso | `python app.py --port 5001` |
| "ModuleNotFoundError" | Instale dependências: `pip install -r requirements.txt` |

## 📚 Documentação

- [Frontend README](./README.md)
- [Backend README](./Phyton/README.md)
- [Firebase Docs](https://firebase.google.com/docs)
- [Chart.js Docs](https://www.chartjs.org/docs/latest/)

## 🤝 Contribuindo

1. Faça um Fork
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

MIT License - Sinta-se livre para usar, modificar e distribuir

## 👥 Autores

Desenvolvido por **Luan e Bianca**

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no GitHub

---

**Desenvolvido com ❤️ para gestão financeira eficiente**

**Última atualização**: Março 2026
