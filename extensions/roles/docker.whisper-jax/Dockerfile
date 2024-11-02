# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Clone the whisper-jax repository
RUN git clone https://github.com/sanchit-gandhi/whisper-jax.git .

RUN cd whisper-jax
RUN pip install -e .["endpoint"]

# Install Python dependencies
#RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependencies for audio processing
RUN pip install --no-cache-dir sounddevice numpy

# Copy your server script into the container
COPY server.py .

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["python", "server.py"]