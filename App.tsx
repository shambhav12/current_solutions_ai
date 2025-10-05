import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Page, Sale, InventoryItem } from './types';
import { useShopData } from './hooks/useShopData';
import { useAuth } from './AuthContext';
import { DashboardIcon, SalesIcon, InventoryIcon, InsightsIcon, MenuIcon, CloseIcon } from './components/Icons';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Inventory from './components/Inventory';
import Insights from './components/Insights';
import LoginScreen from './components/LoginScreen';
import UserMenu from './components/UserMenu';
import { FilterProvider } from './FilterContext';

export const ShopContext = React.createContext<{
  sales: Sale[] | null;
  inventory: InventoryItem[] | null;
  addSale: (sale: Omit<Sale, 'id' | 'date' | 'user_id'>) => void;
  updateSale: (updatedSale: Sale) => void;
  deleteSale: (saleId: string) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'user_id'>) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  deleteInventoryItem: (itemId: string) => void;
}>({
  sales: null,
  inventory: null,
  addSale: () => {},
  updateSale: () => {},
  deleteSale: () => {},
  addInventoryItem: () => {},
  updateInventoryItem: () => {},
  deleteInventoryItem: () => {},
});

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  const {
    sales,
    inventory,
    addSale,
    updateSale,
    deleteSale,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    isLoading: isDataLoading,
  } = useShopData();

  const { user, isLoading: isAuthLoading, signOut } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = () => {
    signOut();
  };

  const shopContextValue = useMemo(
    () => ({
      sales,
      inventory,
      addSale,
      updateSale,
      deleteSale,
      addInventoryItem,
      updateInventoryItem,
      deleteInventoryItem,
    }),
    [sales, inventory, addSale, updateSale, deleteSale, addInventoryItem, updateInventoryItem, deleteInventoryItem]
  );

  const renderPage = useCallback(() => {
    switch (currentPage) {
      case Page.Dashboard:
        return <Dashboard />;
      case Page.Sales:
        return <Sales />;
      case Page.Inventory:
        return <Inventory />;
      case Page.Insights:
        return <Insights />;
      default:
        return <Dashboard />;
    }
  }, [currentPage]);

  if (isAuthLoading || isDataLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }
  
  return (
    <ShopContext.Provider value={shopContextValue}>
      <FilterProvider>
        <div className="flex h-screen bg-background font-sans">
          {isSidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/60 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            ></div>
          )}

          <aside
            className={`fixed md:relative inset-y-0 left-0 z-30 flex-shrink-0 flex flex-col bg-surface border-r border-border transition-all duration-300 ease-in-out ${
              isSidebarOpen ? 'w-64' : 'w-0'
            }`}
          >
            <div className="overflow-y-auto h-full">
              <div className="flex items-center h-16 px-4 border-b border-border">
                <h1 className="text-xl font-bold text-text-main">Current Solutions</h1>
              </div>
              <nav className="flex-grow p-4 space-y-2">
                {[
                  { page: Page.Dashboard, label: 'Dashboard', icon: <DashboardIcon /> },
                  { page: Page.Sales, label: 'Sales', icon: <SalesIcon /> },
                  { page: Page.Inventory, label: 'Inventory', icon: <InventoryIcon /> },
                  { page: Page.Insights, label: 'AI Insights', icon: <InsightsIcon /> },
                ].map((item) => (
                  <button
                    key={item.page}
                    onClick={() => {
                      setCurrentPage(item.page);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 relative ${
                      currentPage === item.page
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                    }`}
                  >
                    {currentPage === item.page && <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full"></span>}
                    <span className="mr-3">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="flex items-center justify-between h-16 px-4 bg-surface border-b border-border flex-shrink-0">
              <div className="flex items-center">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 rounded-md text-text-muted hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
                </button>
              </div>
              <div className="flex-1 text-center md:hidden">
                <h1 className="text-xl font-bold text-text-main">Current Solutions</h1>
              </div>
              <div className="flex items-center space-x-4">
                <UserMenu onSignOut={handleSignOut} />
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">
              <div className="p-4 md:p-8">{renderPage()}</div>
            </main>
          </div>
        </div>
      </FilterProvider>
    </ShopContext.Provider>
  );
};

export default App;