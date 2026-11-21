FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required for native packages and network tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies
COPY requirements.prod.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Ensure start script has executable permissions and Unix line endings
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

# Cloud Run defaults to port 8080
ENV PORT=8080
EXPOSE 8080

CMD ["./start.sh"]
