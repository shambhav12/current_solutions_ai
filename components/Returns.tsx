import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { ShopContext } from '../App';
import { InventoryItem, Sale } from '../types';
import { ReturnIcon } from './Icons';
import ConfirmationModal from './ui/ConfirmationModal';

const Returns: React.FC = () => {
    const { inventory, sales, processStandaloneReturn } = useContext(ShopContext);

    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [quantity, setQuantity] = useState<string>('1');
    const [refundPrice, setRefundPrice] = useState<string>('');
    const [productSearch, setProductSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [itemToConfirm, setItemToConfirm] = useState<{ item: InventoryItem; quantity: number; refundAmount: number } | null>(null);
    
    const searchRef = useRef<HTMLDivElement>(null);
    
    const filteredInventory = useMemo(() => {
        if (!inventory) return [];
        if (!productSearch) return [];
        return inventory.filter(item =>
            item.name.toLowerCase().includes(productSearch.toLowerCase())
        );
    }, [productSearch, inventory]);

    const recentReturns = useMemo(() => {
        if (!sales) return [];
        return sales
            .filter(s => s.totalPrice < 0)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10);
    }, [sales]);
    
    useEffect(() => {
        if (selectedItem) {
            const numQuantity = Number(quantity) > 0 ? Number(quantity) : 0;
            const calculatedRefund = selectedItem.price * numQuantity;
            setRefundPrice(calculatedRefund.toFixed(2));
        } else {
            setRefundPrice('');
        }
    }, [selectedItem, quantity]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectProduct = (item: InventoryItem) => {
        setSelectedItem(item);
        setProductSearch(item.name);
        setIsDropdownOpen(false);
    };

    const resetForm = () => {
        setSelectedItem(null);
        setProductSearch('');
        setQuantity('1');
        setRefundPrice('');
    };

    const handleReturnSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numQuantity = Number(quantity);
        const numRefundPrice = Number(refundPrice);

        if (!selectedItem || !Number.isInteger(numQuantity) || numQuantity <= 0) {
            alert('Please select a valid item and enter a positive whole number for the quantity.');
            return;
        }
        if (isNaN(numRefundPrice) || numRefundPrice < 0) {
            alert('Please enter a valid, non-negative refund amount.');
            return;
        }
        setItemToConfirm({ item: selectedItem, quantity: numQuantity, refundAmount: numRefundPrice });
    };
    
    const handleConfirmReturn = async () => {
        if (itemToConfirm) {
            await processStandaloneReturn(itemToConfirm.item, itemToConfirm.quantity, itemToConfirm.refundAmount);
            resetForm();
        }
    };

    if (!inventory || !sales) return null;

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-text-main">Process a Return</h2>

            <ConfirmationModal
                isOpen={!!itemToConfirm}
                onClose={() => setItemToConfirm(null)}
                onConfirm={handleConfirmReturn}
                title="Confirm Return"
                confirmText="Yes, Process Return"
                variant="warning"
            >
                Are you sure you want to return {itemToConfirm?.quantity} unit(s) of "{itemToConfirm?.item.name}"? 
                This will add the item(s) back to inventory and deduct ₹{itemToConfirm?.refundAmount.toFixed(2)} from today's sales total.
            </ConfirmationModal>

            {/* Return Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-surface p-6 rounded-lg shadow-lg border border-border">
                    <form onSubmit={handleReturnSubmit} className="space-y-6">
                        <div className="relative" ref={searchRef}>
                            <label className="block text-sm font-medium text-text-muted">Search for Product to Return</label>
                            <input
                                type="text" value={productSearch}
                                onChange={(e) => { setProductSearch(e.target.value); setSelectedItem(null); setIsDropdownOpen(true); }}
                                onFocus={() => setIsDropdownOpen(true)}
                                placeholder="Start typing product name..." autoComplete="off"
                                className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                            />
                            {isDropdownOpen && filteredInventory.length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-surface border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {filteredInventory.map(invItem => (
                                        <div key={invItem.id} onClick={() => handleSelectProduct(invItem)} className="cursor-pointer px-4 py-2 text-sm text-text-main hover:bg-surface-hover flex justify-between">
                                            <span>{invItem.name}</span>
                                            <span className="text-text-muted">Stock: {invItem.stock}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedItem && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-text-muted">Quantity to Return</label>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        min="1"
                                        required
                                        className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                                    />
                                </div>

                                <div className="p-4 bg-background rounded-lg border border-border space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted">Total Refund Amount (₹)</label>
                                        <div className="relative mt-1">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">₹</span>
                                            <input
                                                type="number"
                                                value={refundPrice}
                                                onChange={(e) => setRefundPrice(e.target.value)}
                                                min="0"
                                                step="0.01"
                                                required
                                                className="block w-full bg-surface border-border rounded-md py-2 pl-7 pr-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-lg font-bold text-danger"
                                            />
                                        </div>
                                         <p className="text-xs text-text-muted mt-1 text-right">Default is based on current loose price of ₹{selectedItem.price.toFixed(2)}</p>
                                    </div>
                                </div>

                                 <button type="submit" className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors">
                                    Process Return
                                </button>
                            </>
                        )}
                    </form>
                 </div>
                 
                 {/* Recent Returns Log */}
                 <div className="bg-surface p-6 rounded-lg shadow-lg border border-border">
                    <h3 className="text-xl font-semibold text-text-main mb-4">Recent Returns</h3>
                    <div className="space-y-3">
                    {recentReturns.length > 0 ? (
                        recentReturns.map(ret => (
                             <div key={ret.id} className="flex justify-between items-center bg-background p-3 rounded-md border border-border/50">
                                <div>
                                    <p className="font-medium text-text-main">{ret.productName}</p>
                                    <p className="text-xs text-text-muted">
                                        {new Date(ret.date).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                     <p className="font-semibold text-danger">₹{ret.totalPrice.toFixed(2)}</p>
                                     <p className="text-xs text-text-muted">Qty: {ret.quantity}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-text-muted text-center py-4">No standalone returns processed recently.</p>
                    )}
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default Returns;