import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  pt: {
    translation: {
      // Tabs
      storeConfig: 'Config. Loja',
      inventories: 'Inventários',
      products: 'Base de Produtos',
      
      // Store Config Screen
      storeConfigTitle: 'Configuração da Loja',
      storeId: 'Código da Loja',
      storeName: 'Nome da Loja',
      email: 'E-mail',
      managerPhone: 'Celular do Gerente',
      managerName: 'Nome do Gerente',
      saveConfig: 'Salvar Configuração',
      configSaved: 'Configuração salva com sucesso!',
      fillAllFields: 'Por favor, preencha todos os campos',
      
      // Inventories Screen
      inventoriesTitle: 'Sessões de Inventário',
      createInventory: 'Criar Novo Inventário',
      noInventories: 'Nenhum inventário ainda',
      createFirst: 'Crie seu primeiro inventário para começar a contagem',
      items: 'itens',
      open: 'Aberto',
      closed: 'Fechado',
      
      // Create Inventory Modal
      newInventory: 'Novo Inventário',
      description: 'Descrição',
      date: 'Data',
      create: 'Criar',
      cancel: 'Cancelar',
      
      // Products Screen
      productsTitle: 'Base de Cadastro de Produtos',
      uploadCSV: 'Importar CSV',
      noProducts: 'Nenhum produto cadastrado',
      uploadFirst: 'Faça upload de um arquivo CSV para começar',
      selectCSVFile: 'Selecionar Arquivo CSV',
      uploadSuccess: 'Produtos importados com sucesso!',
      productsAdded: 'produtos adicionados',
      productsUpdated: 'produtos atualizados',
      uploadError: 'Erro ao fazer upload do CSV',
      deleteProduct: 'Excluir Produto',
      confirmDeleteProduct: 'Tem certeza que deseja excluir este produto?',
      productDeleted: 'Produto excluído com sucesso',
      csvFormat: 'Formato CSV: Código Produto, EAN, Descrição',
      csvWillReplace: 'ATENÇÃO: O upload irá SOBRESCREVER todos os produtos existentes!',
      searchProducts: 'Pesquisar produtos...',
      editProduct: 'Editar Produto',
      updateProduct: 'Atualizar Produto',
      productUpdated: 'Produto atualizado com sucesso!',
      loadingMore: 'Carregando mais...',
      
      // Counting Screen
      countingTitle: 'Contagem de Itens',
      scanBarcode: 'Escanear Código',
      search: 'Pesquisar',
      searchPlaceholder: 'Digite o Código ou EAN',
      productCode: 'Código do Produto',
      ean: 'EAN',
      quantity: 'Quantidade',
      lot: 'Lote',
      expiryDate: 'Validade',
      addItem: 'Adicionar Item',
      countedItems: 'Itens Contados',
      noItems: 'Nenhum item contado ainda',
      startScanning: 'Escaneie ou adicione itens para começar',
      edit: 'Editar',
      delete: 'Excluir',
      confirmDelete: 'Tem certeza que deseja excluir este item?',
      yes: 'Sim',
      no: 'Não',
      productNotFound: 'Produto não encontrado',
      productNotFoundMessage: 'Produto não encontrado na base de dados. Deseja cadastrar?',
      registerProduct: 'Cadastrar Produto',
      searching: 'Buscando...',
      
      // Export Screen
      exportTitle: 'Exportar Relatório',
      exportAndClose: 'Exportar e Fechar Inventário',
      download: 'Baixar Excel',
      sendEmail: 'Enviar por E-mail',
      totalItems: 'Total de Itens',
      inventoryClosed: 'Este inventário está fechado',
      exportSuccess: 'Relatório exportado com sucesso!',
      exportError: 'Erro ao exportar relatório',
      
      // Edit Item Modal
      editItem: 'Editar Item',
      save: 'Salvar',
      
      // Add Product Modal
      newProduct: 'Novo Produto',
      addProduct: 'Adicionar Produto',
      productAdded: 'Produto cadastrado com sucesso!',
      
      // Scanner
      scannerTitle: 'Escanear Código de Barras/QR',
      scannerInstructions: 'Aponte a câmera para o código de barras ou QR',
      cameraPermission: 'Permissão de câmera necessária',
      grantPermission: 'Conceder Permissão',
      
      // Validation
      invalidDate: 'Formato de data inválido',
      invalidQuantity: 'Quantidade deve ser maior que 0',
      productExists: 'Produto com este código ou EAN já existe',
    }
  }
};

// Initialize i18n with Portuguese only
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
