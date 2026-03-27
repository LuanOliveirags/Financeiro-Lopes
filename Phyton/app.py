"""
app.py - Aplicação Flask Principal
Financeiro Lopes Backend
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from datetime import datetime

# Carregar variáveis de ambiente
load_dotenv()

# Inicializar Flask
app = Flask(__name__)

# Configurações
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///financeiro.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-in-production')

# Inicializar banco de dados
db = SQLAlchemy(app)

# Configurar CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ===== MODELOS =====
class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.String(100), primary_key=True)
    type = db.Column(db.String(50), nullable=False)  # entrada ou saida
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    responsible = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255))
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'amount': self.amount,
            'category': self.category,
            'responsible': self.responsible,
            'description': self.description,
            'date': self.date.isoformat(),
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat()
        }


class Debt(db.Model):
    __tablename__ = 'debts'
    
    id = db.Column(db.String(100), primary_key=True)
    creditor = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    responsible = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255))
    status = db.Column(db.String(50), default='active')  # active, paid, overdue
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'creditor': self.creditor,
            'amount': self.amount,
            'dueDate': self.due_date.isoformat(),
            'responsible': self.responsible,
            'description': self.description,
            'status': self.status,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat()
        }


class Salary(db.Model):
    __tablename__ = 'salaries'
    
    id = db.Column(db.String(100), primary_key=True)
    person = db.Column(db.String(50), nullable=False)  # Luan ou Bianca
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'person': self.person,
            'amount': self.amount,
            'date': self.date.isoformat(),
            'description': self.description,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat()
        }


# ===== ROTAS UTILITÁRIAS =====
@app.route('/')
def index():
    return jsonify({
        'message': 'Financeiro Lopes API',
        'version': '1.0.0',
        'status': 'ok'
    })


@app.route('/health')
def health():
    return jsonify({'status': 'healthy'}), 200


# ===== ROTAS TRANSAÇÕES =====
@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Listar todas as transações"""
    transactions = Transaction.query.all()
    return jsonify([t.to_dict() for t in transactions])


@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    """Criar nova transação"""
    from flask import request
    
    data = request.get_json()
    
    transaction = Transaction(
        id=data.get('id'),
        type=data.get('type'),
        amount=data.get('amount'),
        category=data.get('category'),
        responsible=data.get('responsible'),
        description=data.get('description'),
        date=datetime.fromisoformat(data.get('date')).date()
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify(transaction.to_dict()), 201


@app.route('/api/transactions/<transaction_id>', methods=['PUT'])
def update_transaction(transaction_id):
    """Atualizar transação"""
    from flask import request
    
    transaction = Transaction.query.get(transaction_id)
    if not transaction:
        return jsonify({'error': 'Transação não encontrada'}), 404
    
    data = request.get_json()
    
    transaction.type = data.get('type', transaction.type)
    transaction.amount = data.get('amount', transaction.amount)
    transaction.category = data.get('category', transaction.category)
    transaction.responsible = data.get('responsible', transaction.responsible)
    transaction.description = data.get('description', transaction.description)
    
    if 'date' in data:
        transaction.date = datetime.fromisoformat(data.get('date')).date()
    
    db.session.commit()
    
    return jsonify(transaction.to_dict())


@app.route('/api/transactions/<transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """Deletar transação"""
    transaction = Transaction.query.get(transaction_id)
    if not transaction:
        return jsonify({'error': 'Transação não encontrada'}), 404
    
    db.session.delete(transaction)
    db.session.commit()
    
    return jsonify({'message': 'Transação deletada com sucesso'})


# ===== ROTAS DÍVIDAS =====
@app.route('/api/debts', methods=['GET'])
def get_debts():
    """Listar todas as dívidas"""
    debts = Debt.query.all()
    return jsonify([d.to_dict() for d in debts])


@app.route('/api/debts', methods=['POST'])
def create_debt():
    """Criar nova dívida"""
    from flask import request
    
    data = request.get_json()
    
    debt = Debt(
        id=data.get('id'),
        creditor=data.get('creditor'),
        amount=data.get('amount'),
        due_date=datetime.fromisoformat(data.get('dueDate')).date(),
        responsible=data.get('responsible'),
        description=data.get('description'),
        status=data.get('status', 'active')
    )
    
    db.session.add(debt)
    db.session.commit()
    
    return jsonify(debt.to_dict()), 201


@app.route('/api/debts/<debt_id>', methods=['PUT'])
def update_debt(debt_id):
    """Atualizar dívida"""
    from flask import request
    
    debt = Debt.query.get(debt_id)
    if not debt:
        return jsonify({'error': 'Dívida não encontrada'}), 404
    
    data = request.get_json()
    
    debt.creditor = data.get('creditor', debt.creditor)
    debt.amount = data.get('amount', debt.amount)
    debt.responsible = data.get('responsible', debt.responsible)
    debt.description = data.get('description', debt.description)
    debt.status = data.get('status', debt.status)
    
    if 'dueDate' in data:
        debt.due_date = datetime.fromisoformat(data.get('dueDate')).date()
    
    db.session.commit()
    
    return jsonify(debt.to_dict())


@app.route('/api/debts/<debt_id>', methods=['DELETE'])
def delete_debt(debt_id):
    """Deletar dívida"""
    debt = Debt.query.get(debt_id)
    if not debt:
        return jsonify({'error': 'Dívida não encontrada'}), 404
    
    db.session.delete(debt)
    db.session.commit()
    
    return jsonify({'message': 'Dívida deletada com sucesso'})


# ===== ROTAS SALÁRIOS =====
@app.route('/api/salaries', methods=['GET'])
def get_salaries():
    """Listar todos os salários"""
    salaries = Salary.query.all()
    return jsonify([s.to_dict() for s in salaries])


@app.route('/api/salaries', methods=['POST'])
def create_salary():
    """Registrar novo salário"""
    from flask import request
    
    data = request.get_json()
    
    salary = Salary(
        id=data.get('id'),
        person=data.get('person'),
        amount=data.get('amount'),
        date=datetime.fromisoformat(data.get('date')).date(),
        description=data.get('description')
    )
    
    db.session.add(salary)
    db.session.commit()
    
    return jsonify(salary.to_dict()), 201


@app.route('/api/salaries/<salary_id>', methods=['DELETE'])
def delete_salary(salary_id):
    """Deletar salário"""
    salary = Salary.query.get(salary_id)
    if not salary:
        return jsonify({'error': 'Salário não encontrado'}), 404
    
    db.session.delete(salary)
    db.session.commit()
    
    return jsonify({'message': 'Salário deletado com sucesso'})


# ===== ROTAS ESTATÍSTICAS =====
@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Obter estatísticas gerais"""
    total_transactions = Transaction.query.count()
    total_debts = Debt.query.count()
    total_salaries = Salary.query.count()
    
    total_expenses = db.session.query(db.func.sum(Transaction.amount)) \
        .filter(Transaction.type == 'saida').scalar() or 0
    
    total_income = db.session.query(db.func.sum(Transaction.amount)) \
        .filter(Transaction.type == 'entrada').scalar() or 0
    
    total_debt_amount = db.session.query(db.func.sum(Debt.amount)).scalar() or 0
    
    return jsonify({
        'totalTransactions': total_transactions,
        'totalDebts': total_debts,
        'totalSalaries': total_salaries,
        'totalExpenses': total_expenses,
        'totalIncome': total_income,
        'totalDebtAmount': total_debt_amount,
        'balance': total_income - total_expenses
    })


# ===== TRATAMENTO DE ERROS =====
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Recurso não encontrado'}), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Erro interno do servidor'}), 500


# ===== INICIALIZAÇÃO =====
@app.before_first_request
def create_tables():
    """Criar tabelas do banco de dados"""
    db.create_all()


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    # Development
    app.run(
        debug=os.getenv('FLASK_ENV') == 'development',
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000))
    )
