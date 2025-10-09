import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { ShopContext } from '../App';
import { Sale, Transaction, InventoryItem } from '../types';
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import { PlusIcon, DeleteIcon } from './Icons';
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
}

const SalesForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { inventory, addTransaction, addInventoryItem } = useContext(ShopContext);
    
    // Form state for the item being added
    const [currentItem, setCurrentItem] = useState<InventoryItem | null>(null);
    const [quantity, setQuantity] = useState<string>('1');
    const [sellingPrice, setSellingPrice] = useState<string>('0');
    const [productSearch, setProductSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // State for the "cart" of items in the current transaction
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'Online' | 'Offline'>('Offline');
    
    // State for creating a new item on-the-fly
    const [isCreatingNewItem, setIsCreatingNewItem] = useState(false);
    const [newItemPrice, setNewItemPrice] = useState('0');
    const [newItemCost, setNewItemCost] = useState('0');
    const [newItemHasGst, setNewItemHasGst] = useState(false);
    const [newItemStock, setNewItemStock] = useState('');
    
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
        setSellingPrice('0');
        setCurrentItem(null);
        setIsCreatingNewItem(false);
        setNewItemPrice('0');
        setNewItemCost('0');
        setNewItemHasGst(false);
        setNewItemStock('');
    };
    
    const handleAddToCart = async () => {
        let itemToAdd: CartItem | null = null;
        const numQuantity = Number(quantity);
        if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
            alert('Quantity must be a positive whole number.');
            return;
        }

        if (isCreatingNewItem) {
             const numNewStock = Number(newItemStock);
             const numNewPrice = Number(newItemPrice);
             const numNewCost = Number(newItemCost);
             const trimmedName = productSearch.trim();

             if (!trimmedName) { alert('New product needs a name.'); return; }
             if (numNewStock < numQuantity) { alert('Initial stock cannot be less than the quantity being sold.'); return; }
             if (numNewPrice < numNewCost) { alert('Selling price cannot be less than the cost price.'); return; }
             if (inventory && inventory.some(item => item.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
                alert('An item with this name already exists in the inventory.');
                return;
             }

             const newItemData = {
                name: trimmedName,
                price: numNewPrice,
                cost: numNewCost,
                has_gst: newItemHasGst,
                stock: numNewStock,
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
            };
        } else if (currentItem) {
            if(numQuantity > currentItem.stock) { alert(`Not enough stock for ${currentItem.name}. Only ${currentItem.stock} available.`); return; }
            const numSellingPrice = Number(sellingPrice);
            if(isNaN(numSellingPrice) || numSellingPrice < 0) { alert('Selling price must be a non-negative number.'); return; }
            if (numSellingPrice < currentItem.cost) { alert('Selling price cannot be less than the item\'s cost price.'); return; }

            itemToAdd = {
                inventoryItemId: currentItem.id,
                productName: currentItem.name,
                quantity: numQuantity,
                pricePerUnit: numSellingPrice,
                totalPrice: numSellingPrice * numQuantity,
                stock: currentItem.stock,
            };
        } else {
             alert('Please select a product to add.');
             return;
        }
        
        if (itemToAdd) {
            const existingCartItemIndex = cart.findIndex(ci => ci.inventoryItemId === itemToAdd!.inventoryItemId);
            if (existingCartItemIndex > -1) {
                const updatedCart = [...cart];
                const existingItem = updatedCart[existingCartItemIndex];
                const newQuantity = existingItem.quantity + itemToAdd.quantity;
                if(newQuantity > itemToAdd.stock) { alert(`Not enough stock for ${itemToAdd.productName}. Only ${itemToAdd.stock} available in total.`); return; }
                
                existingItem.quantity = newQuantity;
                existingItem.totalPrice = existingItem.pricePerUnit * newQuantity;
                setCart(updatedCart);
            } else {
                setCart(prev => [...prev, itemToAdd!]);
            }
        }
        resetCurrentItemForm();
    };

    const handleUpdateCartItem = (itemId: string, field: 'quantity' | 'pricePerUnit', value: string) => {
        const numValue = Number(value);
        if (isNaN(numValue) || (field === 'pricePerUnit' && numValue < 0)) {
            return; 
        }

        setCart(currentCart => {
            const newCart = currentCart.map(item => {
                if (item.inventoryItemId === itemId) {
                    const updatedItem = { ...item };

                    if (field === 'quantity') {
                        if (!Number.isInteger(numValue) || numValue < 0) return item;
                        if (numValue > item.stock) {
                             alert(`Not enough stock for ${item.productName}. Only ${item.stock} available.`);
                             updatedItem.quantity = item.stock;
                        } else {
                            updatedItem.quantity = numValue;
                        }
                    } else if (field === 'pricePerUnit') {
                        const inventoryItem = inventory?.find(i => i.id === itemId);
                        if (inventoryItem && numValue < inventoryItem.cost) {
                            alert(`Selling price for ${item.productName} cannot be less than its cost (₹${inventoryItem.cost.toFixed(2)}).`);
                            return item; // Revert change
                        }
                        updatedItem.pricePerUnit = numValue;
                    }
                    
                    updatedItem.totalPrice = updatedItem.quantity * updatedItem.pricePerUnit;
                    return updatedItem;
                }
                return item;
            });
            // Remove item if quantity becomes 0
            return newCart.filter(item => !(item.inventoryItemId === itemId && field === 'quantity' && item.quantity <= 0));
        });
    };

    const handleRemoveFromCart = (inventoryItemId: string) => {
        setCart(prev => prev.filter(item => item.inventoryItemId !== inventoryItemId));
    };

    const handleSubmitTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) {
            alert('Cannot submit an empty sale. Please add at least one item.');
            return;
        }
        
        const transactionItems = cart.map(ci => ({
            inventoryItemId: ci.inventoryItemId,
            productName: ci.productName,
            quantity: ci.quantity,
            totalPrice: ci.totalPrice,
        }));
        
        await addTransaction(transactionItems, paymentMethod);
        onClose();
    };

    return (
         <form onSubmit={handleSubmitTransaction} className="space-y-6">
            {/* Item Entry Section */}
            <div className="p-4 border border-border rounded-lg space-y-4">
                 <div className="relative" ref={searchRef}>
                    <label htmlFor="product-search" className="block text-sm font-medium text-text-muted">Product</label>
                    <input
                        id="product-search"
                        type="text"
                        value={productSearch}
                        onChange={(e) => {
                            setProductSearch(e.target.value);
                            setCurrentItem(null);
                            setIsCreatingNewItem(false);
                            setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder="Search or type to add new..."
                        autoComplete="off"
                        className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    />
                     {isDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-surface border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {filteredInventory.map(invItem => (
                                <div key={invItem.id} onClick={() => {
                                    setCurrentItem(invItem);
                                    setProductSearch(invItem.name);
                                    setSellingPrice(String(invItem.price.toFixed(2)));
                                    setIsCreatingNewItem(false);
                                    setIsDropdownOpen(false);
                                }} className="cursor-pointer px-4 py-2 text-sm text-text-main hover:bg-surface-hover flex justify-between">
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
                {isCreatingNewItem && (
                    <div className="space-y-4 p-4 border border-dashed border-border rounded-lg bg-background/50">
                        <h4 className="text-sm font-semibold text-text-main">New Item Details</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-text-muted">Initial Stock</label>
                                <input type="number" value={newItemStock} onChange={e => setNewItemStock(e.target.value)} min="1" step="1" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted">Selling Price (₹)</label>
                                <input type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted">Cost Price (₹)</label>
                                <input type="number" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                            </div>
                        </div>
                        <label className="flex items-center cursor-pointer pt-2">
                            <input type="checkbox" checked={newItemHasGst} onChange={e => setNewItemHasGst(e.target.checked)} className="h-4 w-4 rounded text-primary border-border focus:ring-primary bg-background" />
                            <span className="ml-2 text-sm text-text-main">Includes GST</span>
                        </label>
                    </div>
                 )}
                 <div className="flex items-end gap-4">
                     <div className="flex-auto">
                        <label htmlFor="quantity" className="block text-sm font-medium text-text-muted">Quantity</label>
                        <input type="number" id="quantity" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                     {currentItem && !isCreatingNewItem && (
                         <div className="flex-auto">
                            <label htmlFor="selling-price" className="block text-sm font-medium text-text-muted">Selling Price (₹)</label>
                            <input type="number" id="selling-price" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                        </div>
                     )}
                    <button type="button" onClick={handleAddToCart} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors h-10">
                        <PlusIcon /> <span className="ml-2">Add</span>
                    </button>
                 </div>
            </div>

            {/* Cart Section */}
            <div className="space-y-3">
                <h3 className="text-lg font-medium text-text-main">Current Sale Items</h3>
                {cart.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-4 bg-background rounded-lg border border-border">No items added yet.</p>
                ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                        {cart.map(item => (
                            <div key={item.inventoryItemId} className="grid grid-cols-12 gap-2 items-center bg-background p-3 rounded-md border border-border">
                                <div className="col-span-4">
                                    <p className="font-medium text-text-main truncate">{item.productName}</p>
                                    <p className="text-xs text-text-muted">Stock: {item.stock}</p>
                                </div>
                                <div className="col-span-2">
                                    <label htmlFor={`quantity-${item.inventoryItemId}`} className="sr-only">Quantity</label>
                                    <input 
                                        id={`quantity-${item.inventoryItemId}`}
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateCartItem(item.inventoryItemId, 'quantity', e.target.value)}
                                        className="w-full bg-surface border border-border rounded-md text-center py-1 text-sm"
                                        min="1"
                                        max={item.stock}
                                    />
                                </div>
                                <div className="col-span-3 relative">
                                    <label htmlFor={`price-${item.inventoryItemId}`} className="sr-only">Price per unit</label>
                                    <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-text-muted text-sm">₹</span>
                                    <input 
                                        id={`price-${item.inventoryItemId}`}
                                        type="number"
                                        value={item.pricePerUnit}
                                        onChange={(e) => handleUpdateCartItem(item.inventoryItemId, 'pricePerUnit', e.target.value)}
                                        className="w-full bg-surface border border-border rounded-md py-1 pl-6 pr-2 text-sm"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="col-span-2 text-right">
                                    <p className="font-semibold text-text-main">₹{item.totalPrice.toFixed(2)}</p>
                                </div>
                                <div className="col-span-1 text-right">
                                    <button type="button" onClick={() => handleRemoveFromCart(item.inventoryItemId)} className="text-danger p-1 rounded-full hover:bg-surface-hover">
                                        <DeleteIcon />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Total and Payment */}
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
                    Submit Sale
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

const TransactionCard: React.FC<{ transaction: Transaction; onDelete: () => void; }> = ({ transaction, onDelete }) => (
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
                        <span className="text-text-muted ml-2"> (x{item.quantity})</span>
                        {item.has_gst && <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
                    </div>
                    <span className="text-text-muted">₹{item.totalPrice.toFixed(2)}</span>
                 </div>
            ))}
        </div>
    </div>
);


const Sales: React.FC = () => {
    const { transactions, deleteTransaction } = useContext(ShopContext);
    const { dateFilter } = useFilters();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
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
                <button onClick={() => setIsModalOpen(true)} className="hidden md:inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors flex-shrink-0">
                    <PlusIcon />
                    <span className="ml-2">New Sale</span>
                </button>
            </div>

            {/* Filter Bar */}
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

            <Modal title="Record New Sale" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <SalesForm onClose={() => setIsModalOpen(false)} />
            </Modal>
            
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Sale Record"
            >
                Are you sure you want to delete this transaction from {new Date(transactionToDelete?.date || '').toLocaleDateString()}? This will restore stock for all {transactionToDelete?.items.length} items and cannot be undone.
            </ConfirmationModal>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 pb-20">
                {filteredTransactions.length > 0 ? (
                    filteredTransactions.map(t => 
                        <TransactionCard 
                            key={t.id} 
                            transaction={t}
                            onDelete={() => openDeleteConfirm(t)}
                        />
                    )
                ) : (
                    <div className="text-center py-10 text-text-muted bg-surface rounded-lg border border-border">
                        <p className="font-semibold">No Sales Found</p>
                        <p className="text-sm mt-1">No sales records match the current filter.</p>
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
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
                                                <span>{item.productName} (x{item.quantity})</span>
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
                                        <div className="flex justify-end">
                                            <button onClick={() => openDeleteConfirm(t)} className="text-danger hover:opacity-80 p-1 rounded-full hover:bg-surface-hover transition-colors"><DeleteIcon /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* FAB for Mobile */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="md:hidden fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-lg z-20 flex items-center justify-center hover:bg-primary-focus transition-transform duration-200 active:scale-95"
                aria-label="Record New Sale"
            >
                <PlusIcon />
            </button>
        </div>
    );
};

export default Sales;