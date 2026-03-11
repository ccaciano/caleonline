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
    
    product = next((p for p in all_products if p.get('code') == query or p.get('ean') == query), None)
    return product

@api_router.post("/products")
async def create_product(product: ProductCreate):
    with file_locks['products']:
        all_products = read_json_file(PRODUCTS_FILE, default=[])
        
        # Check for duplicates
        existing = next((p for p in all_products if p.get('code') == product.code or p.get('ean') == product.ean), None)
        if existing:
            raise HTTPException(status_code=400, detail="Product with this code or EAN already exists")
        
        new_product = {
            "_id": generate_id(),
            "code": product.code,
            "ean": product.ean,
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
        
        # Check for duplicates (excluding current product)
        existing = next((p for p in all_products if p.get('_id') != product_id and (p.get('code') == product.code or p.get('ean') == product.ean)), None)
        if existing:
            raise HTTPException(status_code=400, detail="Another product with this code or EAN already exists")
        
        target_product = next((p for p in all_products if p.get('_id') == product_id), None)
        if not target_product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        target_product['code'] = product.code
        target_product['ean'] = product.ean
        target_product['description'] = product.description
        
        write_json_file(PRODUCTS_FILE, all_products)
    
    return target_product

@api_router.post("/products/upload")
async def upload_products_csv(file_content: str, clear_existing: bool = True):
    try:
        import csv
        import io
        
        with file_locks['products']:
            if clear_existing:
                all_products = []
            else:
                all_products = read_json_file(PRODUCTS_FILE, default=[])
            
            csv_file = io.StringIO(file_content)
            reader = csv.DictReader(csv_file)
            
            products_added = 0
            products_updated = 0
            errors = []
            
            for row in reader:
                try:
                    code = row.get('Código Produto') or row.get('Codigo Produto') or row.get('code') or row.get('Code')
                    ean = row.get('EAN') or row.get('ean')
                    description = row.get('Descrição') or row.get('Descricao') or row.get('description') or row.get('Description')
                    
                    if not code or not ean or not description:
                        errors.append(f"Missing fields in row: {row}")
                        continue
                    
                    if not clear_existing:
                        existing = next((p for p in all_products if p.get('code') == code or p.get('ean') == ean), None)
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
                
                except Exception as e:
                    errors.append(f"Error processing row {row}: {str(e)}")
            
            write_json_file(PRODUCTS_FILE, all_products)
        
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
