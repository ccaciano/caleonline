from fastapi import FastAPI, APIRouter, HTTPException
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import json
import os
import uuid
from pathlib import Path
import logging
from threading import Lock

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / 'data'
DATA_DIR.mkdir(exist_ok=True)

# File paths
STORE_CONFIG_FILE = DATA_DIR / 'store_config.json'
INVENTORIES_FILE = DATA_DIR / 'inventories.json'
COUNTED_ITEMS_FILE = DATA_DIR / 'counted_items.json'
PRODUCTS_FILE = DATA_DIR / 'products.json'

# Thread locks for file operations
file_locks = {
    'store': Lock(),
    'inventories': Lock(),
    'items': Lock(),
    'products': Lock()
}

# Helper functions for JSON file operations
def read_json_file(file_path: Path, default=None):
    if not file_path.exists():
        return default if default is not None else []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return default if default is not None else []

def write_json_file(file_path: Path, data):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)

def generate_id():
    return str(uuid.uuid4())

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class StoreConfig(BaseModel):
    store_id: str
    store_name: str
    email: str
    manager_phone: str
    manager_name: str

class InventoryCreate(BaseModel):
    description: str
    date: str

class Inventory(BaseModel):
    id: Optional[str] = None
    description: str
    date: str
    status: str = "open"
    created_at: Optional[str] = None

class CountedItemCreate(BaseModel):
    product_code: str
    ean: str
    description: str
    quantity: int
    lot: str
    expiry_date: str

class CountedItem(BaseModel):
    id: Optional[str] = None
    inventory_id: str
    product_code: str
    ean: str
    description: str
    quantity: int
    lot: str
    expiry_date: str
    created_at: Optional[str] = None

class CountedItemUpdate(BaseModel):
    product_code: Optional[str] = None
    ean: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    lot: Optional[str] = None
    expiry_date: Optional[str] = None

class Product(BaseModel):
    id: Optional[str] = None
    code: str
    ean: str
    description: str
    created_at: Optional[str] = None

class ProductCreate(BaseModel):
    code: str
    ean: str
    description: str

class CSVUpload(BaseModel):
    file_content: str

# Store Configuration Endpoints
@api_router.post("/store/config")
async def save_store_config(config: StoreConfig):
    with file_locks['store']:
        write_json_file(STORE_CONFIG_FILE, config.dict())
    return {"success": True, "message": "Store configuration saved"}

@api_router.get("/store/config")
async def get_store_config():
    with file_locks['store']:
        config = read_json_file(STORE_CONFIG_FILE, default=None)
    return config

# Inventory Endpoints
@api_router.get("/inventories")
async def get_inventories():
    with file_locks['inventories']:
        inventories = read_json_file(INVENTORIES_FILE, default=[])
    
    with file_locks['items']:
        all_items = read_json_file(COUNTED_ITEMS_FILE, default=[])
    
    # Add item count to each inventory
    for inv in inventories:
        inv['item_count'] = len([item for item in all_items if item.get('inventory_id') == inv.get('_id')])
    
    # Sort by created_at descending
    inventories.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return inventories

@api_router.post("/inventories")
async def create_inventory(inventory: InventoryCreate):
    new_inventory = {
        "_id": generate_id(),
        "description": inventory.description,
        "date": inventory.date,
        "status": "open",
        "created_at": datetime.utcnow().isoformat()
    }
    
    with file_locks['inventories']:
        inventories = read_json_file(INVENTORIES_FILE, default=[])
        inventories.append(new_inventory)
        write_json_file(INVENTORIES_FILE, inventories)
    
    return new_inventory

@api_router.get("/inventories/{inventory_id}")
async def get_inventory(inventory_id: str):
    with file_locks['inventories']:
        inventories = read_json_file(INVENTORIES_FILE, default=[])
    
    inventory = next((inv for inv in inventories if inv.get('_id') == inventory_id), None)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    
    return inventory

@api_router.put("/inventories/{inventory_id}/close")
async def close_inventory(inventory_id: str):
    with file_locks['inventories']:
        inventories = read_json_file(INVENTORIES_FILE, default=[])
        
        inventory = next((inv for inv in inventories if inv.get('_id') == inventory_id), None)
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")
        
        inventory['status'] = 'closed'
        write_json_file(INVENTORIES_FILE, inventories)
    
    return {"success": True, "message": "Inventory closed"}

@api_router.delete("/inventories/{inventory_id}")
async def delete_inventory(inventory_id: str):
    with file_locks['inventories']:
        inventories = read_json_file(INVENTORIES_FILE, default=[])
        
        inventory = next((inv for inv in inventories if inv.get('_id') == inventory_id), None)
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Remover o inventário da lista
        inventories = [inv for inv in inventories if inv.get('_id') != inventory_id]
        write_json_file(INVENTORIES_FILE, inventories)
    
    # Também remover todos os itens contados deste inventário
    with file_locks['items']:
        all_items = read_json_file(COUNTED_ITEMS_FILE, default=[])
        remaining_items = [item for item in all_items if item.get('inventory_id') != inventory_id]
        write_json_file(COUNTED_ITEMS_FILE, remaining_items)
    
    return {"success": True, "message": "Inventário excluído com sucesso"}

# Counted Items Endpoints
@api_router.get("/inventories/{inventory_id}/items")
async def get_counted_items(inventory_id: str):
    with file_locks['items']:
        all_items = read_json_file(COUNTED_ITEMS_FILE, default=[])
    
    items = [item for item in all_items if item.get('inventory_id') == inventory_id]
    items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return items

@api_router.post("/inventories/{inventory_id}/items")
async def add_counted_item(inventory_id: str, item: CountedItemCreate):
    # Check if inventory exists and is open
    with file_locks['inventories']:
        inventories = read_json_file(INVENTORIES_FILE, default=[])
    
    inventory = next((inv for inv in inventories if inv.get('_id') == inventory_id), None)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    if inventory.get('status') == 'closed':
        raise HTTPException(status_code=400, detail="Cannot add items to closed inventory")
    
    new_item = {
        "_id": generate_id(),
        "inventory_id": inventory_id,
        "product_code": item.product_code,
        "ean": item.ean,
        "description": item.description,
        "quantity": item.quantity,
        "lot": item.lot,
        "expiry_date": item.expiry_date,
        "created_at": datetime.utcnow().isoformat()
    }
    
    with file_locks['items']:
        all_items = read_json_file(COUNTED_ITEMS_FILE, default=[])
        all_items.append(new_item)
        write_json_file(COUNTED_ITEMS_FILE, all_items)
    
    return new_item

@api_router.put("/inventories/{inventory_id}/items/{item_id}")
async def update_counted_item(inventory_id: str, item_id: str, item: CountedItemUpdate):
    with file_locks['items']:
        all_items = read_json_file(COUNTED_ITEMS_FILE, default=[])
        
        target_item = next((i for i in all_items if i.get('_id') == item_id and i.get('inventory_id') == inventory_id), None)
        if not target_item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Update only provided fields
        update_data = item.dict(exclude_unset=True)
        target_item.update(update_data)
        
        write_json_file(COUNTED_ITEMS_FILE, all_items)
    
    return target_item

@api_router.delete("/inventories/{inventory_id}/items/{item_id}")
async def delete_counted_item(inventory_id: str, item_id: str):
    with file_locks['items']:
        all_items = read_json_file(COUNTED_ITEMS_FILE, default=[])
        
        filtered_items = [i for i in all_items if not (i.get('_id') == item_id and i.get('inventory_id') == inventory_id)]
        
        if len(filtered_items) == len(all_items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        write_json_file(COUNTED_ITEMS_FILE, filtered_items)
    
    return {"success": True, "message": "Item deleted"}

@api_router.get("/inventories/{inventory_id}/export")
async def get_export_data(inventory_id: str):
    with file_locks['store']:
        store = read_json_file(STORE_CONFIG_FILE, default=None)
    
    with file_locks['inventories']:
        inventories = read_json_file(INVENTORIES_FILE, default=[])
    
    inventory = next((inv for inv in inventories if inv.get('_id') == inventory_id), None)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    
    with file_locks['items']:
        all_items = read_json_file(COUNTED_ITEMS_FILE, default=[])
    
    items = [item for item in all_items if item.get('inventory_id') == inventory_id]
    
    return {
        "store": store,
        "inventory": inventory,
        "items": items
    }

# Products Endpoints
@api_router.get("/products")
async def get_products(page: int = 1, limit: int = 50, search: str = None):
    with file_locks['products']:
        all_products = read_json_file(PRODUCTS_FILE, default=[])
    
    # Filter by search
    if search:
        search_lower = search.lower()
        all_products = [
            p for p in all_products 
            if search_lower in p.get('code', '').lower() 
            or search_lower in p.get('ean', '').lower() 
            or search_lower in p.get('description', '').lower()
        ]
    
    # Sort by code
    all_products.sort(key=lambda x: x.get('code', ''))
    
    # Pagination
    total = len(all_products)
    start = (page - 1) * limit
    end = start + limit
    products = all_products[start:end]
    
    return {
        "products": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 0
    }

@api_router.get("/products/search")
async def search_product(query: str):
    with file_locks['products']:
        all_products = read_json_file(PRODUCTS_FILE, default=[])
    
    # Pesquisa case-insensitive
    query_lower = query.lower()
    product = next(
        (p for p in all_products 
         if p.get('code', '').lower() == query_lower 
         or p.get('ean', '').lower() == query_lower), 
        None
    )
    return product

@api_router.post("/products")
async def create_product(product: ProductCreate):
    with file_locks['products']:
        all_products = read_json_file(PRODUCTS_FILE, default=[])
        
        # Check for duplicates - apenas verificar EAN se não estiver vazio
        for p in all_products:
            if p.get('code') == product.code:
                raise HTTPException(status_code=400, detail="Já existe um produto com este Código")
            if product.ean and p.get('ean') == product.ean:
                raise HTTPException(status_code=400, detail="Já existe um produto com este EAN")
        
        new_product = {
            "_id": generate_id(),
            "code": product.code,
            "ean": product.ean or "",  # EAN pode ser vazio
            "description": product.description,
            "created_at": datetime.utcnow().isoformat()
        }
        
        all_products.append(new_product)
        write_json_file(PRODUCTS_FILE, all_products)
    
    return new_product

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate):
    with file_locks['products']:
        all_products = read_json_file(PRODUCTS_FILE, default=[])
        
        # Check for duplicates (excluding current product) - apenas verificar EAN se não estiver vazio
        for p in all_products:
            if p.get('_id') != product_id:
                if p.get('code') == product.code:
                    raise HTTPException(status_code=400, detail="Já existe outro produto com este Código")
                if product.ean and p.get('ean') == product.ean:
                    raise HTTPException(status_code=400, detail="Já existe outro produto com este EAN")
        
        target_product = next((p for p in all_products if p.get('_id') == product_id), None)
        if not target_product:
            raise HTTPException(status_code=404, detail="Produto não encontrado")
        
        target_product['code'] = product.code
        target_product['ean'] = product.ean or ""  # EAN pode ser vazio
        target_product['description'] = product.description
        
        write_json_file(PRODUCTS_FILE, all_products)
    
    return target_product

@api_router.post("/products/upload")
async def upload_products_csv(data: CSVUpload, clear_existing: bool = True):
    try:
        import csv
        import io
        
        file_content = data.file_content
        logging.info(f"CSV Upload - Content length: {len(file_content)}")
        
        # Try to detect and fix encoding issues
        # If file was read as latin-1 but contains UTF-8, try to fix it
        try:
            # First, try to encode as latin-1 and decode as utf-8 (common mistake)
            file_content_fixed = file_content.encode('latin-1').decode('utf-8')
            file_content = file_content_fixed
            logging.info("CSV Upload - Fixed encoding from latin-1 to utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            # If that fails, the content is likely already correct or needs different handling
            pass
        
        logging.info(f"CSV Upload - First 200 chars: {file_content[:200]}")
        
        with file_locks['products']:
            if clear_existing:
                all_products = []
            else:
                all_products = read_json_file(PRODUCTS_FILE, default=[])
            
            csv_file = io.StringIO(file_content)
            reader = csv.DictReader(csv_file)
            
            # Log the fieldnames detected
            fieldnames = reader.fieldnames
            logging.info(f"CSV Upload - Detected fieldnames: {fieldnames}")
            
            products_added = 0
            products_updated = 0
            errors = []
            
            for row in reader:
                try:
                    logging.info(f"CSV Upload - Processing row: {row}")
                    
                    # Normalize keys by stripping whitespace and handling encoding issues
                    normalized_row = {}
                    for key, value in row.items():
                        if key:
                            # Strip BOM and whitespace from keys
                            clean_key = key.strip().lstrip('\ufeff')
                            normalized_row[clean_key] = value.strip() if value else ''
                    
                    logging.info(f"CSV Upload - Normalized row: {normalized_row}")
                    
                    # Try multiple possible column names (including with/without accents)
                    code = None
                    ean = None
                    description = None
                    
                    # Search for code column
                    for possible_key in ['Código Produto', 'Codigo Produto', 'code', 'Code', 'Código', 'Codigo']:
                        if possible_key in normalized_row and normalized_row[possible_key]:
                            code = normalized_row[possible_key]
                            break
                    
                    # Search for EAN column (OPCIONAL)
                    for possible_key in ['EAN', 'ean', 'Ean']:
                        if possible_key in normalized_row:
                            ean = normalized_row[possible_key] or ''  # Pode ser vazio
                            break
                    
                    # Search for description column
                    for possible_key in ['Descrição', 'Descricao', 'description', 'Description', 'Desc']:
                        if possible_key in normalized_row and normalized_row[possible_key]:
                            description = normalized_row[possible_key]
                            break
                    
                    # If code or description still not found, try by column position
                    if not code or not description:
                        keys = list(normalized_row.keys())
                        values = list(normalized_row.values())
                        if len(keys) >= 2:
                            if not code and values[0]:
                                code = values[0]
                            # Se tiver 3 colunas, a do meio é EAN
                            if len(keys) >= 3:
                                if ean is None and values[1]:
                                    ean = values[1]
                                if not description and values[2]:
                                    description = values[2]
                            # Se tiver apenas 2 colunas (código e descrição)
                            elif len(keys) == 2:
                                if not description and values[1]:
                                    description = values[1]
                    
                    logging.info(f"CSV Upload - Extracted: code={code}, ean={ean}, description={description}")
                    
                    # Apenas código e descrição são obrigatórios, EAN é opcional
                    if not code or not description:
                        errors.append(f"Missing required fields (code, description) in row: {normalized_row}")
                        logging.warning(f"CSV Upload - Missing required fields in row: {normalized_row}")
                        continue
                    
                    # Garantir que ean seja string (pode ser vazio)
                    if ean is None:
                        ean = ''
                    
                    if not clear_existing:
                        existing = next((p for p in all_products if p.get('code') == code or (ean and p.get('ean') == ean)), None)
                        if existing:
                            existing['code'] = code
                            existing['ean'] = ean
                            existing['description'] = description
                            products_updated += 1
                            continue
                    
                    new_product = {
                        "_id": generate_id(),
                        "code": code,
                        "ean": ean,
                        "description": description,
                        "created_at": datetime.utcnow().isoformat()
                    }
                    all_products.append(new_product)
                    products_added += 1
                    logging.info(f"CSV Upload - Added product: {new_product}")
                
                except Exception as e:
                    errors.append(f"Error processing row {row}: {str(e)}")
                    logging.error(f"CSV Upload - Error processing row: {e}")
            
            write_json_file(PRODUCTS_FILE, all_products)
            logging.info(f"CSV Upload - Total products saved: {len(all_products)}")
        
        return {
            "success": True,
            "products_added": products_added,
            "products_updated": products_updated,
            "cleared_existing": clear_existing,
            "errors": errors if errors else None
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    with file_locks['products']:
        all_products = read_json_file(PRODUCTS_FILE, default=[])
        
        filtered_products = [p for p in all_products if p.get('_id') != product_id]
        
        if len(filtered_products) == len(all_products):
            raise HTTPException(status_code=404, detail="Product not found")
        
        write_json_file(PRODUCTS_FILE, filtered_products)
    
    return {"success": True, "message": "Product deleted"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
