const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export interface StoreConfig {
  store_id: string;
  store_name: string;
  email: string;
  manager_phone: string;
  manager_name: string;
}

export interface Inventory {
  _id?: string;
  description: string;
  date: string;
  status: 'open' | 'closed';
  created_at?: string;
  item_count?: number;
}

export interface CountedItem {
  _id?: string;
  inventory_id: string;
  product_code: string;
  ean: string;
  description: string;
  quantity: number;
  lot: string;
  expiry_date: string;
  created_at?: string;
}

export interface Product {
  _id?: string;
  code: string;
  ean: string;
  description: string;
  created_at?: string;
}

export interface ExportData {
  store: StoreConfig | null;
  inventory: Inventory;
  items: CountedItem[];
}

// Store Configuration
export const saveStoreConfig = async (config: StoreConfig): Promise<any> => {
  const response = await fetch(`${API_URL}/store/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error('Failed to save store config');
  return response.json();
};

export const getStoreConfig = async (): Promise<StoreConfig | null> => {
  const response = await fetch(`${API_URL}/store/config`);
  if (!response.ok) throw new Error('Failed to get store config');
  const data = await response.json();
  return data;
};

// Inventories
export const getInventories = async (): Promise<Inventory[]> => {
  const response = await fetch(`${API_URL}/inventories`);
  if (!response.ok) throw new Error('Failed to get inventories');
  return response.json();
};

export const createInventory = async (inventory: { description: string; date: string }): Promise<Inventory> => {
  const response = await fetch(`${API_URL}/inventories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(inventory),
  });
  if (!response.ok) throw new Error('Failed to create inventory');
  return response.json();
};

export const getInventory = async (id: string): Promise<Inventory> => {
  const response = await fetch(`${API_URL}/inventories/${id}`);
  if (!response.ok) throw new Error('Failed to get inventory');
  return response.json();
};

export const closeInventory = async (id: string): Promise<any> => {
  const response = await fetch(`${API_URL}/inventories/${id}/close`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error('Failed to close inventory');
  return response.json();
};

// Counted Items
export const getCountedItems = async (inventoryId: string): Promise<CountedItem[]> => {
  const response = await fetch(`${API_URL}/inventories/${inventoryId}/items`);
  if (!response.ok) throw new Error('Failed to get counted items');
  return response.json();
};

export const addCountedItem = async (inventoryId: string, item: Omit<CountedItem, '_id' | 'inventory_id' | 'created_at'>): Promise<CountedItem> => {
  const response = await fetch(`${API_URL}/inventories/${inventoryId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error('Failed to add counted item');
  return response.json();
};

export const updateCountedItem = async (
  inventoryId: string,
  itemId: string,
  updates: Partial<Omit<CountedItem, '_id' | 'inventory_id' | 'created_at'>>
): Promise<CountedItem> => {
  const response = await fetch(`${API_URL}/inventories/${inventoryId}/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update counted item');
  return response.json();
};

export const deleteCountedItem = async (inventoryId: string, itemId: string): Promise<any> => {
  const response = await fetch(`${API_URL}/inventories/${inventoryId}/items/${itemId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete counted item');
  return response.json();
};

export const getExportData = async (inventoryId: string): Promise<ExportData> => {
  const response = await fetch(`${API_URL}/inventories/${inventoryId}/export`);
  if (!response.ok) throw new Error('Failed to get export data');
  return response.json();
};

// Products
export const getProducts = async (page: number = 1, limit: number = 50, search: string = ''): Promise<any> => {
  let url = `${API_URL}/products?page=${page}&limit=${limit}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to get products');
  return response.json();
};

export const searchProduct = async (query: string): Promise<Product | null> => {
  const response = await fetch(`${API_URL}/products/search?query=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Failed to search product');
  const data = await response.json();
  return data;
};

export const createProduct = async (product: Omit<Product, '_id' | 'created_at'>): Promise<Product> => {
  const response = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create product');
  }
  return response.json();
};

export const updateProduct = async (productId: string, product: Omit<Product, '_id' | 'created_at'>): Promise<Product> => {
  const response = await fetch(`${API_URL}/products/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update product');
  }
  return response.json();
};

export const uploadProductsCSV = async (csvContent: string, clearExisting: boolean = true): Promise<any> => {
  const response = await fetch(`${API_URL}/products/upload?clear_existing=${clearExisting}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_content: csvContent }),
  });
  if (!response.ok) throw new Error('Failed to upload CSV');
  return response.json();
};

export const deleteProduct = async (productId: string): Promise<any> => {
  const response = await fetch(`${API_URL}/products/${productId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete product');
  return response.json();
};
