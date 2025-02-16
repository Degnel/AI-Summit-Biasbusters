import socketio
import eventlet
import numpy as np
from scipy.signal import resample
import json
import threading
from RealtimeSTT import AudioToTextRecorder

sio = socketio.Server(cors_allowed_origins="*")
app = socketio.WSGIApp(sio)

recorder_ready = threading.Event()
recorder = None
is_running = True

def text_detected(text):
    sio.emit("transcription", {"type": "realtime", "text": text})
    print(f"\r{text}", flush=True, end='')

recorder_config = {
    "spinner": False,
    "use_microphone": False,
    "model": "large-v2",
    "language": "en",
    "silero_sensitivity": 0.4,
    "webrtc_sensitivity": 2,
    "post_speech_silence_duration": 0.7,
    "enable_realtime_transcription": True,
    "realtime_model_type": "tiny.en",
    "on_realtime_transcription_stabilized": text_detected,
}

def run_recorder():
    global recorder, is_running
    recorder = AudioToTextRecorder(**recorder_config)
    recorder_ready.set()
    
    while is_running:
        try:
            full_sentence = recorder.text()
            if full_sentence:
                sio.emit("transcription", {"type": "fullSentence", "text": full_sentence})
                print(f"\rSentence: {full_sentence}")
        except Exception as e:
            print(f"Error in recorder thread: {e}")

def decode_and_resample(audio_data, original_sample_rate, target_sample_rate=16000):
    try:
        audio_np = np.frombuffer(audio_data, dtype=np.int16)
        num_target_samples = int(len(audio_np) * target_sample_rate / original_sample_rate)
        resampled_audio = resample(audio_np, num_target_samples)
        return resampled_audio.astype(np.int16).tobytes()
    except Exception as e:
        print(f"Error in resampling: {e}")
        return audio_data

@sio.on("audioChunk")
def handle_audio_chunk(sid, data):
    try:
        metadata = data.get("metadata", {})
        sample_rate = metadata.get("sampleRate", 44100)
        chunk = data.get("data")
        
        if chunk:
            audio_bytes = bytes(chunk, "latin1")  # Si l'encodage est en base64, il faudra le décoder avant
            resampled_chunk = decode_and_resample(audio_bytes, sample_rate)
            recorder.feed_audio(resampled_chunk)
    except Exception as e:
        print(f"Error processing audio chunk: {e}")

if __name__ == "__main__":
    threading.Thread(target=run_recorder, daemon=True).start()
    recorder_ready.wait()
    eventlet.wsgi.server(eventlet.listen(("0.0.0.0", 5000)), app)
