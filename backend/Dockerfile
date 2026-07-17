# Dockerfile — Production Python FastAPI Microservice
# Multi-stage/Optimized build for AWS ECS, Railway, and Render
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

WORKDIR /app

# Install system dependencies needed for PyMuPDF, pdfminer.six, and pdfplumber
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpoppler-cpp-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose microservice port
EXPOSE 8000

# Run FastAPI using uvicorn server with explicit IPv4 loopback handling
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
