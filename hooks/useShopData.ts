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
      // Fetch all necessary data in parallel
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

      const inventoryMap = new Map<string, InventoryItem>(inventoryData.map(item => [item.id, item]));

      const salesByTransactionId = new Map<string, Sale[]>();
      salesData.forEach(sale => {
        const saleForState: Sale = {
            id: sale.id,
            user_id: sale.user_id,
            inventoryItemId: sale.inventoryItemId,
            productName: sale.productName || inventoryMap.get(sale.inventoryItemId)?.name || 'Unknown Product',
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
        console.error('[ShopData] Error loading data:', error);
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

  // --- actions ---

  const addTransaction = useCallback(
    async (items: CartItemForTransaction[], paymentMethod: 'Online' | 'Offline') => {
      if (!user || items.length === 0) {
        console.error('[addTransaction] Aborted: user not available or no items.');
        return;
      }
  
      try {
        const grandTotal = items.reduce((acc, item) => acc + item.totalPrice, 0);
  
        const { data: newTransaction, error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            total_price: grandTotal,
            payment_method: paymentMethod,
            date: new Date().toISOString(),
          })
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

          if (currentItem.stock < unitsToDeduct) throw new Error(`Not enough stock for ${item.productName}.`);
  
          inventoryUpdates.set(item.inventoryItemId, currentItem.stock - unitsToDeduct);
          
          salePayloads.push({
            inventoryItemId: item.inventoryItemId,
            productName: item.productName,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            user_id: user.id,
            transaction_id: newTransaction.id,
            item_cost_at_sale: currentItem.cost * unitsToDeduct, // Total cost for units sold
            has_gst: currentItem.has_gst,
            date: newTransaction.date,
            payment_method: newTransaction.payment_method,
            sale_type: item.sale_type,
            // status: 'completed', // BUG: The 'status' column does not exist in the DB schema.
          });
        }
  
        for (const [id, stock] of inventoryUpdates.entries()) {
             const { error: stockError } = await supabase.from('inventory').update({ stock }).eq('id', id);
             if (stockError) throw stockError;
        }
  
        const { data: newSales, error: salesError } = await supabase.from('sales').insert(salePayloads).select();
        if (salesError) throw salesError;
  
        const inventoryMap = new Map(inventory?.map(i => [i.id, i]));
        
        setInventory(prev => {
            if (!prev) return [];
            return prev.map(item => {
                if (inventoryUpdates.has(item.id)) {
                    return { ...item, stock: inventoryUpdates.get(item.id)! };
                }
                return item;
            });
        });

        const newUiSales: Sale[] = newSales.map(s => ({
            id: s.id,
            user_id: s.user_id,
            inventoryItemId: s.inventoryItemId,
            productName: s.productName,
            quantity: s.quantity,
            totalPrice: s.totalPrice,
            paymentMethod: newTransaction.payment_method as 'Online' | 'Offline',
            date: newTransaction.date,
            itemCostAtSale: s.item_cost_at_sale,
            has_gst: s.has_gst,
            transaction_id: s.transaction_id,
            sale_type: s.sale_type,
            status: 'completed',
        }));
        
        const newUiTransaction: Transaction = {
            id: newTransaction.id,
            user_id: newTransaction.user_id,
            total_price: newTransaction.total_price,
            payment_method: newTransaction.payment_method,
            date: newTransaction.date,
            items: newUiSales,
        };
  
        setTransactions(prev => [newUiTransaction, ...(prev || [])]);
        setSales(prev => [...newUiSales, ...(prev || [])]);
  
      } catch (error) {
        console.error('[addTransaction] A critical error occurred:', error);
        alert(`Failed to add sale: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [user, inventory]
  );
  
  const updateSale = useCallback(
    async (updatedSale: Sale) => {
      // This function is deprecated in the multi-item world.
    },
    [user, sales, inventory]
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
        if (!user || !inventory || !sales) return;

        const transactionToDelete = transactions?.find(t => t.id === transactionId);
        if (!transactionToDelete) return;

        const { error: deleteError } = await supabase.from('transactions').delete().eq('id', transactionId);

        if (deleteError) {
            console.error('Error deleting transaction:', deleteError);
            alert(`Failed to delete sale: ${deleteError.message}`);
            return;
        }

        const stockRestorationMap = new Map<string, number>();
        const inventoryMap = new Map(inventory.map(i => [i.id, i]));

        for (const saleItem of transactionToDelete.items) {
             if (saleItem.status === 'returned') continue; // Do not restore stock for already returned items
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
        
        setTransactions(prev => prev ? prev.filter(t => t.id !== transactionId) : []);
        setSales(prev => prev ? prev.filter(s => s.transaction_id !== transactionId) : []);
        setInventory(prev => {
            if (!prev) return [];
            return prev.map(item => {
                if (stockRestorationMap.has(item.id)) {
                    return { ...item, stock: item.stock + stockRestorationMap.get(item.id)! };
                }
                return item;
            });
        });
    },
    [user, inventory, sales, transactions]
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
        // Attempt to revert stock change if sale update fails
        await supabase.from('inventory').update({ stock: inventoryItem.stock }).eq('id', inventoryItem.id);
        alert(`Failed to mark item as returned: ${saleError.message}`);
        return;
    }

    // --- Update local state for immediate UI feedback ---
    setInventory(prev => prev!.map(item =>
        item.id === inventoryItem.id ? { ...item, stock: newStockLevel } : item
    ));

    const updateSaleInState = (sale: Sale) => sale.id === saleId ? { ...sale, status: 'returned' as 'returned' } : sale;

    setSales(prev => prev!.map(updateSaleInState));
    setTransactions(prev => prev!.map(t => ({
        ...t,
        items: t.items.map(updateSaleInState),
    })));

}, [user, inventory, sales]);

const processStandaloneReturn = useCallback(async (itemToReturn: InventoryItem, quantity: number, refundAmount: number) => {
    if (!user || !inventory) {
        alert("Cannot process return: user or inventory not loaded.");
        return;
    }

    try {
        const totalRefundAmount = -Math.abs(refundAmount); // Ensure it's a negative value

        // 1. Create the transaction
        const { data: newTransaction, error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                total_price: totalRefundAmount,
                payment_method: 'Offline', // Returns are typically offline/cash
                date: new Date().toISOString(),
            })
            .select()
            .single();

        if (transactionError) throw transactionError;

        // 2. Create the negative sale record
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
            // status: 'completed' as 'completed', // BUG: The 'status' column might not exist. Removing it.
        };

        const { data: newSale, error: salesError } = await supabase
            .from('sales')
            .insert(salePayload)
            .select()
            .single();

        if (salesError) throw salesError;
        
        // 3. Update inventory stock
        const newStockLevel = itemToReturn.stock + quantity;
        const { error: stockError } = await supabase
            .from('inventory')
            .update({ stock: newStockLevel })
            .eq('id', itemToReturn.id);

        if (stockError) throw stockError;

        // 4. Update local state
        setInventory(prev => prev!.map(item => 
            item.id === itemToReturn.id ? { ...item, stock: newStockLevel } : item
        ));
        
        const newUiSale: Sale = { ...newSale, paymentMethod: newTransaction.payment_method, date: newTransaction.date };
        const newUiTransaction: Transaction = { ...newTransaction, items: [newUiSale] };

        setSales(prev => [newUiSale, ...(prev || [])]);
        setTransactions(prev => [newUiTransaction, ...(prev || [])]);

    } catch (error) {
        console.error("[processStandaloneReturn] Error:", error);
        alert(`Failed to process return: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}, [user, inventory]);


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
        setInventory((prev) => (prev ? [newItem, ...prev] : [newItem]));
        return newItem;
      }
    },
    [user]
  );

  const updateInventoryItem = useCallback(
    async (updatedItem: InventoryItem) => {
      if (!user) return;
      const { data: newItem, error } = await supabase
        .from('inventory')
        .update({
          name: updatedItem.name,
          stock: updatedItem.stock,
          price: updatedItem.price,
          cost: updatedItem.cost,
          has_gst: updatedItem.has_gst,
          is_bundle: updatedItem.is_bundle,
          bundle_price: updatedItem.is_bundle ? updatedItem.bundle_price : null,
          items_per_bundle: updatedItem.is_bundle ? updatedItem.items_per_bundle : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updatedItem.id)
        .select()
        .single();

      if (error || !newItem) {
        console.error('Error updating inventory item:', error);
      } else {
        setInventory((prev) =>
          prev ? [newItem, ...prev.filter((item) => item.id !== newItem.id)] : [newItem]
        );
      }
    },
    [user]
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
    deleteTransaction,
    processReturn,
    processStandaloneReturn,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    isLoading,
  };
};