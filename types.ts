// FIX: Removed a self-import of 'Page' that was causing a declaration conflict.
export enum Page {
    Dashboard = 'DASHBOARD',
    Sales = 'SALES',
    ScanBill = 'SCAN_BILL',
    Returns = 'RETURNS',
    Inventory = 'INVENTORY',
    Insights = 'INSIGHTS',
}

export interface Transaction {
    id: string;
    user_id: string;
    total_price: number;
    payment_method: 'Online' | 'Offline' | 'On Credit';
    date: string; // ISO string
    items: Sale[];
    customer_name?: string;
    customer_phone?: string;
}

export interface Sale {
    id: string;
    user_id: string;
    inventoryItemId: string;
    productName: string;
    quantity: number;
    totalPrice: number;
    date: string; // This is now sourced from the parent transaction
    paymentMethod: 'Online' | 'Offline' | 'On Credit'; // This is now sourced from the parent transaction
    has_gst?: boolean;
    itemCostAtSale?: number;
    transaction_id?: string;
    sale_type?: 'loose' | 'bundle'; // New field to track sale type
    status?: 'completed' | 'returned'; // To track returns
}

export interface InventoryItem {
    id: string;
    user_id: string;
    name: string;
    stock: number; // Always refers to the count of individual units
    price: number; // Price for one loose item
    cost: number; // Cost for one loose item
    created_at?: string;
    updated_at?: string;
    has_gst?: boolean;
    is_bundle?: boolean; // Is this item ever sold as a bundle?
    bundle_price?: number; // Price for the entire bundle
    items_per_bundle?: number; // How many loose items are in one bundle
}

export interface SalesPrediction {
    date: string;
    predictedSales: number;
    reasoning: string;
}

export interface InventoryInsight {
    itemName: string;
    insight: string;
    suggestion: string;
}

// A more descriptive type for items being prepared for a transaction
export type CartItemForTransaction = {
    inventoryItemId: string;
    productName: string;
    quantity: number; // How many units or bundles are being sold
    totalPrice: number;
    sale_type: 'loose' | 'bundle';
    items_per_bundle: number; // Need this for stock calculation
};


// Supabase user object has a different structure.
// We map it to this simplified User type for use in the app.
export interface User {
    id: string;
    name: string;
    email: string;
    picture: string;
}