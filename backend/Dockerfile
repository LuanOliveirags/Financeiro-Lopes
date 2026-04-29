# Dockerfile - WolfSource Backend

# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Instalar dependências
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Instalar apenas as dependências necessárias
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependências do builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copiar aplicação
COPY app.py .
COPY config.py .

# Criar diretório para banco de dados
RUN mkdir -p /app/data

# Variáveis de ambiente
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Iniciar aplicação — usa $PORT injetado pelo Railway (ou 5000 como fallback)
CMD gunicorn --bind 0.0.0.0:$PORT --workers 4 --timeout 120 app:app
