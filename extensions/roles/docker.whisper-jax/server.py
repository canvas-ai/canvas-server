from flask import Flask, request, Response, stream_with_context
from whisper_jax import FlaxWhisperPipeline
import numpy as np
import queue
import threading

app = Flask(__name__)

# Initialize the Whisper-JAX pipeline
pipeline = FlaxWhisperPipeline("openai/whisper-small")

# Create a queue to hold audio chunks
audio_queue = queue.Queue()

def process_audio():
    while True:
        audio_chunks = []
        total_duration = 0
        desired_duration = 2  # Process 2 seconds of audio at a time

        while total_duration < desired_duration:
            try:
                chunk = audio_queue.get(timeout=1)
                audio_chunks.append(chunk)
                total_duration += len(chunk) / 16000  # Assuming 16kHz sample rate
            except queue.Empty:
                break

        if audio_chunks:
            audio_array = np.concatenate(audio_chunks)
            result = pipeline(audio_array)
            yield f"data: {result['text']}\n\n"

@app.route('/stream_transcribe', methods=['POST'])
def stream_transcribe():
    if request.headers['Content-Type'] == 'audio/raw':
        audio_chunk = request.data
        audio_queue.put(np.frombuffer(audio_chunk, dtype=np.float32))
        return "", 204
    else:
        return "Unsupported Media Type", 415

@app.route('/start_transcription')
def start_transcription():
    def generate():
        for text in process_audio():
            yield text

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == '__main__':
    threading.Thread(target=process_audio, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, threaded=True)
