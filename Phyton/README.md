# WolfSource - Backend Python

Este é o backend da aplicação WolfSource, desenvolvido com Python/Flask.

## 🚀 Configuração

### Pré-requisitos
- Python 3.8+
- pip (gerenciador de pacotes Python)
- Virtual Environment (recomendado)

### Instalação

1. **Crie um ambiente virtual**:
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

2. **Instale as dependências**:
```bash
pip install -r requirements.txt
```

3. **Configure as variáveis de ambiente**:
```bash
# Crie um arquivo .env
echo "FLASK_ENV=development" > .env
echo "SECRET_KEY=sua-chave-secreta" >> .env
echo "DATABASE_URL=sqlite:///financeiro.db" >> .env
```

4. **Execute o servidor**:
```bash
python app.py
```

O servidor estará disponível em `http://localhost:5000`

## 📁 Estrutura

```
Phyton/
├── app.py              # Aplicação Flask principal
├── requirements.txt    # Dependências do projeto
├── config.py          # Configurações
├── models.py          # Modelos de dados
├── routes.py          # Rotas da API
├── database.py        # Inicialização do banco
└── .env              # Variáveis de ambiente
```

## 🔧 Dependências Principais

- **Flask**: Framework web
- **Flask-SQLAlchemy**: ORM para banco de dados
- **Flask-CORS**: Suporte a CORS
- **python-dotenv**: Gerenciamento de .env
- **Firebase Admin SDK**: Integração Firebase
- **Gunicorn**: Servidor WSGI

## 📚 API Endpoints

### Transações
- `GET /api/transactions` - Listar todas as transações
- `POST /api/transactions` - Criar nova transação
- `PUT /api/transactions/<id>` - Atualizar transação
- `DELETE /api/transactions/<id>` - Deletar transação

### Dívidas
- `GET /api/debts` - Listar todas as dívidas
- `POST /api/debts` - Criar nova dívida
- `PUT /api/debts/<id>` - Atualizar dívida
- `DELETE /api/debts/<id>` - Deletar dívida

### Salários
- `GET /api/salaries` - Listar todos os salários
- `POST /api/salaries` - Registrar novo salário
- `DELETE /api/salaries/<id>` - Deletar salário

## 📝 Exemplos de Uso

### Criar uma Transação
```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "saida",
    "amount": 50.00,
    "category": "alimentacao",
    "responsible": "Luan",
    "description": "Compras no supermercado",
    "date": "2026-03-26"
  }'
```

### Listar Transações
```bash
curl http://localhost:5000/api/transactions
```

### Criar uma Dívida
```bash
curl -X POST http://localhost:5000/api/debts \
  -H "Content-Type: application/json" \
  -d '{
    "creditor": "Banco XYZ",
    "amount": 1000.00,
    "dueDate": "2026-04-30",
    "responsible": "Ambos",
    "description": "Empréstimo pessoal"
  }'
```

## 🔒 Autenticação

(A ser implementado com JWT ou Firebase Auth)

## 🗄️ Banco de Dados

O backend usa SQLAlchemy com SQLite por padrão.

Para usar PostgreSQL em produção:
```
DATABASE_URL=postgresql://user:password@localhost/financeiro
```

## 🚀 Deploy

### Heroku
```bash
git push heroku main
```

### Docker
```bash
docker build -t financeiro-api .
docker run -p 5000:5000 financeiro-api
```

## 📖 Documentação

A documentação completa da API está disponível em `/api/docs`

Acesse: `http://localhost:5000/api/docs`

## ❓ FAQ

**P**: Como conectar ao Firebase?
**R**: Configure a variável `FIREBASE_CREDENTIALS` com o caminho do arquivo JSON de credenciais do Firebase.

**P**: Qual banco de dados usar em produção?
**R**: Recomenda-se PostgreSQL para melhor performance e confiabilidade.

**P**: Como fazer deploy?
**R**: Use Heroku, AWS, Google Cloud, ou seu servidor preferido com Gunicorn e Nginx.

## 🐛 Troubleshooting

**Erro: "ModuleNotFoundError"**
- Verifique se as dependências foram instaladas: `pip install -r requirements.txt`

**Erro: "Port 5000 already in use"**
- Use outra porta: `python app.py --port 5001`

**Erro de CORS**
- Adicione a URL do frontend em `CORS_ALLOWED_ORIGINS` no `.env`

## 📝 License

MIT License

---

Desenvolvido com ❤️ para WolfSource
