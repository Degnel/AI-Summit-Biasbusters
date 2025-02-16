import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech-recognition';

interface RecognitionResults {
  data: string[];
}

export default function VoiceRecognition() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [permission, setPermission] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [partialText, setPartialText] = useState<string>('');

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async (): Promise<void> => {
    try {
      const available = await Speech.isAvailableAsync();
      setIsAvailable(available);
      
      if (available) {
        const { status } = await Speech.requestPermissionsAsync();
        setPermission(status === 'granted');
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  };

  const startListening = async (): Promise<void> => {
    try {
      if (!permission) {
        const { status } = await Speech.requestPermissionsAsync();
        setPermission(status === 'granted');
        if (status !== 'granted') return;
      }

      setIsListening(true);
      setRecognizedText('');
      setPartialText('');

      await Speech.startListeningAsync({
        partialResults: true,
        onResults: (results: RecognitionResults) => {
          if (results.data.length > 0) {
            setRecognizedText(results.data[0]);
          }
        },
        onPartialResults: (results: RecognitionResults) => {
          if (results.data.length > 0) {
            setPartialText(results.data[0]);
          }
        },
      });
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  };

  const stopListening = async (): Promise<void> => {
    try {
      await Speech.stopListeningAsync();
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  };

  if (!isAvailable) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Speech recognition is not available on this device.</Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need microphone permission to recognize speech.</Text>
        <TouchableOpacity style={styles.button} onPress={checkAvailability}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Recognition Demo</Text>
      
      <TouchableOpacity 
        style={[styles.button, isListening && styles.buttonListening]}
        onPress={isListening ? stopListening : startListening}
      >
        <Text style={styles.buttonText}>
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </Text>
      </TouchableOpacity>

      <View style={styles.resultsContainer}>
        <Text style={styles.label}>Partial Results:</Text>
        <Text style={styles.results}>{partialText || 'Waiting...'}</Text>
        
        <Text style={styles.label}>Final Results:</Text>
        <Text style={styles.results}>{recognizedText || 'Waiting...'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginVertical: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonListening: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  resultsContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    marginTop: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  results: {
    fontSize: 18,
    color: '#333',
    marginVertical: 10,
    minHeight: 50,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});