# Data Element Management Guide

## Overview

The Adobe Launch MCP server now includes **intelligent data element management** with:

✅ Automatic name generation
✅ Smart code generation from descriptions
✅ Data layer path parsing
✅ Interactive clarification when needed
✅ Full CRUD operations (Create, Read, Update, Delete)
✅ Search and filter capabilities

---

## Features

### 1. Intelligent Creation

**You describe what you want**, the tool figures out how to implement it:

```
User: "Create a reference to productId from the data layer digitalData.products[0].productId"

Tool automatically:
- Extracts data layer path: digitalData.products[0].productId
- Generates name: "DE - productId"
- Creates custom code: return digitalData.products[0].productId;
- Adds to selected library
```

### 2. Complex Code Generation

```
User: "Create a data element that returns an Adobe Analytics products string from the products object in the data layer"

Tool generates:
var products = digitalData.products || [];
return products.map(function(p) {
  return [
    p.category || '',
    p.productID || '',
    p.quantity || 1,
    p.price || 0
  ].join(';');
}).join(',');
```

### 3. Interactive Clarification

If information is missing, the tool asks:

```
User: "Create a data element for product ID"

Tool: "I need more details:
- What is the exact data layer path? (e.g., digitalData.products[0].productID)
- Should this have a default value if data is missing?
- How long should the value be cached? (none/session/visitor)"
```

---

## Available Tools

### 1. adobe_launch_create_data_element_smart

**Create data elements intelligently from descriptions**

**Simple Example:**
```
User: "Create a data element for user ID from digitalData.user.userId"

Claude calls:
{
  "description": "get user ID from digitalData.user.userId",
  "dataLayerPath": "digitalData.user.userId"
}

Result:
- Name: "DE - userId"
- Code: return digitalData.user.userId;
- Type: custom-code
```

**Complex Example:**
```
User: "Create a data element that returns the total cart value, cache it for the session, default to 0 if missing"

Claude calls:
{
  "description": "return total cart value",
  "dataLayerPath": "digitalData.cart.total",
  "storageType": "session",
  "defaultValue": "0"
}

Result:
- Name: "DE - cartTotal"
- Code: return digitalData.cart?.total || 0;
- Storage: session
- Default: "0"
```

**Parameters:**
- `description` (required) - What the data element should do
- `name` (optional) - Custom name (auto-generated if not provided)
- `dataLayerPath` (optional) - Exact path to data
- `type` (optional) - custom-code, data-layer, cookie, query-param, javascript
- `storageType` (optional) - none, session, visitor
- `defaultValue` (optional) - Fallback if data is missing
- `cleanText` (optional) - Remove whitespace
- `forceLowercase` (optional) - Convert to lowercase

### 2. adobe_launch_update_data_element

**Update existing data elements**

**Example:**
```
User: "Update the 'Product ID' data element to use a different path"

Claude calls:
{
  "dataElementName": "Product ID",
  "newCode": "return digitalData.product.sku;"
}

Result:
- Updates code
- Adds to library
- Ready to build
```

**Parameters:**
- `dataElementId` or `dataElementName` (one required)
- `newName` - Rename the data element
- `newCode` - Update custom code
- `newSettings` - Update entire settings object
- `storageType` - Change caching behavior
- `cleanText` - Update text cleaning
- `forceLowercase` - Update lowercase setting

### 3. adobe_launch_delete_data_element

**Delete data elements (with confirmation)**

**Example:**
```
User: "Delete the 'Old Product ID' data element"

Claude: "This is permanent. Confirm deletion?"
User: "Yes"

Claude calls:
{
  "dataElementName": "Old Product ID",
  "confirm": true
}

Result:
- Data element deleted permanently
- Remember to build library
```

**Safety Feature:** Requires `confirm: true` to prevent accidents

### 4. adobe_launch_search_data_elements

**Find data elements by pattern**

**Example:**
```
User: "Show me all product-related data elements"

Claude calls:
{
  "pattern": "product",
  "showCode": true
}

Result:
- Lists all matching data elements
- Includes code if requested
```

### 5. adobe_launch_get_data_element

**Get complete details of a data element**

**Example:**
```
User: "Show me details of the 'Cart Total' data element"

Claude calls:
{
  "dataElementName": "Cart Total"
}

Result:
- Full code
- Settings
- Storage configuration
- Creation date
- Last updated
```

---

## Common Workflows

### Workflow 1: Create Simple Data Element

```
User: "Create a data element for page name from digitalData.page.pageName"

Claude:
1. Extracts data layer path: digitalData.page.pageName
2. Generates name: "DE - pageName"
3. Calls adobe_launch_create_data_element_smart
4. Creates with code: return digitalData.page.pageName;
5. Adds to library

User: "Build the library"

Claude:
1. Calls adobe_launch_build_library
2. Deploys to development
```

### Workflow 2: Create Complex Data Element

```
User: "Create a data element that returns an Adobe Analytics products string"

Claude: "I can create that. Where is the products data in your data layer?"

User: "digitalData.products"

Claude:
1. Generates Analytics products string code
2. Creates data element: "DE - analyticsProductsString"
3. Code:
   var products = digitalData.products || [];
   return products.map(function(p) {
     return [p.category, p.productID, p.quantity, p.price].join(';');
   }).join(',');
4. Adds to library

Claude: "Created! You can reference it as %DE - analyticsProductsString% in your rules"
```

### Workflow 3: Update Existing Data Element

```
User: "Update the 'User ID' data element to have a default value of 'anonymous'"

Claude:
1. Searches for "User ID" data element
2. Gets current settings
3. Updates with default value
4. Calls adobe_launch_update_data_element
5. Adds to library

Claude: "Updated 'User ID' data element with default value 'anonymous'"
```

### Workflow 4: Bulk Management

```
User: "Show me all data elements related to cart"

Claude:
1. Calls adobe_launch_search_data_elements
2. Pattern: "cart"
3. Shows list:
   - Cart Total
   - Cart Item Count
   - Cart Value

User: "Delete Cart Item Count"

Claude:
1. Asks for confirmation
2. Calls adobe_launch_delete_data_element
3. Confirms deletion
```

---

## Intelligent Features

### 1. Data Layer Path Parsing

The tool automatically extracts data layer paths from natural language:

**Input:** "from the data layer digitalData.products[0].price"
**Extracted:** `digitalData.products[0].price`

**Input:** "get cart total from digitalData.cart.total"
**Extracted:** `digitalData.cart.total`

**Input:** "path: window.appData.userId"
**Extracted:** `window.appData.userId`

### 2. Name Generation

Generates descriptive names from descriptions:

| Description | Generated Name |
|-------------|----------------|
| "get product ID" | DE - productId |
| "return user ID from data layer" | DE - userId |
| "cart total value" | DE - cartTotalValue |
| "analytics products string" | DE - analyticsProductsString |

### 3. Code Generation Patterns

The tool recognizes common patterns:

**Product ID:**
```javascript
return digitalData.product?.productID || '';
```

**Analytics Products String:**
```javascript
var products = digitalData.products || [];
return products.map(function(p) {
  return [p.category || '', p.productID || '', p.quantity || 1, p.price || 0].join(';');
}).join(',');
```

**Cart Value:**
```javascript
return digitalData.cart?.total || 0;
```

**Page Name:**
```javascript
return digitalData.page?.pageName || document.title;
```

**User ID:**
```javascript
return digitalData.user?.userID || '';
```

### 4. Interactive Clarification

When details are missing:

```
User: "Create data element for product ID"

Claude: "I can create that! I need a few details:
1. What is the exact data layer path? (e.g., digitalData.products[0].productID)
2. Should this have a default value if the product ID is missing?
3. How long should this be cached? (none/session/visitor)

Please provide these details."

User: "Path is digitalData.product.sku, default to empty string, no caching"

Claude: [Creates with exact specifications]
```

---

## Data Element Types

### 1. Custom Code (default)
**Best for:** Complex logic, transformations, calculations

```javascript
// Example: Format currency
return (digitalData.cart.total || 0).toFixed(2);
```

### 2. Data Layer Variable
**Best for:** Direct access to data layer values

```
Path: digitalData.page.pageName
Returns: The value at that path
```

### 3. Cookie
**Best for:** Reading cookie values

```
Cookie Name: sessionId
Returns: Value of the sessionId cookie
```

### 4. Query Parameter
**Best for:** Reading URL parameters

```
Parameter: utm_campaign
Returns: Value of ?utm_campaign=...
```

### 5. JavaScript Variable
**Best for:** Accessing global JavaScript variables

```
Path: window.dataLayer
Returns: The global dataLayer object
```

---

## Storage Types

### None (default)
- Value retrieved every time
- No caching
- **Use for:** Dynamic data that changes frequently

### Session
- Value cached for browser session
- Cleared when browser closes
- **Use for:** User session data, cart info

### Visitor
- Value cached persistently
- Survives browser restarts
- **Use for:** User preferences, IDs

---

## Best Practices

### 1. Naming Convention
✅ Use descriptive, readable names
✅ Prefix with "DE -" for easy identification
✅ Use camelCase: `DE - productId`
❌ Avoid: `de1`, `temp`, `test`

### 2. Code Quality
✅ Add fallback values: `|| ''` or `|| 0`
✅ Use optional chaining: `?.`
✅ Handle missing data gracefully
❌ Avoid code that throws errors

### 3. Storage Selection
✅ Default to "none" unless you have a reason
✅ Use "session" for cart/user session data
✅ Use "visitor" sparingly (impacts privacy)

### 4. Testing
✅ Test data element in development first
✅ Verify fallback behavior
✅ Check with missing data scenarios

---

## Examples by Use Case

### E-commerce

```javascript
// Product ID
return digitalData.product?.productID || '';

// Cart Total
return digitalData.cart?.total || 0;

// Cart Item Count
return (digitalData.cart?.items || []).length;

// Analytics Products String
var products = digitalData.products || [];
return products.map(function(p) {
  return [p.category, p.productID, p.quantity, p.price].join(';');
}).join(',');
```

### User Tracking

```javascript
// User ID
return digitalData.user?.userID || '';

// User Type
return digitalData.user?.type || 'guest';

// Login Status
return !!digitalData.user?.userID;
```

### Page Context

```javascript
// Page Name
return digitalData.page?.pageName || document.title;

// Page Type
return digitalData.page?.pageType || '';

// Page Category
return digitalData.page?.category || '';
```

### Campaign Tracking

```javascript
// UTM Campaign (query param)
// Type: query-param, Name: utm_campaign

// Campaign ID (cookie)
// Type: cookie, Name: campaignId
```

---

## Troubleshooting

### Issue: "Data element returns undefined"

**Solution:** Add fallback value

```javascript
// ❌ Bad
return digitalData.product.productID;

// ✅ Good
return digitalData.product?.productID || '';
```

### Issue: "Data element not updating"

**Solution:** Check storage type

- If storage is "session" or "visitor", value is cached
- Change to "none" for dynamic data

### Issue: "Complex code not working"

**Solution:** Test in browser console first

```javascript
// Test in browser console
console.log(digitalData.products.map(function(p) {
  return p.productID;
}));
```

---

## Summary

The data element tools provide:

✅ **Intelligent creation** from natural language
✅ **Automatic name generation**
✅ **Smart code generation** for common patterns
✅ **Interactive clarification** when needed
✅ **Full CRUD operations**
✅ **Search and filter**
✅ **Library integration**

**The tool makes it easy to create data elements without knowing the exact Adobe Launch API syntax!** 🚀