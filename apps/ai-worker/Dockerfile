FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml ./
COPY worker ./worker
# Ajouter ".[nllb]" pour la traduction NLLB auto-hébergée
RUN pip install --no-cache-dir .
CMD ["python", "-m", "worker.main"]
