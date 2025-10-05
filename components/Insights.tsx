import React, { useState, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { ShopContext } from '../App';
import { getSalesPredictions, getInventoryInsights } from '../services/geminiService';
import { SalesPrediction, InventoryInsight } from '../types';
import { useApiUsage } from '../hooks/useApiUsage';

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center space-x-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="text-text-muted">Analyzing data...</span>
    </div>
);

const Insights: React.FC = () => {
    const { sales, inventory } = React.useContext(ShopContext);
    const { user, signOut } = useAuth();
    
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [predictions, setPredictions] = useState<SalesPrediction[]>([]);
    const [invInsights, setInvInsights] = useState<{ slowMovingItems: InventoryInsight[], restockAlerts: InventoryInsight[] } | null>(null);
    
    const {
        recordUsage,
        remainingPredictions,
        remainingInventory,
        isPredictionsLimitReached,
        isInventoryLimitReached,
        DAILY_LIMIT,
    } = useApiUsage();

    const handleError = (err: unknown) => {
        let message = err instanceof Error ? err.message : "An unknown error occurred.";
        
        // Intercept common API errors to provide helpful feedback.
        // FIX: Updated the error message to be more generic and not expose internal configuration details,
        // as per the @google/genai API key handling guidelines.
        if (message.includes("API_KEY_ERROR") || message.includes("API key not valid")) {
            message = "The AI service is currently unavailable due to a configuration issue.";
        } else if (message.includes("Authentication failed")) {
            signOut();
        }

        setError(message);
    };

    const runAI = async (
        type: 'predictions' | 'inventory',
        aiFunction: () => Promise<any>
    ) => {
        if (!user) {
            setError("You must be signed in to generate insights.");
            return;
        }
        setLoading(type);
        setError(null);
        
        try {
            const result = await aiFunction();
            if (type === 'predictions') setPredictions(result.predictions);
            if (type === 'inventory') setInvInsights(result);
        } catch (err) {
            handleError(err);
        } finally {
            setLoading(null);
        }
    };

    const handleFetchPredictions = useCallback(() => {
        if (isPredictionsLimitReached) {
            setError(`You have reached your daily limit of ${DAILY_LIMIT} uses for sales forecasts. Please try again tomorrow.`);
            return;
        }
        if (!sales) {
            setError("Sales data is not available to make predictions.");
            return;
        }
        const recentSales = sales.filter(s => new Date(s.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        if (recentSales.length < 3) {
            setError("Not enough recent sales data to make a prediction. Please record at least 3 sales.");
            return;
        }
        setPredictions([]);
        recordUsage('predictions');
        runAI('predictions', () => getSalesPredictions(recentSales));
    }, [sales, user, signOut, isPredictionsLimitReached, recordUsage]);

    const handleFetchInvInsights = useCallback(() => {
        if (isInventoryLimitReached) {
            setError(`You have reached your daily limit of ${DAILY_LIMIT} uses for inventory analysis. Please try again tomorrow.`);
            return;
        }
        if (!inventory || !sales) {
            setError("Inventory or sales data is not available to analyze.");
            return;
        }
        if (inventory.length === 0) {
            setError("No inventory data to analyze.");
            return;
        }
        setInvInsights(null);
        recordUsage('inventory');
        runAI('inventory', () => getInventoryInsights(inventory, sales));
    }, [inventory, sales, user, signOut, isInventoryLimitReached, recordUsage]);

    // Guard against rendering until data is loaded
    if (!sales || !inventory) {
        return null;
    }
    
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-text-main">AI Insights</h2>
            </div>
            {error && (
                 <div className="bg-danger/10 border border-danger text-red-300 p-4 rounded-lg">
                    <p>{error}</p>
                </div>
            )}

            {/* Sales Predictions */}
            <div className="bg-surface p-6 rounded-lg shadow-lg border border-border">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                    <div>
                        <h3 className="text-xl font-semibold text-text-main">7-Day Sales Forecast</h3>
                        <p className="text-text-muted mt-1">Predict future sales based on recent performance.</p>
                         <p className="text-xs text-text-muted mt-2">
                            {remainingPredictions} of {DAILY_LIMIT} uses remaining today.
                        </p>
                    </div>
                    <button onClick={handleFetchPredictions} disabled={loading === 'predictions' || !user || isPredictionsLimitReached} className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-focus disabled:bg-surface-hover disabled:cursor-not-allowed transition-colors flex-shrink-0">
                        {loading === 'predictions' ? 'Generating...' : 'Generate Forecast'}
                    </button>
                </div>
                {loading === 'predictions' && <div className="mt-6"><LoadingSpinner /></div>}
                {predictions.length > 0 && (
                    <div className="mt-6 space-y-4">
                        {predictions.map(p => (
                            <div key={p.date} className="p-4 bg-background rounded-md border border-border">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-text-main">{new Date(p.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    <p className="font-bold text-lg text-success">₹{p.predictedSales.toFixed(2)}</p>
                                </div>
                                <p className="text-sm text-text-muted mt-2">{p.reasoning}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Inventory Insights */}
            <div className="bg-surface p-6 rounded-lg shadow-lg border border-border">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                    <div>
                        <h3 className="text-xl font-semibold text-text-main">Inventory Analysis</h3>
                        <p className="text-text-muted mt-1">Get recommendations on slow-moving items and restock alerts.</p>
                         <p className="text-xs text-text-muted mt-2">
                            {remainingInventory} of {DAILY_LIMIT} uses remaining today.
                        </p>
                    </div>
                     <button onClick={handleFetchInvInsights} disabled={loading === 'inventory' || !user || isInventoryLimitReached} className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-focus disabled:bg-surface-hover disabled:cursor-not-allowed transition-colors flex-shrink-0">
                        {loading === 'inventory' ? 'Analyzing...' : 'Analyze Inventory'}
                    </button>
                </div>
                 {loading === 'inventory' && <div className="mt-6"><LoadingSpinner /></div>}
                 {invInsights && (
                     <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <h4 className="font-semibold text-lg text-warning mb-3">Slow-Moving Items</h4>
                             <div className="space-y-3">
                                {invInsights.slowMovingItems.length > 0 ? invInsights.slowMovingItems.map((item, i) => (
                                    <div key={i} className="p-4 bg-background rounded-md border border-border">
                                        <p className="font-semibold text-text-main">{item.itemName}</p>
                                        <p className="text-sm text-text-muted mt-1">{item.insight}</p>
                                        <p className="text-sm text-warning mt-2">Suggestion: {item.suggestion}</p>
                                    </div>
                                )) : <p className="text-sm text-text-muted">No slow-moving items found.</p>}
                             </div>
                         </div>
                         <div>
                            <h4 className="font-semibold text-lg text-info mb-3">Restock Alerts</h4>
                            <div className="space-y-3">
                                {invInsights.restockAlerts.length > 0 ? invInsights.restockAlerts.map((item, i) => (
                                     <div key={i} className="p-4 bg-background rounded-md border border-border">
                                        <p className="font-semibold text-text-main">{item.itemName}</p>
                                        <p className="text-sm text-text-muted mt-1">{item.insight}</p>
                                        <p className="text-sm text-info mt-2">Suggestion: {item.suggestion}</p>
                                    </div>
                                )) : <p className="text-sm text-text-muted">No items need restocking right now.</p>}
                            </div>
                         </div>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default Insights;