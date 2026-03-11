import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, deleteProduct, uploadProductsCSV, Product } from '../services/api';
import * as DocumentPicker from 'expo-document-picker';
import ProductFormModal from '../components/ProductFormModal';

export default function ProductsScreen() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadProducts(1, searchQuery);
  }, []);

  const loadProducts = async (pageNum: number = 1, search: string = '') => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const data = await getProducts(pageNum, 50, search);
      
      if (pageNum === 1) {
        setProducts(data.products);
      } else {
        setProducts(prev => [...prev, ...data.products]);
      }
      
      setPage(data.page);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Erro', 'Falha ao carregar produtos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadProducts(1, searchQuery);
    setRefreshing(false);
  };

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setPage(1);
    loadProducts(1, text);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && page < totalPages) {
      loadProducts(page + 1, searchQuery);
    }
  };

  // Processa o conteúdo CSV após upload
  const processCSVUpload = async (csvContent: string) => {
    try {
      setUploading(true);
      
      // Upload to API
      const uploadResult = await uploadProductsCSV(csvContent, true);
      
      Alert.alert(
        t('uploadSuccess'),
        `${uploadResult.products_added} ${t('productsAdded')}`
      );
      
      // Reload products
      setPage(1);
      await loadProducts(1, '');
      setSearchQuery('');
    } catch (error) {
      console.error('Error uploading CSV:', error);
      Alert.alert(t('uploadError'), error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  // Handler para web file input
  const handleWebFileSelect = async (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target?.result as string;
      if (csvContent) {
        await processCSVUpload(csvContent);
      }
    };
    reader.onerror = () => {
      Alert.alert(t('uploadError'), 'Falha ao ler o arquivo');
    };
    reader.readAsText(file);

    // Reset input para permitir selecionar o mesmo arquivo novamente
    if (event.target) {
      event.target.value = '';
    }
  };

  // Upload CSV - versão para mobile (nativo)
  const handleNativeUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      // Read file content
      const response = await fetch(result.assets[0].uri);
      const csvContent = await response.text();
      
      await processCSVUpload(csvContent);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert(t('uploadError'), error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Upload CSV - versão principal que detecta a plataforma
  const handleUploadCSV = async () => {
    Alert.alert(
      t('uploadCSV'),
      t('csvWillReplace'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('continue') || 'Continuar',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS === 'web') {
              // Na web, dispara o click no input hidden
              if (typeof document !== 'undefined') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,text/csv';
                input.onchange = handleWebFileSelect;
                input.click();
              }
            } else {
              // Em dispositivos nativos, usa o DocumentPicker
              await handleNativeUpload();
            }
          },
        },
      ]
    );
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setModalVisible(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setModalVisible(true);
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      t('deleteProduct'),
      t('confirmDeleteProduct'),
      [
        { text: t('no'), style: 'cancel' },
        {
          text: t('yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product._id!);
              Alert.alert(t('productDeleted'));
              handleRefresh();
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Erro', 'Falha ao excluir produto');
            }
          },
        },
      ]
    );
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditingProduct(null);
    handleRefresh();
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productCode}>{item.code}</Text>
          <Text style={styles.productEan}>EAN: {item.ean}</Text>
          <Text style={styles.productDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity
            onPress={() => handleEditProduct(item)}
            style={styles.actionButton}
          >
            <Ionicons name="create-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteProduct(item)}
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.footerText}>{t('loadingMore')}</Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="cube-outline" size={80} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>{t('noProducts')}</Text>
      <Text style={styles.emptySubtitle}>{t('uploadFirst')}</Text>
      <Text style={styles.csvFormatHint}>{t('csvFormat')}</Text>
    </View>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder={t('searchProducts')}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.buttonDisabled]}
            onPress={handleUploadCSV}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>{t('uploadCSV')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={handleAddProduct}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item._id || item.code}
        contentContainerStyle={[
          styles.listContent,
          products.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />

      <ProductFormModal
        visible={modalVisible}
        product={editingProduct}
        onClose={() => {
          setModalVisible(false);
          setEditingProduct(null);
        }}
        onSuccess={handleModalSuccess}
      />
    </View>
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
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  productEan: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  csvFormatHint: {
    fontSize: 12,
    color: '#C7C7CC',
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
