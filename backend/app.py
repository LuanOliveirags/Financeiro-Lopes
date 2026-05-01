"""
app.py - Aplicação Flask Principal
WolfSource Backend
"""

import os
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, messaging as fcm_messaging, auth as fb_auth, firestore as fb_firestore

# Carregar variáveis de ambiente
load_dotenv()

# Inicializar Flask
app = Flask(__name__)

# Configurações
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///wolfsource.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-in-production')

# Inicializar banco de dados
db = SQLAlchemy(app)

# Configurar CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ===== FIREBASE ADMIN (FCM V1) =====
_firebase_app = None

def _get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    sa_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
    if not sa_json:
        return None
    try:
        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
        _firebase_app = firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f'[FCM] Falha ao inicializar Firebase Admin: {e}')
    return _firebase_app

# ===== MODELOS =====
class Family(db.Model):
    __tablename__ = 'families'
    
    id = db.Column(db.String(100), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'createdAt': self.created_at.isoformat()
        }


class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.String(100), primary_key=True)
    type = db.Column(db.String(50), nullable=False)  # entrada ou saida
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    responsible = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255))
    date = db.Column(db.Date, nullable=False)
    family_id = db.Column(db.String(100), db.ForeignKey('families.id'), nullable=True)
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
            'familyId': self.family_id,
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
    family_id = db.Column(db.String(100), db.ForeignKey('families.id'), nullable=True)
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
            'familyId': self.family_id,
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
    family_id = db.Column(db.String(100), db.ForeignKey('families.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'person': self.person,
            'amount': self.amount,
            'date': self.date.isoformat(),
            'description': self.description,
            'familyId': self.family_id,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat()
        }


# ===== ROTAS FAMÍLIAS =====
@app.route('/api/families', methods=['GET'])
def get_families():
    """Listar todas as famílias"""
    families = Family.query.all()
    return jsonify([f.to_dict() for f in families])


@app.route('/api/families', methods=['POST'])
def create_family_route():
    """Criar nova família"""
    data = request.get_json()
    family = Family(
        id=data.get('id'),
        name=data.get('name')
    )
    db.session.add(family)
    db.session.commit()
    return jsonify(family.to_dict()), 201


@app.route('/api/families/<family_id>', methods=['DELETE'])
def delete_family_route(family_id):
    """Deletar família (apenas se sem membros)"""
    family = Family.query.get(family_id)
    if not family:
        return jsonify({'error': 'Família não encontrada'}), 404
    db.session.delete(family)
    db.session.commit()
    return jsonify({'message': 'Família deletada com sucesso'})


# ===== AUTH: CUSTOM TOKEN =====
@app.route('/api/auth/token', methods=['POST'])
def get_custom_token():
    """Valida credenciais SHA-256 no Firestore e retorna Firebase custom token."""
    data = request.get_json(silent=True) or {}
    user_id   = data.get('userId')
    family_id = data.get('familyId')

    if not user_id or not family_id:
        return jsonify({'error': 'userId e familyId são obrigatórios'}), 400

    firebase_app = _get_firebase_app()
    if not firebase_app:
        return jsonify({'error': 'Firebase Admin não inicializado'}), 503

    try:
        fs_client = fb_firestore.client(app=firebase_app)
        user_doc = fs_client.collection('users').document(user_id).get()
        if not user_doc.exists:
            return jsonify({'error': 'Usuário não encontrado'}), 404

        user_data = user_doc.to_dict()
        if user_data.get('familyId') != family_id:
            return jsonify({'error': 'familyId não corresponde ao usuário'}), 403

        # Garante que o usuário existe no Firebase Auth
        try:
            fb_auth.get_user(user_id, app=firebase_app)
        except fb_auth.UserNotFoundError:
            fb_auth.create_user(uid=user_id, app=firebase_app)

        # Claims persistentes (sobrevivem refresh de token)
        fb_auth.set_custom_user_claims(user_id, {'familyId': family_id}, app=firebase_app)

        custom_token = fb_auth.create_custom_token(user_id, app=firebase_app)
        # create_custom_token retorna bytes no SDK v5+ — decodificar para string
        if isinstance(custom_token, bytes):
            custom_token = custom_token.decode('utf-8')

        return jsonify({'token': custom_token}), 200

    except Exception as e:
        print(f'[AUTH TOKEN] Erro: {e}')
        return jsonify({'error': 'Erro interno ao gerar token'}), 500


# ===== ROTAS UTILITÁRIAS =====
@app.route('/')
def index():
    return jsonify({
        'message': 'WolfSource API',
        'version': '1.0.0',
        'status': 'ok'
    })


@app.route('/health')
def health():
    return jsonify({'status': 'healthy'}), 200


# ===== ROTAS TRANSAÇÕES =====
@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Listar todas as transações (filtradas por família)"""
    family_id = request.args.get('familyId')
    query = Transaction.query
    if family_id:
        query = query.filter_by(family_id=family_id)
    transactions = query.all()
    return jsonify([t.to_dict() for t in transactions])


@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    """Criar nova transação"""
    data = request.get_json()
    
    transaction = Transaction(
        id=data.get('id'),
        type=data.get('type'),
        amount=data.get('amount'),
        category=data.get('category'),
        responsible=data.get('responsible'),
        description=data.get('description'),
        date=datetime.fromisoformat(data.get('date')).date(),
        family_id=data.get('familyId')
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify(transaction.to_dict()), 201


@app.route('/api/transactions/<transaction_id>', methods=['PUT'])
def update_transaction(transaction_id):
    """Atualizar transação"""
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
    """Listar todas as dívidas (filtradas por família)"""
    family_id = request.args.get('familyId')
    query = Debt.query
    if family_id:
        query = query.filter_by(family_id=family_id)
    debts = query.all()
    return jsonify([d.to_dict() for d in debts])


@app.route('/api/debts', methods=['POST'])
def create_debt():
    """Criar nova dívida"""
    data = request.get_json()
    
    debt = Debt(
        id=data.get('id'),
        creditor=data.get('creditor'),
        amount=data.get('amount'),
        due_date=datetime.fromisoformat(data.get('dueDate')).date(),
        responsible=data.get('responsible'),
        description=data.get('description'),
        status=data.get('status', 'active'),
        family_id=data.get('familyId')
    )
    
    db.session.add(debt)
    db.session.commit()
    
    return jsonify(debt.to_dict()), 201


@app.route('/api/debts/<debt_id>', methods=['PUT'])
def update_debt(debt_id):
    """Atualizar dívida"""
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
    """Listar todos os salários (filtrados por família)"""
    family_id = request.args.get('familyId')
    query = Salary.query
    if family_id:
        query = query.filter_by(family_id=family_id)
    salaries = query.all()
    return jsonify([s.to_dict() for s in salaries])


@app.route('/api/salaries', methods=['POST'])
def create_salary():
    """Registrar novo salário"""
    data = request.get_json()
    
    salary = Salary(
        id=data.get('id'),
        person=data.get('person'),
        amount=data.get('amount'),
        date=datetime.fromisoformat(data.get('date')).date(),
        description=data.get('description'),
        family_id=data.get('familyId')
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
    """Obter estatísticas gerais (filtradas por família)"""
    family_id = request.args.get('familyId')
    
    trans_query = Transaction.query
    debt_query = Debt.query
    salary_query = Salary.query
    
    if family_id:
        trans_query = trans_query.filter_by(family_id=family_id)
        debt_query = debt_query.filter_by(family_id=family_id)
        salary_query = salary_query.filter_by(family_id=family_id)
    
    total_transactions = trans_query.count()
    total_debts = debt_query.count()
    total_salaries = salary_query.count()
    
    total_expenses = db.session.query(db.func.sum(Transaction.amount)) \
        .filter(Transaction.type == 'saida')
    total_income = db.session.query(db.func.sum(Transaction.amount)) \
        .filter(Transaction.type == 'entrada')
    total_debt_amount = db.session.query(db.func.sum(Debt.amount))
    
    if family_id:
        total_expenses = total_expenses.filter(Transaction.family_id == family_id)
        total_income = total_income.filter(Transaction.family_id == family_id)
        total_debt_amount = total_debt_amount.filter(Debt.family_id == family_id)
    
    total_expenses = total_expenses.scalar() or 0
    total_income = total_income.scalar() or 0
    total_debt_amount = total_debt_amount.scalar() or 0
    
    return jsonify({
        'totalTransactions': total_transactions,
        'totalDebts': total_debts,
        'totalSalaries': total_salaries,
        'totalExpenses': total_expenses,
        'totalIncome': total_income,
        'totalDebtAmount': total_debt_amount,
        'balance': total_income - total_expenses
    })


# ===== ROTA FCM V1 =====
@app.route('/api/fcm/send', methods=['POST'])
def send_fcm_push():
    """Envia push notification via FCM V1 API usando firebase-admin"""
    if not _get_firebase_app():
        return jsonify({'error': 'Firebase Admin não configurado (FIREBASE_SERVICE_ACCOUNT_JSON ausente)'}), 503

    data = request.get_json() or {}
    token = data.get('token')
    title = data.get('title', '')
    body  = data.get('body', '')
    extra = {str(k): str(v) for k, v in (data.get('data') or {}).items()}

    if not token:
        return jsonify({'error': 'token é obrigatório'}), 400

    try:
        message = fcm_messaging.Message(
            token=token,
            notification=fcm_messaging.Notification(title=title, body=body),
            data=extra,
            android=fcm_messaging.AndroidConfig(
                priority='high',
                notification=fcm_messaging.AndroidNotification(
                    channel_id='chat_messages',
                    priority='high',
                    default_sound=True,
                    default_vibrate_timings=True,
                    icon='ic_launcher',
                    tag='chat-incoming',
                ),
            ),
        )
        result = fcm_messaging.send(message)
        return jsonify({'success': True, 'messageId': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== TRATAMENTO DE ERROS =====
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Recurso não encontrado'}), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Erro interno do servidor'}), 500


# ===== INICIALIZAÇÃO =====
with app.app_context():
    db.create_all()


if __name__ == '__main__':
    
    # Development
    app.run(
        debug=os.getenv('FLASK_ENV') == 'development',
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000))
    )
