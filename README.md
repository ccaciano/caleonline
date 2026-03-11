# 📦 Inventory & Stock Management App

A professional mobile inventory management application with barcode/QR scanning, multi-language support, and Excel export functionality.

## ✨ Features

### 🏪 Store Configuration
- Configure store details (ID, Name, Email, Manager info)
- Data saved both locally (AsyncStorage) and in database
- Multi-language support (Portuguese 🇧🇷 / English 🇺🇸)

### 📊 Inventory Management
- Create multiple inventory counting sessions
- Track inventory date and description
- View open and closed inventory status
- Item count tracking per inventory

### 📱 Item Counting
- **Barcode & QR Code Scanner** using device camera
- Manual input option
- Fields: Product Code, Quantity, Lot, Expiry Date
- Live preview of counted items
- Edit/Delete items before export

### 📤 Export & Email
- Generate Excel (.xlsx) reports
- Report includes:
  - Store configuration
  - Inventory details
  - Complete item list
- Download to device OR send via email
- Auto-closes inventory after export

## 🛠 Tech Stack

### Frontend
- **Expo** (React Native)
- **Expo Router** (file-based navigation)
- **TypeScript**
- **i18next** (internationalization)
- **expo-barcode-scanner** (camera scanning)
- **xlsx** (Excel generation)
- **AsyncStorage** (local data)
- **react-native-modal** (bottom sheets)

### Backend
- **FastAPI** (Python)
- **MongoDB** (database)
- **Motor** (async MongoDB driver)

## 📱 Screen Flow

```
┌─────────────────────┐
│  Store Config Tab   │ ← Configure store details
│  (index.tsx)        │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Inventories Tab    │ ← List all inventories
│  (inventories.tsx)  │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Create Inventory   │ ← Modal to create new
│  (Modal)            │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Counting Screen    │ ← Scan & count items
│  (counting/[id])    │
│                     │
│  ┌──────────────┐  │
│  │ Scan Button  │  │ ← Opens camera
│  └──────────────┘  │
│                     │
│  Manual Input Form  │
│                     │
│  Items Preview List │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Export & Email     │ ← Generate Excel
│                     │
└─────────────────────┘
```

## 🎨 Design Features

- **Mobile-First Design**: Large touch targets (48px+)
- **iOS-Style UI**: Clean, professional interface
- **Bottom Sheets**: Smooth modal interactions
- **Pull-to-Refresh**: Easy data reloading
- **Status Badges**: Visual inventory status
- **Icon Integration**: Ionicons throughout

## 🔐 Permissions

### iOS
- **Camera**: "Scan barcodes to add products"
- Configured in `app.json` → `ios.infoPlist`

### Android
- **Camera**: CAMERA permission
- Configured in `app.json` → `android.permissions`

## 📡 API Endpoints

### Store Configuration
- `POST /api/store/config` - Save store config
- `GET /api/store/config` - Get store config

### Inventories
- `GET /api/inventories` - List all inventories
- `POST /api/inventories` - Create inventory
- `GET /api/inventories/{id}` - Get inventory
- `PUT /api/inventories/{id}/close` - Close inventory

### Counted Items
- `GET /api/inventories/{id}/items` - List items
- `POST /api/inventories/{id}/items` - Add item
- `PUT /api/inventories/{id}/items/{item_id}` - Update item
- `DELETE /api/inventories/{id}/items/{item_id}` - Delete item

### Export
- `GET /api/inventories/{id}/export` - Get export data

## 🚀 Running the App

### Backend
```bash
cd /app/backend
python server.py
```

### Frontend
```bash
cd /app/frontend
yarn start
```

### Access
- **Web Preview**: https://stock-counter-pwa.preview.emergentagent.com
- **Expo Go**: Scan QR code in Expo Go app

## 📋 Usage Flow

1. **Configure Store** (First Time)
   - Open Store Config tab
   - Fill in all store details
   - Save configuration

2. **Create Inventory Session**
   - Go to Inventories tab
   - Tap FAB (+) button
   - Enter description and date
   - Create inventory

3. **Count Items**
   - Select inventory from list
   - Tap green "Scan Barcode" button
   - Point camera at barcode/QR code
   - OR enter details manually
   - Add item to list
   - Repeat for all products

4. **Review & Edit**
   - View all counted items
   - Edit items if needed (tap edit icon)
   - Delete items if needed (tap trash icon)

5. **Export Report**
   - Tap "Export & Close Inventory"
   - Choose "Download Excel" or "Send via Email"
   - Inventory automatically closes

## 🌍 Language Support

The app supports Portuguese and English. Toggle language in Store Config screen.

### Supported Translations
- All UI elements
- Error messages
- Form labels
- Button text
- Status indicators

## 📦 Data Storage

### Local (AsyncStorage)
- Store configuration (backup)
- Language preference

### Database (MongoDB)
- Store configuration
- Inventory sessions
- Counted items

## 🎯 Key Features Implemented

✅ Multi-language support (PT/EN)  
✅ Camera-based barcode/QR scanning  
✅ Manual item entry  
✅ Edit/Delete functionality  
✅ Excel report generation  
✅ Email integration (mailto)  
✅ Local + Database storage  
✅ Date validation  
✅ Quantity validation  
✅ Closed inventory protection  
✅ Duplicate handling (new entry)  
✅ Pull-to-refresh  
✅ Status badges  
✅ Item count display  

## 🔒 Validation Rules

- **All fields required** for store config and items
- **Date format**: YYYY-MM-DD
- **Quantity**: Must be positive integer
- **Closed inventories**: Cannot add/edit/delete items

## 📱 Tested Barcode Types

- EAN-13, EAN-8
- UPC-A, UPC-E
- QR Codes
- Code 128, Code 39, Code 93
- Codabar, ITF-14
- PDF417, Aztec

## 🎨 Color Scheme

- **Primary Blue**: #007AFF (iOS standard)
- **Success Green**: #34C759
- **Danger Red**: #FF3B30
- **Background**: #F2F2F7
- **Card White**: #FFFFFF
- **Text Dark**: #000000
- **Text Light**: #8E8E93

## 📄 License

This is a proprietary inventory management solution.

---

**Built with ❤️ using Expo and FastAPI**
