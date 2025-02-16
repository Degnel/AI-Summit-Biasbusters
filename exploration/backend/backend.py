from flask import Flask, request, jsonify
import os

app = Flask(__name__)

print('ok')
# Dossier pour stocker les fichiers téléchargés
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/upload', methods=['POST'])
def upload_file():
    print('dans la route')
    # Vérifie si un fichier est présent dans la requête
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    # Vérifie si le fichier a un nom
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Vérifie si le fichier est au format WAV
    if file and file.filename.endswith('.wav'):
        # Enregistre le fichier dans le dossier de téléchargement
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)
        return jsonify({'message': 'File uploaded successfully', 'file_path': file_path}), 200
    else:
        return jsonify({'error': 'Invalid file format. Only WAV files are allowed.'}), 400



app.run(host='0.0.0.0', port=5000, debug=True)