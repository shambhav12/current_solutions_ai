import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { ShopContext } from '../App';
import { Sale } from '../types';
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import { PlusIcon, EditIcon, DeleteIcon } from './Icons';
import { useFilters } from '../FilterContext';
import DateFilterComponent from './ui/DateFilter';
import { useDebounce } from '../hooks/useDebounce';

interface SalesFormProps {
    onClose: () => void;
    saleToEdit?: Sale | null;
}

const SalesForm: React.FC<SalesFormProps> = ({ onClose, saleToEdit }) => {
    const { inventory, sales, addSale, updateSale, addInventoryItem } = useContext(ShopContext);
    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState<string>('1');
    const [totalPrice, setTotalPrice] = useState<string>('0');
    const [paymentMethod, setPaymentMethod] = useState<'Online' | 'Offline'>('Offline');
    
    // State for the new searchable product input
    const [productSearch, setProductSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // State for creating a new item on-the-fly
    const [isCreatingNewItem, setIsCreatingNewItem] = useState(false);
    const [newItemPrice, setNewItemPrice] = useState('0');
    const [newItemCost, setNewItemCost] = useState('0');
    const [newItemHasGst, setNewItemHasGst] = useState(false);

    const item = useMemo(() => inventory?.find(i => i.id === itemId), [inventory, itemId]);

    // Sort inventory by most sold items first
    const sortedInventory = useMemo(() => {
        if (!inventory || !sales) return [];

        const salesCount = sales.reduce((acc, sale) => {
            acc[sale.inventoryItemId] = (acc[sale.inventoryItemId] || 0) + sale.quantity;
            return acc;
        }, {} as Record<string, number>);

        return [...inventory].sort((a, b) => {
            const countA = salesCount[a.id] || 0;
            const countB = salesCount[b.id] || 0;
            return countB - countA;
        });
    }, [inventory, sales]);

    const filteredInventory = useMemo(() => {
        if (!productSearch) return sortedInventory;
        return sortedInventory.filter(item =>
            item.name.toLowerCase().includes(productSearch.toLowerCase())
        );
    }, [productSearch, sortedInventory]);


    useEffect(() => {
        if (saleToEdit) {
            setItemId(saleToEdit.inventoryItemId);
            setQuantity(String(saleToEdit.quantity));
            setPaymentMethod(saleToEdit.paymentMethod || 'Offline');
            setTotalPrice(String(saleToEdit.totalPrice));
            const itemName = inventory?.find(i => i.id === saleToEdit.inventoryItemId)?.name || '';
            setProductSearch(itemName);
            setIsCreatingNewItem(false);
        } else {
            // Reset form for a new sale
            setItemId('');
            setQuantity('1');
            setPaymentMethod('Offline');
            setTotalPrice('0');
            setProductSearch('');
            setIsCreatingNewItem(false);
            setNewItemPrice('0');
            setNewItemCost('0');
            setNewItemHasGst(false);
        }
    }, [saleToEdit, inventory]);

    useEffect(() => {
        const numQuantity = Number(quantity);
        if (isCreatingNewItem) {
             setTotalPrice(String(Number(newItemPrice) * numQuantity));
        } else if (item && numQuantity > 0) {
            setTotalPrice(String(item.price * numQuantity));
        } else {
             setTotalPrice('0');
        }
    }, [item, quantity, isCreatingNewItem, newItemPrice]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const numQuantity = Number(quantity);
        const numTotalPrice = Number(totalPrice);
        let currentItemStock = item?.stock ?? 0;
        let finalItemId = itemId;
        let finalProductName = productSearch;
        
        // --- Form Validation ---
        if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
            alert('Invalid value. Quantity must be a whole number greater than 0.');
            return;
        }
        if (isNaN(numTotalPrice) || numTotalPrice < 0) {
            alert('Invalid value. Total price cannot be negative.');
            return;
        }

        if (isCreatingNewItem) {
            const numNewPrice = Number(newItemPrice);
            const numNewCost = Number(newItemCost);

            if (isNaN(numNewPrice) || numNewPrice < 0) {
                alert('Invalid value for new item. Price cannot be negative.');
                return;
            }
            if (isNaN(numNewCost) || numNewCost < 0) {
                alert('Invalid value for new item. Cost cannot be negative.');
                return;
            }

            // Create the new item with initial stock equal to the quantity being sold.
            // The addSale function will then deduct this, leaving the final stock at 0.
            const newItemData = {
                name: productSearch.trim(),
                price: numNewPrice,
                cost: numNewCost,
                has_gst: newItemHasGst,
                stock: numQuantity, 
            };
            const newInventoryItem = await addInventoryItem(newItemData);

            if (!newInventoryItem) {
                alert('Failed to create new inventory item. Please try again.');
                return;
            }
            finalItemId = newInventoryItem.id;
            currentItemStock = newInventoryItem.stock;
        }
        
        if (!finalItemId) {
            alert('Please select a valid product from the list or create a new one.');
            return;
        }

        const stockAvailableForEdit = saleToEdit && saleToEdit.inventoryItemId === finalItemId 
            ? currentItemStock + saleToEdit.quantity 
            : currentItemStock;

        if (numQuantity > stockAvailableForEdit) {
            alert(`Invalid quantity. Only ${stockAvailableForEdit} available in stock for "${finalProductName}".`);
            return;
        }

        if (saleToEdit) {
            const updatedSalePayload = {
                ...saleToEdit,
                inventoryItemId: finalItemId,
                productName: finalProductName,
                quantity: numQuantity,
                totalPrice: numTotalPrice,
                paymentMethod,
            };
            console.log(`[SalesForm] Submitting update for sale ID: ${saleToEdit.id}`, updatedSalePayload);
            updateSale(updatedSalePayload);
        } else {
            const newSalePayload = {
                inventoryItemId: finalItemId,
                productName: finalProductName,
                quantity: numQuantity,
                totalPrice: numTotalPrice,
                paymentMethod,
            };
            console.log(`[SalesForm] Submitting new sale for item: ${finalProductName}`, newSalePayload);
            addSale(newSalePayload);
        }
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative" ref={searchRef}>
                <label htmlFor="product-search" className="block text-sm font-medium text-text-muted">Product</label>
                <input
                    id="product-search"
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                        setProductSearch(e.target.value);
                        setItemId('');
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
                            <div
                                key={invItem.id}
                                onClick={() => {
                                    setItemId(invItem.id);
                                    setProductSearch(invItem.name);
                                    setIsCreatingNewItem(false);
                                    setIsDropdownOpen(false);
                                }}
                                className="cursor-pointer px-4 py-2 text-sm text-text-main hover:bg-surface-hover flex justify-between"
                            >
                                <span>{invItem.name}</span>
                                <span className="text-text-muted">Stock: {invItem.stock}</span>
                            </div>
                        ))}
                        {filteredInventory.length === 0 && productSearch.trim() !== '' && (
                             <div
                                onClick={() => {
                                    setIsCreatingNewItem(true);
                                    setItemId('');
                                    setIsDropdownOpen(false);
                                }}
                                className="cursor-pointer px-4 py-2 text-sm text-text-main hover:bg-surface-hover flex items-center gap-2"
                            >
                                <PlusIcon /> <span>Add "{productSearch.trim()}" to inventory</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {isCreatingNewItem && !saleToEdit && (
                <div className="space-y-4 p-4 border border-dashed border-border rounded-lg bg-background/50">
                    <h4 className="text-sm font-semibold text-text-main">New Item Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="newItemPrice" className="block text-xs font-medium text-text-muted">Selling Price (₹)</label>
                            <input type="number" id="newItemPrice" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="newItemCost" className="block text-xs font-medium text-text-muted">Cost Price (₹)</label>
                            <input type="number" id="newItemCost" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                        </div>
                    </div>
                    <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={newItemHasGst} onChange={e => setNewItemHasGst(e.target.checked)} className="h-4 w-4 rounded text-primary border-border focus:ring-primary bg-background" />
                        <span className="ml-2 text-sm text-text-main">Includes GST</span>
                    </label>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-text-muted">Quantity</label>
                    <input type="number" id="quantity" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                </div>
                 <div>
                    <label htmlFor="totalPrice" className="block text-sm font-medium text-text-muted">Total Price (₹)</label>
                    <input 
                        type="number" 
                        id="totalPrice" 
                        value={totalPrice} 
                        onChange={e => setTotalPrice(e.target.value)} 
                        min="0"
                        step="0.01" 
                        required 
                        className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" 
                    />
                </div>
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
             <div className="flex justify-end pt-4">
                <button type="submit" className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors">
                    {saleToEdit ? 'Update Sale' : 'Add Sale'}
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

const SaleCard: React.FC<{ sale: Sale; onEdit: () => void; onDelete: () => void; }> = ({ sale, onEdit, onDelete }) => (
    <div className="bg-surface p-4 rounded-lg border border-border flex flex-col space-y-2">
        <div className="flex justify-between items-start">
             <div className="flex-1 pr-4">
                <h3 className="font-bold text-text-main leading-tight">{sale.productName}</h3>
                <p className="text-sm text-text-muted mt-1">
                    {new Date(sale.date).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                </p>
            </div>
             <div className="flex items-center space-x-1">
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
        
        <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <div className="text-sm text-text-muted space-x-4 flex items-center">
                <span>Qty: <span className="font-semibold text-text-main">{sale.quantity}</span></span>
                 <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ sale.paymentMethod === 'Online' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400' }`}>
                    {sale.paymentMethod || 'Offline'}
                </span>
                {sale.has_gst && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
            </div>
             <span className="font-semibold text-lg text-success">₹{sale.totalPrice.toFixed(2)}</span>
        </div>
    </div>
);


const Sales: React.FC = () => {
    const { sales, deleteSale } = useContext(ShopContext);
    const { dateFilter } = useFilters();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
    const [gstFilter, setGstFilter] = useState<GstFilter>('all');
    
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const searchRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (debouncedSearchTerm.length < 3) {
            setSuggestions([]);
            return;
        }
        if (sales) {
            const uniqueProductNames = [...new Set(sales.map(s => s.productName))];
            const filteredSuggestions = uniqueProductNames
                .filter(name => name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
                .slice(0, 5);
            setSuggestions(filteredSuggestions);
        }
    }, [debouncedSearchTerm, sales]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!sales) {
        return null;
    }

    const filteredSales = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let results: Sale[] = sales;

        // Apply date filter
        switch (dateFilter.type) {
            case 'today':
                results = results.filter(sale => new Date(sale.date) >= today);
                break;
            case '7days':
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(today.getDate() - 6);
                results = results.filter(sale => new Date(sale.date) >= sevenDaysAgo);
                break;
            case '30days':
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(today.getDate() - 29);
                results = results.filter(sale => new Date(sale.date) >= thirtyDaysAgo);
                break;
            case 'custom':
                 if (dateFilter.startDate && dateFilter.endDate) {
                    const start = new Date(dateFilter.startDate);
                    start.setUTCHours(0, 0, 0, 0);
                    const end = new Date(dateFilter.endDate);
                    end.setUTCHours(23, 59, 59, 999);
                    results = results.filter(sale => {
                        const saleDate = new Date(sale.date);
                        return saleDate >= start && saleDate <= end;
                    });
                }
                break;
        }

        // Apply GST filter
        switch (gstFilter) {
            case 'gst':
                results = results.filter(s => s.has_gst);
                break;
            case 'non-gst':
                results = results.filter(s => !s.has_gst);
                break;
        }
        
        // Apply search filter
        if (debouncedSearchTerm) {
            results = results.filter(sale =>
                sale.productName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            );
        }

        return results;
    }, [sales, dateFilter, gstFilter, debouncedSearchTerm]);

    const sortedSales = [...filteredSales].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleOpenModal = (sale: Sale | null = null) => {
        setSaleToEdit(sale);
        setIsModalOpen(true);
    };

    const openDeleteConfirm = (sale: Sale) => {
        setSaleToDelete(sale);
        setIsConfirmModalOpen(true);
    };

    const handleDelete = () => {
        if (saleToDelete) {
            console.log(`[Sales] Confirming delete for sale ID: ${saleToDelete.id}`);
            deleteSale(saleToDelete.id);
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

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                 <div className="relative w-full md:max-w-xs" ref={searchRef}>
                    <input
                        type="text"
                        placeholder="Search by product name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    />
                    {suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                           {suggestions.map((s, index) => (
                               <div
                                   key={index}
                                   onClick={() => { setSearchTerm(s); setSuggestions([]); }}
                                   className="cursor-pointer px-4 py-2 text-sm text-text-main hover:bg-surface-hover"
                               >
                                   {s}
                               </div>
                           ))}
                        </div>
                    )}
                </div>
                <div className="w-full md:w-auto">
                    <GstFilterComponent filter={gstFilter} setFilter={setGstFilter} />
                </div>
                <DateFilterComponent className="w-full md:w-auto" />
            </div>

            <Modal title={saleToEdit ? "Edit Sale Record" : "Record New Sale"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <SalesForm onClose={() => setIsModalOpen(false)} saleToEdit={saleToEdit} />
            </Modal>
            
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Sale Record"
            >
                Are you sure you want to delete the sale for "{saleToDelete?.productName}"? This will add the stock back to inventory and cannot be undone.
            </ConfirmationModal>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 pb-20">
                {sortedSales.length > 0 ? (
                    sortedSales.map(sale => 
                        <SaleCard 
                            key={sale.id} 
                            sale={sale} 
                            onEdit={() => handleOpenModal(sale)}
                            onDelete={() => openDeleteConfirm(sale)}
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
                                <th scope="col" className="px-2 md:px-3 lg:px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Product</th>
                                <th scope="col" className="px-2 md:px-3 lg:px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Quantity</th>
                                <th scope="col" className="px-2 md:px-3 lg:px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Total Price (₹)</th>
                                <th scope="col" className="hidden lg:table-cell px-2 md:px-3 lg:px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Payment Method</th>
                                <th scope="col" className="px-2 md:px-3 lg:px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-2 md:px-3 lg:px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedSales.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-text-muted">
                                        <p className="font-semibold">No Sales Found</p>
                                        <p className="text-sm mt-1">No sales records match the current filter.</p>
                                    </td>
                                </tr>
                            )}
                            {sortedSales.map((sale: Sale) => (
                                <tr key={sale.id} className="hover:bg-surface-hover/50">
                                    <td className="px-2 md:px-3 lg:px-4 py-4 whitespace-nowrap text-sm font-medium text-text-main">
                                        <div className="flex items-center gap-2">
                                            {sale.productName}
                                            {sale.has_gst && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
                                        </div>
                                    </td>
                                    <td className="px-2 md:px-3 lg:px-4 py-4 whitespace-nowrap text-sm text-text-muted">{sale.quantity}</td>
                                    <td className="px-2 md:px-3 lg:px-4 py-4 whitespace-nowrap text-sm text-text-muted">₹{sale.totalPrice.toFixed(2)}</td>
                                    <td className="hidden lg:table-cell px-2 md:px-3 lg:px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            sale.paymentMethod === 'Online'
                                            ? 'bg-blue-500/10 text-blue-400'
                                            : 'bg-gray-500/10 text-gray-400'
                                        }`}>
                                            {sale.paymentMethod || 'Offline'}
                                        </span>
                                    </td>
                                    <td className="px-2 md:px-3 lg:px-4 py-4 whitespace-nowrap text-sm text-text-muted">{new Date(sale.date).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="px-2 md:px-3 lg:px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            <button onClick={() => handleOpenModal(sale)} className="text-primary hover:text-primary-focus p-1 rounded-full hover:bg-surface-hover transition-colors"><EditIcon /></button>
                                            <button onClick={() => openDeleteConfirm(sale)} className="text-danger hover:opacity-80 p-1 rounded-full hover:bg-surface-hover transition-colors"><DeleteIcon /></button>
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