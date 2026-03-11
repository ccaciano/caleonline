import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Alert, Linking } from 'react-native';
import { ExportData } from '../services/api';

// Função para converter AAAA-MM-DD para DD/MM/AAAA
const convertFromISO = (isoStr: string): string => {
  if (!isoStr) return '';
  const [year, month, day] = isoStr.split('-');
  return `${day}/${month}/${year}`;
};

// Função auxiliar para criar o workbook
const createWorkbook = (data: ExportData): XLSX.WorkBook => {
  // Create workbook
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

  // Prepare Items Data with ALL fields
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

  // Set column widths for better readability
  ws['!cols'] = [
    { wch: 20 }, // Código do Produto
    { wch: 15 }, // EAN
    { wch: 35 }, // Descrição
    { wch: 12 }, // Quantidade
    { wch: 15 }, // Lote
    { wch: 12 }, // Validade
  ];

  // Add worksheet to workbook
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
  
  // Verifica se estamos em um ambiente de navegador real
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
    // Cria URL temporária e faz download
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Cleanup after a small delay
    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 100);
  } else {
    // Fallback: Usa window.open para download
    const url = URL.createObjectURL(blob);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } else {
      throw new Error('Download not supported in this environment');
    }
  }
};

// Solicitar permissão de diretório usando SAF (Storage Access Framework)
const requestDirectoryPermission = async (): Promise<FileSystem.FileSystemUploadResult | null> => {
  try {
    // Usa o SAF para permitir que o usuário selecione um diretório
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    
    if (permissions.granted) {
      return permissions;
    }
    return null;
  } catch (error) {
    console.error('Erro ao solicitar permissão de diretório:', error);
    return null;
  }
};

// Salvar arquivo usando SAF (Storage Access Framework) - permite salvar em qualquer pasta
const saveWithSAF = async (base64Content: string, fileName: string): Promise<string> => {
  try {
    console.log('Solicitando permissão para selecionar diretório...');
    
    // Solicita permissão do usuário para acessar um diretório
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    
    if (!permissions.granted) {
      throw new Error('Permissão de acesso ao diretório negada pelo usuário');
    }

    console.log('Permissão concedida. Diretório selecionado:', permissions.directoryUri);

    // Cria o arquivo no diretório selecionado pelo usuário
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      fileName,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    console.log('Arquivo criado:', fileUri);

    // Escreve o conteúdo no arquivo
    await FileSystem.writeAsStringAsync(fileUri, base64Content, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('Conteúdo escrito com sucesso!');
    
    return fileUri;
  } catch (error: any) {
    console.error('Erro ao salvar com SAF:', error);
    throw error;
  }
};

// Salvar no cache e compartilhar (fallback)
const saveAndShare = async (base64Content: string, fileName: string): Promise<string> => {
  // Salva no cache directory primeiro
  const cacheUri = FileSystem.cacheDirectory + fileName;
  
  await FileSystem.writeAsStringAsync(cacheUri, base64Content, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  // Verifica se o compartilhamento está disponível
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(cacheUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Salvar Relatório de Inventário',
    });
  }
  
  return cacheUri;
};

// Download para dispositivos nativos (iOS/Android)
const downloadForNative = async (data: ExportData): Promise<string> => {
  const wb = createWorkbook(data);
  const fileName = generateFileName(data.inventory.description);
  
  // Generate base64 string
  const base64Content = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  if (Platform.OS === 'android') {
    // No Android, usa o Storage Access Framework para permitir escolha do diretório
    try {
      const fileUri = await saveWithSAF(base64Content, fileName);
      return fileUri;
    } catch (error: any) {
      console.error('Erro SAF:', error);
      
      // Se o usuário cancelou ou houve erro, oferece alternativa de compartilhamento
      if (error.message?.includes('negada') || error.message?.includes('cancelled')) {
        throw new Error('Exportação cancelada. Selecione um diretório para salvar o arquivo.');
      }
      
      // Tenta fallback para compartilhamento
      console.log('Tentando fallback de compartilhamento...');
      return await saveAndShare(base64Content, fileName);
    }
  } else {
    // No iOS, usa documentDirectory normalmente
    const baseDir = FileSystem.documentDirectory;
    
    if (!baseDir) {
      throw new Error('Diretório de armazenamento não disponível');
    }

    const fileUri = baseDir + fileName;

    await FileSystem.writeAsStringAsync(fileUri, base64Content, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  }
};

export const generateExcelReport = async (data: ExportData): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      // Para web, faz download direto
      downloadForWeb(data);
      return 'web-download';
    } else {
      // Para mobile, salva o arquivo usando SAF ou compartilhamento
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
    
    // Se já foi salvo via SAF, não precisa compartilhar novamente
    if (fileUri.startsWith('content://')) {
      console.log('Arquivo já foi salvo no diretório selecionado pelo usuário');
      return;
    }
    
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Compartilhar Relatório de Inventário',
      });
    } else {
      throw new Error('Compartilhamento não está disponível neste dispositivo');
    }
  } catch (error) {
    console.error('Error sharing file:', error);
    throw error;
  }
};

// Função auxiliar para verificar se temos acesso a um diretório persistido
export const checkStoragePermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  
  try {
    // Verifica se temos permissões persistidas
    const permissions = await FileSystem.StorageAccessFramework.readDirectoryAsync(
      FileSystem.documentDirectory || ''
    ).catch(() => null);
    
    return permissions !== null;
  } catch {
    return false;
  }
};
