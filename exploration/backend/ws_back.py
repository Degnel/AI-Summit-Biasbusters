from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import base64

# Créer une application Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

# Quand un client se connecte
@socketio.on('connect')
def handle_connect():
    print("Un client est connecté")
    #emit('serverResponse', {
    #    'nom_fonction': 'welcome',
    #    'arguments': ['Bienvenue sur le serveur WebSocket !']
    #})

# Quand le client envoie un message audio de début d'enregistrement
@socketio.on('audioStart')
def handle_audio_start():
    print("Début de l'enregistrement")
    # Vous pouvez ajouter ici des actions spécifiques à l'enregistrement audio
    # Par exemple, démarrer l'enregistrement sur le serveur si nécessaire

# Quand le client envoie un chunk audio (segment d'enregistrement)
@socketio.on('audioChunk')
def handle_audio_chunk(data):
    print("Chunk audio reçu...")
    emit('serverResponse', {
            'nom_fonction': 'askForMoreInfo',
            'arguments': ['Peux-tu préciser ta question ?']
        })

    # Décoder le chunk Base64 et sauvegarder le fichier ou le traiter
    try:
        audio_data = base64.b64decode(data['data'])  # Décoder le Base64
        with open("audio_chunk.wav", "wb") as audio_file:
            audio_file.write(audio_data)
        print("Chunk audio sauvegardé.")
    except Exception as e:
        print(f"Erreur lors du traitement du chunk audio: {e}")

# Quand l'enregistrement est terminé
@socketio.on('audioEnd')
def handle_audio_end():
    print("Fin de l'enregistrement")
    handle_send_message("message")
    # Vous pouvez ajouter ici des actions spécifiques à la fin de l'enregistrement

# Quand le client envoie une question ou un message
@socketio.on('sendMessage')
def handle_send_message(message):
    print(f"Message reçu du client: {message}")
    
    if "question" in message.lower():
        # Répondre avec une question de clarification
        emit('serverResponse', {
            'nom_fonction': 'askForMoreInfo',
            'arguments': ['Peux-tu préciser ta question ?']
        })

    emit('serverResponse', {
            'nom_fonction': 'askForMoreInfo',
            'arguments': ['Peux-tu préciser ta question ?']
        })
    
    if False:
        # Répondre avec une réponse générique
        emit('serverResponse', {
            'nom_fonction': 'answer',
            'arguments': ['Voici la réponse à ta question.']
        })

# Lancer le serveur sur le port 5000
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
