"""
token_server.py — Servidor mínimo apenas para gerar Firebase custom tokens.
Não depende de SQLAlchemy — compatível com Python 3.14+.
"""
import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth as fb_auth, firestore as fb_firestore

load_dotenv()

# ── Inicializa Firebase Admin ──────────────────────────────────────────────
_sa_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
if not _sa_json:
    raise SystemExit('FIREBASE_SERVICE_ACCOUNT_JSON não definido no .env')

_cred = credentials.Certificate(json.loads(_sa_json))
_app  = firebase_admin.initialize_app(_cred)
_fs   = fb_firestore.client(app=_app)
print('[token_server] Firebase Admin inicializado OK')

# ── Handler HTTP ───────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f'[{self.address_string()}] {fmt % args}')

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path in ('/', '/health'):
            self._json(200, {'status': 'ok', 'service': 'WolfSource token server'})
        else:
            self._json(404, {'error': 'Not found'})

    def do_POST(self):
        if self.path != '/api/auth/token':
            self._json(404, {'error': 'Not found'})
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length)) if length else {}
            user_id   = body.get('userId')
            family_id = body.get('familyId')

            if not user_id or not family_id:
                self._json(400, {'error': 'userId e familyId são obrigatórios'}); return

            # Valida usuário no Firestore
            user_doc = _fs.collection('users').document(user_id).get()
            if not user_doc.exists:
                self._json(404, {'error': 'Usuário não encontrado'}); return
            user_data = user_doc.to_dict()
            if user_data.get('familyId') != family_id:
                self._json(403, {'error': 'familyId não corresponde'}); return

            # Garante usuário no Firebase Auth
            try:
                fb_auth.get_user(user_id, app=_app)
            except fb_auth.UserNotFoundError:
                fb_auth.create_user(uid=user_id, app=_app)

            # Define claims persistentes
            role = user_data.get('role', 'user')
            fb_auth.set_custom_user_claims(user_id, {'familyId': family_id, 'role': role}, app=_app)

            token = fb_auth.create_custom_token(user_id, app=_app)
            if isinstance(token, bytes):
                token = token.decode()

            self._json(200, {'token': token})
        except Exception as e:
            print(f'[ERROR] {e}')
            self._json(500, {'error': str(e)})


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'[token_server] Rodando em http://localhost:{port} ...')
    server.serve_forever()
