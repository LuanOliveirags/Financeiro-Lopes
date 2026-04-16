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
COPY .env.example .env

# Criar diretório para banco de dados
RUN mkdir -p /app/data

# Expor porta
EXPOSE 5000

# Variáveis de ambiente
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/health')"

# Iniciar aplicação
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "app:app"]
