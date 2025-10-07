import { useState, useEffect, useCallback } from 'react';
import { Sale, InventoryItem } from '../types';
import { useAuth } from '../AuthContext';
import { supabase } from '../services/supabaseClient';

export const useShopData = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (user) {
      let isCancelled = false;
      
      const loadData = async () => {
        setIsLoading(true);
        try {
          // Step 1: Fetch all inventory items for the user from Supabase.
          const { data: inventoryData, error: inventoryError } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', user.id);
          
          if (inventoryError) throw inventoryError;
          if (isCancelled) return;
          
          const inventoryMap = new Map(inventoryData.map(item => [item.id, item.name]));
          const inventoryGstMap = new Map(inventoryData.map(item => [item.id, item.has_gst]));
          
          // Step 2: Fetch all sales records for the user from Supabase.
          const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('*')
            .eq('user_id', user.id);
            
          if (salesError) throw salesError;
          if (isCancelled) return;

          // Step 3: Combine sales with inventory data and map DB columns to app properties.
          const formattedSales: Sale[] = salesData.map(sale => ({
              id: sale.id,
              user_id: sale.user_id,
              inventoryItemId: sale.inventoryItemId,
              productName: inventoryMap.get(sale.inventoryItemId) || sale.productName || 'Unknown Product',
              quantity: sale.quantity,
              totalPrice: sale.totalPrice,
              date: sale.date,
              paymentMethod: sale.payment_method || 'Offline', // Map from snake_case to camelCase
              has_gst: inventoryGstMap.get(sale.inventoryItemId) || false,
          }));
          
          // Step 4: Update the application state with the data fetched from Supabase.
          setInventory(inventoryData ?? []);
          setSales(formattedSales ?? []);

        } catch (error) {
          if (!isCancelled) {
            console.error('[ShopData] Error loading data from Supabase:', error);
            setInventory([]);
            setSales([]);
          }
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      };

      loadData();

      return () => {
        isCancelled = true;
      };
    } else {
      setSales(null);
      setInventory(null);
      setIsLoading(false);
    }
  }, [user, isAuthLoading]);


  // --- actions ---

  const addSale = useCallback(
    async (sale: Omit<Sale, 'id' | 'date' | 'user_id'>) => {
      if (!user) {
        console.error('[addSale] Aborted: user not available.');
        return;
      }

      try {
        // Fetch the latest item state directly from the database to avoid stale closure issues,
        // especially when adding a sale for a newly created inventory item.
        const { data: currentItemBeforeSale, error: itemFetchError } = await supabase
          .from('inventory')
          .select('*')
          .eq('id', sale.inventoryItemId)
          .single();

        if (itemFetchError || !currentItemBeforeSale) {
          throw new Error(itemFetchError?.message || `Inventory item with ID ${sale.inventoryItemId} not found.`);
        }

        if (currentItemBeforeSale.stock < sale.quantity) {
          throw new Error(`Not enough stock for ${sale.productName}. Available: ${currentItemBeforeSale.stock}, Needed: ${sale.quantity}`);
        }

        const newStock = currentItemBeforeSale.stock - sale.quantity;

        // Step 1: Update inventory stock in Supabase.
        const { data: updatedItem, error: stockError } = await supabase
          .from('inventory')
          .update({ stock: newStock })
          .eq('id', sale.inventoryItemId)
          .select()
          .single();

        if (stockError) throw stockError;
        if (!updatedItem) throw new Error('Failed to update item stock in database.');

        // Step 2: Prepare the sale record for insertion, mapping to snake_case.
        const { paymentMethod, ...restOfSale } = sale;
        const newSalePayload = {
          ...restOfSale,
          payment_method: paymentMethod,
          date: new Date().toISOString(),
          user_id: user.id,
        };

        // Step 3: Insert the new sale into Supabase.
        const { data: newSaleFromDb, error: saleError } = await supabase
          .from('sales')
          .insert(newSalePayload)
          .select()
          .single();

        if (saleError) {
          // If sale insertion fails, try to revert the stock change.
          await supabase
            .from('inventory')
            .update({ stock: currentItemBeforeSale.stock })
            .eq('id', sale.inventoryItemId);
          throw saleError; // Throw original error after attempting revert.
        }
        if (!newSaleFromDb) throw new Error('Sale was not returned from database after insert.');

        // Step 4: Update the local state, mapping back to camelCase.
        const newSaleForState: Sale = {
          id: newSaleFromDb.id,
          user_id: newSaleFromDb.user_id,
          inventoryItemId: newSaleFromDb.inventoryItemId,
          productName: newSaleFromDb.productName,
          quantity: newSaleFromDb.quantity,
          totalPrice: newSaleFromDb.totalPrice,
          date: newSaleFromDb.date,
          paymentMethod: newSaleFromDb.payment_method,
          has_gst: currentItemBeforeSale.has_gst,
        };
        
        setSales((prev) => (prev ? [...prev, newSaleForState] : [newSaleForState]));
        setInventory((prev) =>
          prev ? prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)) : [updatedItem]
        );

      } catch (error) {
        console.error('[addSale] A critical error occurred:', error);
        alert(`Failed to add sale: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [user]
  );

  const updateSale = useCallback(
    async (updatedSale: Sale) => {
      if (!user || !inventory || !sales) return;

      const originalSale = sales.find((s) => s.id === updatedSale.id);
      const item = inventory.find((i) => i.id === updatedSale.inventoryItemId);
      if (!originalSale || !item) return;

      const stockDifference = originalSale.quantity - updatedSale.quantity;
      const newStock = item.stock + stockDifference;

      const [
        { data: updatedItem, error: stockError },
        { data: updatedSaleFromDb, error: saleError },
      ] = await Promise.all([
        supabase
          .from('inventory')
          .update({ stock: newStock })
          .eq('id', updatedSale.inventoryItemId)
          .select()
          .single(),
        supabase
          .from('sales')
          .update({
            productName: updatedSale.productName,
            quantity: updatedSale.quantity,
            totalPrice: updatedSale.totalPrice,
            payment_method: updatedSale.paymentMethod, // Map to snake_case
          })
          .eq('id', updatedSale.id)
          .select()
          .single(),
      ]);

      if (stockError || saleError || !updatedItem || !updatedSaleFromDb) {
        console.error('Error updating sale or stock:', stockError || saleError);
        // Note: A rollback mechanism for the inventory update might be needed in a real-world app.
        return;
      }
      
      // Map DB response back to camelCase for local state.
      const updatedSaleForState: Sale = {
        id: updatedSaleFromDb.id,
        user_id: updatedSaleFromDb.user_id,
        inventoryItemId: updatedSaleFromDb.inventoryItemId,
        productName: updatedSaleFromDb.productName,
        quantity: updatedSaleFromDb.quantity,
        totalPrice: updatedSaleFromDb.totalPrice,
        date: updatedSaleFromDb.date,
        paymentMethod: updatedSaleFromDb.payment_method,
        has_gst: item.has_gst,
      };

      setSales((prev) =>
        prev ? prev.map((s) => (s.id === updatedSaleForState.id ? updatedSaleForState : s)) : [updatedSaleForState]
      );
      setInventory((prev) =>
        prev ? prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)) : [updatedItem]
      );
    },
    [user, sales, inventory]
  );

  const deleteSale = useCallback(
    async (saleId: string) => {
      if (!user || !inventory || !sales) return;

      const saleToDelete = sales.find((s) => s.id === saleId);
      if (!saleToDelete) return;

      const currentItem = inventory.find((i) => i.id === saleToDelete.inventoryItemId);
      if (!currentItem) return;

      const restoredStock = currentItem.stock + saleToDelete.quantity;

      const { error: saleError } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);
      if (saleError) {
        console.error('Error deleting sale:', saleError);
        return;
      }

      const { data: updatedItem, error: stockError } = await supabase
        .from('inventory')
        .update({ stock: restoredStock })
        .eq('id', saleToDelete.inventoryItemId)
        .select()
        .single();

      if (stockError || !updatedItem) {
        console.error('Sale deleted, but failed to restore stock:', stockError);
      }

      setSales((prev) => (prev ? prev.filter((s) => s.id !== saleId) : []));
      if (updatedItem) {
        setInventory((prev) =>
          prev ? prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)) : [updatedItem]
        );
      }
    },
    [user, sales, inventory]
  );

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
        setInventory((prev) => (prev ? [...prev, newItem] : [newItem]));
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', updatedItem.id)
        .select()
        .single();

      if (error || !newItem) {
        console.error('Error updating inventory item:', error);
      } else {
        setInventory((prev) =>
          prev ? prev.map((item) => (item.id === newItem.id ? newItem : item)) : [newItem]
        );
      }
    },
    [user]
  );

  const deleteInventoryItem = useCallback(
    async (itemId: string) => {
      if (!user) return;

      const { error: salesError } = await supabase
        .from('sales')
        .delete()
        .eq('inventoryItemId', itemId);
      if (salesError) {
        console.error('Error deleting associated sales:', salesError);
        return;
      }

      const { error } = await supabase.from('inventory').delete().eq('id', itemId);
      if (error) {
        console.error('Error deleting inventory item:', error);
      } else {
        setInventory((prev) => (prev ? prev.filter((item) => item.id !== itemId) : []));
        setSales((prev) => (prev ? prev.filter((sale) => sale.inventoryItemId !== itemId) : []));
      }
    },
    [user]
  );

  return {
    sales,
    inventory,
    addSale,
    updateSale,
    deleteSale,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    isLoading,
  };
};