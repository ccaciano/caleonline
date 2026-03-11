import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getInventory,
  getCountedItems,
  addCountedItem,
  deleteCountedItem,
  closeInventory,
  getExportData,
  searchProduct,
  Inventory,
  CountedItem,
} from '../../services/api';
import BarcodeScanner from '../../components/BarcodeScanner';
import EditItemModal from '../../components/EditItemModal';
import AddProductModal from '../../components/AddProductModal';
import { generateExcelReport, shareExcelFile } from '../../utils/excelExport';
import * as MailComposer from 'expo-mail-composer';
import { getStoreConfig } from '../../services/api';

// Função para validar data no formato DD/MM/AAAA
const isValidDate = (dateStr: string): boolean => {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(regex);
  if (!match) return false;
  
  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  const year = parseInt(match[3]);
  
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  
  return true;
};

// Função para converter DD/MM/AAAA para AAAA-MM-DD
const convertToISO = (dateStr: string): string => {
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
};

// Função para converter AAAA-MM-DD para DD/MM/AAAA
const convertFromISO = (isoStr: string): string => {
  const [year, month, day] = isoStr.split('-');
  return `${day}/${month}/${year}`;
};

export default function CountingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const inventoryId = Array.isArray(id) ? id[0] : id;

  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [items, setItems] = useState<CountedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [editItem, setEditItem] = useState<CountedItem | null>(null);
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [searchingProduct, setSearchingProduct] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [productFound, setProductFound] = useState<{
    code: string;
    ean: string;
    description: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    quantity: '',
    lot: '',
    expiry_date: '',
  });

  useEffect(() => {
    loadData();
  }, [inventoryId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, itemsData] = await Promise.all([
        getInventory(inventoryId),
        getCountedItems(inventoryId),
      ]);
      setInventory(invData);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erro', 'Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchQuery('');
      setProductFound(null);
      return;
    }

    setSearchQuery(query);
    setSearchingProduct(true);

    try {
      const product = await searchProduct(query);
      
      if (product) {
        setProductFound({
          code: product.code,
          ean: product.ean || '',
          description: product.description,
        });
      } else {
        setProductFound(null);
        // Show modal to add product - usar window.confirm na web
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const confirmed = window.confirm(
            'Produto não encontrado na base de dados.\n\nDeseja cadastrar este produto?'
          );
          if (confirmed) {
            setAddProductModalVisible(true);
          }
        } else {
          // Em dispositivos nativos, usa o Alert normal
          Alert.alert(
            t('productNotFound'),
            t('productNotFoundMessage'),
            [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('registerProduct'),
                onPress: () => setAddProductModalVisible(true),
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error searching product:', error);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Erro: Falha ao buscar produto');
      } else {
        Alert.alert('Erro', 'Falha ao buscar produto');
      }
    } finally {
      setSearchingProduct(false);
    }
  };

  const handleScan = (code: string) => {
    setScannerVisible(false);
    handleSearch(code);
  };

  const handleAddItem = async () => {
    // Validações
    if (!productFound) {
      Alert.alert('Erro', 'Busque um produto primeiro');
      return;
    }

    if (!formData.quantity) {
      Alert.alert(t('fillAllFields'), 'Preencha pelo menos a quantidade');
      return;
    }

    // Validar quantidade (apenas números)
    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert(t('invalidQuantity'));
      return;
    }

    // Validar data (formato DD/MM/AAAA) - apenas se preenchida
    if (formData.expiry_date && !isValidDate(formData.expiry_date)) {
      Alert.alert(t('invalidDate'), 'Use o formato DD/MM/AAAA');
      return;
    }

    try {
      setLoading(true);
      const newItem = await addCountedItem(inventoryId, {
        product_code: productFound.code,
        ean: productFound.ean || '',
        description: productFound.description,
        quantity,
        lot: formData.lot || '',
        expiry_date: formData.expiry_date ? convertToISO(formData.expiry_date) : '',
      });
      
      setItems([newItem, ...items]);
      
      // Limpar formulário
      setFormData({
        quantity: '',
        lot: '',
        expiry_date: '',
      });
      setSearchQuery('');
      setProductFound(null);
      
      Alert.alert('Sucesso', 'Item adicionado!');
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Erro', 'Falha ao adicionar item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = (item: CountedItem) => {
    Alert.alert(
      t('delete'),
      t('confirmDelete'),
      [
        { text: t('no'), style: 'cancel' },
        {
          text: t('yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCountedItem(inventoryId, item._id!);
              setItems(items.filter((i) => i._id !== item._id));
              Alert.alert('Sucesso', 'Item excluído');
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Erro', 'Falha ao excluir item');
            }
          },
        },
      ]
    );
  };

  const handleEditSuccess = () => {
    setEditItem(null);
    loadData();
  };

  const handleProductAdded = (product: { code: string; ean: string; description: string }) => {
    setAddProductModalVisible(false);
    setProductFound(product);
    setSearchQuery(product.code);
  };

  const handleExport = async () => {
    if (items.length === 0) {
      Alert.alert('Erro', 'Nenhum item para exportar');
      return;
    }

    try {
      setLoading(true);
      
      // Primeiro fechar o inventário
      console.log('Fechando inventário...');
      await closeInventory(inventoryId);
      
      // Obter dados para exportação
      console.log('Obtendo dados para exportação...');
      const exportData = await getExportData(inventoryId);
      
      // Gerar arquivo Excel
      console.log('Gerando arquivo Excel...');
      const fileUri = await generateExcelReport(exportData);
      console.log('Arquivo gerado:', fileUri);
      
      // Verifica se foi salvo via SAF (Android) - URI começa com content://
      const savedViaSAF = fileUri.startsWith('content://');
      
      if (Platform.OS === 'web' || fileUri === 'web-download') {
        // Na web, o download já foi feito automaticamente
        Alert.alert(
          t('exportTitle'),
          'Arquivo Excel baixado com sucesso!',
          [{ text: 'OK' }]
        );
      } else if (savedViaSAF) {
        // No Android com SAF, o arquivo já foi salvo no diretório escolhido
        Alert.alert(
          t('exportTitle'),
          'Arquivo salvo com sucesso no diretório selecionado!',
          [
            {
              text: t('sendEmail'),
              onPress: async () => {
                try {
                  const storeConfig = await getStoreConfig();
                  const isAvailable = await MailComposer.isAvailableAsync();
                  
                  if (!isAvailable) {
                    Alert.alert('Erro', 'E-mail não disponível neste dispositivo');
                    return;
                  }

                  await MailComposer.composeAsync({
                    recipients: storeConfig?.email ? [storeConfig.email] : [],
                    subject: `Relatório de Inventário - ${exportData.inventory.description}`,
                    body: `Segue em anexo o relatório de inventário para ${exportData.inventory.description} datado de ${exportData.inventory.date}.`,
                    attachments: [fileUri],
                  });
                } catch (error) {
                  console.error('Error sending email:', error);
                  Alert.alert('Erro', 'Falha ao enviar e-mail: ' + (error as Error).message);
                }
              },
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
      } else {
        // iOS ou fallback - mostrar opções de compartilhamento
        Alert.alert(
          t('exportTitle'),
          t('exportSuccess'),
          [
            {
              text: t('download'),
              onPress: async () => {
                try {
                  console.log('Compartilhando arquivo...');
                  await shareExcelFile(fileUri);
                } catch (error) {
                  console.error('Error sharing file:', error);
                  Alert.alert('Erro', 'Falha ao compartilhar arquivo: ' + (error as Error).message);
                }
              },
            },
            {
              text: t('sendEmail'),
              onPress: async () => {
                try {
                  const storeConfig = await getStoreConfig();
                  const isAvailable = await MailComposer.isAvailableAsync();
                  
                  if (!isAvailable) {
                    Alert.alert('Erro', 'E-mail não disponível neste dispositivo');
                    return;
                  }

                  await MailComposer.composeAsync({
                    recipients: storeConfig?.email ? [storeConfig.email] : [],
                    subject: `Relatório de Inventário - ${exportData.inventory.description}`,
                    body: `Segue em anexo o relatório de inventário para ${exportData.inventory.description} datado de ${exportData.inventory.date}.`,
                    attachments: [fileUri],
                  });
                } catch (error) {
                  console.error('Error sending email:', error);
                  Alert.alert('Erro', 'Falha ao enviar e-mail: ' + (error as Error).message);
                }
              },
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
      }
      
      loadData();
    } catch (error) {
      console.error('Error exporting:', error);
      Alert.alert('Erro ao Exportar', (error as Error).message || t('exportError'));
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: CountedItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemCodeContainer}>
          <Ionicons name="barcode-outline" size={20} color="#007AFF" />
          <Text style={styles.itemCode}>{item.product_code}</Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => setEditItem(item)} style={styles.actionButton}>
            <Ionicons name="create-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>EAN:</Text>
          <Text style={styles.detailValue}>{item.ean || '-'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('description')}:</Text>
          <Text style={styles.detailValue} numberOfLines={2}>{item.description}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('quantity')}:</Text>
          <Text style={styles.detailValue}>{item.quantity}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('lot')}:</Text>
          <Text style={styles.detailValue}>{item.lot || '-'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('expiryDate')}:</Text>
          <Text style={styles.detailValue}>{item.expiry_date ? convertFromISO(item.expiry_date) : '-'}</Text>
        </View>
      </View>
    </View>
  );

  if (loading && !inventory) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!inventory) {
    return null;
  }

  const isClosed = inventory.status === 'closed';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {inventory.description}
            </Text>
            <Text style={styles.subtitle}>{convertFromISO(inventory.date)}</Text>
          </View>
          {isClosed && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedBadgeText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {!isClosed && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>{t('addItem')}</Text>
            
            {/* Botão Escanear */}
            <View style={styles.scanButtonContainer}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => setScannerVisible(true)}
              >
                <Ionicons name="scan" size={32} color="#FFFFFF" />
                <Text style={styles.scanButtonText}>{t('scanBarcode')}</Text>
              </TouchableOpacity>
            </View>

            {/* Campo de Pesquisa */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('search')}</Text>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => handleSearch(searchQuery)}
                    placeholder={t('searchPlaceholder')}
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity onPress={() => handleSearch(searchQuery)} disabled={searchingProduct}>
                    {searchingProduct ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <Ionicons name="search" size={24} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Campos Read-Only do Produto */}
              {productFound && (
                <View style={styles.productFoundSection}>
                  <View style={styles.productFoundHeader}>
                    <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                    <Text style={styles.productFoundTitle}>Produto Encontrado</Text>
                  </View>
                  
                  <View style={styles.readOnlyField}>
                    <Text style={styles.readOnlyLabel}>{t('productCode')}</Text>
                    <Text style={styles.readOnlyValue}>{productFound.code}</Text>
                  </View>
                  
                  <View style={styles.readOnlyField}>
                    <Text style={styles.readOnlyLabel}>EAN</Text>
                    <Text style={styles.readOnlyValue}>{productFound.ean}</Text>
                  </View>
                  
                  <View style={styles.readOnlyField}>
                    <Text style={styles.readOnlyLabel}>{t('description')}</Text>
                    <Text style={styles.readOnlyValue}>{productFound.description}</Text>
                  </View>
                </View>
              )}

              {/* Campos Editáveis */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('quantity')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.quantity}
                  onChangeText={(text) => {
                    // Apenas números
                    const numbers = text.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, quantity: numbers });
                  }}
                  placeholder={t('quantity')}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('lot')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lot}
                  onChangeText={(text) => setFormData({ ...formData, lot: text })}
                  placeholder={t('lot')}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('expiryDate')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.expiry_date}
                  onChangeText={(text) => {
                    // Formatar automaticamente DD/MM/AAAA
                    let formatted = text.replace(/\D/g, '');
                    if (formatted.length >= 2) {
                      formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                    }
                    if (formatted.length >= 5) {
                      formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                    }
                    setFormData({ ...formData, expiry_date: formatted });
                  }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity
                style={[styles.addButton, (!productFound || loading) && styles.addButtonDisabled]}
                onPress={handleAddItem}
                disabled={!productFound || loading}
              >
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <Text style={styles.addButtonText}>{t('addItem')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.itemsSection}>
          <View style={styles.itemsHeader}>
            <Text style={styles.sectionTitle}>{t('countedItems')}</Text>
            <Text style={styles.itemCount}>{items.length} {t('items')}</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyText}>{t('noItems')}</Text>
              <Text style={styles.emptySubtext}>{t('startScanning')}</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item._id || ''}
              scrollEnabled={false}
              contentContainerStyle={styles.itemsList}
            />
          )}
        </View>

        {!isClosed && items.length > 0 && (
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="download" size={24} color="#FFFFFF" />
                <Text style={styles.exportButtonText}>{t('exportAndClose')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />

      {editItem && (
        <EditItemModal
          visible={!!editItem}
          item={editItem}
          inventoryId={inventoryId}
          onClose={() => setEditItem(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      <AddProductModal
        visible={addProductModalVisible}
        initialCode={searchQuery}
        onClose={() => setAddProductModalVisible(false)}
        onSuccess={handleProductAdded}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  closedBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  closedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  scanButtonContainer: {
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#34C759',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    minHeight: 72,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 14,
  },
  productFoundSection: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  productFoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  productFoundTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
  },
  readOnlyField: {
    gap: 4,
  },
  readOnlyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  readOnlyValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#000',
    minHeight: 48,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    minHeight: 52,
  },
  addButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  itemCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  itemDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
  },
  exportButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
