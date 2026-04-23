import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');

  const handleResetPassword = () => {
    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir e-posta adresi girin.');
      return;
    }
    
    // Simüle edilmiş şifre sıfırlama işlemi
    Alert.alert(
      'Başarılı',
      'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
      [{ text: 'Tamam', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Şifremi Unuttum</Text>
      <Text style={styles.subtitle}>E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.</Text>

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
        <Text style={styles.buttonText}>Gönder</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>Geri dön</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#111',
  },
  button: {
    backgroundColor: '#2e7d32',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backText: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});