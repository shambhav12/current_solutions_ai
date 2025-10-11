import { useState, useEffect, useCallback } from 'react';
import { Sale, InventoryItem, Transaction, CartItemForTransaction } from '../types';
import { useAuth } from '../AuthContext';
import { supabase } from '../services/supabaseClient';

export const useShopData = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async (userId: string) => {
    setIsLoading(true);
    let isCancelled = false;
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

      if (isCancelled) return;
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
      if (!isCancelled) {
        setInventory([]);
        setSales([]);
        setTransactions([]);
      }
    } finally {
      if (!isCancelled) {
        setIsLoading(false);
      }
    }
     return () => { isCancelled = true; };
  }, []);


  useEffect(() => {
    if (isAuthLoading) return;

    if (user) {
      const unsubscribe = fetchData(user.id);
      return () => { unsubscribe.then(cleanup => cleanup()); };
    } else {
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
      if (!user || items.length === 0) {
        return;
      }
  
      try {
        const grandTotal = items.reduce((acc, item) => acc + item.totalPrice, 0);
  
        // FIX: Added robust check for NaN on the grand total before sending to Supabase.
        if (isNaN(grandTotal) || typeof grandTotal !== 'number') {
            alert("Transaction failed: Invalid total amount. Please review the items in your cart.");
            return;
        }

        const transactionPayload: { [key: string]: any } = {
            user_id: user.id,
            total_price: grandTotal,
            payment_method: paymentMethod,
            date: new Date().toISOString(),
        };

        if (paymentMethod === 'On Credit' && customerInfo) {
            if (customerInfo.name && customerInfo.name.trim()) {
                transactionPayload.customer_name = customerInfo.name.trim();
            }
            if (customerInfo.phone && customerInfo.phone.trim()) {
                transactionPayload.customer_phone = customerInfo.phone.trim();
            }
        }

        const { data: newTransaction, error: transactionError } = await supabase
          .from('transactions')
          .insert(transactionPayload)
          .select()
          .single();
  
        if (transactionError || !newTransaction) throw transactionError || new Error('Failed to create transaction.');
  
        const salePayloads = [];
        const inventoryUpdates = new Map<string, number>();
  
        for (const item of items) {
          const { data: currentItem, error: fetchError } = await supabase
            .from('inventory')
            .select('stock, cost, has_gst')
            .eq('id', item.inventoryItemId)
            .single();
          
          if (fetchError || !currentItem) throw fetchError || new Error(`Item ${item.productName} not found.`);
          
          const unitsToDeduct = item.sale_type === 'bundle' ? item.quantity * (item.items_per_bundle || 1) : item.quantity;
          
          // FIX: Added robust check for NaN on the item cost calculation.
          const itemCostAtSale = (currentItem.cost || 0) * unitsToDeduct;
          if (isNaN(itemCostAtSale)) {
            throw new Error(`Failed to calculate cost for ${item.productName}. Please check its cost in inventory.`);
          }

          if (currentItem.stock < unitsToDeduct) throw new Error(`Not enough stock for ${item.productName}.`);
  
          inventoryUpdates.set(item.inventoryItemId, currentItem.stock - unitsToDeduct);
          
          salePayloads.push({
            inventoryItemId: item.inventoryItemId,
            productName: item.productName,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            user_id: user.id,
            transaction_id: newTransaction.id,
            item_cost_at_sale: itemCostAtSale,
            has_gst: currentItem.has_gst,
            date: newTransaction.date,
            payment_method: newTransaction.payment_method,
            sale_type: item.sale_type,
          });
        }
  
        for (const [id, stock] of inventoryUpdates.entries()) {
             const { error: stockError } = await supabase.from('inventory').update({ stock }).eq('id', id);
             if (stockError) throw stockError;
        }
  
        const { data: newSales, error: salesError } = await supabase.from('sales').insert(salePayloads).select();
        if (salesError) throw salesError;
        
        await fetchData(user.id);
  
      } catch (error) {
        alert(`Failed to add sale: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [user, fetchData]
  );
  
  const updateSale = useCallback(
    async (updatedSale: Sale) => {
      // This function is deprecated and no longer used.
    },
    []
  );

    const updateTransactionPaymentMethod = useCallback(
    async (transactionId: string, newPaymentMethod: 'Online' | 'Offline') => {
        if (!user) return;

        try {
            const { error: transactionError } = await supabase
                .from('transactions')
                .update({ payment_method: newPaymentMethod })
                .eq('id', transactionId)
                .eq('user_id', user.id);

            if (transactionError) throw transactionError;

            const { error: salesError } = await supabase
                .from('sales')
                .update({ payment_method: newPaymentMethod })
                .eq('transaction_id', transactionId)
                .eq('user_id', user.id);

            if (salesError) throw salesError;

            // FIX: Manually update the local state to avoid re-fetching and ensure
            // the UI updates instantly and reliably.
            setTransactions(currentTransactions => {
                if (!currentTransactions) return null;
                return currentTransactions.map(t => {
                    if (t.id === transactionId) {
                        return {
                            ...t,
                            payment_method: newPaymentMethod,
                            items: t.items.map(item => ({
                                ...item,
                                paymentMethod: newPaymentMethod,
                            }))
                        };
                    }
                    return t;
                });
            });

            setSales(currentSales => {
                if (!currentSales) return null;
                return currentSales.map(s => {
                    if (s.transaction_id === transactionId) {
                        return { ...s, paymentMethod: newPaymentMethod };
                    }
                    return s;
                });
            });

        } catch (error) {
            alert(`Failed to update payment method: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // If something goes wrong, re-fetch to ensure data consistency.
            if (user) await fetchData(user.id);
        }
    },
    [user, fetchData]
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
        if (!user || !inventory || !sales) return;

        const transactionToDelete = transactions?.find(t => t.id === transactionId);
        if (!transactionToDelete) return;

        const { error: deleteError } = await supabase.from('transactions').delete().eq('id', transactionId);

        if (deleteError) {
            alert(`Failed to delete sale: ${deleteError.message}`);
            return;
        }

        const stockRestorationMap = new Map<string, number>();
        const inventoryMap = new Map(inventory.map(i => [i.id, i]));

        for (const saleItem of transactionToDelete.items) {
             if (saleItem.status === 'returned') continue;
            const inventoryItem = inventoryMap.get(saleItem.inventoryItemId);
            if (inventoryItem) {
                const unitsToRestore = saleItem.sale_type === 'bundle'
                    ? saleItem.quantity * (inventoryItem.items_per_bundle || 1)
                    : saleItem.quantity;
                
                const currentChange = stockRestorationMap.get(saleItem.inventoryItemId) || 0;
                stockRestorationMap.set(saleItem.inventoryItemId, currentChange + unitsToRestore);
            }
        }

        for (const [itemId, quantityToRestore] of stockRestorationMap.entries()) {
            const currentItem = inventory.find(i => i.id === itemId);
            if (currentItem) {
                const { error: stockError } = await supabase
                    .from('inventory')
                    .update({ stock: currentItem.stock + quantityToRestore })
                    .eq('id', itemId);
                if (stockError) console.error(`Failed to restore stock for item ${itemId}:`, stockError);
            }
        }
        
        await fetchData(user.id);
    },
    [user, inventory, sales, transactions, fetchData]
);

const processReturn = useCallback(async (saleId: string) => {
    if (!user || !inventory || !sales) return;

    const saleToReturn = sales.find(s => s.id === saleId);
    if (!saleToReturn || saleToReturn.status === 'returned') {
        alert("This item has already been returned or does not exist.");
        return;
    }

    const inventoryItem = inventory.find(i => i.id === saleToReturn.inventoryItemId);
    if (!inventoryItem) {
        alert("Could not find the original inventory item to process the return.");
        return;
    }

    const unitsToRestore = saleToReturn.sale_type === 'bundle'
        ? saleToReturn.quantity * (inventoryItem.items_per_bundle || 1)
        : saleToReturn.quantity;

    const newStockLevel = inventoryItem.stock + unitsToRestore;

    const { error: stockError } = await supabase
        .from('inventory')
        .update({ stock: newStockLevel })
        .eq('id', inventoryItem.id);

    if (stockError) {
        alert(`Failed to update stock: ${stockError.message}`);
        return;
    }

    const { error: saleError } = await supabase
        .from('sales')
        .update({ status: 'returned' })
        .eq('id', saleId);

    if (saleError) {
        await supabase.from('inventory').update({ stock: inventoryItem.stock }).eq('id', inventoryItem.id);
        alert(`Failed to mark item as returned: ${saleError.message}`);
        return;
    }

    await fetchData(user.id);

}, [user, inventory, sales, fetchData]);

const processStandaloneReturn = useCallback(async (itemToReturn: InventoryItem, quantity: number, refundAmount: number) => {
    if (!user || !inventory) {
        alert("Cannot process return: user or inventory not loaded.");
        return;
    }

    try {
        const totalRefundAmount = -Math.abs(refundAmount);

        const { data: newTransaction, error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                total_price: totalRefundAmount,
                payment_method: 'Offline',
                date: new Date().toISOString(),
            })
            .select()
            .single();

        if (transactionError) throw transactionError;

        const salePayload = {
            inventoryItemId: itemToReturn.id,
            productName: itemToReturn.name,
            quantity: quantity,
            totalPrice: totalRefundAmount,
            user_id: user.id,
            transaction_id: newTransaction.id,
            item_cost_at_sale: itemToReturn.cost * quantity,
            has_gst: itemToReturn.has_gst,
            date: newTransaction.date,
            payment_method: newTransaction.payment_method,
            sale_type: 'loose' as 'loose',
        };

        const { data: newSale, error: salesError } = await supabase
            .from('sales')
            .insert(salePayload)
            .select()
            .single();

        if (salesError) throw salesError;
        
        const newStockLevel = itemToReturn.stock + quantity;
        const { error: stockError } = await supabase
            .from('inventory')
            .update({ stock: newStockLevel })
            .eq('id', itemToReturn.id);

        if (stockError) throw stockError;

        await fetchData(user.id);

    } catch (error) {
        alert(`Failed to process return: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}, [user, inventory, fetchData]);


  const addInventoryItem = useCallback(
    async (item: Omit<InventoryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<InventoryItem | null> => {
      if (!user) return null;
      const newItemPayload = { ...item, user_id: user.id };
      const { data: newItem, error } = await supabase
        .from('inventory')
        .insert(newItemPayload)
        .select()
        .single();
      if (error || !newItem) {
        console.error('Error adding inventory item:', error);
        return null;
      } else {
        await fetchData(user.id);
        return newItem;
      }
    },
    [user, fetchData]
  );

  const updateInventoryItem = useCallback(
    async (updatedItem: InventoryItem) => {
        if (!user) return;

        const newUpdatedAt = new Date().toISOString();
        const updatedItemWithTimestamp = { ...updatedItem, updated_at: newUpdatedAt };

        const updatePayload = {
            name: updatedItemWithTimestamp.name,
            stock: updatedItemWithTimestamp.stock,
            price: updatedItemWithTimestamp.price,
            cost: updatedItemWithTimestamp.cost,
            has_gst: updatedItemWithTimestamp.has_gst,
            is_bundle: updatedItemWithTimestamp.is_bundle,
            bundle_price: updatedItemWithTimestamp.is_bundle ? updatedItemWithTimestamp.bundle_price : null,
            items_per_bundle: updatedItemWithTimestamp.is_bundle ? updatedItemWithTimestamp.items_per_bundle : null,
            updated_at: newUpdatedAt,
        };
        
        try {
            const { error } = await supabase
                .from('inventory')
                .update(updatePayload)
                .eq('id', updatedItem.id)
                .eq('user_id', user.id);

            if (error) throw error;
            
            // FIX: Manually update the local inventory state for an instant and reliable UI update.
            setInventory(currentInventory => {
                if (!currentInventory) return null;
                return currentInventory.map(item => 
                    item.id === updatedItem.id ? updatedItemWithTimestamp : item
                ).sort((a, b) => 
                    new Date(b.updated_at || b.created_at).getTime() - 
                    new Date(a.updated_at || a.created_at).getTime()
                );
            });
            
        } catch (error) {
            console.error('Error updating inventory item:', error);
            alert(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
            if (user) await fetchData(user.id);
        }
    },
    [user, fetchData]
  );

  const deleteInventoryItem = useCallback(
    async (itemId: string) => {
      if (!user) return;
      const { error } = await supabase.from('inventory').delete().eq('id', itemId);
      if (error) {
        console.error('Error deleting inventory item:', error);
      } else {
        if(user) await fetchData(user.id);
      }
    },
    [user, fetchData]
  );

  return {
    sales,
    transactions,
    inventory,
    addTransaction,
    updateSale,
    updateTransactionPaymentMethod,
    deleteTransaction,
    processReturn,
    processStandaloneReturn,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    isLoading,
  };
};