import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { io, Socket} from "socket.io-client";

// URL du serveur WebSocket
const SERVER_URL = "ws://51.159.159.241:5000";

export default function Index() {
  const [messages, setMessages] = useState([]); 
  const [isChatActive, setIsChatActive] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [isListening, setIsListening] = useState(false);

  const [activeResource, setActiveResource] = useState(null); 

  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on("serverResponse", async (data) => {
      console.log("Réponse du serveur reçue :", data);

      if (data.nom_fonction === "askForMoreInfo") {
        setPendingQuestion(`Besoin d'une précision: ${JSON.stringify(data.arguments)}`);
        setIsChatActive(true);
      } else {
        const {sound_id, video_id} = await processFinalResponse(data);
        await playSound(sound_id);
        showAnimation(video_id);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const processFinalResponse = async (data) => {
    console.log("Réponse finale reçue :", data);
    const { sound_id, video_id } = JSON.parse(data.arguments);
    return { sound_id, video_id };
  };
  
  const isListeningRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        alert("Permission d'accès au micro refusée");
        return;
      }
  
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);
      setIsListening(true);
      isListeningRef.current = true;

      Animated.timing(scaleAnim, {
        toValue: 1.5,
        duration: 300,
        useNativeDriver: true,
      }).start();
  
      if (socket) {
        console.log("🔴 Enregistrement démarré...");
        socket.emit("audioStart");
      }
  
      intervalRef.current = setInterval(async () => {
        if (!newRecording || !isListeningRef.current) {
          console.log("⚠️ Enregistrement arrêté, arrêt de l'envoi des chunks.");
          return;
        }
  
        try {
          const audioBase64 = await convertToBase64(newRecording);
          if (audioBase64) {
            console.log("📤 Envoi d'un chunk audio...");
            const data =  '{ data: audioBase64,metadata : {sampleRate : 44100}}'
            socket?.emit("audioChunk", {data: audioBase64});
          } else {
            console.warn("⚠️ Aucun audioBase64 généré !");
          }
        } catch (error) {
          console.error("❌ Erreur lors de l'envoi du chunk audio :", error);
        }
      }, 1000);
  
    } catch (error) {
      console.error("❌ Erreur lors de l'enregistrement :", error);
    }
  };
  
  const stopRecording = async () => {
    if (!recording) return;
  
    setIsListening(false);
    isListeningRef.current = false;
  
    await recording.stopAndUnloadAsync();
    setRecording(null);

    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  
    if (socket) {
      console.log("🛑 Enregistrement arrêté.");
      socket.emit("audioEnd");
    }
  };
  
  const convertToBase64 = async (recording) => {
    try {
      const uri = recording.getURI();
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Erreur conversion Base64 :", error);
      return null;
    }
  };

  const playSound = async (id: string) => {
    const sounds: { [key: string]: any } = {
      "0": require("./audios/heimlich.wav"),

    };

    const soundFile = sounds[id];

    if (!soundFile) {
      console.warn("Aucun son trouvé pour l'ID:", id);
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(soundFile);
      await sound.playAsync();
    } catch (error) {
      console.error("Erreur lecture son:", error);
    }
  };

  const showAnimation = (id: string) => {
    const images: { [key: string]: any } = {
      "0": require("./images/heimlich.gif"),
    };

    setActiveResource(images[id]);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 60}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          {activeResource ? (
            <Animated.Image source={activeResource} style={[styles.animationImage, { opacity: imageOpacity }]} />
          ) : (
            <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
              <TouchableOpacity
                style={[styles.microphoneBox, isListening && styles.recording]}
                onPress={isListening ? stopRecording : startRecording}
              >
                <Ionicons name={isListening ? "stop-circle" : "mic"} size={40} color="white" />
              </TouchableOpacity>

            </Animated.View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, justifyContent: "center", alignItems: "center" },
  microphoneBox: { width: 150, height: 150, backgroundColor: "red", justifyContent: "center", alignItems: "center", borderRadius: 100, marginTop: 20 },
  recording: { backgroundColor: "darkred" },
  animationImage: { width: 300, height: 300, resizeMode: "contain" },
  chatContainer: { flex: 1, width: "100%", paddingHorizontal: 20, marginTop: 10 },
  messageBubble: { padding: 10, borderRadius: 10, backgroundColor: "#E5E5EA", marginBottom: 10, maxWidth: "80%" },
  messageText: { fontSize: 16 },
});
