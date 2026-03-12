import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import XLSX from 'xlsx';
import { ExportData } from '../services/api';

export const shareExcelReport = async (data: ExportData): Promise<void> => {
  // 1. Organizar os dados para o Excel (Array de Objetos ou Array de Arrays)
  // Vamos criar uma aba para os itens do inventário
  const rows = data.items.map(item => ({
    'Código': item.product_code,
    'EAN': item.ean,
    'Descrição': item.description,
    'Quantidade': item.quantity,
    'Lote': item.lot,
    'Validade': item.expiry_date
  }));

  // 2. Criar a planilha (Worksheet)
  const worksheet = XLSX.utils.json_to_sheet(rows);
  
  // 3. Criar o livro (Workbook) e adicionar a planilha
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Itens");

  // 4. Gerar o arquivo binário (em formato base64 para o Mobile)
  const excelBase64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  const fileName = `inventario_${data.inventory.description.replace(/\s/g, '_')}.xlsx`;

  if (Platform.OS === 'web') {
    // Lógica para Web (Gera o download automático)
    XLSX.writeFile(workbook, fileName);
    return;
  }

  // 5. Salvar e compartilhar no Mobile
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  try {
    // No mobile, escrevemos como 'base64'
    await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
      encoding: 'base64',
    });

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Compartilhar Relatório Excel',
    });
  } catch (error) {
    console.error("Erro ao exportar Excel:", error);
  }
};
