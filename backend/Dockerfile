FROM python:3.11-slim-bookworm

# Set the working directory in the container
WORKDIR /app

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libleptonica-dev \
    libtesseract-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/* # Clean up apt cache to keep image size down

COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code
COPY . .

ENV PORT 8000
EXPOSE ${PORT}

CMD ["python", "app.py"]
