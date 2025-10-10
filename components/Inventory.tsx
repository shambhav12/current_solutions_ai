import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { ShopContext } from '../App';
import { InventoryItem } from '../types';
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import { PlusIcon, EditIcon, DeleteIcon } from './Icons';
import { useDebounce } from '../hooks/useDebounce';

interface InventoryFormProps {
    onClose: () => void;
    itemToEdit?: InventoryItem | null;
    inventory: InventoryItem[];
}

const InventoryForm: React.FC<InventoryFormProps> = ({ onClose, itemToEdit, inventory }) => {
    const { addInventoryItem, updateInventoryItem } = useContext(ShopContext);
    const [name, setName] = useState('');
    const [stock, setStock] = useState<string>('0');
    const [price, setPrice] = useState<string>('0');
    const [cost, setCost] = useState<string>('0');
    const [hasGst, setHasGst] = useState(false);
    // Bundle fields
    const [isBundle, setIsBundle] = useState(false);
    const [bundlePrice, setBundlePrice] = useState<string>('');
    const [itemsPerBundle, setItemsPerBundle] = useState<string>('');


    useEffect(() => {
        if (itemToEdit) {
            setName(itemToEdit.name);
            setStock(String(itemToEdit.stock));
            setPrice(String(itemToEdit.price.toFixed(2)));
            setCost(String(itemToEdit.cost.toFixed(2)));
            setHasGst(itemToEdit.has_gst || false);
            setIsBundle(itemToEdit.is_bundle || false);
            setBundlePrice(itemToEdit.bundle_price?.toFixed(2) || '');
            setItemsPerBundle(String(itemToEdit.items_per_bundle || ''));
        } else {
            // Reset form for new item
            setName('');
            setStock('0');
            setPrice('0');
            setCost('0');
            setHasGst(false);
            setIsBundle(false);
            setBundlePrice('');
            setItemsPerBundle('');
        }
    }, [itemToEdit]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const numStock = Number(stock);
        const numPrice = Number(price);
        const numCost = Number(cost);
        const numBundlePrice = Number(bundlePrice);
        const numItemsPerBundle = Number(itemsPerBundle);

        if (!Number.isInteger(numStock) || numStock < 0) { alert('Stock must be a non-negative whole number.'); return; }
        if (isNaN(numPrice) || numPrice < 0) { alert('Price cannot be negative.'); return; }
        if (isNaN(numCost) || numCost < 0) { alert('Cost cannot be negative.'); return; }
        if (numPrice < numCost) { alert('Selling price cannot be less than the cost price.'); return; }
        
        if (isBundle) {
            if(isNaN(numBundlePrice) || numBundlePrice <= 0) { alert('Bundle price must be a positive number.'); return; }
            if(!Number.isInteger(numItemsPerBundle) || numItemsPerBundle <= 1) { alert('Items per bundle must be a whole number greater than 1.'); return; }
        }

        const trimmedName = name.trim().toLowerCase();
        const basePayload = {
            name: name.trim(), 
            stock: numStock, 
            price: numPrice, 
            cost: numCost,
            has_gst: hasGst,
            is_bundle: isBundle,
            bundle_price: isBundle ? numBundlePrice : undefined,
            items_per_bundle: isBundle ? numItemsPerBundle : undefined,
        };

        if (itemToEdit) {
            if (inventory.some(item => item.id !== itemToEdit.id && item.name.trim().toLowerCase() === trimmedName)) {
                alert('An item with this name already exists.'); return;
            }
            updateInventoryItem({ ...basePayload, id: itemToEdit.id, user_id: itemToEdit.user_id });
        } else {
             if (inventory.some(item => item.name.trim().toLowerCase() === trimmedName)) {
                alert('An item with this name already exists.'); return;
            }
            addInventoryItem(basePayload);
        }
        onClose();
    };

    return (
         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-muted">Product Name</label>
                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label htmlFor="stock" className="block text-sm font-medium text-text-muted">Stock (Units)</label>
                    <input type="number" id="stock" value={stock} onChange={e => setStock(e.target.value)} min="0" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="price" className="block text-sm font-medium text-text-muted">{isBundle ? 'Loose Price (₹)' : 'Selling Price (₹)'}</label>
                    <input type="number" id="price" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                </div>
                 <div>
                    <label htmlFor="cost" className="block text-sm font-medium text-text-muted">Cost per Unit (₹)</label>
                    <input type="number" id="cost" value={cost} onChange={e => setCost(e.target.value)} min="0" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                </div>
            </div>
             <div className="pt-2 space-y-4">
                <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={hasGst} onChange={e => setHasGst(e.target.checked)} className="h-4 w-4 rounded text-primary border-border focus:ring-primary bg-background" />
                    <span className="ml-2 text-sm text-text-main">Includes GST</span>
                </label>
                 <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={isBundle} onChange={e => setIsBundle(e.target.checked)} className="h-4 w-4 rounded text-primary border-border focus:ring-primary bg-background" />
                    <span className="ml-2 text-sm text-text-main">Is Bundle Item? (e.g., sold as pack)</span>
                </label>
            </div>

            {isBundle && (
                 <div className="p-4 border border-dashed border-primary/50 rounded-lg space-y-4 bg-primary/5">
                    <h4 className="text-sm font-semibold text-text-main">Bundle Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="bundle-price" className="block text-sm font-medium text-text-muted">Bundle Price (₹)</label>
                            <input type="number" id="bundle-price" value={bundlePrice} onChange={e => setBundlePrice(e.target.value)} min="0.01" step="0.01" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="items-per-bundle" className="block text-sm font-medium text-text-muted">Items per Bundle</label>
                            <input type="number" id="items-per-bundle" value={itemsPerBundle} onChange={e => setItemsPerBundle(e.target.value)} min="2" step="1" required className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm" />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end pt-4">
                <button type="submit" className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors">
                    {itemToEdit ? 'Update Item' : 'Add Item'}
                </button>
            </div>
        </form>
    );
};

const getBundleDisplayInfo = (item: InventoryItem): { fullBundles: number, remainingUnits: number, canBeBundled: boolean } => {
    const itemsPerBundle = Number(item.items_per_bundle);
    const stock = Number(item.stock);
    const canBeBundled = !!(item.is_bundle && itemsPerBundle > 1);

    if (!canBeBundled) {
        return { fullBundles: 0, remainingUnits: stock, canBeBundled: false };
    }

    const fullBundles = Math.floor(stock / itemsPerBundle);
    const remainingUnits = stock % itemsPerBundle;

    return { fullBundles, remainingUnits, canBeBundled: true };
};


const InventoryCard: React.FC<{ item: InventoryItem; onEdit: () => void; onDelete: () => void; }> = ({ item, onEdit, onDelete }) => {
    const { fullBundles, remainingUnits, canBeBundled } = getBundleDisplayInfo(item);
    
    return (
        <div className="bg-surface p-4 rounded-lg border border-border flex flex-col space-y-3">
             <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 pr-2">
                     <span className="font-bold text-text-main truncate">{item.name}</span>
                     {item.has_gst && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
                     {item.is_bundle && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">Bundle</span>}
                </div>
                <div className="text-right flex-shrink-0">
                    <span className={`font-semibold text-lg px-2 py-0.5 rounded ${item.stock < 10 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                        {item.stock} in stock
                    </span>
                    {canBeBundled && (
                        <p className="text-xs text-text-muted mt-1">
                            ({fullBundles} bundles + {remainingUnits} loose)
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                <p>{item.is_bundle ? 'Loose Price' : 'Selling Price'}: <span className="text-text-main">₹{item.price.toFixed(2)}</span></p>
                {item.is_bundle && <p>Bundle Price: <span className="text-text-main">₹{item.bundle_price?.toFixed(2)}</span> ({item.items_per_bundle} units)</p>}
                <p>Cost/Unit: <span className="text-text-main">₹{item.cost.toFixed(2)}</span></p>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-border/50">
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
    );
};


const Inventory: React.FC = () => {
    const { inventory, sales, deleteInventoryItem } = useContext(ShopContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
    const [itemHasSales, setItemHasSales] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const searchRef = useRef<HTMLDivElement>(null);

    if (!inventory || !sales) {
        return null;
    }

    const totalInventoryValue = useMemo(() =>
        inventory.reduce((acc, item) => acc + item.stock * item.cost, 0),
        [inventory]
    );

    useEffect(() => {
        if (searchTerm.length < 1) {
            setSuggestions([]);
            return;
        }
        if (inventory) {
            const filteredSuggestions = inventory
                .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(item => item.name)
                .slice(0, 5);
            setSuggestions(filteredSuggestions);
        }
    }, [searchTerm, inventory]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredInventory = useMemo(() => {
        if (!debouncedSearchTerm) return inventory;
        return inventory.filter(item =>
            item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
    }, [inventory, debouncedSearchTerm]);

    const handleOpenModal = (item: InventoryItem | null = null) => {
        setItemToEdit(item);
        setIsModalOpen(true);
    };
    
    const openDeleteConfirm = (item: InventoryItem) => {
        const hasSales = sales.some(sale => sale.inventoryItemId === item.id);
        setItemHasSales(hasSales);
        setItemToDelete(item);
        setIsConfirmModalOpen(true);
    };

    const handleDelete = () => {
        if(itemToDelete) {
            deleteInventoryItem(itemToDelete.id);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-text-main">Inventory</h2>
                    <p className="mt-1 text-text-muted font-semibold">
                        INVENTORY VALUE: <span className="text-success">₹{totalInventoryValue.toFixed(2)}</span>
                    </p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="relative flex-grow sm:w-64" ref={searchRef}>
                        <input
                            type="text"
                            placeholder="Search inventory..."
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
                    <button onClick={() => handleOpenModal()} className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors flex-shrink-0">
                        <PlusIcon />
                        <span className="ml-2 hidden sm:inline">New Item</span>
                    </button>
                </div>
            </div>

            <Modal title={itemToEdit ? "Edit Inventory Item" : "Add New Inventory Item"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <InventoryForm onClose={() => setIsModalOpen(false)} itemToEdit={itemToEdit} inventory={inventory} />
            </Modal>

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Inventory Item"
            >
                {itemHasSales ? (
                    <>
                        <strong>Warning:</strong> This item has existing sales records. Deleting "{itemToDelete?.name}" will also permanently delete <strong>all associated sales records</strong>. This action cannot be undone. Are you sure you want to proceed?
                    </>
                ) : (
                    <>
                        Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
                    </>
                )}
            </ConfirmationModal>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                 {filteredInventory.length > 0 ? (
                    filteredInventory.map(item => 
                        <InventoryCard 
                            key={item.id} 
                            item={item}
                            onEdit={() => handleOpenModal(item)}
                            onDelete={() => openDeleteConfirm(item)}
                        />
                    )
                ) : (
                     <div className="text-center py-10 text-text-muted bg-surface rounded-lg border border-border">
                        <p className="font-semibold">No Items Found</p>
                        <p className="text-sm mt-1">No inventory items match your search.</p>
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-surface rounded-lg shadow border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-background">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Product</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Stock</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Prices (Loose / Bundle)</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Cost/Unit</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                             {filteredInventory.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-text-muted">
                                        <p className="font-semibold">No Items Found</p>
                                        <p className="text-sm mt-1">No inventory items match your search.</p>
                                    </td>
                                </tr>
                            )}
                            {filteredInventory.map((item: InventoryItem) => {
                                const { fullBundles, remainingUnits, canBeBundled } = getBundleDisplayInfo(item);
                                return (
                                <tr key={item.id} className="hover:bg-surface-hover/50">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-text-main">{item.name}</span>
                                            {item.has_gst && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-info/10 text-info">GST</span>}
                                            {item.is_bundle && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">Bundle</span>}
                                        </div>
                                    </td>
                                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-semibold ${item.stock < 10 ? 'text-danger' : 'text-text-main'}`}>
                                        <div>
                                            <span>{item.stock} units</span>
                                            {canBeBundled && (
                                                 <span className="block text-xs text-text-muted font-normal">
                                                    ({fullBundles} bundles + {remainingUnits} loose)
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                                        {item.is_bundle 
                                            ? `₹${item.price.toFixed(2)} / ₹${item.bundle_price?.toFixed(2)}`
                                            : `₹${item.price.toFixed(2)}`
                                        }
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">₹{item.cost.toFixed(2)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            <button onClick={() => handleOpenModal(item)} className="text-primary hover:text-primary-focus p-1 rounded-full hover:bg-surface-hover transition-colors"><EditIcon /></button>
                                            <button onClick={() => openDeleteConfirm(item)} className="text-danger hover:opacity-80 p-1 rounded-full hover:bg-surface-hover transition-colors"><DeleteIcon /></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Inventory;