import { useState, useEffect, useCallback } from 'react';
import { Sale, InventoryItem, Transaction, CartItemForTransaction } from '../types';
import { useAuth } from '../AuthContext';
import { supabase } from '../services/supabaseClient';

export const useShopData = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
        const [
            { data: inventoryData, error: inventoryError },
            { data: transactionsData, error: transactionsError },
            { data: salesData, error: salesError },
        ] = await Promise.all([
            supabase.from('inventory').select('*').eq('user_id', userId),
            supabase.from('transactions').select('*').eq('user_id', userId),
            supabase.from('sales').select('*').eq('user_id', userId)
        ]);

        if (inventoryError) throw inventoryError;
        if (transactionsError) throw transactionsError;
        if (salesError) throw salesError;

        const salesByTransactionId = new Map<string, Sale[]>();
        salesData.forEach(sale => {
            const saleForState: Sale = {
                id: sale.id,
                user_id: sale.user_id,
                inventoryItemId: sale.inventoryItemId,
                productName: sale.productName,
                quantity: sale.quantity,
                totalPrice: sale.totalPrice,
                date: sale.date,
                paymentMethod: sale.payment_method,
                has_gst: sale.has_gst,
                itemCostAtSale: sale.item_cost_at_sale,
                transaction_id: sale.transaction_id,
                sale_type: sale.sale_type,
                status: sale.status ?? 'completed',
            };
            const items = salesByTransactionId.get(sale.transaction_id) || [];
            items.push(saleForState);
            salesByTransactionId.set(sale.transaction_id, items);
        });

        const formattedTransactions: Transaction[] = transactionsData.map(t => ({
            id: t.id,
            user_id: t.user_id,
            total_price: t.total_price,
            payment_method: t.payment_method,
            date: t.date,
            customer_name: t.customer_name,
            customer_phone: t.customer_phone,
            items: (salesByTransactionId.get(t.id) || []).map(item => ({
                ...item,
                date: t.date,
                paymentMethod: t.payment_method,
            })),
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const flatSalesFromTransactions = formattedTransactions.flatMap(t => t.items);

        inventoryData.sort((a, b) => 
            new Date(b.updated_at || b.created_at).getTime() - 
            new Date(a.updated_at || a.created_at).getTime()
        );

        setInventory(inventoryData ?? []);
        setTransactions(formattedTransactions ?? []);
        setSales(flatSalesFromTransactions ?? []);

    } catch (error) {
        console.error("Error fetching data:", error);
        setInventory([]);
        setSales([]);
        setTransactions([]);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !isAuthLoading) {
      fetchData(user.id);
    } else if (!user && !isAuthLoading) {
      setSales(null);
      setInventory(null);
      setTransactions(null);
      setIsLoading(false);
    }
  }, [user, isAuthLoading, fetchData]);

  const addTransaction = useCallback(
    async (
        items: CartItemForTransaction[],
        paymentMethod: 'Online' | 'Offline' | 'On Credit',
        customerInfo?: { name?: string; phone?: string }
    ) => {
      if (!user || items.length === 0) return;
  
      try {
        const grandTotal = items.reduce((acc, item) => acc + item.totalPrice, 0);
        if (isNaN(grandTotal)) throw new Error("Invalid total amount.");

        const transactionPayload: { [key: string]: any } = {
            user_id: user.id,
            total_price: grandTotal,
            payment_method: paymentMethod,
            date: new Date().toISOString(),
            ...(paymentMethod === 'On Credit' && customerInfo ? {
                customer_name: customerInfo.name?.trim(),
                customer_phone: customerInfo.phone?.trim()
            } : {})
        };

        const { data: newTransaction, error: transactionError } = await supabase
          .from('transactions').insert(transactionPayload).select().single();
        if (transactionError) throw transactionError;
  
        const salePayloads = [];
        const inventoryUpdates = new Map<string, number>();
  
        for (const item of items) {
          const inventoryItem = inventory?.find(i => i.id === item.inventoryItemId);
          if (!inventoryItem) throw new Error(`Item ${item.productName} not found.`);
          
          const unitsToDeduct = item.sale_type === 'bundle' ? item.quantity * (item.items_per_bundle || 1) : item.quantity;
          const itemCostAtSale = (inventoryItem.cost || 0) * unitsToDeduct;

          if (inventoryItem.stock < unitsToDeduct) throw new Error(`Not enough stock for ${item.productName}.`);
  
          inventoryUpdates.set(item.inventoryItemId, inventoryItem.stock - unitsToDeduct);
          
          salePayloads.push({
            inventoryItemId: item.inventoryItemId, productName: item.productName, quantity: item.quantity,
            totalPrice: item.totalPrice, user_id: user.id, transaction_id: newTransaction.id,
            item_cost_at_sale: itemCostAtSale, has_gst: inventoryItem.has_gst,
            date: newTransaction.date, payment_method: newTransaction.payment_method,
            sale_type: item.sale_type, status: 'completed'
          });
        }
  
        for (const [id, stock] of inventoryUpdates.entries()) {
             await supabase.from('inventory').update({ stock }).eq('id', id);
        }
  
        const { data: newSalesData, error: salesError } = await supabase.from('sales').insert(salePayloads).select();
        if (salesError) throw salesError;

        // Optimistic UI update
        const newSales: Sale[] = newSalesData.map(s => ({ ...s, paymentMethod: newTransaction.payment_method }));
        const newTransactionForState: Transaction = { ...newTransaction, items: newSales };
        
        setTransactions(prev => [newTransactionForState, ...(prev || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setSales(prev => [...(prev || []), ...newSales]);
        setInventory(prev => {
            if (!prev) return null;
            return prev.map(invItem => {
                if (inventoryUpdates.has(invItem.id)) {
                    return { ...invItem, stock: inventoryUpdates.get(invItem.id)! };
                }
                return invItem;
            });
        });
  
      } catch (error) {
        alert(`Failed to add sale: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (user) await fetchData(user.id);
      }
    },
    [user, inventory, fetchData]
  );
  
  const updateSale = useCallback( async (updatedSale: Sale) => {}, []);

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
        if (!user || !inventory || !transactions) return;

        const transactionToDelete = transactions.find(t => t.id === transactionId);
        if (!transactionToDelete) return;

        const { error: deleteError } = await supabase.from('transactions').delete().eq('id', transactionId);
        if (deleteError) {
            alert(`Failed to delete sale: ${deleteError.message}`);
            return;
        }

        const stockRestorationMap = new Map<string, number>();
        const inventoryMap = new Map(inventory.map(i => [i.id, i]));
        for (const saleItem of transactionToDelete.items) {
             if (saleItem.status === 'returned') continue; // This handles items returned from a regular sale.
            
            const inventoryItem = inventoryMap.get(saleItem.inventoryItemId) as InventoryItem | undefined;
            if (inventoryItem) {
                const units = saleItem.sale_type === 'bundle' 
                    ? saleItem.quantity * (inventoryItem.items_per_bundle || 1) 
                    : saleItem.quantity;
                
                // If it's a sale (positive price), restore stock.
                // If it was a standalone return (negative price), deduct stock upon deletion.
                const stockChange = saleItem.totalPrice >= 0 ? units : -units;

                stockRestorationMap.set(
                    saleItem.inventoryItemId, 
                    (stockRestorationMap.get(saleItem.inventoryItemId) || 0) + stockChange
                );
            }
        }

        for (const [itemId, quantityChange] of stockRestorationMap.entries()) {
            const currentItem = inventory.find(i => i.id === itemId);
            if (currentItem) {
                await supabase.from('inventory').update({ stock: currentItem.stock + quantityChange }).eq('id', itemId);
            }
        }
        
        // Optimistic UI update
        const deletedSaleIds = new Set(transactionToDelete.items.map(i => i.id));
        setTransactions(prev => (prev || []).filter(t => t.id !== transactionId));
        setSales(prev => (prev || []).filter(s => !deletedSaleIds.has(s.id)));
        setInventory(prev => {
            if (!prev) return null;
            return prev.map(invItem => {
                if (stockRestorationMap.has(invItem.id)) {
                    return { ...invItem, stock: invItem.stock + stockRestorationMap.get(invItem.id)! };
                }
                return invItem;
            });
        });
    },
    [user, inventory, transactions]
);

const processReturn = useCallback(async (saleId: string) => {
    if (!user || !inventory || !sales) return;

    const saleToReturn = sales.find(s => s.id === saleId);
    if (!saleToReturn || saleToReturn.status === 'returned') return;
    const inventoryItem = inventory.find(i => i.id === saleToReturn.inventoryItemId);
    if (!inventoryItem) return;

    const unitsToRestore = saleToReturn.sale_type === 'bundle' ? saleToReturn.quantity * (inventoryItem.items_per_bundle || 1) : saleToReturn.quantity;
    const newStockLevel = inventoryItem.stock + unitsToRestore;

    const { error: saleError } = await supabase.from('sales').update({ status: 'returned' }).eq('id', saleId);
    if (saleError) { alert(`Failed to mark item as returned: ${saleError.message}`); return; }

    const { error: stockError } = await supabase.from('inventory').update({ stock: newStockLevel }).eq('id', inventoryItem.id);
    if (stockError) { alert(`Failed to update stock: ${stockError.message}`); return; }

    // Optimistic UI update
    setSales(prev => (prev || []).map(s => s.id === saleId ? { ...s, status: 'returned' } : s));
    setInventory(prev => (prev || []).map(i => i.id === inventoryItem.id ? { ...i, stock: newStockLevel } : i));

}, [user, inventory, sales]);

const processStandaloneReturn = useCallback(async (itemToReturn: InventoryItem, quantity: number, refundAmount: number) => {
    if (!user) return;
    try {
        const totalRefundAmount = -Math.abs(refundAmount);
        const { data: newTransaction, error: tError } = await supabase.from('transactions').insert({ user_id: user.id, total_price: totalRefundAmount, payment_method: 'Offline', date: new Date().toISOString() }).select().single();
        if (tError) throw tError;

        const salePayload = {
            inventoryItemId: itemToReturn.id, productName: itemToReturn.name, quantity: quantity,
            totalPrice: totalRefundAmount, user_id: user.id, transaction_id: newTransaction.id,
            item_cost_at_sale: itemToReturn.cost * quantity, has_gst: itemToReturn.has_gst,
            date: newTransaction.date, payment_method: newTransaction.payment_method, sale_type: 'loose' as 'loose', 
            status: 'completed' as 'completed', // Using 'completed' with a negative price to represent a return and avoid backend trigger issues.
        };
        const { data: newSaleData, error: sError } = await supabase.from('sales').insert(salePayload).select().single();
        if (sError) throw sError;
        
        const newStockLevel = itemToReturn.stock + quantity;
        const { error: stockError } = await supabase.from('inventory').update({ stock: newStockLevel }).eq('id', itemToReturn.id);
        if (stockError) throw stockError;

        // Optimistic UI update
        const newSale: Sale = { ...newSaleData, paymentMethod: newTransaction.payment_method };
        const newTransactionForState: Transaction = { ...newTransaction, items: [newSale] };
        setTransactions(prev => [newTransactionForState, ...(prev || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setSales(prev => [...(prev || []), newSale]);
        setInventory(prev => (prev || []).map(i => i.id === itemToReturn.id ? { ...i, stock: newStockLevel } : i));

    } catch (error) {
        alert(`Failed to process return: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}, [user]);

  const addInventoryItem = useCallback(
    async (item: Omit<InventoryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<InventoryItem | null> => {
      if (!user) return null;
      const { data: newItem, error } = await supabase.from('inventory').insert({ ...item, user_id: user.id }).select().single();
      if (error) {
        console.error('Error adding inventory item:', error);
        return null;
      }
      // Optimistic UI update
      setInventory(prev => [newItem, ...(prev || [])].sort((a,b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()));
      return newItem;
    },
    [user]
  );

  const updateInventoryItem = useCallback(
    async (updatedItem: InventoryItem) => {
        if (!user) return;
        const newUpdatedAt = new Date().toISOString();
        const updatedItemWithTimestamp = { ...updatedItem, updated_at: newUpdatedAt };
        const { id, user_id, created_at, ...updatePayload } = updatedItemWithTimestamp;
        try {
            const { error } = await supabase.from('inventory').update(updatePayload).eq('id', updatedItem.id);
            if (error) throw error;
            setInventory(current => (current || []).map(item => item.id === updatedItem.id ? updatedItemWithTimestamp : item)
                .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()));
        } catch (error) {
            alert(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    [user]
  );

  const deleteInventoryItem = useCallback(
    async (itemId: string) => {
      if (!user || !sales) return;
      const hasSales = sales.some(sale => sale.inventoryItemId === itemId);
      if (hasSales) {
          alert("Cannot delete item: It has existing sales records. Please delete the associated sales first.");
          return;
      }
      const { error } = await supabase.from('inventory').delete().eq('id', itemId);
      if (error) {
        alert(`Error deleting inventory item: ${error.message}`);
      } else {
        setInventory(current => (current || []).filter(item => item.id !== itemId));
      }
    },
    [user, sales]
  );

  return {
    sales,
    transactions,
    inventory,
    addTransaction,
    updateSale,
    deleteTransaction,
    processReturn,
    processStandaloneReturn,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    isLoading,
  };
};