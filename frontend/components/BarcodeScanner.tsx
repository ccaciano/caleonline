import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Modal from 'react-native-modal';

// Importar BarCodeScanner apenas para plataformas nativas
let BarCodeScanner: any = null;
if (Platform.OS !== 'web') {
  BarCodeScanner = require('expo-barcode-scanner').BarCodeScanner;
}

interface BarcodeScannerComponentProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

// Componente para Web usando html5-qrcode
function WebBarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const html5QrCodeRef = useRef<any>(null);
  const containerIdRef = useRef(`scanner-${Date.now()}`);

  // Criar elemento container no DOM quando o modal abre
  useEffect(() => {
    if (visible && Platform.OS === 'web' && typeof document !== 'undefined') {
      // Criar container se não existir
      let container = document.getElementById(containerIdRef.current);
      if (!container) {
        container = document.createElement('div');
        container.id = containerIdRef.current;
        container.style.cssText = 'width:100%;height:100%;background:#000;position:absolute;top:0;left:0;';
      }
      
      // Aguardar um pouco para o modal estar pronto e então inicializar
      const timer = setTimeout(() => {
        initializeScanner();
      }, 300);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [visible]);

  // Cleanup quando modal fecha
  useEffect(() => {
    if (!visible) {
      stopScanner();
    }
  }, [visible]);

  const initializeScanner = async () => {
    if (typeof window === 'undefined' || isInitializing) return;
    
    setIsInitializing(true);
    setError(null);

    try {
      // Importar html5-qrcode dinamicamente
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Obter lista de câmeras
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        setCameras(devices);
        setHasPermission(true);
        
        // Preferir câmera frontal para notebooks
        let frontCameraIndex = devices.findIndex((d: any) => 
          d.label.toLowerCase().includes('front') || 
          d.label.toLowerCase().includes('user') ||
          d.label.toLowerCase().includes('facetime') ||
          d.label.toLowerCase().includes('integrated')
        );
        
        if (frontCameraIndex === -1) frontCameraIndex = 0;
        
        setCurrentCameraIndex(frontCameraIndex);
        
        // Iniciar scanner
        await startScanner(devices[frontCameraIndex].id);
      } else {
        setHasPermission(false);
        setError('Nenhuma câmera encontrada');
      }
    } catch (err: any) {
      console.error('Error initializing scanner:', err);
      setHasPermission(false);
      if (err.message?.includes('Permission')) {
        setError('Permissão para câmera negada');
      } else {
        setError(err.message || 'Erro ao acessar câmera');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const startScanner = async (cameraId: string) => {
    if (typeof document === 'undefined' || !cameraId) return;
    
    try {
      // Parar scanner anterior se existir
      await stopScanner();
      
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Encontrar o container de câmera e adicionar o elemento do scanner
      const cameraContainer = document.querySelector('[data-camera-container="true"]');
      if (!cameraContainer) {
        console.error('Camera container not found');
        setError('Container de câmera não encontrado');
        return;
      }

      // Limpar container
      cameraContainer.innerHTML = '';
      
      // Criar elemento para o scanner
      const scannerElement = document.createElement('div');
      scannerElement.id = containerIdRef.current;
      scannerElement.style.cssText = 'width:100%;height:100%;';
      cameraContainer.appendChild(scannerElement);

      // Criar instância do scanner
      html5QrCodeRef.current = new Html5Qrcode(containerIdRef.current);
      
      // Configurar e iniciar
      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          handleScan(decodedText);
        },
        () => {
          // Callback de erro de scan - ignorar
        }
      );
      
      setIsStarted(true);
      setError(null);
      console.log('Scanner started successfully');
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      setError('Erro ao iniciar câmera: ' + (err.message || 'Desconhecido'));
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (isStarted) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
      setIsStarted(false);
    }
  };

  const handleScan = async (code: string) => {
    await stopScanner();
    onScan(code);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const toggleCamera = async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(cameras[nextIndex].id);
  };

  if (!visible) return null;

  // Tela de erro/permissão
  if (hasPermission === false || error) {
    return (
      <Modal
        isVisible={visible}
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
        style={styles.modal}
      >
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off" size={64} color="#8E8E93" />
          <Text style={styles.permissionTitle}>
            {error || t('cameraPermission')}
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={initializeScanner}>
            <Text style={styles.permissionButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      style={styles.fullScreenModal}
      animationIn="fadeIn"
      animationOut="fadeOut"
    >
      <View style={styles.scannerContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('scannerTitle')}</Text>
          <View style={styles.headerButtons}>
            {cameras.length > 1 && (
              <TouchableOpacity onPress={toggleCamera} style={styles.switchCameraButton}>
                <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Container da câmera - será preenchido via JS */}
        <View 
          style={styles.cameraContainer}
          // @ts-ignore
          data-camera-container="true"
        />

        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>{t('scannerInstructions')}</Text>
          {cameras.length > 0 && (
            <Text style={styles.cameraTypeText}>
              Câmera: {cameras[currentCameraIndex]?.label || 'Carregando...'}
            </Text>
          )}
          {isInitializing && (
            <Text style={styles.tipText}>Inicializando câmera...</Text>
          )}
          <Text style={styles.tipText}>
            💡 Se não funcionar, digite o código manualmente
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Componente para dispositivos nativos (iOS/Android)
function NativeBarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');

  useEffect(() => {
    if (visible && BarCodeScanner) {
      requestPermission();
      setScanned(false);
    }
  }, [visible]);

  const requestPermission = async () => {
    if (!BarCodeScanner) return;
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanned) {
      setScanned(true);
      onScan(data);
    }
  };

  const handleClose = () => {
    setScanned(false);
    onClose();
  };

  const toggleCameraType = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };

  if (!BarCodeScanner || !visible) {
    return null;
  }

  if (hasPermission === null) {
    return null;
  }

  if (hasPermission === false) {
    return (
      <Modal
        isVisible={visible}
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
        style={styles.modal}
      >
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off" size={64} color="#8E8E93" />
          <Text style={styles.permissionTitle}>{t('cameraPermission')}</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>{t('grantPermission')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      style={styles.fullScreenModal}
      animationIn="fadeIn"
      animationOut="fadeOut"
    >
      <View style={styles.scannerContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('scannerTitle')}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={toggleCameraType} style={styles.switchCameraButton}>
              <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cameraContainer}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
            type={cameraType}
            barCodeTypes={[
              'ean13',
              'ean8',
              'upc_e',
              'upc_a',
              'qr',
              'code128',
              'code39',
              'code93',
              'codabar',
              'itf14',
              'pdf417',
              'aztec',
            ]}
          />
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
          </View>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>{t('scannerInstructions')}</Text>
          <Text style={styles.cameraTypeText}>
            Câmera: {cameraType === 'front' ? 'Frontal' : 'Traseira'}
          </Text>
          {scanned && (
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={() => setScanned(false)}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.scanAgainText}>Escanear Novamente</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Componente principal que escolhe qual implementação usar
export default function BarcodeScanner(props: BarcodeScannerComponentProps) {
  if (Platform.OS === 'web') {
    return <WebBarcodeScanner {...props} />;
  }
  return <NativeBarcodeScanner {...props} />;
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenModal: {
    margin: 0,
  },
  permissionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    maxWidth: 320,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  switchCameraButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  closeButton: {
    padding: 4,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  scanArea: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: '#34C759',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  instructions: {
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  instructionsText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cameraTypeText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    textAlign: 'center',
  },
  tipText: {
    fontSize: 12,
    color: '#FFD60A',
    textAlign: 'center',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
