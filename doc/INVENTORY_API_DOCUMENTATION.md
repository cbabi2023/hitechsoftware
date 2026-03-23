# Inventory Management Module — API Documentation for Flutter Developers

> **Last Updated:** 2026-03-23  
> **Target Clients:** `hitech_admin` (Flutter), `hitech_technician` (Flutter)  
> **Backend:** Supabase (PostgreSQL + PostgREST + RLS)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Supabase Setup (Flutter)](#2-supabase-setup-flutter)
3. [Authentication & Role-Based Access](#3-authentication--role-based-access)
4. [Database Tables & Relationships](#4-database-tables--relationships)
5. [Product Categories API](#5-product-categories-api)
6. [Product Types API](#6-product-types-api)
7. [Products API](#7-products-api)
8. [Stock Entries API](#8-stock-entries-api)
9. [Stock Levels (Read-Only View)](#9-stock-levels-read-only-view)
10. [Pricing System](#10-pricing-system)
11. [Error Handling](#11-error-handling)
12. [Validation Rules Reference](#12-validation-rules-reference)
13. [Real-Time Subscriptions](#13-real-time-subscriptions)
14. [Dart Model Classes](#14-dart-model-classes)

---

## 1. Overview

The Inventory Management module manages:

- **Product Categories** — classification buckets (e.g., Electronics, Mechanical)
- **Product Types** — type labels (e.g., Spare Part, Consumable, Tool)
- **Products** — master catalogue of all inventory items with pricing
- **Stock Entries** — goods receipt notes (GRN) recording inbound inventory
- **Stock Levels** — real-time aggregated view of current stock quantities and values

### Architecture

```
Flutter App
    ↓ (Supabase SDK — direct DB access via PostgREST)
Supabase PostgreSQL
    ↓ (RLS policies filter by user role)
Tables / Views / Triggers
```

Flutter apps communicate **directly** with Supabase — there is no intermediate REST API server. All queries go through the Supabase Dart SDK, and Row Level Security (RLS) policies enforce access control.

---

## 2. Supabase Setup (Flutter)

### Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  supabase_flutter: ^2.8.0
```

### Initialization

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: 'YOUR_SUPABASE_PROJECT_URL',       // Settings → API → Project URL
    anonKey: 'YOUR_SUPABASE_ANON_KEY',      // Settings → API → anon/public key
  );

  runApp(const MyApp());
}

// Global client accessor
final supabase = Supabase.instance.client;
```

> **IMPORTANT:** Only use the `anon` key in Flutter apps. Never embed the `service_role` key in client apps.

### Authentication

```dart
// Login
final response = await supabase.auth.signInWithPassword(
  email: 'user@example.com',
  password: 'password',
);

// Current session
final session = supabase.auth.currentSession;
final user = supabase.auth.currentUser;

// Get user role from profile
final profile = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
final role = profile['role']; // 'super_admin', 'office_staff', 'stock_manager', 'technician'
```

---

## 3. Authentication & Role-Based Access

All inventory tables are protected by RLS. Access is determined by the `role` column in the `profiles` table.

| Role | Read Products | Write Products | Read Stock | Write Stock | Read Categories/Types | Write Categories/Types |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| `super_admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `office_staff` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `stock_manager` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `technician` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** Technicians have NO access to inventory tables. The `hitech_technician` app does not need inventory module integration. Only `hitech_admin` needs these APIs.

---

## 4. Database Tables & Relationships

### Entity Relationship

```
product_categories (1) ←── (N) inventory_products (1) ──→ (N) stock_entry_items
product_types      (1) ←── (N) inventory_products                    ↑
                                                              stock_entries (1) ──→ (N) stock_entry_items
                                                              
                               inventory_products ←── current_stock_levels (VIEW)
```

### Table Summary

| Table | Purpose |
|-------|---------|
| `product_categories` | Classification groups (Electronics, Mechanical, etc.) |
| `product_types` | Type labels (Spare Part, Consumable, Tool, etc.) |
| `inventory_products` | Master product catalogue with pricing |
| `stock_entries` | Goods receipt header (invoice reference, date) |
| `stock_entry_items` | Line items per stock entry (product, qty, pricing) |
| `current_stock_levels` | **VIEW** — aggregated stock quantities and values |

### Soft Delete Pattern

All tables use a soft-delete pattern. Records are **never** physically deleted.

```dart
// When "deleting", set is_deleted = true and is_active = false
await supabase
    .from('inventory_products')
    .update({'is_deleted': true, 'is_active': false})
    .eq('id', productId);

// ALWAYS filter out deleted records in queries
await supabase
    .from('inventory_products')
    .select()
    .eq('is_deleted', false);
```

---

## 5. Product Categories API

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, auto-generated | Unique identifier |
| `name` | `VARCHAR(150)` | NOT NULL, unique (case-insensitive, among non-deleted) | Category name |
| `is_active` | `BOOLEAN` | DEFAULT `true` | Whether category is active |
| `is_deleted` | `BOOLEAN` | DEFAULT `false` | Soft delete flag |
| `created_by` | `UUID` | FK → `profiles` | Creator user ID |
| `created_at` | `TIMESTAMPTZ` | Auto-set | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Auto-set | Last update timestamp |

### List All Categories

```dart
final response = await supabase
    .from('product_categories')
    .select()
    .eq('is_deleted', false)
    .order('name');

// Response: List<Map<String, dynamic>>
// [
//   { "id": "uuid", "name": "Electronics", "is_active": true, "is_deleted": false, ... },
//   { "id": "uuid", "name": "Mechanical", "is_active": true, "is_deleted": false, ... }
// ]
```

### Create Category

```dart
final response = await supabase
    .from('product_categories')
    .insert({
      'name': 'Electronics',    // Required, 1-150 chars, trimmed
    })
    .select()
    .single();
```

### Update Category

```dart
await supabase
    .from('product_categories')
    .update({
      'name': 'Updated Name',     // Optional
      'is_active': false,         // Optional
    })
    .eq('id', categoryId);
```

### Delete Category (Soft Delete)

```dart
// WARNING: Cannot delete if products reference this category.
// Check first, or handle the error gracefully.
await supabase
    .from('product_categories')
    .update({'is_deleted': true, 'is_active': false})
    .eq('id', categoryId);
```

### Error Cases

| Error | Cause |
|-------|-------|
| `duplicate key value violates unique constraint` | Category name already exists (case-insensitive) |
| `update or delete on table "product_categories" violates foreign key constraint` | Products still reference this category |

---

## 6. Product Types API

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, auto-generated | Unique identifier |
| `name` | `VARCHAR(150)` | NOT NULL, unique (case-insensitive, among non-deleted) | Type name |
| `is_active` | `BOOLEAN` | DEFAULT `true` | Whether type is active |
| `is_deleted` | `BOOLEAN` | DEFAULT `false` | Soft delete flag |
| `created_by` | `UUID` | FK → `profiles` | Creator user ID |
| `created_at` | `TIMESTAMPTZ` | Auto-set | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Auto-set | Last update timestamp |

### List All Types

```dart
final response = await supabase
    .from('product_types')
    .select()
    .eq('is_deleted', false)
    .order('name');
```

### Create Type

```dart
final response = await supabase
    .from('product_types')
    .insert({
      'name': 'Spare Part',    // Required, 1-150 chars, trimmed
    })
    .select()
    .single();
```

### Update Type

```dart
await supabase
    .from('product_types')
    .update({
      'name': 'Updated Name',
      'is_active': false,
    })
    .eq('id', typeId);
```

### Delete Type (Soft Delete)

```dart
await supabase
    .from('product_types')
    .update({'is_deleted': true, 'is_active': false})
    .eq('id', typeId);
```

---

## 7. Products API

### Schema: `inventory_products`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, auto-generated | Unique identifier |
| `product_name` | `VARCHAR(255)` | NOT NULL | Product display name |
| `description` | `TEXT` | — | Optional description |
| `material_code` | `VARCHAR(100)` | Unique (case-insensitive, among non-deleted) | Alphanumeric code. Always UPPERCASE. |
| `category_id` | `UUID` | FK → `product_categories` | Optional category |
| `product_type_id` | `UUID` | FK → `product_types` | Optional type |
| `is_refurbished` | `BOOLEAN` | DEFAULT `false` | Whether the product is refurbished |
| `refurbished_label` | `VARCHAR(100)` | Required if `is_refurbished = true` | Label for the refurbished product |
| `hsn_sac_code` | `VARCHAR(20)` | — | India GST HSN/SAC code |
| `purchase_price` | `NUMERIC(12,2)` | ≥ 0 or NULL | Legacy purchase price field |
| `mrp` | `NUMERIC(12,2)` | ≥ 0 or NULL | Legacy MRP field |
| `default_purchase_price` | `NUMERIC(12,2)` | — | **Auto-updated** by DB trigger from latest stock entry |
| `minimum_selling_price` | `NUMERIC(12,2)` | — | Floor price for billing (cannot sell below this) |
| `weighted_average_cost` | `NUMERIC(12,2)` | — | **Auto-calculated** by DB trigger: `SUM(qty × purchase_price) / SUM(qty)` across all stock entries |
| `minimum_stock_level` | `INTEGER` | DEFAULT `5` | Threshold for low-stock alerts |
| `stock_classification` | `TEXT` | DEFAULT `'unclassified'` | Stock classification label |
| `is_active` | `BOOLEAN` | DEFAULT `true` | Whether product is active |
| `is_deleted` | `BOOLEAN` | DEFAULT `false` | Soft delete flag |
| `created_by` | `UUID` | FK → `profiles` | Creator user ID |
| `created_at` | `TIMESTAMPTZ` | Auto-set | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Auto-set | Last update timestamp |

### List Products (Paginated)

```dart
const int pageSize = 20;
int page = 1;

// Build query
var query = supabase
    .from('inventory_products')
    .select('''
      id, product_name, description, material_code,
      category_id, product_type_id, is_refurbished, refurbished_label,
      hsn_sac_code, purchase_price, mrp,
      default_purchase_price, minimum_selling_price, weighted_average_cost,
      minimum_stock_level, stock_classification,
      is_active, is_deleted, created_at, updated_at,
      product_categories!left(id, name),
      product_types!left(id, name)
    ''', const FetchOptions(count: CountOption.exact))
    .eq('is_deleted', false);

// Optional filters
if (searchText != null && searchText.isNotEmpty) {
  query = query.or(
    'product_name.ilike.%$searchText%,'
    'material_code.ilike.%$searchText%,'
    'hsn_sac_code.ilike.%$searchText%'
  );
}
if (categoryId != null) {
  query = query.eq('category_id', categoryId);
}
if (productTypeId != null) {
  query = query.eq('product_type_id', productTypeId);
}
if (isActive != null) {
  query = query.eq('is_active', isActive);
}

// Pagination
final from = (page - 1) * pageSize;
final to = from + pageSize - 1;

final response = await query
    .order('product_name')
    .range(from, to);

// response.data   → List<Map<String, dynamic>>
// response.count  → int (total matching records for pagination)
```

### Response Shape

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "product_name": "Samsung Compressor 1.5T",
  "description": "Compressor unit for Samsung 1.5 ton split AC",
  "material_code": "COMP-SAM-1.5T",
  "category_id": "uuid-of-category",
  "product_type_id": "uuid-of-type",
  "is_refurbished": false,
  "refurbished_label": null,
  "hsn_sac_code": "8414",
  "purchase_price": 4500.00,
  "mrp": 6500.00,
  "default_purchase_price": 4200.00,
  "minimum_selling_price": 5000.00,
  "weighted_average_cost": 4350.75,
  "minimum_stock_level": 5,
  "stock_classification": "unclassified",
  "is_active": true,
  "is_deleted": false,
  "created_at": "2026-03-20T10:00:00+05:30",
  "updated_at": "2026-03-23T14:30:00+05:30",
  "product_categories": { "id": "uuid", "name": "Electronics" },
  "product_types": { "id": "uuid", "name": "Spare Part" }
}
```

### Get Single Product

```dart
final product = await supabase
    .from('inventory_products')
    .select('''
      id, product_name, description, material_code,
      category_id, product_type_id, is_refurbished, refurbished_label,
      hsn_sac_code, purchase_price, mrp,
      default_purchase_price, minimum_selling_price, weighted_average_cost,
      minimum_stock_level, stock_classification,
      is_active, is_deleted, created_at, updated_at,
      product_categories!left(id, name),
      product_types!left(id, name)
    ''')
    .eq('id', productId)
    .eq('is_deleted', false)
    .single();
```

### Create Product

```dart
final newProduct = await supabase
    .from('inventory_products')
    .insert({
      'product_name': 'Samsung Compressor 1.5T',          // Required
      'material_code': 'COMP-SAM-1.5T',                   // Required, 2-100 chars, UPPERCASE
      'description': 'Compressor for Samsung 1.5 ton AC', // Optional
      'category_id': categoryUuid,                         // Optional UUID
      'product_type_id': typeUuid,                         // Optional UUID
      'is_refurbished': false,                             // Optional, default false
      'refurbished_label': null,                           // Required if is_refurbished = true
      'hsn_sac_code': '8414',                              // Optional, max 20 chars
      'purchase_price': 4500.00,                           // Optional, ≥ 0
      'mrp': 6500.00,                                      // Optional, ≥ 0
      'minimum_selling_price': 5000.00,                    // Optional, ≥ 0
      'minimum_stock_level': 5,                            // Optional, default 5
      'is_active': true,                                   // Optional, default true
    })
    .select()
    .single();
```

### Material Code Rules

| Rule | Detail |
|------|--------|
| Format | Alphanumeric + hyphens (`-`), underscores (`_`), forward slashes (`/`) |
| Regex | `^[A-Za-z0-9\-_/]+$` |
| Length | 2–100 characters |
| Storage | Always converted to UPPERCASE before storage |
| Uniqueness | Case-insensitive unique among non-deleted products |

```dart
// Validate material code client-side before sending
final materialCodeRegex = RegExp(r'^[A-Za-z0-9\-_/]+$');
if (!materialCodeRegex.hasMatch(code) || code.length < 2 || code.length > 100) {
  // Show validation error
}
// Always send uppercase
final normalizedCode = code.trim().toUpperCase();
```

### Update Product (PATCH Semantics)

Only send fields that changed. Omitted fields are not modified.

```dart
await supabase
    .from('inventory_products')
    .update({
      'product_name': 'Updated Name',
      'mrp': 7000.00,
      'is_active': false,
    })
    .eq('id', productId);
```

### Delete Product (Soft Delete)

```dart
await supabase
    .from('inventory_products')
    .update({'is_deleted': true, 'is_active': false})
    .eq('id', productId);
```

### Search Products by Material Code

```dart
// Case-insensitive search (useful for barcode/scanner lookup)
final results = await supabase
    .from('inventory_products')
    .select('id, product_name, material_code, mrp, default_purchase_price')
    .eq('is_deleted', false)
    .ilike('material_code', '%$searchCode%')
    .limit(10);
```

---

## 8. Stock Entries API

Stock entries record inbound goods receipt. Each entry has a header (invoice reference) and line items (products received).

> **IMPORTANT:** Stock entries are **immutable** after creation. There is no update/edit operation. To correct an entry, soft-delete it and create a new one. This preserves the audit trail.

### Schema: `stock_entries`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, auto-generated | Unique identifier |
| `invoice_number` | `VARCHAR(100)` | NOT NULL | Supplier invoice reference |
| `entry_date` | `DATE` | DEFAULT `CURRENT_DATE` | Date goods were received |
| `notes` | `TEXT` | — | Optional notes (max 1000 chars) |
| `is_deleted` | `BOOLEAN` | DEFAULT `false` | Soft delete flag |
| `created_by` | `UUID` | FK → `profiles` | Creator user ID |
| `created_at` | `TIMESTAMPTZ` | Auto-set | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Auto-set | Last update timestamp |

### Schema: `stock_entry_items`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, auto-generated | Unique identifier |
| `stock_entry_id` | `UUID` | FK → `stock_entries`, ON DELETE CASCADE | Parent entry |
| `product_id` | `UUID` | FK → `inventory_products`, nullable | Linked product (null for ad-hoc items) |
| `material_code` | `VARCHAR(100)` | NOT NULL | Denormalized material code (preserved even if product deleted) |
| `quantity` | `INTEGER` | CHECK > 0 | Number of units received |
| `purchase_price` | `NUMERIC(12,2)` | — | Per-unit cost price on this invoice |
| `selling_price` | `NUMERIC(12,2)` | — | Optional suggested selling price |
| `mrp` | `NUMERIC(12,2)` | — | Maximum retail price on this invoice |
| `total_purchase_value` | `NUMERIC(14,2)` | GENERATED ALWAYS AS `quantity * purchase_price` | Auto-calculated line total |
| `hsn_sac_code` | `VARCHAR(20)` | — | GST HSN/SAC code (denormalized) |
| `created_at` | `TIMESTAMPTZ` | Auto-set | Creation timestamp |

### List Stock Entries (Paginated)

```dart
const int pageSize = 20;
int page = 1;

final from = (page - 1) * pageSize;
final to = from + pageSize - 1;

var query = supabase
    .from('stock_entries')
    .select('''
      id, invoice_number, entry_date, notes,
      is_deleted, created_by, created_at, updated_at,
      stock_entry_items (
        id, stock_entry_id, product_id,
        material_code, quantity,
        purchase_price, selling_price, mrp, total_purchase_value,
        hsn_sac_code, created_at,
        inventory_products!left (id, product_name, material_code)
      )
    ''', const FetchOptions(count: CountOption.exact))
    .eq('is_deleted', false);

// Optional: filter by invoice number
if (invoiceSearch != null && invoiceSearch.isNotEmpty) {
  query = query.ilike('invoice_number', '%$invoiceSearch%');
}

final response = await query
    .order('entry_date', ascending: false)
    .order('created_at', ascending: false)
    .range(from, to);
```

### Response Shape

```json
{
  "id": "entry-uuid",
  "invoice_number": "INV-2026-0345",
  "entry_date": "2026-03-23",
  "notes": "Samsung parts shipment",
  "is_deleted": false,
  "created_by": "user-uuid",
  "created_at": "2026-03-23T10:00:00+05:30",
  "updated_at": "2026-03-23T10:00:00+05:30",
  "stock_entry_items": [
    {
      "id": "item-uuid",
      "stock_entry_id": "entry-uuid",
      "product_id": "product-uuid",
      "material_code": "COMP-SAM-1.5T",
      "quantity": 10,
      "purchase_price": 4200.00,
      "selling_price": null,
      "mrp": 6500.00,
      "total_purchase_value": 42000.00,
      "hsn_sac_code": "8414",
      "created_at": "2026-03-23T10:00:00+05:30",
      "inventory_products": {
        "id": "product-uuid",
        "product_name": "Samsung Compressor 1.5T",
        "material_code": "COMP-SAM-1.5T"
      }
    }
  ]
}
```

### Get Single Stock Entry

```dart
final entry = await supabase
    .from('stock_entries')
    .select('''
      id, invoice_number, entry_date, notes,
      is_deleted, created_by, created_at, updated_at,
      stock_entry_items (
        id, stock_entry_id, product_id,
        material_code, quantity,
        purchase_price, selling_price, mrp, total_purchase_value,
        hsn_sac_code, created_at,
        inventory_products!left (id, product_name, material_code)
      )
    ''')
    .eq('id', entryId)
    .eq('is_deleted', false)
    .single();
```

### Create Stock Entry (Two-Step Insert)

Creating a stock entry is a **two-step process**: insert the header first, then insert line items referencing the header ID.

```dart
// Step 1: Insert header
final header = await supabase
    .from('stock_entries')
    .insert({
      'invoice_number': 'INV-2026-0345',    // Required, 1-100 chars
      'entry_date': '2026-03-23',            // Required, ISO date
      'notes': 'Samsung parts shipment',     // Optional, max 1000 chars
    })
    .select('id')
    .single();

final entryId = header['id'] as String;

// Step 2: Insert line items
final items = [
  {
    'stock_entry_id': entryId,
    'product_id': 'product-uuid',          // Optional (null for ad-hoc items)
    'material_code': 'COMP-SAM-1.5T',     // Required, 2-100 chars
    'quantity': 10,                         // Required, integer ≥ 1
    'purchase_price': 4200.00,             // Required, ≥ 0
    'mrp': 6500.00,                         // Required, ≥ 0
    'selling_price': null,                  // Optional, ≥ 0
    'hsn_sac_code': '8414',                // Optional
  },
  {
    'stock_entry_id': entryId,
    'product_id': 'another-product-uuid',
    'material_code': 'FAN-LG-2T',
    'quantity': 5,
    'purchase_price': 800.00,
    'mrp': 1200.00,
    'selling_price': 1100.00,
    'hsn_sac_code': '8414',
  },
];

await supabase.from('stock_entry_items').insert(items);
```

> **What happens after insert?**
> - The `total_purchase_value` column is auto-calculated by PostgreSQL: `quantity × purchase_price`
> - A DB trigger (`trg_stock_entry_items_pricing`) fires and:
>   - Recalculates `weighted_average_cost` on the linked product
>   - Updates `default_purchase_price` on the product to the latest entry's purchase price

### Delete Stock Entry (Soft Delete)

```dart
await supabase
    .from('stock_entries')
    .update({'is_deleted': true})
    .eq('id', entryId);
```

### Stock Entry Item — Ad-Hoc Items

Items can be recorded **without** linking to a product in the master catalogue. Set `product_id` to `null` and provide the `material_code` manually. This is useful for one-off purchases.

```dart
{
  'stock_entry_id': entryId,
  'product_id': null,                    // No linked product
  'material_code': 'MISC-CABLE-01',     // Manually entered
  'quantity': 20,
  'purchase_price': 50.00,
  'mrp': 100.00,
  'selling_price': null,
  'hsn_sac_code': null,
}
```

---

## 9. Stock Levels (Read-Only View)

The `current_stock_levels` view aggregates stock data across all stock entries. It is **read-only** — data is derived from `inventory_products`, `stock_entries`, and `stock_entry_items`.

### View Columns

| Column | Type | Description |
|--------|------|-------------|
| `product_id` | `UUID` | Product ID |
| `material_code` | `VARCHAR` | Product material code |
| `product_name` | `VARCHAR` | Product name |
| `minimum_stock_level` | `INTEGER` | Low-stock alert threshold |
| `total_received` | `BIGINT` | Sum of all quantities received across all stock entries |
| `current_quantity` | `BIGINT` | Current stock (= `total_received`, consumption tracking TBD) |
| `last_received_date` | `DATE` | Date of most recent stock entry |
| `latest_purchase_price` | `NUMERIC(12,2)` | Purchase price from the most recent stock entry |
| `weighted_average_cost` | `NUMERIC(12,2)` | `SUM(qty × purchase_price) / SUM(qty)` across all entries |
| `mrp` | `NUMERIC(12,2)` | MRP from the most recent stock entry |
| `total_stock_value` | `NUMERIC` | `current_quantity × weighted_average_cost` |
| `stock_status` | `TEXT` | `'in_stock'` / `'low_stock'` / `'out_of_stock'` |

### Query Stock Levels

```dart
final stockLevels = await supabase
    .from('current_stock_levels')
    .select()
    .order('product_name');

// Response: List<Map<String, dynamic>>
// [
//   {
//     "product_id": "uuid",
//     "material_code": "COMP-SAM-1.5T",
//     "product_name": "Samsung Compressor 1.5T",
//     "minimum_stock_level": 5,
//     "total_received": 25,
//     "current_quantity": 25,
//     "last_received_date": "2026-03-23",
//     "latest_purchase_price": 4200.00,
//     "weighted_average_cost": 4350.75,
//     "mrp": 6500.00,
//     "total_stock_value": 108768.75,
//     "stock_status": "in_stock"
//   }
// ]
```

### Filter by Stock Status

```dart
// Get items that need reordering
final lowStock = await supabase
    .from('current_stock_levels')
    .select()
    .inFilter('stock_status', ['low_stock', 'out_of_stock'])
    .order('stock_status');

// Get only items in stock
final inStock = await supabase
    .from('current_stock_levels')
    .select()
    .eq('stock_status', 'in_stock');
```

### Stock Status Logic

```
if current_quantity = 0             → 'out_of_stock'
if current_quantity ≤ minimum_stock_level → 'low_stock'
otherwise                           → 'in_stock'
```

---

## 10. Pricing System

The inventory system manages three distinct prices, each serving a different purpose:

### Price Hierarchy

| Price | Level | Purpose | Updated By |
|-------|-------|---------|------------|
| **Purchase Price** | Per stock entry item | Actual cost paid to supplier on a specific invoice | Manual input during stock entry |
| **MRP** | Per stock entry item | Maximum retail price printed on packaging | Manual input during stock entry |
| **Selling Price** | Per stock entry item | Suggested selling price (optional) | Manual input during stock entry |
| **Default Purchase Price** | Per product | Latest purchase price from most recent stock entry | Auto-updated by DB trigger |
| **Weighted Average Cost** | Per product | Weighted average across ALL stock entries: `Σ(qty × price) / Σ(qty)` | Auto-calculated by DB trigger |
| **Minimum Selling Price** | Per product | Floor price — billing cannot go below this | Manual input on product master |

### How Pricing Auto-Updates Work

When a stock entry item is inserted or updated:

1. **DB Trigger** `trg_stock_entry_items_pricing` fires
2. Calls `calculate_weighted_average_cost(product_id)` function
3. Updates `inventory_products`:
   - `weighted_average_cost` = `SUM(qty × purchase_price) / SUM(qty)`
   - `default_purchase_price` = the purchase price from this entry (latest)

### Billing Price Rules

When creating a bill/invoice for a customer:
- The selling price **must not** be less than `minimum_selling_price` (if set)
- If `minimum_selling_price` is NULL, MRP is used as the floor

### Example Pricing Flow

```
Stock Entry 1: Product X, qty=10, purchase_price=100, mrp=200
  → weighted_average_cost = 100.00
  → default_purchase_price = 100.00

Stock Entry 2: Product X, qty=5, purchase_price=120, mrp=200
  → weighted_average_cost = (10*100 + 5*120) / (10+5) = 106.67
  → default_purchase_price = 120.00 (latest)
```

---

## 11. Error Handling

### Common Database Errors

| Error Pattern | Cause | User-Facing Message |
|---------------|-------|---------------------|
| `duplicate key value violates unique constraint` | Material code or name already exists | "A product with this material code already exists" |
| `violates check constraint "inventory_products_purchase_price_non_negative"` | Negative purchase price | "Purchase price must be 0 or greater" |
| `violates check constraint "inventory_products_mrp_non_negative"` | Negative MRP | "MRP must be 0 or greater" |
| `violates check constraint "stock_entry_items_quantity_check"` | Quantity ≤ 0 | "Quantity must be at least 1" |
| `violates foreign key constraint` | Referenced category/type/product doesn't exist | "Referenced item not found" |
| `new row violates row-level security policy` | User role doesn't have access | "Permission denied" |

### Error Handling in Dart

```dart
try {
  final result = await supabase
      .from('inventory_products')
      .insert({...})
      .select()
      .single();
  // Success
} on PostgrestException catch (e) {
  if (e.code == '23505') {
    // Unique constraint violation
    showError('A product with this material code already exists');
  } else if (e.code == '23503') {
    // Foreign key violation
    showError('Referenced category or type not found');
  } else if (e.code == '42501') {
    // RLS policy violation
    showError('You do not have permission to perform this action');
  } else {
    showError('An error occurred: ${e.message}');
  }
} catch (e) {
  showError('Unexpected error: $e');
}
```

### PostgreSQL Error Codes Reference

| Code | Name | Common Cause |
|------|------|-------------|
| `23505` | `unique_violation` | Duplicate key |
| `23503` | `foreign_key_violation` | FK reference doesn't exist or is being deleted with dependents |
| `23514` | `check_violation` | CHECK constraint failed (negative price, zero qty, etc.) |
| `42501` | `insufficient_privilege` | RLS policy denied the operation |

---

## 12. Validation Rules Reference

Apply these validations **client-side** in the Flutter app before sending data to Supabase.

### Product Validation

| Field | Rule |
|-------|------|
| `product_name` | Required. 1–255 characters. |
| `material_code` | Required. 2–100 characters. Regex: `^[A-Za-z0-9\-_/]+$`. Auto-uppercase. |
| `description` | Optional. Free text. |
| `category_id` | Optional. Must be a valid UUID of an existing category. |
| `product_type_id` | Optional. Must be a valid UUID of an existing type. |
| `is_refurbished` | Boolean. Default `false`. |
| `refurbished_label` | **Required** when `is_refurbished = true`. Max 100 chars. |
| `hsn_sac_code` | Optional. Max 20 characters. |
| `purchase_price` | Optional. Must be ≥ 0. Decimal. |
| `mrp` | Optional. Must be ≥ 0. Decimal. |
| `minimum_selling_price` | Optional. Must be ≥ 0. Decimal. |
| `minimum_stock_level` | Optional. Default 5. Non-negative integer. |
| `is_active` | Boolean. Default `true`. |

### Stock Entry Validation

| Field | Rule |
|-------|------|
| `invoice_number` | Required. 1–100 characters. |
| `entry_date` | Required. ISO date string (e.g., `2026-03-23`). |
| `notes` | Optional. Max 1000 characters. |
| `items` | Required. At least 1 item. |

### Stock Entry Item Validation

| Field | Rule |
|-------|------|
| `product_id` | Optional. UUID or null (for ad-hoc items). |
| `material_code` | Required. 2–100 characters. Same regex as product material_code. |
| `quantity` | Required. Positive integer (≥ 1). |
| `purchase_price` | Required. Decimal ≥ 0. |
| `mrp` | Required. Decimal ≥ 0. |
| `selling_price` | Optional. Decimal ≥ 0. |
| `hsn_sac_code` | Optional. Max 20 characters. |

### Category / Type Validation

| Field | Rule |
|-------|------|
| `name` | Required. 1–150 characters. Trimmed. |
| `is_active` | Optional boolean (update only). |

---

## 13. Real-Time Subscriptions

Use Supabase Realtime to listen for inventory changes. Useful for dashboards that show live stock levels.

### Subscribe to Product Changes

```dart
final channel = supabase.channel('inventory-products');

channel
    .onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'inventory_products',
      callback: (payload) {
        print('Product changed: ${payload.eventType}');
        print('New data: ${payload.newRecord}');
        print('Old data: ${payload.oldRecord}');
        // Refresh your product list
      },
    )
    .subscribe();

// Cleanup when disposing
channel.unsubscribe();
```

### Subscribe to Stock Entry Changes

```dart
final channel = supabase.channel('stock-entries');

channel
    .onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'stock_entry_items',
      callback: (payload) {
        print('New stock received: ${payload.newRecord}');
        // Refresh stock levels
      },
    )
    .subscribe();
```

### Subscribe to Stock Level Changes

```dart
// NOTE: Views don't support direct realtime subscriptions.
// Instead, listen to the underlying tables and refresh the view query.

final channel = supabase.channel('stock-updates');

channel
    .onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'stock_entry_items',
      callback: (payload) {
        // Re-fetch current_stock_levels view
        refreshStockLevels();
      },
    )
    .subscribe();
```

---

## 14. Dart Model Classes

Ready-to-use model classes for the Flutter apps.

### ProductCategory

```dart
class ProductCategory {
  final String id;
  final String name;
  final bool isActive;
  final bool isDeleted;
  final String? createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ProductCategory({
    required this.id,
    required this.name,
    required this.isActive,
    required this.isDeleted,
    this.createdBy,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ProductCategory.fromJson(Map<String, dynamic> json) {
    return ProductCategory(
      id: json['id'] as String,
      name: json['name'] as String,
      isActive: json['is_active'] as bool,
      isDeleted: json['is_deleted'] as bool,
      createdBy: json['created_by'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toInsertJson() {
    return {'name': name};
  }
}
```

### ProductType

```dart
class ProductType {
  final String id;
  final String name;
  final bool isActive;
  final bool isDeleted;
  final String? createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ProductType({
    required this.id,
    required this.name,
    required this.isActive,
    required this.isDeleted,
    this.createdBy,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ProductType.fromJson(Map<String, dynamic> json) {
    return ProductType(
      id: json['id'] as String,
      name: json['name'] as String,
      isActive: json['is_active'] as bool,
      isDeleted: json['is_deleted'] as bool,
      createdBy: json['created_by'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toInsertJson() {
    return {'name': name};
  }
}
```

### Product

```dart
class Product {
  final String id;
  final String productName;
  final String? description;
  final String materialCode;
  final String? categoryId;
  final String? productTypeId;
  final bool isRefurbished;
  final String? refurbishedLabel;
  final String? hsnSacCode;
  final double? purchasePrice;
  final double? mrp;
  final double? defaultPurchasePrice;
  final double? minimumSellingPrice;
  final double? weightedAverageCost;
  final int minimumStockLevel;
  final String stockClassification;
  final bool isActive;
  final bool isDeleted;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Resolved relationships
  final ProductCategory? category;
  final ProductType? productType;

  const Product({
    required this.id,
    required this.productName,
    this.description,
    required this.materialCode,
    this.categoryId,
    this.productTypeId,
    required this.isRefurbished,
    this.refurbishedLabel,
    this.hsnSacCode,
    this.purchasePrice,
    this.mrp,
    this.defaultPurchasePrice,
    this.minimumSellingPrice,
    this.weightedAverageCost,
    required this.minimumStockLevel,
    required this.stockClassification,
    required this.isActive,
    required this.isDeleted,
    required this.createdAt,
    required this.updatedAt,
    this.category,
    this.productType,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String,
      productName: json['product_name'] as String,
      description: json['description'] as String?,
      materialCode: json['material_code'] as String,
      categoryId: json['category_id'] as String?,
      productTypeId: json['product_type_id'] as String?,
      isRefurbished: json['is_refurbished'] as bool? ?? false,
      refurbishedLabel: json['refurbished_label'] as String?,
      hsnSacCode: json['hsn_sac_code'] as String?,
      purchasePrice: (json['purchase_price'] as num?)?.toDouble(),
      mrp: (json['mrp'] as num?)?.toDouble(),
      defaultPurchasePrice: (json['default_purchase_price'] as num?)?.toDouble(),
      minimumSellingPrice: (json['minimum_selling_price'] as num?)?.toDouble(),
      weightedAverageCost: (json['weighted_average_cost'] as num?)?.toDouble(),
      minimumStockLevel: json['minimum_stock_level'] as int? ?? 5,
      stockClassification: json['stock_classification'] as String? ?? 'unclassified',
      isActive: json['is_active'] as bool? ?? true,
      isDeleted: json['is_deleted'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      category: json['product_categories'] != null
          ? ProductCategory.fromJson(json['product_categories'] as Map<String, dynamic>)
          : null,
      productType: json['product_types'] != null
          ? ProductType.fromJson(json['product_types'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toInsertJson() {
    return {
      'product_name': productName,
      'material_code': materialCode.trim().toUpperCase(),
      if (description != null) 'description': description,
      if (categoryId != null) 'category_id': categoryId,
      if (productTypeId != null) 'product_type_id': productTypeId,
      'is_refurbished': isRefurbished,
      if (refurbishedLabel != null) 'refurbished_label': refurbishedLabel,
      if (hsnSacCode != null) 'hsn_sac_code': hsnSacCode,
      if (purchasePrice != null) 'purchase_price': purchasePrice,
      if (mrp != null) 'mrp': mrp,
      if (minimumSellingPrice != null) 'minimum_selling_price': minimumSellingPrice,
      'minimum_stock_level': minimumStockLevel,
      'is_active': isActive,
    };
  }
}
```

### StockEntry & StockEntryItem

```dart
class StockEntryItem {
  final String id;
  final String stockEntryId;
  final String? productId;
  final String materialCode;
  final int quantity;
  final double? purchasePrice;
  final double? sellingPrice;
  final double? mrp;
  final double? totalPurchaseValue;
  final String? hsnSacCode;
  final DateTime createdAt;

  // Resolved relationship
  final StockEntryProduct? product;

  const StockEntryItem({
    required this.id,
    required this.stockEntryId,
    this.productId,
    required this.materialCode,
    required this.quantity,
    this.purchasePrice,
    this.sellingPrice,
    this.mrp,
    this.totalPurchaseValue,
    this.hsnSacCode,
    required this.createdAt,
    this.product,
  });

  factory StockEntryItem.fromJson(Map<String, dynamic> json) {
    return StockEntryItem(
      id: json['id'] as String,
      stockEntryId: json['stock_entry_id'] as String,
      productId: json['product_id'] as String?,
      materialCode: json['material_code'] as String,
      quantity: json['quantity'] as int,
      purchasePrice: (json['purchase_price'] as num?)?.toDouble(),
      sellingPrice: (json['selling_price'] as num?)?.toDouble(),
      mrp: (json['mrp'] as num?)?.toDouble(),
      totalPurchaseValue: (json['total_purchase_value'] as num?)?.toDouble(),
      hsnSacCode: json['hsn_sac_code'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      product: json['inventory_products'] != null
          ? StockEntryProduct.fromJson(json['inventory_products'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toInsertJson(String entryId) {
    return {
      'stock_entry_id': entryId,
      'product_id': productId,
      'material_code': materialCode.trim().toUpperCase(),
      'quantity': quantity,
      'purchase_price': purchasePrice,
      'mrp': mrp,
      if (sellingPrice != null) 'selling_price': sellingPrice,
      if (hsnSacCode != null) 'hsn_sac_code': hsnSacCode,
    };
  }
}

class StockEntryProduct {
  final String id;
  final String productName;
  final String materialCode;

  const StockEntryProduct({
    required this.id,
    required this.productName,
    required this.materialCode,
  });

  factory StockEntryProduct.fromJson(Map<String, dynamic> json) {
    return StockEntryProduct(
      id: json['id'] as String,
      productName: json['product_name'] as String,
      materialCode: json['material_code'] as String,
    );
  }
}

class StockEntry {
  final String id;
  final String invoiceNumber;
  final String entryDate;
  final String? notes;
  final bool isDeleted;
  final String? createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<StockEntryItem> items;

  const StockEntry({
    required this.id,
    required this.invoiceNumber,
    required this.entryDate,
    this.notes,
    required this.isDeleted,
    this.createdBy,
    required this.createdAt,
    required this.updatedAt,
    required this.items,
  });

  factory StockEntry.fromJson(Map<String, dynamic> json) {
    return StockEntry(
      id: json['id'] as String,
      invoiceNumber: json['invoice_number'] as String,
      entryDate: json['entry_date'] as String,
      notes: json['notes'] as String?,
      isDeleted: json['is_deleted'] as bool? ?? false,
      createdBy: json['created_by'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      items: (json['stock_entry_items'] as List<dynamic>?)
              ?.map((e) => StockEntryItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  /// Grand total across all line items
  double get grandTotal =>
      items.fold(0.0, (sum, item) => sum + (item.totalPurchaseValue ?? 0));
}
```

### StockLevel

```dart
class StockLevel {
  final String productId;
  final String materialCode;
  final String productName;
  final int minimumStockLevel;
  final int totalReceived;
  final int currentQuantity;
  final String? lastReceivedDate;
  final double? latestPurchasePrice;
  final double? weightedAverageCost;
  final double? mrp;
  final double? totalStockValue;
  final String stockStatus; // 'in_stock', 'low_stock', 'out_of_stock'

  const StockLevel({
    required this.productId,
    required this.materialCode,
    required this.productName,
    required this.minimumStockLevel,
    required this.totalReceived,
    required this.currentQuantity,
    this.lastReceivedDate,
    this.latestPurchasePrice,
    this.weightedAverageCost,
    this.mrp,
    this.totalStockValue,
    required this.stockStatus,
  });

  factory StockLevel.fromJson(Map<String, dynamic> json) {
    return StockLevel(
      productId: json['product_id'] as String,
      materialCode: json['material_code'] as String,
      productName: json['product_name'] as String,
      minimumStockLevel: json['minimum_stock_level'] as int? ?? 5,
      totalReceived: (json['total_received'] as num?)?.toInt() ?? 0,
      currentQuantity: (json['current_quantity'] as num?)?.toInt() ?? 0,
      lastReceivedDate: json['last_received_date'] as String?,
      latestPurchasePrice: (json['latest_purchase_price'] as num?)?.toDouble(),
      weightedAverageCost: (json['weighted_average_cost'] as num?)?.toDouble(),
      mrp: (json['mrp'] as num?)?.toDouble(),
      totalStockValue: (json['total_stock_value'] as num?)?.toDouble(),
      stockStatus: json['stock_status'] as String? ?? 'out_of_stock',
    );
  }

  bool get isLowStock => stockStatus == 'low_stock';
  bool get isOutOfStock => stockStatus == 'out_of_stock';
  bool get isInStock => stockStatus == 'in_stock';
}
```

---

## Quick Reference: All Supabase Tables & Views

| Name | Type | Flutter Access |
|------|------|----------------|
| `product_categories` | Table | Full CRUD |
| `product_types` | Table | Full CRUD |
| `inventory_products` | Table | Full CRUD |
| `stock_entries` | Table | Create + Read + Soft Delete |
| `stock_entry_items` | Table | Create + Read (via stock_entries join) |
| `current_stock_levels` | View | Read-only |

## Quick Reference: Common Select Strings

```dart
// Products with relationships
const productSelect = '''
  id, product_name, description, material_code,
  category_id, product_type_id, is_refurbished, refurbished_label,
  hsn_sac_code, purchase_price, mrp,
  default_purchase_price, minimum_selling_price, weighted_average_cost,
  minimum_stock_level, stock_classification,
  is_active, is_deleted, created_at, updated_at,
  product_categories!left(id, name),
  product_types!left(id, name)
''';

// Stock entries with nested items + product info
const stockEntrySelect = '''
  id, invoice_number, entry_date, notes,
  is_deleted, created_by, created_at, updated_at,
  stock_entry_items (
    id, stock_entry_id, product_id,
    material_code, quantity,
    purchase_price, selling_price, mrp, total_purchase_value,
    hsn_sac_code, created_at,
    inventory_products!left (id, product_name, material_code)
  )
''';

// Stock levels (simple - no joins needed)
const stockLevelSelect = '*';
```
