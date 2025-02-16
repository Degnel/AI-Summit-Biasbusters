import React, { useEffect, useRef, useState } from 'react';

const SERVER_URL = 'ws://62.210.150.81:5000';

const SpeechRecognition: React.FC = () => {
  // États pour suivre la disponibilité du serveur et du micro,
  // les phrases complètes, le texte en temps réel et l'état d'enregistrement.
  const [serverAvailable, setServerAvailable] = useState<boolean>(false);
  const [micAvailable, setMicAvailable] = useState<boolean>(false);
  const [fullSentences, setFullSentences] = useState<string[]>([]);
  const [realtimeText, setRealtimeText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Références pour le WebSocket et les éléments audio
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Fonction d'information à l'utilisateur selon l'état du système
  const startMsg = () => {
    if (!micAvailable) {
      setRealtimeText('🎤 Please allow microphone access 🎤');
    } else if (!serverAvailable) {
      setRealtimeText('🖥️ Please start the server 🖥️');
    } else {
      setRealtimeText('👄 Start speaking 👄');
    }
  };

  // Connexion au serveur via WebSocket
  const connectToServer = () => {
    const ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
      setServerAvailable(true);
      startMsg();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'realtime') {
          setRealtimeText(data.text);
        } else if (data.type === 'fullSentence') {
          setFullSentences((prev) => [...prev, data.text]);
          setRealtimeText('');
        }
      } catch (error) {
        console.error('Erreur lors du parsing du message :', error);
      }
    };

    ws.onclose = () => {
      setServerAvailable(false);
    };

    wsRef.current = ws;
  };

  // Essai de connexion au démarrage et reconnexion toutes les 5 secondes si nécessaire
  useEffect(() => {
    if (!wsRef.current) {
      connectToServer();
    }
    const interval = setInterval(() => {
      if (!serverAvailable) {
        connectToServer();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [serverAvailable]);

  // Démarrage de la capture audio via Web Audio API
  const startRecording = async () => {
    try {
      // Demande d'accès au micro
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMicAvailable(true);
      startMsg();

      // Création de l'AudioContext et d'une source audio à partir du stream
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      // Création d'un ScriptProcessor pour traiter les données audio en temps réel
      const processor = audioContext.createScriptProcessor(256, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const outputData = new Int16Array(inputData.length);

        // Conversion en PCM 16 bits
        for (let i = 0; i < inputData.length; i++) {
          outputData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        // Si le WebSocket est ouvert, envoi d'un blob combinant les métadonnées et les données audio
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const metadata = JSON.stringify({ sampleRate: audioContext.sampleRate });
          const metadataBytes = new TextEncoder().encode(metadata);
          const metadataLength = new ArrayBuffer(4);
          const metadataLengthView = new DataView(metadataLength);
          metadataLengthView.setInt32(0, metadataBytes.byteLength, true); // little-endian

          // Combinaison de la longueur des métadonnées, des métadonnées et des données audio
          const blob = new Blob([metadataLength, metadataBytes, outputData.buffer]);
          wsRef.current.send(blob);
        }
      };

      setIsRecording(true);
    } catch (e) {
      console.error('Erreur d’accès au microphone :', e);
      setMicAvailable(false);
      startMsg();
    }
  };

  // Arrêt de la capture audio et libération des ressources
  const stopRecording = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {/* Zone d'affichage du texte en temps réel et des phrases complètes */}
        <div style={styles.textDisplay}>
          {fullSentences.map((sentence, index) => (
            <span
              key={index}
              style={{
                marginRight: '0.5rem',
                color: index % 2 === 0 ? 'yellow' : 'cyan',
              }}
            >
              {sentence}
            </span>
          ))}
          <span>{realtimeText}</span>
        </div>

        {/* Bouton micro avec animation de scale en fonction de l'état d'enregistrement */}
        <button
          style={{
            ...styles.microphoneBox,
            backgroundColor: isRecording ? 'darkred' : 'red',
            transform: isRecording ? 'scale(1.5)' : 'scale(1)',
            transition: 'transform 300ms',
          }}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? 'Stop' : 'Mic'}
        </button>
      </div>
    </div>
  );
};

// Quelques styles en objet (pour une version web)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#fff',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  microphoneBox: {
    width: 150,
    height: 150,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '1.5rem',
    border: 'none',
    cursor: 'pointer',
  },
  textDisplay: {
    padding: '1rem',
    marginBottom: '1rem',
  },
};

export default SpeechRecognition;
