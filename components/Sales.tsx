import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { ShopContext } from '../App';
import { Sale, Transaction, InventoryItem, CartItemForTransaction } from '../types';
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import { PlusIcon, DeleteIcon, EditIcon } from './Icons';
import { useFilters } from '../FilterContext';
import DateFilterComponent from './ui/DateFilter';
import { useDebounce } from '../hooks/useDebounce';

interface CartItem {
    inventoryItemId: string;
    productName: string;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
    stock: number;
    costPerUnit: number;
    sale_type: 'loose' | 'bundle';
    items_per_bundle: number;
}

const SalesForm: React.FC<{
    onClose: () => void;
    transactionToEdit?: Transaction | null;
    onUpdate: (id: string, items: CartItemForTransaction[], pm: 'Online' | 'Offline') => Promise<void>;
}> = ({ onClose, transactionToEdit, onUpdate }) => {
    const { inventory, addTransaction, addInventoryItem } = useContext(ShopContext);
    
    // Form state for the item being added
    const [currentItem, setCurrentItem] = useState<InventoryItem | null>(null);
    const [quantity, setQuantity] = useState<string>('1');
    const [price, setPrice] = useState<string>('0');
    const [productSearch, setProductSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [saleType, setSaleType] = useState<'loose' | 'bundle'>('loose');
    
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'Online' | 'Offline'>('Offline');
    
    // State for creating a new item
    const [isCreatingNewItem, setIsCreatingNewItem] = useState(false);
    const [newItemPrice, setNewItemPrice] = useState('0');
    const [newItemCost, setNewItemCost] = useState('0');
    const [newItemHasGst, setNewItemHasGst] = useState(false);
    const [newItemStock, setNewItemStock] = useState('');
    const [newItemIsBundle, setNewItemIsBundle] = useState(false);
    const [newItemBundlePrice, setNewItemBundlePrice] = useState('');
    const [newItemItemsPerBundle, setNewItemItemsPerBundle] = useState('');
    
    const searchRef = useRef<HTMLDivElement>(null);

    const grandTotal = useMemo(() => cart.reduce((acc, item) => acc + item.totalPrice, 0), [cart]);

    const filteredInventory = useMemo(() => {
        if (!inventory) return [];
        if (!productSearch) return inventory;
        return inventory.filter(item =>
            item.name.toLowerCase().includes(productSearch.toLowerCase())
        );
    }, [productSearch, inventory]);

    useEffect(() => {
        if (transactionToEdit && inventory) {
            const inventoryMap = new Map(inventory.map(i => [i.id, i]));
            
            // Calculate how many units were sold in this transaction for each item
            const stockRestorationMap = new Map<string, number>();
            transactionToEdit.items.forEach(saleItem => {
                const invItem = inventoryMap.get(saleItem.inventoryItemId);
                if(invItem){
                    const unitsSold = saleItem.sale_type === 'bundle' 
                        ? saleItem.quantity * (invItem.items_per_bundle || 1) 
                        : saleItem.quantity;
                    const currentRestoration = stockRestorationMap.get(saleItem.inventoryItemId) || 0;
                    stockRestorationMap.set(saleItem.inventoryItemId, currentRestoration + unitsSold);
                }
            });

            const cartItems: CartItem[] = transactionToEdit.items.map(saleItem => {
                const invItem = inventoryMap.get(saleItem.inventoryItemId);
                if (!invItem) return null;

                const pricePerUnit = saleItem.totalPrice / saleItem.quantity;
                const originalStock = invItem.stock + (stockRestorationMap.get(invItem.id) || 0);

                return {
                    inventoryItemId: invItem.id,
                    productName: invItem.name,
                    quantity: saleItem.quantity,
                    pricePerUnit: pricePerUnit,
                    totalPrice: saleItem.totalPrice,
                    stock: originalStock, // Use restored stock for validation
                    costPerUnit: invItem.cost,
                    sale_type: saleItem.sale_type || 'loose',
                    items_per_bundle: invItem.items_per_bundle || 1,
                };
            }).filter((item): item is CartItem => item !== null);

            setCart(cartItems);
            setPaymentMethod(transactionToEdit.payment_method);
        }
    }, [transactionToEdit, inventory]);

     useEffect(() => {
        if (currentItem) {
            const newPrice = saleType === 'bundle' ? (currentItem.bundle_price || 0) : currentItem.price;
            setPrice(newPrice.toFixed(2));
        } else {
            setPrice('0.00');
        }
    }, [currentItem, saleType]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const resetCurrentItemForm = () => {
        setProductSearch('');
        setQuantity('1');
        setPrice('0');
        setCurrentItem(null);
        setSaleType('loose');
        setIsCreatingNewItem(false);
        setNewItemPrice('0');
        setNewItemCost('0');
        setNewItemHasGst(false);
        setNewItemStock('');
        setNewItemIsBundle(false);
        setNewItemBundlePrice('');
        setNewItemItemsPerBundle('');
    };

    const handleSelectProduct = (invItem: InventoryItem) => {
        setCurrentItem(invItem);
        setProductSearch(invItem.name);
        setSaleType(invItem.is_bundle ? 'loose' : 'loose'); // Default to loose
        setIsCreatingNewItem(false);
        setIsDropdownOpen(false);
    };
    
    const handleAddToCart = async () => {
        const numQuantity = Number(quantity);
        const numPrice = Number(price);

        if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
            alert('Quantity must be a positive whole number.');
            return;
        }

        let itemToAdd: CartItem | null = null;

        if (isCreatingNewItem) {
             const numNewStock = Number(newItemStock);
             const numNewPrice = Number(newItemPrice);
             const numNewCost = Number(newItemCost);
             const numNewBundlePrice = Number(newItemBundlePrice);
             const numNewItemsPerBundle = Number(newItemItemsPerBundle);
             const trimmedName = productSearch.trim();

             if (!trimmedName) { alert('New product needs a name.'); return; }
             if (numNewStock < numQuantity) { alert('Initial stock cannot be less than the quantity being sold.'); return; }
             if (numNewPrice < numNewCost) { alert('Selling price cannot be less than the cost price.'); return; }
             if (inventory && inventory.some(item => item.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
                alert('An item with this name already exists in the inventory.'); return;
             }
             if (newItemIsBundle) {
                if(isNaN(numNewBundlePrice) || numNewBundlePrice <= 0) { alert('Bundle price must be a positive number.'); return; }
                if(!Number.isInteger(numNewItemsPerBundle) || numNewItemsPerBundle <= 1) { alert('Items per bundle must be a whole number greater than 1.'); return; }
            }

             const newItemData = { 
                name: trimmedName, 
                price: numNewPrice, 
                cost: numNewCost, 
                has_gst: newItemHasGst, 
                stock: numNewStock,
                is_bundle: newItemIsBundle,
                bundle_price: newItemIsBundle ? numNewBundlePrice : undefined,
                items_per_bundle: newItemIsBundle ? numNewItemsPerBundle : undefined,
            };
             const newInventoryItem = await addInventoryItem(newItemData);
             if (!newInventoryItem) { alert('Failed to create new item.'); return; }
            
             itemToAdd = {
                inventoryItemId: newInventoryItem.id,
                productName: newInventoryItem.name,
                quantity: numQuantity,
                pricePerUnit: newInventoryItem.price,
                totalPrice: newInventoryItem.price * numQuantity,
                stock: newInventoryItem.stock,
                costPerUnit: newInventoryItem.cost,
                sale_type: 'loose',
                items_per_bundle: 1,
            };
        } else if (currentItem) {
            const costOfSaleUnit = saleType === 'bundle' ? (currentItem.cost * (currentItem.items_per_bundle || 1)) : currentItem.cost;
            const unitsNeeded = saleType === 'bundle' ? numQuantity * (currentItem.items_per_bundle || 1) : numQuantity;
            
            if(unitsNeeded > currentItem.stock) { alert(`Not enough stock for ${currentItem.name}. Only ${currentItem.stock} units available.`); return; }
            if (numPrice < costOfSaleUnit) { alert(`Selling price (₹${numPrice.toFixed(2)}) cannot be less than the item's cost (₹${costOfSaleUnit.toFixed(2)}).`); return; }


            itemToAdd = {
                inventoryItemId: currentItem.id,
                productName: currentItem.name,
                quantity: numQuantity,
                pricePerUnit: numPrice,
                totalPrice: numPrice * numQuantity,
                stock: currentItem.stock,
                costPerUnit: currentItem.cost,
                sale_type: saleType,
                items_per_bundle: currentItem.items_per_bundle || 1,
            };
        } else {
             alert('Please select a product to add.');
             return;
        }
        
        if (itemToAdd) {
            setCart(prev => [...prev, itemToAdd!]);
        }
        resetCurrentItemForm();
    };
    
    const handleUpdateCartItem = (index: number, field: 'quantity' | 'pricePerUnit', value: string) => {
        const updatedCart = [...cart];
        const item = updatedCart[index];

        if (field === 'quantity') {
            const numQuantity = value === '' ? 1 : Math.floor(Number(value));
            item.quantity = Math.max(1, numQuantity);

            const unitsNeeded = item.sale_type === 'bundle' ? item.quantity * item.items_per_bundle : item.quantity;
            if (unitsNeeded > item.stock) {
                const maxQty = item.sale_type === 'bundle' ? Math.floor(item.stock / item.items_per_bundle) : item.stock;
                item.quantity = maxQty > 0 ? maxQty : 1;
                alert(`Not enough stock. Quantity has been adjusted to the maximum available (${item.quantity}).`);
            }
        }

        if (field === 'pricePerUnit') {
            const numPrice = value === '' ? 0 : Number(value);
            item.pricePerUnit = Math.max(0, numPrice);
        }

        item.totalPrice = item.quantity * item.pricePerUnit;
        setCart(updatedCart);
    };

    const handlePriceValidation = (index: number) => {
        const item = cart[index];
        const costOfSaleUnit = item.sale_type === 'bundle' ? (item.costPerUnit * item.items_per_bundle) : item.costPerUnit;
        if (item.pricePerUnit < costOfSaleUnit) {
            alert(`Selling price (₹${item.pricePerUnit.toFixed(2)}) cannot be less than the item's cost (₹${costOfSaleUnit.toFixed(2)}). Reverting to cost price.`);
            handleUpdateCartItem(index, 'pricePerUnit', costOfSaleUnit.toFixed(2));
        }
    };


    const handleRemoveFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmitTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) {
            alert('Cannot submit an empty sale. Please add at least one item.');
            return;
        }
        
        for (const item of cart) {
             const costOfSaleUnit = item.sale_type === 'bundle' ? (item.costPerUnit * item.items_per_bundle) : item.costPerUnit;
             if (item.pricePerUnit < costOfSaleUnit) {
                alert(`The price for ${item.productName} is below its cost. Please correct it before submitting.`);
                return;
             }
        }

        const transactionItems: CartItemForTransaction[] = cart.map(ci => ({
            inventoryItemId: ci.inventoryItemId,
            productName: ci.productName,
            quantity: ci.quantity,
            totalPrice: ci.totalPrice,
            sale_type: ci.sale_type,
            items_per_bundle: ci.items_per_bundle,
        }));
        
        if (transactionToEdit) {
            await onUpdate(transactionToEdit.id, transactionItems, paymentMethod);
        } else {
            await addTransaction(transactionItems, paymentMethod);
        }
        onClose();
    };

    const quantityLabel = currentItem?.is_bundle ? (saleType === 'bundle' ? 'Quantity (Bundles)' : 'Quantity (Units)') : 'Quantity';
    const maxQuantity = currentItem ? (saleType === 'bundle' ? Math.floor(currentItem.stock / (currentItem.items_per_bundle || 1)) : currentItem.stock) : 999;


    return (
         <form onSubmit={handleSubmitTransaction} className="space-y-6">
            <div className="p-4 border border-border rounded-lg space-y-4">
                 <div className="relative" ref={searchRef}>
                    <label className="block text-sm font-medium text-text-muted">Product</label>
                    <input
                        type="text" value={productSearch}
                        onChange={(e) => { setProductSearch(e.target.value); setCurrentItem(null); setIsCreatingNewItem(false); setIsDropdownOpen(true); }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder="Search or type to add new..." autoComplete="off"
                        className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    />
                     {isDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-surface border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {filteredInventory.map(invItem => (
                                <div key={invItem.id} onClick={() => handleSelectProduct(invItem)} className="cursor-pointer px-4 py-2 text-sm text-text-main hover:bg-surface-hover flex justify-between">
                                    <span>{invItem.name}</span>
                                    <span className="text-text-muted">Stock: {invItem.stock}</span>
                                </div>
                            ))}
                            {filteredInventory.length === 0 && productSearch.trim() !== '' && (
                                 <div onClick={() => { setIsCreatingNewItem(true); setIsDropdownOpen(false); }} className="cursor-pointer px-4 py-2 text-sm text-text-main hover:bg-surface-hover flex items-center gap-2">
                                    <PlusIcon /> <span>Add "{productSearch.trim()}" to inventory</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {currentItem?.is_bundle && (
                    <div>
                         <label className="block text-sm font-medium text-text-muted">Sale Type</label>
                         <div className="mt-2 flex rounded-md shadow-sm bg-surface border border-border" role="group">
                             <button type="button" onClick={() => setSaleType('loose')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-l-md transition-colors ${saleType === 'loose' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>
                                 Loose (₹{currentItem.price.toFixed(2)})
                             </button>
                             <button type="button" onClick={() => setSaleType('bundle')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-r-md border-l border-border transition-colors ${saleType === 'bundle' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>
                                 Bundle (₹{currentItem.bundle_price?.toFixed(2)})
                             </button>
                         </div>
                    </div>
                )}
                {isCreatingNewItem && (
                    <div className="space-y-4 p-4 border border-dashed border-border rounded-lg bg-background/50">
                        <h4 className="text-sm font-semibold text-text-main">New Item Details</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-text-muted">Initial Stock</label>
                                <input type="number" value={newItemStock} onChange={e => setNewItemStock(e.target.value)} min="1" step="1" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted">Loose Price (₹)</label>
                                <input type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted">Cost/Unit (₹)</label>
                                <input type="number" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                        </div>
                        <div className="pt-2 space-y-2">
                            <label className="flex items-center cursor-pointer">
                                <input type="checkbox" checked={newItemHasGst} onChange={e => setNewItemHasGst(e.target.checked)} className="h-4 w-4 rounded text-primary border-border focus:ring-primary bg-background" />
                                <span className="ml-2 text-sm text-text-main">Includes GST</span>
                            </label>
                             <label className="flex items-center cursor-pointer">
                                <input type="checkbox" checked={newItemIsBundle} onChange={e => setNewItemIsBundle(e.target.checked)} className="h-4 w-4 rounded text-primary border-border focus:ring-primary bg-background" />
                                <span className="ml-2 text-sm text-text-main">Sell as a bundle?</span>
                            </label>
                        </div>
                        {newItemIsBundle && (
                            <div className="pt-2 space-y-2">
                                <h5 className="text-xs font-semibold text-text-muted uppercase">Bundle Details</h5>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-text-muted">Bundle Price (₹)</label>
                                        <input type="number" value={newItemBundlePrice} onChange={e => setNewItemBundlePrice(e.target.value)} min="0.01" step="0.01" required={newItemIsBundle} className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-muted">Items per Bundle</label>
                                        <input type="number" value={newItemItemsPerBundle} onChange={e => setNewItemItemsPerBundle(e.target.value)} min="2" step="1" required={newItemIsBundle} className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                 )}
                 <div className="flex items-end gap-4">
                     <div className="flex-auto">
                        <label className="block text-sm font-medium text-text-muted">{quantityLabel}</label>
                        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" max={maxQuantity} required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                    <div className="flex-auto">
                        <label className="block text-sm font-medium text-text-muted">Price (₹)</label>
                        <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                    <button type="button" onClick={handleAddToCart} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors h-10">
                        <PlusIcon /> <span className="ml-2">Add</span>
                    </button>
                 </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-lg font-medium text-text-main">Current Sale Items</h3>
                {cart.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-4 bg-background rounded-lg border border-border">No items added yet.</p>
                ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                        {cart.map((item, index) => (
                           <div key={`${item.inventoryItemId}-${index}`} className="grid grid-cols-12 gap-2 items-center bg-background p-3 rounded-md border border-border">
                                <div className="col-span-12 sm:col-span-4">
                                    <p className="font-medium text-text-main truncate">{item.productName}</p>
                                    <p className="text-xs text-text-muted">
                                        {item.sale_type === 'bundle' ? `Bundle (${item.items_per_bundle} units)` : 'Loose'}
                                    </p>
                                </div>
                                
                                <div className="col-span-4 sm:col-span-2">
                                    <label className="block text-xs text-text-muted sm:hidden">Qty</label>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateCartItem(index, 'quantity', e.target.value)}
                                        min="1"
                                        className="w-full bg-surface border border-border rounded-md py-1 px-2 text-sm text-text-main focus:ring-primary focus:border-primary"
                                    />
                                </div>

                                <div className="col-span-4 sm:col-span-2">
                                    <label className="block text-xs text-text-muted sm:hidden">Price</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-text-muted text-sm">₹</span>
                                        <input
                                            type="number"
                                            value={item.pricePerUnit.toFixed(2)}
                                            onBlur={() => handlePriceValidation(index)}
                                            onChange={(e) => handleUpdateCartItem(index, 'pricePerUnit', e.target.value)}
                                            min="0"
                                            step="0.01"
                                            className="w-full bg-surface border border-border rounded-md py-1 px-2 pl-5 text-sm text-text-main focus:ring-primary focus:border-primary"
                                        />
                                    </div>
                                </div>

                                <div className="col-span-4 sm:col-span-4 flex items-center justify-end gap-2">
                                    <p className="font-semibold text-text-main text-right w-full">
                                        ₹{item.totalPrice.toFixed(2)}
                                    </p>
                                    <button type="button" onClick={() => handleRemoveFromCart(index)} className="text-danger p-1 rounded-full hover:bg-surface-hover flex-shrink-0">
                                        <DeleteIcon />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t border-border pt-4 space-y-4">
                <div className="flex justify-between items-center text-xl font-bold">
                    <span className="text-text-main">Grand Total:</span>
                    <span className="text-success">₹{grandTotal.toFixed(2)}</span>
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-muted">Payment Method</label>
                    <div className="mt-2 flex space-x-6">
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="paymentMethod" value="Offline" checked={paymentMethod === 'Offline'} onChange={() => setPaymentMethod('Offline')} className="h-4 w-4 text-primary border-border focus:ring-primary bg-background" />
                            <span className="ml-2 text-sm text-text-main">Offline (Cash)</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="paymentMethod" value="Online" checked={paymentMethod === 'Online'} onChange={() => setPaymentMethod('Online')} className="h-4 w-4 text-primary border-border focus:ring-primary bg-background" />
                            <span className="ml-2 text-sm text-text-main">Online</span>
                        </label>
                    </div>
                </div>
            </div>

             <div className="flex justify-end pt-4">
                <button type="submit" className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors">
                    {transactionToEdit ? 'Update Sale' : 'Submit Sale'}
                </button>
            </div>
        </form>
    );
};

type GstFilter = 'all' | 'gst' | 'non-gst';

const GstFilterComponent: React.FC<{ filter: GstFilter, setFilter: (filter: GstFilter) => void }> = ({ filter, setFilter }) => {
    return (
        <div className="flex rounded-md shadow-sm bg-surface border border-border w-full" role="group">
            <button
                type="button"
                onClick={() => setFilter('all')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-l-md transition-colors ${filter === 'all' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}
            >
                All
            </button>
            <button
                type="button"
                onClick={() => setFilter('gst')}
                className={`flex-1 px-3 py-2 text-sm font-medium border-x border-border transition-colors ${filter === 'gst' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}
            >
                GST
            </button>
            <button
                type="button"
                onClick={() => setFilter('non-gst')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-r-md transition-colors ${filter === 'non-gst' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}
            >
                Non-GST
            </button>
        </div>
    );
};

const TransactionCard: React.FC<{ transaction: Transaction; onDelete: () => void; onEdit: () => void; }> = ({ transaction, onEdit, onDelete }) => (
    <div className="bg-surface p-4 rounded-lg border border-border flex flex-col space-y-3">
        <div className="flex justify-between items-start">
             <div className="flex-1 pr-4">
                <h3 className="font-bold text-lg text-success">₹{transaction.total_price.toFixed(2)}</h3>
                <p className="text-sm text-text-muted mt-1">
                    {new Date(transaction.date).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                </p>
            </div>
             <div className="flex items-center space-x-2">
                 <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ transaction.payment_method === 'Online' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400' }`}>
                    {transaction.payment_method}
                </span>
                 <button 
                    onClick={onEdit}
                    className="text-primary hover:text-primary-focus p-3 rounded-full hover:bg-surface-hover transition-colors"
                >
                    <EditIcon />
                </button>
                <button 
                    onClick={onDelete} 
                    className="text-danger hover:opacity-80 p-3 rounded-full hover:bg-surface-hover transition-colors"
                >
                    <DeleteIcon />
                </button>
            </div>
        </div>
        
        <div className="pt-2 border-t border-border/50 space-y-2">
            {transaction.items.map(item => (
                 <div key={item.id} className="flex justify-between items-center text-sm">
                    <div className="text-text-main">
                        {item.productName} 
                        <span className="text-text-muted ml-2"> (x{item.quantity} {item.sale_type === 'bundle' ? 'bundles' : ''})</span>
                        {item.has_gst && <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
                    </div>
                    <span className="text-text-muted">₹{item.totalPrice.toFixed(2)}</span>
                 </div>
            ))}
        </div>
    </div>
);


const Sales: React.FC = () => {
    const { transactions, deleteTransaction, addTransaction } = useContext(ShopContext);
    const { dateFilter } = useFilters();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
    const [gstFilter, setGstFilter] = useState<GstFilter>('all');
    
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    if (!transactions) {
        return null;
    }

    const filteredTransactions = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let results: Transaction[] = transactions;

        // Apply date filter
        switch (dateFilter.type) {
            case 'today':
                results = results.filter(t => new Date(t.date) >= today);
                break;
            case '7days':
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(today.getDate() - 6);
                results = results.filter(t => new Date(t.date) >= sevenDaysAgo);
                break;
            case '30days':
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(today.getDate() - 29);
                results = results.filter(t => new Date(t.date) >= thirtyDaysAgo);
                break;
            case 'custom':
                 if (dateFilter.startDate && dateFilter.endDate) {
                    const start = new Date(dateFilter.startDate);
                    start.setUTCHours(0, 0, 0, 0);
                    const end = new Date(dateFilter.endDate);
                    end.setUTCHours(23, 59, 59, 999);
                    results = results.filter(t => {
                        const transactionDate = new Date(t.date);
                        return transactionDate >= start && transactionDate <= end;
                    });
                }
                break;
        }

        // Apply GST filter
        switch (gstFilter) {
            case 'gst':
                results = results.filter(t => t.items.some(item => item.has_gst));
                break;
            case 'non-gst':
                results = results.filter(t => t.items.every(item => !item.has_gst));
                break;
        }
        
        // Apply search filter
        if (debouncedSearchTerm) {
            results = results.filter(t =>
                t.items.some(item => item.productName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
            );
        }

        return results;
    }, [transactions, dateFilter, gstFilter, debouncedSearchTerm]);

    const handleOpenModal = (transaction: Transaction | null = null) => {
        setTransactionToEdit(transaction);
        setIsModalOpen(true);
    };

    const handleUpdateTransaction = async (
        originalTransactionId: string,
        items: CartItemForTransaction[],
        paymentMethod: 'Online' | 'Offline'
    ) => {
        await deleteTransaction(originalTransactionId);
        await addTransaction(items, paymentMethod);
    };

    const openDeleteConfirm = (transaction: Transaction) => {
        setTransactionToDelete(transaction);
        setIsConfirmModalOpen(true);
    };

    const handleDelete = () => {
        if (transactionToDelete) {
            deleteTransaction(transactionToDelete.id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h2 className="text-3xl font-bold text-text-main">Sales Records</h2>
                <button onClick={() => handleOpenModal()} className="hidden md:inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors flex-shrink-0">
                    <PlusIcon />
                    <span className="ml-2">New Sale</span>
                </button>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                 <div className="relative w-full md:max-w-xs">
                    <input
                        type="text"
                        placeholder="Search by product name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    />
                </div>
                <div className="w-full md:w-auto">
                    <GstFilterComponent filter={gstFilter} setFilter={setGstFilter} />
                </div>
                <DateFilterComponent className="w-full md:w-auto" />
            </div>

            <Modal title={transactionToEdit ? "Edit Sale" : "Record New Sale"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <SalesForm 
                    onClose={() => setIsModalOpen(false)} 
                    transactionToEdit={transactionToEdit}
                    onUpdate={handleUpdateTransaction}
                />
            </Modal>
            
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Sale Record"
            >
                Are you sure you want to delete this transaction from {new Date(transactionToDelete?.date || '').toLocaleDateString()}? This will restore stock for all items and cannot be undone.
            </ConfirmationModal>

            <div className="md:hidden space-y-4 pb-20">
                {filteredTransactions.length > 0 ? (
                    filteredTransactions.map(t => 
                        <TransactionCard 
                            key={t.id} 
                            transaction={t}
                            onDelete={() => openDeleteConfirm(t)}
                            onEdit={() => handleOpenModal(t)}
                        />
                    )
                ) : (
                    <div className="text-center py-10 text-text-muted bg-surface rounded-lg border border-border">
                        <p className="font-semibold">No Sales Found</p>
                        <p className="text-sm mt-1">No sales records match the current filter.</p>
                    </div>
                )}
            </div>

            <div className="hidden md:block bg-surface rounded-lg shadow border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-background">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Items</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Total Price (₹)</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Payment</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-text-muted">
                                        <p className="font-semibold">No Sales Found</p>
                                        <p className="text-sm mt-1">No sales records match the current filter.</p>
                                    </td>
                                </tr>
                            )}
                            {filteredTransactions.map((t: Transaction) => (
                                <tr key={t.id} className="hover:bg-surface-hover/50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-main">
                                        {t.items.map(item => (
                                            <div key={item.id} className="flex items-center gap-2">
                                                <span>{item.productName} (x{item.quantity} {item.sale_type === 'bundle' ? 'bundles' : ''})</span>
                                                {item.has_gst && <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
                                            </div>
                                        ))}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-text-main">₹{t.total_price.toFixed(2)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            t.payment_method === 'Online'
                                            ? 'bg-blue-500/10 text-blue-400'
                                            : 'bg-gray-500/10 text-gray-400'
                                        }`}>
                                            {t.payment_method}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">{new Date(t.date).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            <button onClick={() => handleOpenModal(t)} className="text-primary hover:text-primary-focus p-1 rounded-full hover:bg-surface-hover transition-colors"><EditIcon /></button>
                                            <button onClick={() => openDeleteConfirm(t)} className="text-danger hover:opacity-80 p-1 rounded-full hover:bg-surface-hover transition-colors"><DeleteIcon /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <button
                onClick={() => handleOpenModal()}
                className="md:hidden fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-lg z-20 flex items-center justify-center hover:bg-primary-focus transition-transform duration-200 active:scale-95"
                aria-label="Record New Sale"
            >
                <PlusIcon />
            </button>
        </div>
    );
};

export default Sales;