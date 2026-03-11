from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Helper function to serialize ObjectId
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

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
    status: str = "open"  # open or closed
    created_at: datetime = Field(default_factory=datetime.utcnow)

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
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CountedItemUpdate(BaseModel):
    product_code: Optional[str] = None
    quantity: Optional[int] = None
    lot: Optional[str] = None
    expiry_date: Optional[str] = None

class Product(BaseModel):
    id: Optional[str] = None
    code: str
    ean: str
    description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ProductCreate(BaseModel):
    code: str
    ean: str
    description: str

# Store Configuration Endpoints
@api_router.post("/store/config")
async def save_store_config(config: StoreConfig):
    config_dict = config.dict()
    # Upsert - update if exists, insert if not
    result = await db.store_config.update_one(
        {},
        {"$set": config_dict},
        upsert=True
    )
    return {"success": True, "message": "Store configuration saved"}

@api_router.get("/store/config")
async def get_store_config():
    config = await db.store_config.find_one()
    if not config:
        return None
    return serialize_doc(config)

# Inventory Endpoints
@api_router.get("/inventories")
async def get_inventories():
    # Use aggregation pipeline to avoid N+1 query problem
    pipeline = [
        {
            "$lookup": {
                "from": "counted_items",
                "let": {"inv_id": {"$toString": "$_id"}},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$inventory_id", "$$inv_id"]}}}
                ],
                "as": "items"
            }
        },
        {
            "$addFields": {
                "item_count": {"$size": "$items"}
            }
        },
        {
            "$project": {
                "items": 0
            }
        },
        {
            "$sort": {"created_at": -1}
        }
    ]
    
    inventories = await db.inventories.aggregate(pipeline).to_list(1000)
    for inv in inventories:
        serialize_doc(inv)
    return inventories

@api_router.post("/inventories")
async def create_inventory(inventory: InventoryCreate):
    inventory_dict = inventory.dict()
    inventory_dict["status"] = "open"
    inventory_dict["created_at"] = datetime.utcnow()
    result = await db.inventories.insert_one(inventory_dict)
    inventory_dict["_id"] = str(result.inserted_id)
    return serialize_doc(inventory_dict)

@api_router.get("/inventories/{inventory_id}")
async def get_inventory(inventory_id: str):
    try:
        inventory = await db.inventories.find_one({"_id": ObjectId(inventory_id)})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")
        return serialize_doc(inventory)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/inventories/{inventory_id}/close")
async def close_inventory(inventory_id: str):
    try:
        result = await db.inventories.update_one(
            {"_id": ObjectId(inventory_id)},
            {"$set": {"status": "closed"}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Inventory not found")
        return {"success": True, "message": "Inventory closed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Counted Items Endpoints
@api_router.get("/inventories/{inventory_id}/items")
async def get_counted_items(inventory_id: str):
    items = await db.counted_items.find({"inventory_id": inventory_id}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(item) for item in items]

@api_router.post("/inventories/{inventory_id}/items")
async def add_counted_item(inventory_id: str, item: CountedItemCreate):
    # Check if inventory exists and is open
    try:
        inventory = await db.inventories.find_one({"_id": ObjectId(inventory_id)})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")
        if inventory.get("status") == "closed":
            raise HTTPException(status_code=400, detail="Cannot add items to closed inventory")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    item_dict = item.dict()
    item_dict["inventory_id"] = inventory_id
    item_dict["created_at"] = datetime.utcnow()
    result = await db.counted_items.insert_one(item_dict)
    item_dict["_id"] = str(result.inserted_id)
    return serialize_doc(item_dict)

@api_router.put("/inventories/{inventory_id}/items/{item_id}")
async def update_counted_item(inventory_id: str, item_id: str, item: CountedItemUpdate):
    try:
        update_data = {k: v for k, v in item.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No data to update")
        
        result = await db.counted_items.update_one(
            {"_id": ObjectId(item_id), "inventory_id": inventory_id},
            {"$set": update_data}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        updated_item = await db.counted_items.find_one({"_id": ObjectId(item_id)})
        return serialize_doc(updated_item)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.delete("/inventories/{inventory_id}/items/{item_id}")
async def delete_counted_item(inventory_id: str, item_id: str):
    try:
        result = await db.counted_items.delete_one(
            {"_id": ObjectId(item_id), "inventory_id": inventory_id}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"success": True, "message": "Item deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/inventories/{inventory_id}/export")
async def get_export_data(inventory_id: str):
    try:
        # Get store config
        store = await db.store_config.find_one()
        
        # Get inventory
        inventory = await db.inventories.find_one({"_id": ObjectId(inventory_id)})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")
        
        # Get counted items
        items = await db.counted_items.find({"inventory_id": inventory_id}).to_list(1000)
        
        return {
            "store": serialize_doc(store) if store else None,
            "inventory": serialize_doc(inventory),
            "items": [serialize_doc(item) for item in items]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Products Endpoints
@api_router.get("/products")
async def get_products(page: int = 1, limit: int = 50, search: str = None):
    skip = (page - 1) * limit
    
    # Build search query
    query = {}
    if search:
        query = {
            "$or": [
                {"code": {"$regex": search, "$options": "i"}},
                {"ean": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
        }
    
    # Get total count
    total = await db.products.count_documents(query)
    
    # Get paginated products
    products = await db.products.find(query).sort("code", 1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "products": [serialize_doc(product) for product in products],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@api_router.get("/products/search")
async def search_product(query: str):
    # Search by code or ean
    product = await db.products.find_one({
        "$or": [
            {"code": query},
            {"ean": query}
        ]
    })
    if not product:
        return None
    return serialize_doc(product)

@api_router.post("/products")
async def create_product(product: ProductCreate):
    # Check if product already exists
    existing = await db.products.find_one({
        "$or": [
            {"code": product.code},
            {"ean": product.ean}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Product with this code or EAN already exists")
    
    product_dict = product.dict()
    product_dict["created_at"] = datetime.utcnow()
    result = await db.products.insert_one(product_dict)
    product_dict["_id"] = str(result.inserted_id)
    return serialize_doc(product_dict)

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate):
    try:
        # Check if another product has the same code or ean
        existing = await db.products.find_one({
            "_id": {"$ne": ObjectId(product_id)},
            "$or": [
                {"code": product.code},
                {"ean": product.ean}
            ]
        })
        if existing:
            raise HTTPException(status_code=400, detail="Another product with this code or EAN already exists")
        
        result = await db.products.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": product.dict()}
        )
        if result.modified_count == 0:
            # Check if product exists
            product_doc = await db.products.find_one({"_id": ObjectId(product_id)})
            if not product_doc:
                raise HTTPException(status_code=404, detail="Product not found")
        
        updated_product = await db.products.find_one({"_id": ObjectId(product_id)})
        return serialize_doc(updated_product)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/products/upload")
async def upload_products_csv(file_content: str, clear_existing: bool = True):
    try:
        import csv
        import io
        
        # Clear existing products if requested
        if clear_existing:
            await db.products.delete_many({})
        
        # Parse CSV
        csv_file = io.StringIO(file_content)
        reader = csv.DictReader(csv_file)
        
        products_added = 0
        products_updated = 0
        errors = []
        
        for row in reader:
            try:
                # Get fields (handle different column names)
                code = row.get('Código Produto') or row.get('Codigo Produto') or row.get('code') or row.get('Code')
                ean = row.get('EAN') or row.get('ean')
                description = row.get('Descrição') or row.get('Descricao') or row.get('description') or row.get('Description')
                
                if not code or not ean or not description:
                    errors.append(f"Missing fields in row: {row}")
                    continue
                
                # Check if product exists (only if not clearing)
                if not clear_existing:
                    existing = await db.products.find_one({
                        "$or": [
                            {"code": code},
                            {"ean": ean}
                        ]
                    })
                    
                    if existing:
                        # Update existing product
                        await db.products.update_one(
                            {"_id": existing["_id"]},
                            {"$set": {
                                "code": code,
                                "ean": ean,
                                "description": description
                            }}
                        )
                        products_updated += 1
                        continue
                
                # Insert new product
                await db.products.insert_one({
                    "code": code,
                    "ean": ean,
                    "description": description,
                    "created_at": datetime.utcnow()
                })
                products_added += 1
                    
            except Exception as e:
                errors.append(f"Error processing row {row}: {str(e)}")
        
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
    try:
        result = await db.products.delete_one({"_id": ObjectId(product_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"success": True, "message": "Product deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
