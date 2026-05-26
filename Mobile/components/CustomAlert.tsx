import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Dimensions, 
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert as RNAlert } from 'react-native';

const { width } = Dimensions.get('window');

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

let alertTrigger: (title: string, message: string, buttons?: AlertButton[]) => void = () => {};

export const globalAlert = (title: string, message: string, buttons?: AlertButton[]) => {
  if (alertTrigger) {
    alertTrigger(title, message, buttons);
  } else {
    RNAlert.alert(title, message, buttons as any);
  }
};

// Monkey-patch React Native Alert globally
(RNAlert as any).alert = (title: any, message?: any, buttons?: AlertButton[]) => {
  globalAlert(title || '', message || '', buttons);
};

export function CustomAlertModal() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<AlertButton[]>([]);
  // Her yeni alert'te key değişir → Android yeni bir Dialog penceresi oluşturur
  // Bu sayede alert her zaman en üstte görünür, başka modalların arkasında kalmaz
  const [alertKey, setAlertKey] = useState(0);

  useEffect(() => {
    let openTimer: ReturnType<typeof setTimeout> | null = null;
    alertTrigger = (t: string, m: string, b?: AlertButton[]) => {
      // Önceki zamanlayıcıyı iptal et (rapid-fire alert'lerde race condition önler)
      if (openTimer) clearTimeout(openTimer);
      setTitle(t);
      setMessage(m);
      setButtons(b || []);
      // Önce kapat (varsa), sonra yeni key ile yeniden aç
      setVisible(false);
      setAlertKey(prev => prev + 1);
      // 100ms gecikme — Android'de yeni native Dialog'un en üstte oluşmasını garanti eder
      openTimer = setTimeout(() => {
        setVisible(true);
      }, 100);
    };
    return () => {
      if (openTimer) clearTimeout(openTimer);
      alertTrigger = () => {};
    };
  }, []);

  const handleButtonPress = (btn: AlertButton) => {
    setVisible(false);
    if (btn.onPress) {
      btn.onPress();
    }
  };

  // Determine Alert Type for Icons and Colors
  const getAlertType = () => {
    const tLower = title.toLowerCase();
    const mLower = message.toLowerCase();
    
    if (
      tLower.includes('başarılı') || 
      tLower.includes('tebrikler') || 
      tLower.includes('onay') || 
      tLower.includes('kaydedildi') || 
      tLower.includes('güncellendi') ||
      mLower.includes('başarıyla')
    ) {
      return 'success';
    }
    
    if (
      tLower.includes('hata') || 
      tLower.includes('yanlış') || 
      tLower.includes('eksik') || 
      tLower.includes('başarısız') || 
      tLower.includes('geçersiz')
    ) {
      return 'error';
    }
    
    if (
      tLower.includes('uyarı') || 
      tLower.includes('dikkat') || 
      tLower.includes('emin misiniz')
    ) {
      return 'warning';
    }
    
    return 'info';
  };

  const alertType = getAlertType();

  const getAlertIcon = () => {
    switch (alertType) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={54} color="#22c55e" />;
      case 'error':
        return <Ionicons name="close-circle" size={54} color="#ef4444" />;
      case 'warning':
        return <Ionicons name="warning" size={54} color="#f59e0b" />;
      default:
        return <Ionicons name="information-circle" size={54} color="#3b82f6" />;
    }
  };

  const getIconBgColor = () => {
    switch (alertType) {
      case 'success': return '#f0fdf4';
      case 'error': return '#fef2f2';
      case 'warning': return '#fffbeb';
      default: return '#f0f9ff';
    }
  };

  const getPrimaryButtonColor = () => {
    switch (alertType) {
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  const renderButtons = () => {
    const alertButtons = buttons.length > 0 ? buttons : [{ text: 'Tamam' }];
    
    const isRow = alertButtons.length === 2;

    return (
      <View style={[styles.buttonContainer, isRow ? styles.buttonRow : styles.buttonCol]}>
        {alertButtons.map((btn, index) => {
          const isCancel = btn.style === 'cancel' || btn.text.toLowerCase() === 'iptal' || btn.text.toLowerCase() === 'vazgeç';
          const isDestructive = btn.style === 'destructive';
          
          let btnBg = getPrimaryButtonColor();
          let textColor = '#ffffff';
          let borderStyles = {};

          if (isCancel) {
            btnBg = '#f1f5f9';
            textColor = '#475569';
          } else if (isDestructive) {
            btnBg = '#ef4444';
          }

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.button, 
                isRow ? styles.flexButton : styles.fullButton,
                { backgroundColor: btnBg },
                borderStyles
              ]}
              onPress={() => handleButtonPress(btn)}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonText, { color: textColor }]}>
                {btn.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      key={alertKey}
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={() => setVisible(false)}
      statusBarTranslucent={true}
      hardwareAccelerated={true}
    >
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          {/* Header Icon */}
          <View style={[styles.iconContainer, { backgroundColor: getIconBgColor() }]}>
            {getAlertIcon()}
          </View>

          {/* Title */}
          {title ? <Text style={styles.title}>{title}</Text> : null}

          {/* Message */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons */}
          {renderButtons()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      }
    }),
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonCol: {
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexButton: {
    flex: 1,
  },
  fullButton: {
    width: '100%',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  }
});
