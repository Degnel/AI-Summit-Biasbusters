from flask import Flask
from flask_socketio import SocketIO, emit
import base64
import threading
import json
import numpy as np
from scipy.signal import resample
from RealtimeSTT import AudioToTextRecorder
import traceback

# Initialisation de l'application Flask et SocketIO
app = Flask(__name__)
socketio = SocketIO(app)

# Configuration du transcripteur
def text_detected(text):
    print("text_detected")
    socketio.emit('transcription', {'type': 'realtime', 'text': text})

def full_sentence_detected(sentence):
    socketio.emit('transcription', {'type': 'fullSentence', 'text': sentence})

recorder_config = {
    'spinner': False,
    'use_microphone': False,
    'model': 'large-v2',
    'language': 'en',
    'silero_sensitivity': 0.4,
    'webrtc_sensitivity': 2,
    'post_speech_silence_duration': 0.7,
    'min_length_of_recording': 0,
    'min_gap_between_recordings': 0,
    'enable_realtime_transcription': True,
    'realtime_processing_pause': 0,
    'realtime_model_type': 'tiny.en',
    'on_realtime_transcription_stabilized': text_detected,
}

recorder = AudioToTextRecorder(**recorder_config)

def run_recorder():
    while True:
        full_sentence = recorder.text()
        if full_sentence:
            full_sentence_detected(full_sentence)

# Lancer l'enregistreur dans un thread séparé
recorder_thread = threading.Thread(target=run_recorder, daemon=True)
recorder_thread.start()

# Traitement et rééchantillonnage de l'audio
def decode_and_resample(audio_data, original_sample_rate, target_sample_rate=44100):
    buffer_size = len(audio_data)
    element_size = np.dtype(np.int16).itemsize
    print(buffer_size)
    
    # Si la taille du buffer n'est pas un multiple de la taille de l'élément, ajustez-la
    if buffer_size % element_size != 0:
        # Ajoutez des zéros pour compléter la taille du buffer
        padding_size = element_size - (buffer_size % element_size)
        audio_data += b'\0' * padding_size

    try:
        #print("audio_data", type(audio_data), audio_data)
        audio_np = np.frombuffer(audio_data, dtype=np.int16)
        #print("audio_np", type(audio_np), audio_np)
        num_target_samples = int(len(audio_np) * target_sample_rate / original_sample_rate)
        #print("num_target_samples", type(num_target_samples), num_target_samples)
        resampled_audio = resample(audio_np, num_target_samples)
        #print("resampled_audio", type(resampled_audio), resampled_audio)
        return resampled_audio.astype(np.int16).tobytes()
    except Exception as e:
        print(f"Error in resampling: {e}")
        traceback.print_exc()
        return audio_data

# Gestion des connexions WebSocket
@socketio.on('connect')
def handle_connect():
    print("Client connecté")

@socketio.on('audioChunk')
def handle_audio_chunk(data):
    audio_data = base64.b64decode(data['data'])
    resampled_chunk = decode_and_resample(audio_data, 16000)
    #print("resampled_chunk", type(resampled_chunk), resampled_chunk)
    try:
        recorder.feed_audio(resampled_chunk)
    except Exception as e:
        print(f"Erreur lors du traitement du chunk audio: {e}")

@socketio.on('disconnect')
def handle_disconnect():
    print("Client déconnecté")

# Lancer le serveur Flask
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
