import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import XLSX from 'xlsx';
import { ExportData } from '../services/api';

// Função para converter AAAA-MM-DD para DD/MM/AAAA
const formatDate = (isoStr: string | undefined): string => {
  if (!isoStr) return '';
  const [year, month, day] = isoStr.split('-');
  return `${day}/${month}/${year}`;
};

export const shareExcelReport = async (data: ExportData): Promise<void> => {
  // 1. Criar array com todas as linhas do relatório
  const rows: any[][] = [];

  // Seção: Configuração da Loja
  rows.push(['CONFIGURAÇÃO DA LOJA']);
  rows.push(['Código da Loja', data.store?.store_id || '']);
  rows.push(['Nome da Loja', data.store?.store_name || '']);
  rows.push(['E-mail', data.store?.email || '']);
  rows.push(['Celular do Gerente', data.store?.manager_phone || '']);
  rows.push(['Nome do Gerente', data.store?.manager_name || '']);
  rows.push([]); // Linha em branco

  // Seção: Informações do Inventário
  rows.push(['INFORMAÇÕES DO INVENTÁRIO']);
  rows.push(['Descrição', data.inventory.description]);
  rows.push(['Data', formatDate(data.inventory.date)]);
  rows.push(['Status', data.inventory.status === 'open' ? 'Aberto' : 'Fechado']);
  rows.push(['Total de Itens', data.items.length]);
  rows.push([]); // Linha em branco

  // Seção: Cabeçalho dos Itens
  rows.push(['Código do Produto', 'EAN', 'Descrição', 'Quantidade', 'Lote', 'Validade']);

  // Seção: Dados dos Itens
  data.items.forEach(item => {
    rows.push([
      item.product_code || '',
      item.ean || '',
      item.description || '',
      item.quantity,
      item.lot || '',
      formatDate(item.expiry_date)
    ]);
  });

  // 2. Criar a planilha a partir do array
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Definir largura das colunas
  worksheet['!cols'] = [
    { wch: 25 }, // Coluna A
    { wch: 20 }, // Coluna B
    { wch: 40 }, // Coluna C
    { wch: 12 }, // Coluna D
    { wch: 15 }, // Coluna E
    { wch: 12 }, // Coluna F
  ];

  // 3. Criar o livro e adicionar a planilha
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventário');

  // 4. Gerar o arquivo em base64
  const excelBase64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  // Nome do arquivo
  const sanitizedName = data.inventory.description.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const fileName = `inventario_${sanitizedName}_${dateStr}.xlsx`;

  if (Platform.OS === 'web') {
    // Web: Download automático
    XLSX.writeFile(workbook, fileName);
    return;
  }

  // 5. Mobile: Salvar e compartilhar
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  try {
    await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
      encoding: 'base64',
    });

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Compartilhar Relatório de Inventário',
    });
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
    throw error;
  }
};
