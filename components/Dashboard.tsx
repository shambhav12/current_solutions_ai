import React, { useContext, useMemo, useState } from 'react';
import { ShopContext } from '../App';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useFilters } from '../FilterContext';
import DateFilterComponent from './ui/DateFilter';
import { Sale } from '../types';
import { RevenueIcon, OnlineIcon, OfflineIcon, GstPayableIcon, ChevronDownIcon } from './Icons';
import { StatCard } from './ui/StatCard';


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

const Dashboard: React.FC = () => {
    const { sales, inventory } = useContext(ShopContext);
    const { dateFilter } = useFilters();
    const [isGstExpanded, setIsGstExpanded] = useState(false);
    const [isRevenueExpanded, setIsRevenueExpanded] = useState(false);


    // Guard against rendering until data is loaded
    if (!sales || !inventory) {
        return null;
    }

    const filteredSales = useMemo(() => filterSalesByDate(sales, dateFilter), [sales, dateFilter]);
    
    // This is the single source of truth for all calculations.
    // It correctly excludes items returned via the old method (status: 'returned')
    // and correctly includes standalone returns (which are negative-value sales with status: 'completed').
    const relevantSales = useMemo(() => filteredSales.filter(s => s.status !== 'returned'), [filteredSales]);
    
    const totalRevenue = useMemo(() =>
        relevantSales.reduce((acc, sale) => acc + sale.totalPrice, 0),
        [relevantSales]
    );

    const totalProfit = useMemo(() =>
        relevantSales.reduce((acc, sale) => {
            const saleProfit = sale.totalPrice - (sale.itemCostAtSale ?? 0);
            return acc + saleProfit;
        }, 0),
        [relevantSales]
    );
    
    const profitMargin = useMemo(() =>
        totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        [totalRevenue, totalProfit]
    );

    const onCreditRevenue = useMemo(() =>
        relevantSales.reduce((acc, sale) => (sale.paymentMethod === 'On Credit' ? acc + sale.totalPrice : acc), 0),
        [relevantSales]
    );

    const onlineRevenue = useMemo(() =>
        relevantSales.reduce((acc, sale) => (sale.paymentMethod === 'Online' ? acc + sale.totalPrice : acc), 0),
        [relevantSales]
    );

    const offlineRevenue = useMemo(() =>
        relevantSales.reduce((acc, sale) => (sale.paymentMethod === 'Offline' ? acc + sale.totalPrice : acc), 0),
        [relevantSales]
    );

    const totalGstSales = useMemo(() =>
        relevantSales.reduce((acc, sale) => (sale.has_gst ? acc + sale.totalPrice : acc), 0),
        [relevantSales]
    );

    const outputGst = useMemo(() =>
        relevantSales.reduce((acc, sale) => {
            if (sale.has_gst) {
                // For a return (negative price), this correctly calculates a negative GST (credit)
                const gstAmount = sale.totalPrice * 0.18;
                return acc + gstAmount;
            }
            return acc;
        }, 0),
        [relevantSales]
    );

    const inputGstOnSoldItems = useMemo(() =>
        relevantSales.reduce((acc, sale) => {
            if (sale.has_gst) {
                // For a return, we credit the input GST as well.
                // We use Math.sign to handle negative totalPrice correctly.
                const sign = Math.sign(sale.totalPrice);
                const totalItemCost = (sale.itemCostAtSale ?? 0) * sign;
                const inputGstForItem = totalItemCost * 0.18;
                return acc + inputGstForItem;
            }
            return acc;
        }, 0),
        [relevantSales]
    );

    const netGstPayable = useMemo(() => outputGst - inputGstOnSoldItems, [outputGst, inputGstOnSoldItems]);

    const salesOverTime = useMemo(() => {
        const salesByDay: { [key: string]: number } = {};
        relevantSales.forEach(sale => {
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
    }, [relevantSales]);

    const topSellingItems = useMemo(() => {
        const itemSales: { [key: string]: { name: string; quantity: number } } = {};
        // We only want to see positive sales here, not returns
        const positiveSales = relevantSales.filter(s => s.totalPrice > 0);
        positiveSales.forEach(sale => {
            if (!itemSales[sale.inventoryItemId]) {
                itemSales[sale.inventoryItemId] = { name: sale.productName, quantity: 0 };
            }
            itemSales[sale.inventoryItemId].quantity += sale.quantity;
        });
        return Object.values(itemSales).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    }, [relevantSales]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-3xl font-bold text-text-main">Dashboard</h2>
                <DateFilterComponent />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Expandable Revenue & Profit Card */}
                <div className="bg-surface rounded-lg shadow-lg border border-border transition-all duration-300 hover:shadow-primary/20 col-span-1 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center space-x-4 cursor-pointer p-6" onClick={() => setIsRevenueExpanded(!isRevenueExpanded)}>
                        <div className="p-3 rounded-full bg-primary/10 text-primary">
                            <RevenueIcon />
                        </div>
                        <div className="flex-grow">
                            <h3 className="text-sm font-medium text-text-muted">Total Revenue ({dateFilter.label})</h3>
                            <p className="text-2xl font-bold text-text-main mt-1">₹{totalRevenue.toFixed(2)}</p>
                        </div>
                        <ChevronDownIcon className={`transform transition-transform duration-300 ${isRevenueExpanded ? 'rotate-180' : ''}`} />
                    </div>
                     <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isRevenueExpanded ? 'max-h-40' : 'max-h-0'}`}>
                         <div className="px-6 pb-6 pt-4 border-t border-border space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-text-muted">Total Profit:</span>
                                <span className="font-semibold text-success">₹{totalProfit.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Profit Margin:</span>
                                <span className="font-semibold text-success">{profitMargin.toFixed(2)}%</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-text-muted">Pending Payments:</span>
                                <span className="font-semibold text-warning">₹{onCreditRevenue.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <StatCard title="Online Revenue" value={`₹${onlineRevenue.toFixed(2)}`} subtext="Online payments" icon={<OnlineIcon />}/>
                <StatCard title="Offline Revenue" value={`₹${offlineRevenue.toFixed(2)}`} subtext="Cash payments" icon={<OfflineIcon />}/>

                {/* Expandable GST Card */}
                <div className="bg-surface rounded-lg shadow-lg border border-border transition-all duration-300 hover:shadow-primary/20">
                    <div className="flex items-center space-x-4 cursor-pointer p-6" onClick={() => setIsGstExpanded(!isGstExpanded)}>
                        <div className="p-3 rounded-full bg-primary/10 text-primary">
                            <GstPayableIcon />
                        </div>
                        <div className="flex-grow">
                            <h3 className="text-sm font-medium text-text-muted">GST Details</h3>
                            <p className="text-2xl font-bold text-text-main mt-1">₹{netGstPayable.toFixed(2)}</p>
                             <p className="text-xs text-text-muted mt-1">Net GST Payable</p>
                        </div>
                        <ChevronDownIcon className={`transform transition-transform duration-300 ${isGstExpanded ? 'rotate-180' : ''}`} />
                    </div>

                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isGstExpanded ? 'max-h-40' : 'max-h-0'}`}>
                         <div className="px-6 pb-6 pt-4 border-t border-border space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-text-muted">Total GST Sales:</span>
                                <span className="font-semibold text-text-main">₹{totalGstSales.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Output GST (Collected):</span>
                                <span className="font-semibold text-text-main">₹{outputGst.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Input GST (Credit):</span>
                                <span className="font-semibold text-text-main">₹{inputGstOnSoldItems.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

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