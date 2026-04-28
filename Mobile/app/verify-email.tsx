import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useRef } from 'react';
import DatabaseService from '../database/DatabaseService';

export default function VerifyEmailScreen() {
  const { generatedCode, userEmail } = useLocalSearchParams();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);

  const handleTextChange = (text: string, index: number) => {
    // Sadece sayısal değer kabul et (isteğe bağlı)
    const numericText = text.replace(/[^0-9]/g, '');
    
    const newCode = [...code];
    newCode[index] = numericText;
    setCode(newCode);

    // Bir karakter girildiyse ve son kutu değilse, sonraki kutuya geç
    if (numericText.length === 1 && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Backspace'e basıldıysa ve kutu boşsa, önceki kutuya geç
    if (e.nativeEvent.key === 'Backspace' && code[index] === '' && index > 0) {
      inputs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const handleVerify = async () => {
    const enteredCode = code.join('');
    
    if (enteredCode.length < 6) {
      Alert.alert('Hata', 'Lütfen 6 haneli kodu eksiksiz girin.');
      return;
    }

    try {
      await DatabaseService.verifyResetCode(userEmail as string, enteredCode);
      
      router.push({
        pathname: '/reset-password',
        params: { 
          email: userEmail,
          code: enteredCode
        }
      });
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Kod doğrulanamadı.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Geliştirme aşaması için test kodu */}
      {generatedCode ? (
        <Text style={styles.testCode}>Test Kodu: {generatedCode}</Text>
      ) : null}
      
      <Text style={styles.title}>Doğrulama Kodu</Text>
      <Text style={styles.subtitle}>
        Lütfen {userEmail ? `${userEmail} adresinize` : 'e-posta adresinize'} gönderilen 6 haneli doğrulama kodunu girin.
      </Text>

      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputs.current[index] = ref)}
            style={styles.codeInput}
            value={digit}
            onChangeText={(text) => handleTextChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>
      
      <TouchableOpacity style={styles.button} onPress={handleVerify}>
        <Text style={styles.buttonText}>Onayla</Text>
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  codeInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    fontSize: 24,
    textAlign: 'center',
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
  testCode: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
