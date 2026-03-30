import { SafeAreaProvider } from 'react-native-safe-area-context';
import VoiceRecorder from './src/components/VoiceRecorder';

function App() {
  return (
    <SafeAreaProvider>
      <VoiceRecorder />
    </SafeAreaProvider>
  );
}

export default App;
