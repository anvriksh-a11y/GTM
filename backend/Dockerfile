FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install production dependencies
COPY requirements.prod.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Cloud Run defaults to port 8080
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
