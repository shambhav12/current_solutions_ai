import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { ShopContext } from '../App';
import { Sale, Transaction, InventoryItem, CartItemForTransaction } from '../types';
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import { PlusIcon, DeleteIcon, EditIcon, ReturnIcon, CreditIcon, FilterIcon, InvoiceIcon } from './Icons';
import { useFilters, GstFilter, PaymentFilter, BundleFilter } from '../FilterContext';
import DateFilterComponent from './ui/DateFilter';
import { useDebounce } from '../hooks/useDebounce';
import { generateInvoicePDF } from '../utils/generateInvoice';

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
    is_bundle_item: boolean;
}

const SalesForm: React.FC<{
    onClose: () => void;
    transactionToEdit?: Transaction | null;
    onUpdate: (id: string, items: CartItemForTransaction[], pm: 'Online' | 'Offline' | 'On Credit', customerInfo?: { name?: string; phone?: string }) => Promise<void>;
}> = ({ onClose, transactionToEdit, onUpdate }) => {
    const { inventory, addTransaction, addInventoryItem } = useContext(ShopContext);
    
    const [currentItem, setCurrentItem] = useState<InventoryItem | null>(null);
    const [quantity, setQuantity] = useState<string>('1');
    const [price, setPrice] = useState<string>('0');
    const [productSearch, setProductSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [saleType, setSaleType] = useState<'loose' | 'bundle'>('loose');
    
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'Online' | 'Offline' | 'On Credit'>('Offline');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    
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
             const editableItems = transactionToEdit.items.filter(item => item.status !== 'returned');
            const inventoryMap = new Map(inventory.map(i => [i.id, i]));
            
            const stockRestorationMap = new Map<string, number>();
            editableItems.forEach(saleItem => {
                const invItem = inventoryMap.get(saleItem.inventoryItemId);
                if(invItem){
                    const unitsSold = saleItem.sale_type === 'bundle' 
                        ? saleItem.quantity * (invItem.items_per_bundle || 1) 
                        : saleItem.quantity;
                    const currentRestoration = stockRestorationMap.get(saleItem.inventoryItemId) || 0;
                    stockRestorationMap.set(saleItem.inventoryItemId, currentRestoration + unitsSold);
                }
            });

            const cartItems: CartItem[] = editableItems.map(saleItem => {
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
                    stock: originalStock,
                    costPerUnit: invItem.cost,
                    sale_type: saleItem.sale_type || 'loose',
                    items_per_bundle: invItem.items_per_bundle || 1,
                    is_bundle_item: invItem.is_bundle || false,
                };
            }).filter((item): item is CartItem => item !== null);

            setCart(cartItems);
            setPaymentMethod(transactionToEdit.payment_method);
            setCustomerName(transactionToEdit.customer_name || '');
            setCustomerPhone(transactionToEdit.customer_phone || '');
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
        setSaleType(invItem.is_bundle ? 'loose' : 'loose');
        setIsCreatingNewItem(false);
        setIsDropdownOpen(false);
    };
    
    const handleAddToCart = async () => {
        const numQuantity = Number(quantity);
        const numPrice = Number(price);

        if (isNaN(numQuantity) || !Number.isInteger(numQuantity) || numQuantity <= 0) {
            alert('Quantity must be a positive whole number.');
            return;
        }
        if (isNaN(numPrice) || numPrice < 0) {
            alert('Price must be a valid, non-negative number.');
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
             if (isNaN(numNewStock) || !Number.isInteger(numNewStock) || numNewStock < 0) { alert('Initial stock must be a non-negative whole number.'); return; }
             if (isNaN(numNewPrice) || numNewPrice < 0) { alert('Selling price must be a non-negative number.'); return; }
             if (isNaN(numNewCost) || numNewCost < 0) { alert('Cost must be a non-negative number.'); return; }
             if (numNewStock < numQuantity) { alert('Initial stock cannot be less than the quantity being sold.'); return; }
             if (numNewPrice < numNewCost) { alert('Selling price cannot be less than the cost price.'); return; }
             if (inventory && inventory.some(item => item.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
                alert('An item with this name already exists in the inventory.'); return;
             }
             if (cart.some(cartItem => cartItem.productName.trim().toLowerCase() === trimmedName.toLowerCase())) {
                 alert(`An item named "${trimmedName}" is already in the cart. Please choose a different name.`);
                 return;
             }
             if (newItemIsBundle) {
                if(isNaN(numNewBundlePrice) || numNewBundlePrice <= 0) { alert('Bundle price must be a positive number.'); return; }
                if(isNaN(numNewItemsPerBundle) || !Number.isInteger(numNewItemsPerBundle) || numNewItemsPerBundle <= 1) { alert('Items per bundle must be a whole number greater than 1.'); return; }
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
                is_bundle_item: newInventoryItem.is_bundle || false,
            };
        } else if (currentItem) {
            if (cart.some(cartItem => cartItem.inventoryItemId === currentItem.id)) {
                alert(`"${currentItem.name}" is already in the cart. You can edit its quantity and price in the list below.`);
                return;
            }
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
                is_bundle_item: currentItem.is_bundle || false,
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
    
    // FIX: Implemented robust validation to prevent NaN values from entering the state.
    // This was the primary cause of the "Bad Request" error.
    const handleUpdateCartItem = (index: number, field: 'quantity' | 'pricePerUnit', value: string) => {
        const updatedCart = [...cart];
        const item = updatedCart[index];

        if (field === 'quantity') {
            const numQuantity = parseInt(value, 10);
            // If input is invalid (e.g., "abc") or less than 1, default to 1 to prevent NaN state.
            if (isNaN(numQuantity) || numQuantity < 1) {
                item.quantity = 1;
            } else {
                const unitsNeeded = item.sale_type === 'bundle' ? numQuantity * item.items_per_bundle : numQuantity;
                if (unitsNeeded > item.stock) {
                    const maxQty = item.sale_type === 'bundle' ? Math.floor(item.stock / item.items_per_bundle) : item.stock;
                    item.quantity = Math.max(1, maxQty);
                    alert(`Not enough stock. Quantity has been adjusted to the maximum available (${item.quantity}).`);
                } else {
                    item.quantity = numQuantity;
                }
            }
        }

        if (field === 'pricePerUnit') {
            const numPrice = parseFloat(value);
            // If input is invalid or negative, default to 0 to prevent NaN state.
            if (isNaN(numPrice) || numPrice < 0) {
                item.pricePerUnit = 0;
            } else {
                item.pricePerUnit = numPrice;
            }
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
        
        // FIX: Added a comprehensive final validation loop before submission.
        for (const [index, item] of cart.entries()) {
             if (isNaN(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
                alert(`Item #${index + 1} (${item.productName}) has an invalid quantity. Please enter a positive whole number.`);
                return;
            }
            if (isNaN(item.pricePerUnit) || item.pricePerUnit < 0) {
                alert(`Item #${index + 1} (${item.productName}) has an invalid price. Please enter a non-negative number.`);
                return;
            }
            if (isNaN(item.totalPrice)) {
                alert(`Item #${index + 1} (${item.productName}) has an invalid total. Please check its quantity and price.`);
                return;
            }
             const costOfSaleUnit = item.sale_type === 'bundle' ? (item.costPerUnit * item.items_per_bundle) : item.costPerUnit;
             if (item.pricePerUnit < costOfSaleUnit) {
                alert(`The price for ${item.productName} is below its cost (₹${costOfSaleUnit.toFixed(2)}). Please correct it before submitting.`);
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
        
        const customerInfo = { name: customerName, phone: customerPhone };

        if (transactionToEdit) {
            await onUpdate(transactionToEdit.id, transactionItems, paymentMethod, customerInfo);
        } else {
            await addTransaction(transactionItems, paymentMethod, customerInfo);
        }
        onClose();
    };

    const handlePaymentMethodChange = (method: 'Online' | 'Offline' | 'On Credit') => {
        setPaymentMethod(method);
        if (method !== 'On Credit') {
            setCustomerName('');
            setCustomerPhone('');
        }
    };

    const quantityLabel = currentItem?.is_bundle ? (saleType === 'bundle' ? 'Quantity (Bundles)' : 'Quantity (Units)') : 'Quantity';
    const maxQuantity = currentItem ? (saleType === 'bundle' ? Math.floor(currentItem.stock / (currentItem.items_per_bundle || 1)) : currentItem.stock) : 999;

    return (
         <form onSubmit={handleSubmitTransaction} className="flex flex-col max-h-[85vh]">
            <div className="p-4 border border-border rounded-lg space-y-4 flex-shrink-0">
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
                                <input type="number" value={newItemStock} onChange={e => setNewItemStock(e.target.value)} min="0" step="1" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted">{newItemIsBundle ? 'Loose Price (₹)' : 'Selling Price (₹)'}</label>
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

            <div className="space-y-3 my-4 flex-grow overflow-y-auto">
                <h3 className="text-lg font-medium text-text-main">Current Sale Items</h3>
                {cart.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-4 bg-background rounded-lg border border-border">No items added yet.</p>
                ) : (
                    <div className="space-y-2 pr-2">
                        {cart.map((item, index) => (
                           <div key={`${item.inventoryItemId}-${index}`} className="bg-background p-3 rounded-md border border-border">
                               {/* Mobile View */}
                               <div className="sm:hidden">
                                   <div className="flex justify-between items-start">
                                       <div>
                                           <p className="font-medium text-text-main break-words">{item.productName}</p>
                                           {item.is_bundle_item && (
                                               <p className="text-xs text-text-muted">{item.sale_type === 'bundle' ? `Bundle (${item.items_per_bundle} units)` : 'Loose'}</p>
                                           )}
                                       </div>
                                       <p className="font-semibold text-text-main whitespace-nowrap ml-2">₹{item.totalPrice.toFixed(2)}</p>
                                   </div>
                                   <div className="flex items-center gap-2 mt-2">
                                       <div className="flex-1 min-w-[70px]">
                                           <label className="block text-xs text-text-muted mb-1">Qty</label>
                                           <input type="number" value={item.quantity} onChange={(e) => handleUpdateCartItem(index, 'quantity', e.target.value)} min="1" className="w-full bg-surface border border-border rounded-md py-1 px-2 text-sm text-text-main"/>
                                       </div>
                                       <div className="flex-1 min-w-[90px]">
                                           <label className="block text-xs text-text-muted mb-1">Price</label>
                                           <div className="relative">
                                               <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-text-muted text-sm">₹</span>
                                               <input type="number" value={item.pricePerUnit.toFixed(2)} onBlur={() => handlePriceValidation(index)} onChange={(e) => handleUpdateCartItem(index, 'pricePerUnit', e.target.value)} min="0" step="0.01" className="w-full bg-surface border border-border rounded-md py-1 pl-5 pr-2 text-sm text-text-main"/>
                                           </div>
                                       </div>
                                       <div className="self-end pb-0.5">
                                           <button type="button" onClick={() => handleRemoveFromCart(index)} className="text-danger p-2 rounded-full hover:bg-surface-hover">
                                               <DeleteIcon />
                                           </button>
                                       </div>
                                   </div>
                               </div>
                               {/* Desktop View */}
                               <div className="hidden sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center">
                                   <div className="sm:col-span-5">
                                       <p className="font-medium text-text-main truncate">{item.productName}</p>
                                       {item.is_bundle_item && <p className="text-xs text-text-muted">{item.sale_type === 'bundle' ? `Bundle (${item.items_per_bundle} units)` : 'Loose'}</p>}
                                   </div>
                                   <div className="sm:col-span-2">
                                       <input type="number" value={item.quantity} onChange={(e) => handleUpdateCartItem(index, 'quantity', e.target.value)} min="1" className="w-full bg-surface border border-border rounded-md py-1 px-2 text-sm text-text-main"/>
                                   </div>
                                   <div className="sm:col-span-2">
                                       <div className="relative">
                                           <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-text-muted text-sm">₹</span>
                                           <input type="number" value={item.pricePerUnit.toFixed(2)} onBlur={() => handlePriceValidation(index)} onChange={(e) => handleUpdateCartItem(index, 'pricePerUnit', e.target.value)} min="0" step="0.01" className="w-full bg-surface border border-border rounded-md py-1 pl-5 pr-2 text-sm text-text-main"/>
                                       </div>
                                   </div>
                                   <div className="sm:col-span-2 text-right">
                                       <p className="font-semibold text-text-main">₹{item.totalPrice.toFixed(2)}</p>
                                   </div>
                                   <div className="sm:col-span-1 flex justify-end">
                                       <button type="button" onClick={() => handleRemoveFromCart(index)} className="text-danger p-1 rounded-full hover:bg-surface-hover">
                                           <DeleteIcon />
                                       </button>
                                   </div>
                               </div>
                           </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t border-border pt-4 space-y-4 flex-shrink-0">
                <div className="flex justify-between items-center text-xl font-bold">
                    <span className="text-text-main">Grand Total:</span>
                    <span className="text-success">₹{grandTotal.toFixed(2)}</span>
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-muted">Payment Method</label>
                    <div className="mt-2 flex items-center justify-between">
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="paymentMethod" value="Offline" checked={paymentMethod === 'Offline'} onChange={() => handlePaymentMethodChange('Offline')} className="h-4 w-4 text-primary border-border focus:ring-primary bg-background" />
                            <span className="ml-2 text-sm text-text-main">Offline (Cash)</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="paymentMethod" value="Online" checked={paymentMethod === 'Online'} onChange={() => handlePaymentMethodChange('Online')} className="h-4 w-4 text-primary border-border focus:ring-primary bg-background" />
                            <span className="ml-2 text-sm text-text-main">Online</span>
                        </label>
                         <label className="flex items-center cursor-pointer">
                            <input type="radio" name="paymentMethod" value="On Credit" checked={paymentMethod === 'On Credit'} onChange={() => handlePaymentMethodChange('On Credit')} className="h-4 w-4 text-primary border-border focus:ring-primary bg-background" />
                            <span className="ml-2 text-sm text-text-main">On Credit</span>
                        </label>
                    </div>
                </div>
                {paymentMethod === 'On Credit' && (
                    <div className="p-4 border border-dashed border-amber-500/50 rounded-lg space-y-4 bg-amber-500/5">
                        <h4 className="text-sm font-semibold text-amber-400">Customer Details (Optional)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-text-muted">Customer Name</label>
                                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted">Phone Number</label>
                                <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                        </div>
                    </div>
                )}
                 <div className="flex justify-end pt-2">
                    <button type="submit" className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors">
                        {transactionToEdit ? 'Update Sale' : 'Submit Sale'}
                    </button>
                </div>
            </div>
        </form>
    );
};

const FilterPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { 
        gstFilter, setGstFilter,
        paymentFilter, setPaymentFilter,
        bundleFilter, setBundleFilter,
        resetFilters
    } = useFilters();

    const handleReset = () => {
        resetFilters();
        onClose();
    };

    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <div 
            className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-2xl bg-surface ring-1 ring-black ring-opacity-5 focus:outline-none z-10 border border-border"
            onClick={stopPropagation}
        >
            <div className="p-4 space-y-4">
                <div>
                    <label className="text-sm font-medium text-text-main">Date Range</label>
                    <DateFilterComponent className="w-full mt-1" />
                </div>
                <div>
                    <label className="text-sm font-medium text-text-main">Payment Status</label>
                    <div className="mt-1 flex rounded-md shadow-sm bg-background border border-border" role="group">
                        <button type="button" onClick={() => setPaymentFilter('all')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-l-md transition-colors ${paymentFilter === 'all' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>All</button>
                        <button type="button" onClick={() => setPaymentFilter('paid')} className={`flex-1 px-3 py-2 text-sm font-medium border-x border-border transition-colors ${paymentFilter === 'paid' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>Paid</button>
                        <button type="button" onClick={() => setPaymentFilter('credit')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-r-md transition-colors ${paymentFilter === 'credit' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>On Credit</button>
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium text-text-main">GST Status</label>
                     <div className="mt-1 flex rounded-md shadow-sm bg-background border border-border" role="group">
                        <button type="button" onClick={() => setGstFilter('all')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-l-md transition-colors ${gstFilter === 'all' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>All</button>
                        <button type="button" onClick={() => setGstFilter('gst')} className={`flex-1 px-3 py-2 text-sm font-medium border-x border-border transition-colors ${gstFilter === 'gst' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>GST</button>
                        <button type="button" onClick={() => setGstFilter('non-gst')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-r-md transition-colors ${gstFilter === 'non-gst' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>Non-GST</button>
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium text-text-main">Sale Type</label>
                     <div className="mt-1 flex rounded-md shadow-sm bg-background border border-border" role="group">
                        <button type="button" onClick={() => setBundleFilter('all')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-l-md transition-colors ${bundleFilter === 'all' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>All</button>
                        <button type="button" onClick={() => setBundleFilter('bundle')} className={`flex-1 px-3 py-2 text-sm font-medium border-x border-border transition-colors ${bundleFilter === 'bundle' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>Bundle</button>
                        <button type="button" onClick={() => setBundleFilter('non-bundle')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-r-md transition-colors ${bundleFilter === 'non-bundle' ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}>Non-Bundle</button>
                    </div>
                </div>
            </div>
            <div className="px-4 py-3 bg-background border-t border-border flex justify-end">
                <button
                    onClick={handleReset}
                    className="text-sm font-medium text-text-muted hover:text-text-main"
                >
                    Reset Filters
                </button>
            </div>
        </div>
    );
};


const TransactionCard: React.FC<{ transaction: Transaction; onDelete: () => void; onEdit: () => void; onReturn: (item: Sale) => void; onSettle: () => void; onDownload: () => void; inventoryMap: Map<string, InventoryItem> }> = ({ transaction, onEdit, onDelete, onReturn, onSettle, onDownload, inventoryMap }) => {
    const effectiveTotal = useMemo(() => 
        transaction.items.filter(i => i.status !== 'returned').reduce((acc, item) => acc + item.totalPrice, 0),
        [transaction.items]
    );
    const hasReturns = useMemo(() => transaction.items.some(i => i.status === 'returned'), [transaction.items]);

    const paymentMethodColors = {
        'Online': 'bg-blue-500/10 text-blue-400',
        'Offline': 'bg-gray-500/10 text-gray-400',
        'On Credit': 'bg-amber-500/10 text-amber-400',
    };

    return (
    <div className="bg-surface p-4 rounded-lg border border-border flex flex-col space-y-3">
        <div className="flex justify-between items-start">
             <div className="flex-1 pr-4">
                <h3 className="font-bold text-lg text-success">₹{effectiveTotal.toFixed(2)}</h3>
                {hasReturns && <p className="text-xs text-text-muted">Original: <span className="line-through">₹{transaction.total_price.toFixed(2)}</span></p>}
                <p className="text-sm text-text-muted mt-1">
                    {new Date(transaction.date).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                </p>
                {transaction.customer_name && (
                    <p className="text-sm text-text-muted mt-1">
                        For: <span className="font-medium text-text-main">{transaction.customer_name}</span>
                        {transaction.customer_phone && (
                            <>
                                {' ('}
                                <a href={`tel:${transaction.customer_phone}`} className="text-blue-400 hover:underline">
                                    {transaction.customer_phone}
                                </a>
                                {')'}
                            </>
                        )}
                    </p>
                )}
            </div>
             <div className="flex items-center space-x-1">
                 <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${paymentMethodColors[transaction.payment_method]}`}>
                    {transaction.payment_method === 'On Credit' ? 'Pending' : transaction.payment_method}
                </span>
                <button onClick={onDownload} className="text-info hover:opacity-80 p-3 rounded-full hover:bg-surface-hover transition-colors">
                    <InvoiceIcon />
                </button>
                 {transaction.payment_method !== 'On Credit' && (
                    <button onClick={onEdit} className="text-primary hover:text-primary-focus p-3 rounded-full hover:bg-surface-hover transition-colors">
                        <EditIcon />
                    </button>
                 )}
                <button onClick={onDelete} className="text-danger hover:opacity-80 p-3 rounded-full hover:bg-surface-hover transition-colors">
                    <DeleteIcon />
                </button>
            </div>
        </div>
        
        {transaction.payment_method === 'On Credit' && (
            <button onClick={onSettle} className="w-full text-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-success hover:opacity-90 transition-colors">
                Settle Payment
            </button>
        )}

        <div className="pt-2 border-t border-border/50 space-y-2">
            {transaction.items.map(item => {
                const invItem = inventoryMap.get(item.inventoryItemId);
                const isBundleItem = invItem?.is_bundle || false;
                return (
                 <div key={item.id} className="flex justify-between items-center text-sm group">
                    <div className={`text-text-main ${item.status === 'returned' ? 'line-through text-text-muted' : ''}`}>
                        {item.productName} 
                        <span className="text-text-muted ml-2"> (x{item.quantity}{isBundleItem ? (item.sale_type === 'bundle' ? ' bundles' : '') : ''})</span>
                        {item.has_gst && <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
                         {item.status === 'returned' && <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-warning/10 text-warning">Returned</span>}
                    </div>
                     <div className="flex items-center gap-2">
                        <span className={`text-text-muted ${item.status === 'returned' ? 'line-through' : ''}`}>₹{item.totalPrice.toFixed(2)}</span>
                        {item.status !== 'returned' && (
                            <button onClick={() => onReturn(item)} className="text-info hover:opacity-80 p-1 rounded-full hover:bg-surface-hover transition-colors opacity-0 group-hover:opacity-100">
                                <ReturnIcon />
                            </button>
                        )}
                    </div>
                 </div>
                )
            })}
        </div>
    </div>
    )
};


const Sales: React.FC = () => {
    const { transactions, deleteTransaction, addTransaction, processReturn, inventory } = useContext(ShopContext);
    const { dateFilter, gstFilter, paymentFilter, bundleFilter, activeFilterCount } = useFilters();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
    const [saleToReturn, setSaleToReturn] = useState<Sale | null>(null);
    const [transactionToSettle, setTransactionToSettle] = useState<Transaction | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const filterButtonRef = useRef<HTMLDivElement>(null);

    const inventoryMap = useMemo(() => {
        if (!inventory) return new Map<string, InventoryItem>();
        return new Map(inventory.map(i => [i.id, i]));
    }, [inventory]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterButtonRef.current && !filterButtonRef.current.contains(event.target as Node)) {
                setIsFilterPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    if (!transactions) {
        return null;
    }

    const filteredTransactions = useMemo(() => {
        let results: Transaction[] = transactions;

        // Date filter
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

        // GST filter
        if (gstFilter !== 'all') {
            results = results.filter(t => 
                gstFilter === 'gst' 
                    ? t.items.some(item => item.has_gst)
                    : t.items.every(item => !item.has_gst)
            );
        }

        // Payment filter
        if (paymentFilter !== 'all') {
            results = results.filter(t => 
                paymentFilter === 'credit'
                    ? t.payment_method === 'On Credit'
                    : t.payment_method === 'Online' || t.payment_method === 'Offline'
            );
        }

        // Bundle filter
        if (bundleFilter !== 'all') {
            results = results.filter(t => 
                bundleFilter === 'bundle'
                    ? t.items.some(item => item.sale_type === 'bundle')
                    : t.items.every(item => item.sale_type === 'loose')
            );
        }
        
        // Search term filter
        if (debouncedSearchTerm) {
            results = results.filter(t =>
                t.items.some(item => item.productName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
                (t.customer_name && t.customer_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
                (t.customer_phone && t.customer_phone.includes(debouncedSearchTerm))
            );
        }

        return results;
    }, [transactions, dateFilter, gstFilter, paymentFilter, bundleFilter, debouncedSearchTerm]);

    const handleOpenModal = (transaction: Transaction | null = null) => {
        setTransactionToEdit(transaction);
        setIsModalOpen(true);
    };

    const handleUpdateTransaction = async (
        originalTransactionId: string,
        items: CartItemForTransaction[],
        paymentMethod: 'Online' | 'Offline' | 'On Credit',
        customerInfo?: { name?: string; phone?: string }
    ) => {
        await deleteTransaction(originalTransactionId);
        await addTransaction(items, paymentMethod, customerInfo);
    };

    const openDeleteConfirm = (transaction: Transaction) => {
        setTransactionToDelete(transaction);
        setIsConfirmDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (transactionToDelete) {
            deleteTransaction(transactionToDelete.id);
        }
    };

    const handleConfirmReturn = async () => {
        if (saleToReturn) {
            await processReturn(saleToReturn.id);
        }
    };
    
    const handleSettlePayment = async (newPaymentMethod: 'Online' | 'Offline') => {
        if (transactionToSettle) {
            // Re-create the transaction items in the format needed by addTransaction
            const transactionItems: CartItemForTransaction[] = transactionToSettle.items.map(item => {
                const invItem = inventoryMap.get(item.inventoryItemId);
                return {
                    inventoryItemId: item.inventoryItemId,
                    productName: item.productName,
                    quantity: item.quantity,
                    totalPrice: item.totalPrice,
                    sale_type: item.sale_type || 'loose',
                    items_per_bundle: invItem?.items_per_bundle || 1,
                };
            });
    
            const customerInfo = {
                name: transactionToSettle.customer_name,
                phone: transactionToSettle.customer_phone,
            };
            
            // Use the same reliable "delete and recreate" logic as the edit flow
            await deleteTransaction(transactionToSettle.id);
            await addTransaction(transactionItems, newPaymentMethod, customerInfo);
    
            setTransactionToSettle(null);
        }
    };

    const paymentMethodBadges: Record<Transaction['payment_method'], React.ReactNode> = {
        'Online': <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-500/10 text-blue-400">Online</span>,
        'Offline': <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-500/10 text-gray-400">Offline</span>,
        'On Credit': <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-500/10 text-amber-400">On Credit</span>,
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Search by product, name, or phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    />
                </div>
                <div className="relative text-left" ref={filterButtonRef}>
                    <button
                        onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                        className="inline-flex items-center justify-center w-full px-4 py-2 border border-border text-sm font-medium rounded-md shadow-sm text-text-main bg-surface hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors"
                    >
                        <FilterIcon />
                        <span className="ml-2">Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="ml-2 bg-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{activeFilterCount}</span>
                        )}
                    </button>
                    {isFilterPanelOpen && <FilterPanel onClose={() => setIsFilterPanelOpen(false)} />}
                </div>
            </div>

            <Modal title={transactionToEdit ? "Edit Sale" : "Record New Sale"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <SalesForm 
                    onClose={() => setIsModalOpen(false)} 
                    transactionToEdit={transactionToEdit}
                    onUpdate={handleUpdateTransaction}
                />
            </Modal>
            
            <Modal title="Settle Payment" isOpen={!!transactionToSettle} onClose={() => setTransactionToSettle(null)}>
                <div className="space-y-4">
                    <p className="text-sm text-text-muted">
                        Select the method used to settle the payment for transaction from <span className="font-semibold text-text-main">{new Date(transactionToSettle?.date || '').toLocaleDateString()}</span>.
                    </p>
                    <div className="flex justify-around pt-4">
                        <button onClick={() => handleSettlePayment('Online')} className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">Settle Online</button>
                        <button onClick={() => handleSettlePayment('Offline')} className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">Settle Offline</button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={isConfirmDeleteModalOpen}
                onClose={() => setIsConfirmDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Sale Record"
                confirmText="Confirm Delete"
                variant="danger"
            >
                Are you sure you want to delete this transaction from {new Date(transactionToDelete?.date || '').toLocaleDateString()}? This will restore stock for all items and cannot be undone.
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={!!saleToReturn}
                onClose={() => setSaleToReturn(null)}
                onConfirm={handleConfirmReturn}
                title="Confirm Item Return"
                confirmText="Yes, Return Item"
                variant="warning"
            >
                Are you sure you want to return "{saleToReturn?.productName}" (Qty: {saleToReturn?.quantity})? This will add the item(s) back to your inventory.
            </ConfirmationModal>

            <div className="md:hidden space-y-4 pb-20">
                {filteredTransactions.length > 0 ? (
                    filteredTransactions.map(t => 
                        <TransactionCard 
                            key={t.id} 
                            transaction={t}
                            onDelete={() => openDeleteConfirm(t)}
                            onEdit={() => handleOpenModal(t)}
                            onReturn={setSaleToReturn}
                            onSettle={() => setTransactionToSettle(t)}
                            onDownload={() => generateInvoicePDF(t, inventoryMap)}
                            inventoryMap={inventoryMap}
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
                            {filteredTransactions.map((t: Transaction) => {
                                const effectiveTotal = t.items.filter(i => i.status !== 'returned').reduce((acc, item) => acc + item.totalPrice, 0);
                                return (
                                <tr key={t.id} className="hover:bg-surface-hover/50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-main align-top">
                                        <div>
                                            {t.items.map(item => {
                                                const invItem = inventoryMap.get(item.inventoryItemId);
                                                const isBundleItem = invItem?.is_bundle || false;
                                                return (
                                                <div key={item.id} className={`flex items-center gap-2 ${item.status === 'returned' ? 'text-text-muted line-through' : ''}`}>
                                                    <span>{item.productName} (x{item.quantity}{isBundleItem ? (item.sale_type === 'bundle' ? ' bundles' : '') : ''})</span>
                                                    {item.has_gst && <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
                                                    {item.status === 'returned' && <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-warning/10 text-warning">Returned</span>}
                                                </div>
                                            )})}
                                            {t.customer_name && (
                                                <div className="text-xs text-amber-400 mt-2 pt-1 border-t border-border/50">
                                                    Credit for: {t.customer_name}
                                                    {t.customer_phone && (
                                                        <>
                                                            {' ('}
                                                            <a href={`tel:${t.customer_phone}`} className="text-blue-400 hover:underline">
                                                                {t.customer_phone}
                                                            </a>
                                                            {')'}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-text-main align-top">
                                        ₹{effectiveTotal.toFixed(2)}
                                        {effectiveTotal < t.total_price && <span className="block text-xs text-text-muted line-through">₹{t.total_price.toFixed(2)}</span>}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted align-top">
                                        {paymentMethodBadges[t.payment_method]}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted align-top">{new Date(t.date).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                        <div className="flex justify-end space-x-2">
                                            <button onClick={() => generateInvoicePDF(t, inventoryMap)} className="text-info hover:opacity-80 p-1 rounded-full hover:bg-surface-hover transition-colors">
                                                <InvoiceIcon />
                                            </button>
                                            {t.payment_method === 'On Credit' ? (
                                                <button onClick={() => setTransactionToSettle(t)} className="text-success hover:opacity-80 p-1 rounded-full hover:bg-surface-hover transition-colors flex items-center gap-1 text-xs px-2 border border-success/50">
                                                    <CreditIcon /> Settle
                                                </button>
                                            ) : (
                                                <button onClick={() => handleOpenModal(t)} className="text-primary hover:text-primary-focus p-1 rounded-full hover:bg-surface-hover transition-colors"><EditIcon /></button>
                                            )}
                                            <button onClick={() => openDeleteConfirm(t)} className="text-danger hover:opacity-80 p-1 rounded-full hover:bg-surface-hover transition-colors"><DeleteIcon /></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
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