export enum Page {
    Dashboard = 'DASHBOARD',
    Sales = 'SALES',
    Inventory = 'INVENTORY',
    Insights = 'INSIGHTS',
}

export interface Sale {
    id: string;
    user_id: string;
    inventoryItemId: string;
    productName: string;
    quantity: number;
    totalPrice: number;
    date: string; // ISO string
    paymentMethod: 'Online' | 'Offline';
    has_gst?: boolean;
}

export interface InventoryItem {
    id: string;
    user_id: string;
    name: string;
    stock: number;
    price: number;
    cost: number;
    created_at?: string;
    updated_at?: string;
    has_gst?: boolean;
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

// Supabase user object has a different structure.
// We map it to this simplified User type for use in the app.
export interface User {
    id: string;
    name: string;
    email: string;
    picture: string;
}