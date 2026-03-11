import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import { updateCountedItem, CountedItem } from '../services/api';

// Função para validar data no formato DD/MM/AAAA
const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return true; // Vazio é válido (opcional)
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
  if (!dateStr) return '';
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
};

// Função para converter AAAA-MM-DD para DD/MM/AAAA
const convertFromISO = (isoStr: string): string => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return '';
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

interface EditItemModalProps {
  visible: boolean;
  item: CountedItem;
  inventoryId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditItemModal({
  visible,
  item,
  inventoryId,
  onClose,
  onSuccess,
}: EditItemModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: item.quantity.toString(),
    lot: item.lot || '',
    expiry_date: convertFromISO(item.expiry_date),
  });

  // Atualizar formData quando o item mudar
  useEffect(() => {
    setFormData({
      quantity: item.quantity.toString(),
      lot: item.lot || '',
      expiry_date: convertFromISO(item.expiry_date),
    });
  }, [item]);

  const handleSave = async () => {
    // Apenas quantidade é obrigatória
    if (!formData.quantity) {
      Alert.alert(t('fillAllFields'), 'Preencha pelo menos a quantidade');
      return;
    }

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert(t('invalidQuantity'), 'A quantidade deve ser um número maior que zero');
      return;
    }

    // Validar data apenas se preenchida
    if (formData.expiry_date && !isValidDate(formData.expiry_date)) {
      Alert.alert(t('invalidDate'), 'Use o formato DD/MM/AAAA');
      return;
    }

    try {
      setLoading(true);
      await updateCountedItem(inventoryId, item._id!, {
        quantity,
        lot: formData.lot || '',
        expiry_date: formData.expiry_date ? convertToISO(formData.expiry_date) : '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Erro', 'Falha ao atualizar item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.5}
      style={styles.modal}
    >
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('editItem')}</Text>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={28} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Read-only fields */}
        <View style={styles.readOnlySection}>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>{t('productCode')}</Text>
            <Text style={styles.readOnlyValue}>{item.product_code}</Text>
          </View>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>{t('ean')}</Text>
            <Text style={styles.readOnlyValue}>{item.ean}</Text>
          </View>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>{t('description')}</Text>
            <Text style={styles.readOnlyValue}>{item.description}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Editable fields */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('quantity')} *</Text>
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
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('lot')} (opcional)</Text>
            <TextInput
              style={styles.input}
              value={formData.lot}
              onChangeText={(text) => setFormData({ ...formData, lot: text })}
              placeholder={t('lot')}
              placeholderTextColor="#999"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('expiryDate')} (opcional)</Text>
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
              editable={!loading}
            />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{t('save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  readOnlySection: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  readOnlyField: {
    gap: 4,
  },
  readOnlyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  readOnlyValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    minHeight: 52,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
