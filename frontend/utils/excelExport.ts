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

// Função para escapar campos CSV (adiciona aspas se necessário)
const escapeCSV = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Se contém vírgula, aspas ou quebra de linha, envolve em aspas
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Função para gerar nome do arquivo
const generateFileName = (description: string): string => {
  const sanitizedDescription = description.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `inventario_${sanitizedDescription}_${timestamp}.csv`;
};

// Criar conteúdo CSV
const createCSVContent = (data: ExportData): string => {
  const lines: string[] = [];
  
  // Header da loja (se existir)
  if (data.store) {
    lines.push('CONFIGURAÇÃO DA LOJA');
    lines.push(`Código da Loja,${escapeCSV(data.store.store_id)}`);
    lines.push(`Nome da Loja,${escapeCSV(data.store.store_name)}`);
    lines.push(`E-mail,${escapeCSV(data.store.email)}`);
    lines.push(`Celular do Gerente,${escapeCSV(data.store.manager_phone)}`);
    lines.push(`Nome do Gerente,${escapeCSV(data.store.manager_name)}`);
    lines.push('');
  }
  
  // Info do inventário
  lines.push('INFORMAÇÕES DO INVENTÁRIO');
  lines.push(`Descrição,${escapeCSV(data.inventory.description)}`);
  lines.push(`Data,${convertFromISO(data.inventory.date)}`);
  lines.push(`Status,${data.inventory.status === 'open' ? 'Aberto' : 'Fechado'}`);
  lines.push(`Total de Itens,${data.items.length}`);
  lines.push('');
  
  // Header dos itens
  lines.push('Código do Produto,EAN,Descrição,Quantidade,Lote,Validade');
  
  // Dados dos itens
  for (const item of data.items) {
    lines.push([
      escapeCSV(item.product_code),
      escapeCSV(item.ean),
      escapeCSV(item.description),
      escapeCSV(item.quantity),
      escapeCSV(item.lot),
      convertFromISO(item.expiry_date || ''),
    ].join(','));
  }
  
  // Adiciona BOM para UTF-8 (ajuda Excel a reconhecer acentos)
  return '\uFEFF' + lines.join('\n');
};

// Download para Web
const downloadForWeb = (data: ExportData): void => {
  const csvContent = createCSVContent(data);
  const fileName = generateFileName(data.inventory.description);
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
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

// Compartilhar arquivo no mobile
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

  const csvContent = createCSVContent(data);
  const fileName = generateFileName(data.inventory.description);

  // Usa o diretório de cache do app
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  
  console.log('Criando arquivo CSV:', fileUri);

  // Escreve o arquivo como texto UTF-8 (sem precisar de base64!)
  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  console.log('Arquivo criado, abrindo compartilhamento...');

  // Abre o menu de compartilhamento do sistema
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Compartilhar Relatório de Inventário',
    UTI: 'public.comma-separated-values-text',
  });
};

// Funções de compatibilidade (não mais usadas, mas mantidas por segurança)
export const generateExcelReport = async (data: ExportData): Promise<string> => {
  if (Platform.OS === 'web') {
    downloadForWeb(data);
    return 'web-download';
  }
  
  const csvContent = createCSVContent(data);
  const fileName = generateFileName(data.inventory.description);
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  
  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  
  return fileUri;
};

export const shareExcelFile = async (fileUri: string): Promise<void> => {
  if (Platform.OS === 'web' || fileUri === 'web-download') return;
  
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Compartilhar Relatório',
  });
};
