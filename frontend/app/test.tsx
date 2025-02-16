import React, { useEffect, useRef, useState } from 'react';

const SpeechRecognition: React.FC = () => {
  // États pour suivre l'état du serveur, du micro, les phrases complètes et le texte en temps réel.
  const [serverAvailable, setServerAvailable] = useState<boolean>(false);
  const [micAvailable, setMicAvailable] = useState<boolean>(false);
  const [fullSentences, setFullSentences] = useState<string[]>([]);
  const [realtimeText, setRealtimeText] = useState<string>('');
  const socketRef = useRef<WebSocket | null>(null);
  const serverCheckInterval = 5000; // toutes les 5 secondes

  // Fonction qui met à jour le message d'information
  const startMsg = () => {
    if (!micAvailable) {
      setRealtimeText('🎤  please allow microphone access  🎤');
    } else if (!serverAvailable) {
      setRealtimeText('🖥️  please start server  🖥️');
    } else {
      setRealtimeText('👄  start speaking  👄');
    }
  };

  // Affiche le texte en temps réel en combinant les phrases complètes et le texte en cours
  const displayRealtimeText = (text: string) => {
    setRealtimeText(text);
  };

  // Connexion au serveur via WebSocket
  const connectToServer = () => {
    const ws = new WebSocket('ws://62.210.150.81:5000');

    ws.onopen = (event) => {
      setServerAvailable(true);
      startMsg();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'realtime') {
          displayRealtimeText(data.text);
        } else if (data.type === 'fullSentence') {
          setFullSentences((prev) => [...prev, data.text]);
          displayRealtimeText('');
        }
      } catch (error) {
        console.error('Erreur lors du parsing du message', error);
      }
    };

    ws.onclose = (event) => {
      setServerAvailable(false);
    };

    socketRef.current = ws;
  };

  // Vérification périodique de la disponibilité du serveur
  useEffect(() => {
    const interval = setInterval(() => {
      if (!serverAvailable) {
        connectToServer();
      }
    }, serverCheckInterval);
    return () => clearInterval(interval);
  }, [serverAvailable]);

  // Initialisation de la connexion WebSocket
  useEffect(() => {
    if (!socketRef.current) {
      connectToServer();
    }
    // On peut également ajouter une gestion du onopen ici si besoin.
  }, []);

  // Demande d'accès au microphone et traitement audio
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        // Utilisation de createScriptProcessor (attention, il est déprécié mais reste fonctionnel)
        const processor = audioContext.createScriptProcessor(256, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);
        setMicAvailable(true);
        startMsg();

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const outputData = new Int16Array(inputData.length);

          // Conversion en PCM 16 bits
          for (let i = 0; i < inputData.length; i++) {
            outputData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }

          // Envoi des données audio au serveur si la connexion est ouverte
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            const metadata = JSON.stringify({ sampleRate: audioContext.sampleRate });
            const metadataBytes = new TextEncoder().encode(metadata);
            const metadataLength = new ArrayBuffer(4);
            const metadataLengthView = new DataView(metadataLength);
            // On enregistre la longueur des métadonnées (nombre d'octets)
            metadataLengthView.setInt32(0, metadataBytes.byteLength, true); // little-endian

            // Combinaison de la longueur, des métadonnées et des données audio
            const combinedData = new Blob([metadataLength, metadataBytes, outputData.buffer]);
            socketRef.current.send(combinedData);
          }
        };
      })
      .catch((e) => console.error('Erreur d’accès au microphone:', e));
  }, []);

  return (
    <div id="textDisplay" style={{ padding: '1rem' }}>
      {fullSentences.map((sentence, index) => (
        <span
          key={index}
          className={index % 2 === 0 ? 'yellow' : 'cyan'}
          style={{ marginRight: '0.5rem' }}
        >
          {sentence}
        </span>
      ))}
      <span>{realtimeText}</span>
    </div>
  );
};

export default SpeechRecognition;
