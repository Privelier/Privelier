import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { supabase } from './lib/supabase';

export default function App() {
  const [status, setStatus] = useState('Connecting to Supabase…');

  useEffect(() => {
    supabase
      .from('__connection_check__')
      .select('*')
      .limit(1)
      .then(({ error }) => {
        // A "table not found" response confirms the client reached
        // Supabase and the URL/anon key are valid.
        if (error?.code === 'PGRST205') {
          setStatus('Connected to Supabase ✅');
        } else if (error) {
          setStatus(`Supabase error: ${error.message}`);
        } else {
          setStatus('Connected to Supabase ✅');
        }
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text>{status}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
