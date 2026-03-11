import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import '../utils/i18n';

// Componente customizado para o conteúdo do Drawer
function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.drawerContainer}>
      {/* Header do Drawer */}
      <View style={[styles.drawerHeader, { paddingTop: insets.top + 16 }]}>
        <View style={styles.logoContainer}>
          <Ionicons name="cube" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.appTitle}>{t('appTitle') || 'Inventory Manager'}</Text>
        <Text style={styles.appSubtitle}>{t('appSubtitle') || 'Gestão de Estoque'}</Text>
      </View>

      {/* Lista de itens do menu */}
      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerScrollContent}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* Footer do Drawer */}
      <View style={[styles.drawerFooter, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>
    </View>
  );
}

export default function DrawerLayout() {
  const { t } = useTranslation();

  // Configurar Navigation Bar no Android para modo imersivo (oculta com gestos)
  useEffect(() => {
    if (Platform.OS === 'android') {
      const setupNavigationBar = async () => {
        try {
          // Definir comportamento da Navigation Bar para "immersive" 
          // Isso faz a barra ocultar e reaparecer com gestos
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
          
          // Definir cor de fundo transparente quando visível
          await NavigationBar.setBackgroundColorAsync('#00000000');
          await NavigationBar.setButtonStyleAsync('light');
        } catch (error) {
          console.log('NavigationBar setup error:', error);
        }
      };
      setupNavigationBar();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          drawerActiveTintColor: '#007AFF',
          drawerInactiveTintColor: '#3C3C43',
          drawerActiveBackgroundColor: '#E3F2FD',
          drawerLabelStyle: {
            fontSize: 16,
            fontWeight: '600',
            marginLeft: -16,
          },
          drawerItemStyle: {
            borderRadius: 12,
            marginHorizontal: 12,
            marginVertical: 4,
            paddingHorizontal: 8,
          },
          headerStyle: {
            backgroundColor: '#007AFF',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 18,
          },
          drawerType: 'front',
          swipeEnabled: true,
          swipeEdgeWidth: 100,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: t('inventories'),
            title: t('inventories'),
            drawerIcon: ({ color, size }) => (
              <Ionicons name="list-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="products"
          options={{
            drawerLabel: t('products'),
            title: t('products'),
            drawerIcon: ({ color, size }) => (
              <Ionicons name="cube-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="store-config"
          options={{
            drawerLabel: t('storeConfig'),
            title: t('storeConfig'),
            drawerIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="counting/[id]"
          options={{
            drawerLabel: t('counting'),
            title: t('counting'),
            drawerItemStyle: { display: 'none' }, // Ocultar do menu drawer
            drawerIcon: ({ color, size }) => (
              <Ionicons name="barcode-outline" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  drawerHeader: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  drawerScrollContent: {
    paddingTop: 16,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  versionText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
