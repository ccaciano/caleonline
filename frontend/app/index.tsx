import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getInventories, getExportData, deleteInventory, Inventory } from '../services/api';
import Modal from 'react-native-modal';
import CreateInventoryModal from '../components/CreateInventoryModal';
import { generateExcelReport, shareExcelFile } from '../utils/excelExport';

// Função para converter AAAA-MM-DD para DD/MM/AAAA
const convertFromISO = (isoStr: string): string => {
  if (!isoStr) return '';
  const [year, month, day] = isoStr.split('-');
  return `${day}/${month}/${year}`;
};

export default function InventoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadInventories();
  }, []);

  const loadInventories = async () => {
    try {
      setLoading(true);
      const data = await getInventories();
      setInventories(data);
    } catch (error) {
      console.error('Error loading inventories:', error);
      Alert.alert('Erro', 'Falha ao carregar inventários');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInventories();
    setRefreshing(false);
  };

  const handleInventoryPress = (inventory: Inventory) => {
    router.push({
      pathname: '/counting/[id]',
      params: { id: inventory._id || '' },
    });
  };

  const handleCreateSuccess = () => {
    setModalVisible(false);
    loadInventories();
  };

  const handleDownload = async (inventory: Inventory) => {
    if (!inventory._id) return;
    
    try {
      setExportingId(inventory._id);
      const exportData = await getExportData(inventory._id);
      const fileUri = await generateExcelReport(exportData);
      await shareExcelFile(fileUri);
      Alert.alert('Sucesso', 'Relatório baixado com sucesso!');
    } catch (error) {
      console.error('Error downloading report:', error);
      Alert.alert('Erro', 'Falha ao baixar relatório');
    } finally {
      setExportingId(null);
    }
  };

  const handleDeleteInventory = async (inventory: Inventory) => {
    if (!inventory._id) return;

    const confirmMessage = t('confirmDeleteInventory');
    
    // Usar confirmação específica da plataforma
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        await performDelete(inventory._id);
      }
    } else {
      Alert.alert(
        t('deleteInventory'),
        confirmMessage,
        [
          { text: t('cancel'), style: 'cancel' },
          { 
            text: t('yes'), 
            style: 'destructive',
            onPress: () => performDelete(inventory._id!)
          },
        ]
      );
    }
  };

  const performDelete = async (inventoryId: string) => {
    try {
      setDeletingId(inventoryId);
      await deleteInventory(inventoryId);
      
      if (Platform.OS === 'web') {
        window.alert(t('inventoryDeleted'));
      } else {
        Alert.alert('Sucesso', t('inventoryDeleted'));
      }
      
      loadInventories();
    } catch (error) {
      console.error('Error deleting inventory:', error);
      const errorMsg = 'Falha ao excluir inventário';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Erro', errorMsg);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const renderInventoryItem = ({ item }: { item: Inventory }) => {
    const isClosed = item.status === 'closed';
    const isExporting = exportingId === item._id;
    const isDeleting = deletingId === item._id;

    return (
      <View style={styles.inventoryCard}>
        <TouchableOpacity
          onPress={() => handleInventoryPress(item)}
          activeOpacity={0.7}
          disabled={isExporting || isDeleting}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Ionicons
                name={isClosed ? 'folder' : 'folder-open'}
                size={24}
                color={isClosed ? '#8E8E93' : '#34C759'}
              />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.description}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                isClosed ? styles.statusClosed : styles.statusOpen,
              ]}
            >
              <Text style={styles.statusText}>
                {isClosed ? t('closed') : t('open')}
              </Text>
            </View>
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
              <Text style={styles.infoText}>{convertFromISO(item.date)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="cube-outline" size={16} color="#8E8E93" />
              <Text style={styles.infoText}>
                {item.item_count || 0} {t('items')}
              </Text>
            </View>
          </View>

          {!isClosed && (
            <View style={styles.cardFooter}>
              <Ionicons name="chevron-forward" size={20} color="#007AFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Actions for closed inventories */}
        {isClosed && (
          <View style={styles.exportActions}>
            <TouchableOpacity
              style={[styles.exportButton, styles.downloadButton]}
              onPress={() => handleDownload(item)}
              disabled={isExporting || isDeleting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#007AFF" />
                  <Text style={styles.downloadButtonText}>Baixar Excel</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportButton, styles.deleteButton]}
              onPress={() => handleDeleteInventory(item)}
              disabled={isExporting || isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  <Text style={styles.deleteButtonText}>{t('deleteInventory')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Delete button for open inventories - positioned at bottom right */}
        {!isClosed && (
          <View style={styles.openInventoryActions}>
            <TouchableOpacity
              style={[styles.deleteButtonSmall]}
              onPress={() => handleDeleteInventory(item)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="folder-open-outline" size={80} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>{t('noInventories')}</Text>
      <Text style={styles.emptySubtitle}>{t('createFirst')}</Text>
    </View>
  );

  if (loading && inventories.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={inventories}
        renderItem={renderInventoryItem}
        keyExtractor={(item) => item._id || ''}
        contentContainerStyle={[
          styles.listContent,
          inventories.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      <CreateInventoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleCreateSuccess}
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inventoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusOpen: {
    backgroundColor: '#E8F5E9',
  },
  statusClosed: {
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  cardInfo: {
    gap: 8,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  cardFooter: {
    alignItems: 'flex-end',
  },
  exportActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
  },
  downloadButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  openInventoryActions: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  deleteButtonSmall: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFF0F0',
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
