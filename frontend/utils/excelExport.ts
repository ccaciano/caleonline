import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { ExportData } from '../services/api';

// Função para converter AAAA-MM-DD para DD/MM/AAAA
const convertFromISO = (isoStr: string): string => {
  if (!isoStr) return '';
  const [year, month, day] = isoStr.split('-');
  return `${day}/${month}/${year}`;
};

// Função auxiliar para criar o workbook
const createWorkbook = (data: ExportData): XLSX.WorkBook => {
  const wb = XLSX.utils.book_new();

  // Prepare Store Info Data
  const storeInfo = data.store ? [
    ['CONFIGURAÇÃO DA LOJA'],
    ['Código da Loja', data.store.store_id],
    ['Nome da Loja', data.store.store_name],
    ['E-mail', data.store.email],
    ['Celular do Gerente', data.store.manager_phone],
    ['Nome do Gerente', data.store.manager_name],
    [],
    ['INFORMAÇÕES DO INVENTÁRIO'],
    ['Descrição', data.inventory.description],
    ['Data', convertFromISO(data.inventory.date)],
    ['Status', data.inventory.status === 'open' ? 'Aberto' : 'Fechado'],
    ['Total de Itens', data.items.length.toString()],
    [],
  ] : [
    ['INFORMAÇÕES DO INVENTÁRIO'],
    ['Descrição', data.inventory.description],
    ['Data', convertFromISO(data.inventory.date)],
    ['Status', data.inventory.status === 'open' ? 'Aberto' : 'Fechado'],
    ['Total de Itens', data.items.length.toString()],
    [],
  ];

  // Prepare Items Data
  const itemsHeader = [['Código do Produto', 'EAN', 'Descrição', 'Quantidade', 'Lote', 'Validade']];
  const itemsData = data.items.map(item => [
    item.product_code,
    item.ean || '',
    item.description || '',
    item.quantity.toString(),
    item.lot || '',
    convertFromISO(item.expiry_date)
  ]);

  // Combine all data
  const sheetData = [...storeInfo, ...itemsHeader, ...itemsData];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 35 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Inventário');
  return wb;
};

// Função para gerar nome do arquivo
const generateFileName = (description: string): string => {
  const sanitizedDescription = description.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `inventario_${sanitizedDescription}_${timestamp}.xlsx`;
};

// Download para Web
const downloadForWeb = (data: ExportData): void => {
  const wb = createWorkbook(data);
  const fileName = generateFileName(data.inventory.description);
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  
  const blob = new Blob([wbout], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
};

// Compartilhar arquivo no mobile (abre menu do sistema: WhatsApp, Email, etc.)
export const shareExcelReport = async (data: ExportData): Promise<void> => {
  if (Platform.OS === 'web') {
    downloadForWeb(data);
    return;
  }

  // Verificar se o compartilhamento está disponível
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Compartilhamento não disponível neste dispositivo');
  }

  const wb = createWorkbook(data);
  const fileName = generateFileName(data.inventory.description);
  
  // Gera o arquivo como base64
  const base64Content = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  // Usa o diretório de cache do app (sempre disponível)
  const tempDir = `${FileSystem.cacheDirectory}`;
  const fileUri = `${tempDir}${fileName}`;
  
  console.log('Criando arquivo temporário:', fileUri);

  // Escreve o arquivo
  await FileSystem.writeAsStringAsync(fileUri, base64Content, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Abre o menu de compartilhamento do sistema
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Compartilhar Relatório de Inventário',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
};

// Manter funções antigas para compatibilidade (mas não serão mais usadas)
export const generateExcelReport = async (data: ExportData): Promise<string> => {
  if (Platform.OS === 'web') {
    downloadForWeb(data);
    return 'web-download';
  }
  
  const wb = createWorkbook(data);
  const fileName = generateFileName(data.inventory.description);
  const base64Content = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  
  await FileSystem.writeAsStringAsync(fileUri, base64Content, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  return fileUri;
};

export const shareExcelFile = async (fileUri: string): Promise<void> => {
  if (Platform.OS === 'web' || fileUri === 'web-download') return;
  
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Compartilhar Relatório',
  });
};
