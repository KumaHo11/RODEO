FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Create a non-root user
RUN adduser --disabled-password --gecos '' appuser

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./app /app/app

# Change ownership to non-root user
RUN chown -R appuser:appuser /app
USER appuser

# Cloud Run injects PORT env var (default 8080). Use shell form so $PORT is expanded at runtime.
EXPOSE 8080

# Start server — reads $PORT from Cloud Run environment
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
