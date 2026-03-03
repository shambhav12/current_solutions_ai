-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Inventory Table
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stock NUMERIC NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    has_gst BOOLEAN DEFAULT FALSE,
    is_bundle BOOLEAN DEFAULT FALSE,
    bundle_price NUMERIC,
    items_per_bundle NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_price NUMERIC NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Online', 'Offline', 'On Credit')),
    date TIMESTAMPTZ DEFAULT NOW(),
    customer_name TEXT,
    customer_phone TEXT
);

-- Sales Table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    "inventoryItemId" UUID REFERENCES inventory(id) ON DELETE SET NULL,
    "productName" TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    "totalPrice" NUMERIC NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    payment_method TEXT,
    has_gst BOOLEAN,
    item_cost_at_sale NUMERIC,
    sale_type TEXT CHECK (sale_type IN ('loose', 'bundle')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'returned'))
);

-- Enable Row Level Security
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Inventory
CREATE POLICY "Users can manage their own inventory" ON inventory
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for Transactions
CREATE POLICY "Users can manage their own transactions" ON transactions
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for Sales
CREATE POLICY "Users can manage their own sales" ON sales
    FOR ALL USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for inventory updated_at
CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
