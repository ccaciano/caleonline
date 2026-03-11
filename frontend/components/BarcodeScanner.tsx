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

// Componente para Web - Abordagem simplificada
function WebBarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation();
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const html5QrCodeRef = useRef<any>(null);
  const containerIdRef = useRef(`qr-scanner-${Date.now()}`);

  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      initScanner();
    }
    
    return () => {
      cleanup();
    };
  }, [visible]);

  const cleanup = async () => {
    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {}
        try {
          html5QrCodeRef.current.clear();
        } catch (e) {}
        html5QrCodeRef.current = null;
      }
    } catch (e) {}

    // Remover container do DOM
    if (typeof document !== 'undefined') {
      const container = document.getElementById(containerIdRef.current);
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };

  const initScanner = async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      setStatus('error');
      setErrorMessage('Ambiente web não disponível');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      // Importar html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');

      // Obter lista de câmeras
      let devices;
      try {
        devices = await Html5Qrcode.getCameras();
      } catch (e: any) {
        setStatus('error');
        setErrorMessage('Não foi possível acessar as câmeras. Verifique as permissões.');
        return;
      }

      if (!devices || devices.length === 0) {
        setStatus('error');
        setErrorMessage('Nenhuma câmera encontrada');
        return;
      }

      setCameras(devices);

      // Encontrar câmera preferida (frontal para notebook)
      let preferredIndex = devices.findIndex((d: any) =>
        d.label.toLowerCase().includes('front') ||
        d.label.toLowerCase().includes('user') ||
        d.label.toLowerCase().includes('facetime') ||
        d.label.toLowerCase().includes('integrated')
      );
      if (preferredIndex === -1) preferredIndex = 0;
      setCurrentCameraIndex(preferredIndex);

      // Criar container no DOM
      await cleanup(); // Limpar anterior se existir
      
      const container = document.createElement('div');
      container.id = containerIdRef.current;
      container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        height: 300px;
        z-index: 9999;
        background: #000;
        border-radius: 16px;
        overflow: hidden;
      `;
      document.body.appendChild(container);

      // Iniciar scanner
      html5QrCodeRef.current = new Html5Qrcode(containerIdRef.current);

      await html5QrCodeRef.current.start(
        devices[preferredIndex].id,
        {
          fps: 15,
          qrbox: { width: 350, height: 150 }, // Formato retangular para códigos de barras
          aspectRatio: 1.333, // 4:3 para melhor captura de códigos de barras
          formatsToSupport: [
            0,  // QR_CODE
            1,  // AZTEC
            2,  // CODABAR
            3,  // CODE_39
            4,  // CODE_93
            5,  // CODE_128
            6,  // DATA_MATRIX
            7,  // MAXICODE
            8,  // ITF
            9,  // EAN_13
            10, // EAN_8
            11, // PDF_417
            12, // RSS_14
            13, // RSS_EXPANDED
            14, // UPC_A
            15, // UPC_E
            16, // UPC_EAN_EXTENSION
          ]
        },
        (decodedText: string) => {
          handleScan(decodedText);
        },
        () => {} // Ignorar erros de scan
      );

      setStatus('ready');
    } catch (e: any) {
      console.error('Scanner init error:', e);
      setStatus('error');
      setErrorMessage(e.message || 'Erro ao inicializar scanner');
    }
  };

  const handleScan = async (code: string) => {
    await cleanup();
    onScan(code);
  };

  const handleClose = async () => {
    await cleanup();
    onClose();
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;

    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);

    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.start(
          cameras[nextIndex].id,
          {
            fps: 15,
            qrbox: { width: 350, height: 150 },
            aspectRatio: 1.333,
            formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
          },
          (decodedText: string) => {
            handleScan(decodedText);
          },
          () => {}
        );
      }
    } catch (e) {
      console.error('Error switching camera:', e);
    }
  };

  if (!visible) return null;

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('scannerTitle')}</Text>
          <View style={styles.headerButtons}>
            {cameras.length > 1 && (
              <TouchableOpacity onPress={switchCamera} style={styles.switchCameraButton}>
                <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Área central - o scanner é renderizado via DOM diretamente no body */}
        <View style={styles.cameraPlaceholder}>
          {status === 'loading' && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>Inicializando câmera...</Text>
            </View>
          )}
          {status === 'error' && (
            <View style={styles.statusContainer}>
              <Ionicons name="camera-off" size={64} color="#FF3B30" />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={initScanner}>
                <Text style={styles.retryButtonText}>Tentar Novamente</Text>
              </TouchableOpacity>
            </View>
          )}
          {status === 'ready' && (
            <View style={styles.scanOverlay}>
              <View style={styles.scanArea} />
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.instructionsText}>{t('scannerInstructions')}</Text>
          {cameras.length > 0 && (
            <Text style={styles.cameraTypeText}>
              Câmera: {cameras[currentCameraIndex]?.label || 'Carregando...'}
            </Text>
          )}
          <Text style={styles.tipText}>
            💡 Se não funcionar, feche e digite o código manualmente
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

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (!scanned) {
      setScanned(true);
      onScan(data);
    }
  };

  const handleClose = () => {
    setScanned(false);
    onClose();
  };

  if (!BarCodeScanner || !visible) return null;
  if (hasPermission === null) return null;

  if (hasPermission === false) {
    return (
      <Modal isVisible={visible} onBackdropPress={handleClose} style={styles.modal}>
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
    <Modal isVisible={visible} onBackdropPress={handleClose} style={styles.fullScreenModal}>
      <View style={styles.scannerContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('scannerTitle')}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={() => setCameraType(c => c === 'back' ? 'front' : 'back')} style={styles.switchCameraButton}>
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
            barCodeTypes={['ean13', 'ean8', 'upc_e', 'upc_a', 'qr', 'code128', 'code39']}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanArea} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.instructionsText}>{t('scannerInstructions')}</Text>
          <Text style={styles.cameraTypeText}>Câmera: {cameraType === 'front' ? 'Frontal' : 'Traseira'}</Text>
          {scanned && (
            <TouchableOpacity style={styles.retryButton} onPress={() => setScanned(false)}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Escanear Novamente</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function BarcodeScanner(props: BarcodeScannerComponentProps) {
  if (Platform.OS === 'web') {
    return <WebBarcodeScanner {...props} />;
  }
  return <NativeBarcodeScanner {...props} />;
}

const styles = StyleSheet.create({
  modal: { margin: 0, justifyContent: 'center', alignItems: 'center' },
  fullScreenModal: { margin: 0 },
  permissionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    maxWidth: 320,
  },
  permissionTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', textAlign: 'center' },
  permissionButton: { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' },
  permissionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { padding: 12 },
  cancelButtonText: { color: '#8E8E93', fontSize: 16 },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 100,
  },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  switchCameraButton: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 8 },
  closeButton: { padding: 4 },
  cameraContainer: { flex: 1, position: 'relative' },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  statusText: { color: '#FFFFFF', fontSize: 16 },
  errorText: { color: '#FF3B30', fontSize: 16, textAlign: 'center' },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  scanArea: {
    width: 280,
    height: 280,
    borderWidth: 3,
    borderColor: '#34C759',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  footer: {
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  instructionsText: { fontSize: 16, color: '#FFFFFF', textAlign: 'center' },
  cameraTypeText: { fontSize: 14, color: '#34C759', fontWeight: '600', textAlign: 'center' },
  tipText: { fontSize: 12, color: '#FFD60A', textAlign: 'center' },
});
