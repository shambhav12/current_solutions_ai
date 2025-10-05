import React, { useContext, useMemo } from 'react';
import { ShopContext } from '../App';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useFilters } from '../FilterContext';
import DateFilterComponent from './ui/DateFilter';
import { Sale } from '../types';
import { RevenueIcon, ProfitIcon, OnlineIcon, OfflineIcon, GstIcon, InventoryValueIcon } from './Icons';

// Helper function to filter sales
const filterSalesByDate = (sales: Sale[], dateFilter: ReturnType<typeof useFilters>['dateFilter']) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter.type) {
        case 'today':
            return sales.filter(sale => new Date(sale.date) >= today);
        case '7days':
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 6);
            return sales.filter(sale => new Date(sale.date) >= sevenDaysAgo);
        case '30days':
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 29);
            return sales.filter(sale => new Date(sale.date) >= thirtyDaysAgo);
        case 'custom':
            if (dateFilter.startDate && dateFilter.endDate) {
                const start = new Date(dateFilter.startDate);
                start.setUTCHours(0, 0, 0, 0);
                const end = new Date(dateFilter.endDate);
                end.setUTCHours(23, 59, 59, 999);
                return sales.filter(sale => {
                    const saleDate = new Date(sale.date);
                    return saleDate >= start && saleDate <= end;
                });
            }
            return sales;
        case 'all':
        default:
            return sales;
    }
};

const StatCard: React.FC<{ title: string; value: string; subtext?: string; icon: React.ReactNode }> = ({ title, value, subtext, icon }) => (
    <div className="bg-surface p-6 rounded-lg shadow-lg border border-border flex items-center space-x-4 transition-transform duration-200 hover:scale-[1.02] hover:shadow-primary/20">
        <div className="p-3 rounded-full bg-primary/10 text-primary">
            {icon}
        </div>
        <div>
            <h3 className="text-sm font-medium text-text-muted">{title}</h3>
            <p className="text-2xl font-bold text-text-main mt-1">{value}</p>
            {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
        </div>
    </div>
);

const Dashboard: React.FC = () => {
    const { sales, inventory } = useContext(ShopContext);
    const { dateFilter } = useFilters();

    // Guard against rendering until data is loaded
    if (!sales || !inventory) {
        return null;
    }

    const filteredSales = useMemo(() => filterSalesByDate(sales, dateFilter), [sales, dateFilter]);
    
    const inventoryCostMap = useMemo(() => {
        return new Map(inventory.map(item => [item.id, item.cost]));
    }, [inventory]);

    const totalRevenue = useMemo(() =>
        filteredSales.reduce((acc, sale) => acc + sale.totalPrice, 0),
        [filteredSales]
    );

    const totalProfit = useMemo(() =>
        filteredSales.reduce((acc, sale) => {
            const itemCost = inventoryCostMap.get(sale.inventoryItemId) || 0;
            const saleProfit = sale.totalPrice - (itemCost * sale.quantity);
            return acc + saleProfit;
        }, 0),
        [filteredSales, inventoryCostMap]
    );

    const onlineRevenue = useMemo(() =>
        filteredSales.reduce((acc, sale) => (sale.paymentMethod === 'Online' ? acc + sale.totalPrice : acc), 0),
        [filteredSales]
    );

    const offlineRevenue = useMemo(() =>
        filteredSales.reduce((acc, sale) => (sale.paymentMethod === 'Offline' ? acc + sale.totalPrice : acc), 0),
        [filteredSales]
    );

    const totalGstSales = useMemo(() =>
        filteredSales.reduce((acc, sale) => (sale.has_gst ? acc + sale.totalPrice : acc), 0),
        [filteredSales]
    );

    const totalInventoryValue = useMemo(() =>
        inventory.reduce((acc, item) => acc + item.stock * item.price, 0),
        [inventory]
    );

    const salesOverTime = useMemo(() => {
        const salesByDay: { [key: string]: number } = {};
        filteredSales.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString();
            if (!salesByDay[date]) {
                salesByDay[date] = 0;
            }
            salesByDay[date] += sale.totalPrice;
        });
        return Object.keys(salesByDay).map(date => ({
            date,
            'Total Sales': salesByDay[date],
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredSales]);

    const topSellingItems = useMemo(() => {
        const itemSales: { [key: string]: { name: string; quantity: number } } = {};
        filteredSales.forEach(sale => {
            if (!itemSales[sale.inventoryItemId]) {
                itemSales[sale.inventoryItemId] = { name: sale.productName, quantity: 0 };
            }
            itemSales[sale.inventoryItemId].quantity += sale.quantity;
        });
        return Object.values(itemSales).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    }, [filteredSales]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-3xl font-bold text-text-main">Dashboard</h2>
                <DateFilterComponent />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value={`₹${totalRevenue.toFixed(2)}`} subtext={dateFilter.label} icon={<RevenueIcon />} />
                <StatCard title="Total Profit" value={`₹${totalProfit.toFixed(2)}`} subtext={dateFilter.label} icon={<ProfitIcon />} />
                <StatCard title="Online Revenue" value={`₹${onlineRevenue.toFixed(2)}`} subtext="Online payments" icon={<OnlineIcon />}/>
                <StatCard title="Offline Revenue" value={`₹${offlineRevenue.toFixed(2)}`} subtext="Cash payments" icon={<OfflineIcon />}/>
                <StatCard title="Total GST Sales" value={`₹${totalGstSales.toFixed(2)}`} subtext="From GST items" icon={<GstIcon />} />
                <StatCard title="Inventory Value" value={`₹${totalInventoryValue.toFixed(2)}`} subtext="Current stock value" icon={<InventoryValueIcon />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-surface p-6 rounded-lg shadow-lg border border-border">
                    <h3 className="text-lg font-semibold mb-4 text-text-main">Sales Trend ({dateFilter.label})</h3>
                     {salesOverTime.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={salesOverTime}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="date" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" tickFormatter={(tick) => `₹${tick.toLocaleString()}`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(55, 65, 81, 0.5)' }}
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    labelStyle={{ color: '#e5e7eb' }}
                                    itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                                    formatter={(value: number) => `₹${value.toFixed(2)}`}
                                />
                                <Legend wrapperStyle={{ color: '#9ca3af' }}/>
                                <Line type="monotone" dataKey="Total Sales" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px]">
                            <p className="text-text-muted">No sales data for the selected period.</p>
                        </div>
                    )}
                </div>
                <div className="bg-surface p-6 rounded-lg shadow-lg border border-border">
                    <h3 className="text-lg font-semibold mb-4 text-text-main">Top 5 Selling Items</h3>
                     {topSellingItems.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={topSellingItems} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" stroke="#9ca3af" />
                                <YAxis type="category" dataKey="name" stroke="#9ca3af" width={80} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(55, 65, 81, 0.5)' }}
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    labelStyle={{ color: '#e5e7eb' }}
                                    itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                                    formatter={(value: number) => `${value} units`}
                                />
                                <Bar dataKey="quantity" fill="#6366f1" name="Units Sold" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                     ) : (
                        <div className="flex items-center justify-center h-[300px]">
                            <p className="text-text-muted">No sales data for top items.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;