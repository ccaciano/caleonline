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
    { wch: 20 }, // Código do Produto
    { wch: 15 }, // EAN
    { wch: 35 }, // Descrição
    { wch: 12 }, // Quantidade
    { wch: 15 }, // Lote
    { wch: 12 }, // Validade
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Inventário');
  return wb;
};

// Função para gerar nome do arquivo
const generateFileName = (description: string): string => {
  const sanitizedDescription = description.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `inventario_${sanitizedDescription}_${timestamp}.xlsx`;
};

// Download para Web usando Blob
const downloadForWeb = (data: ExportData): void => {
  const wb = createWorkbook(data);
  const fileName = generateFileName(data.inventory.description);
  
  // Gera o arquivo como array buffer
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  
  // Cria um Blob
  const blob = new Blob([wbout], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 100);
  }
};

// Download para dispositivos nativos - SIMPLIFICADO
const downloadForNative = async (data: ExportData): Promise<string> => {
  const wb = createWorkbook(data);
  const fileName = generateFileName(data.inventory.description);
  
  // Gera base64 string
  const base64Content = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  // Usa sempre o cacheDirectory que é garantido estar disponível
  const cacheDir = FileSystem.cacheDirectory;
  
  if (!cacheDir) {
    throw new Error('Diretório de cache não disponível');
  }

  const fileUri = cacheDir + fileName;
  
  console.log('Salvando arquivo em:', fileUri);

  // Escreve o arquivo usando encoding direto como string
  await FileSystem.writeAsStringAsync(fileUri, base64Content, {
    encoding: 'base64',
  });

  // Verifica se o arquivo foi criado
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  console.log('Arquivo criado:', fileInfo);
  
  if (!fileInfo.exists) {
    throw new Error('Falha ao criar arquivo');
  }

  return fileUri;
};

export const generateExcelReport = async (data: ExportData): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      downloadForWeb(data);
      return 'web-download';
    } else {
      return await downloadForNative(data);
    }
  } catch (error) {
    console.error('Error generating Excel report:', error);
    throw error;
  }
};

export const shareExcelFile = async (fileUri: string): Promise<void> => {
  try {
    // Na web, o download já foi feito automaticamente
    if (Platform.OS === 'web' || fileUri === 'web-download') {
      return;
    }
    
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Salvar Relatório de Inventário',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
    } else {
      throw new Error('Compartilhamento não disponível neste dispositivo');
    }
  } catch (error) {
    console.error('Error sharing file:', error);
    throw error;
  }
};
