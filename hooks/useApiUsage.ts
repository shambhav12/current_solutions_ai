import { useState, useCallback } from 'react';

export const DAILY_LIMIT = 15;
const STORAGE_KEY = 'aiApiUsage';

type UsageType = 'predictions' | 'inventory';
export interface UsageData {
  date: string;
  predictions: number;
  inventory: number;
}

const getTodaysDateString = () => new Date().toISOString().split('T')[0];

const getInitialUsageData = (): UsageData => {
    // This function will run only once when the hook is initialized
    const storedData = localStorage.getItem(STORAGE_KEY);
    const today = getTodaysDateString();

    if (!storedData) {
        return { date: today, predictions: 0, inventory: 0 };
    }
    try {
        const parsedData: UsageData = JSON.parse(storedData);
        if (parsedData.date !== today) {
             // It's a new day, reset the counts
            return { date: today, predictions: 0, inventory: 0 };
        }
        return parsedData;
    } catch (e) {
        // Data is corrupted, reset it
        return { date: today, predictions: 0, inventory: 0 };
    }
};

export const useApiUsage = () => {
    const [usage, setUsage] = useState<UsageData>(getInitialUsageData);

    const recordUsage = useCallback((type: UsageType) => {
        setUsage(currentUsage => {
            if (currentUsage[type] >= DAILY_LIMIT) {
                return currentUsage; // Don't increment if limit is already reached
            }
            const newData = {
                ...currentUsage,
                [type]: (currentUsage[type] || 0) + 1,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
            return newData;
        });
    }, []);

    const remainingPredictions = Math.max(0, DAILY_LIMIT - usage.predictions);
    const remainingInventory = Math.max(0, DAILY_LIMIT - usage.inventory);

    return {
        recordUsage,
        remainingPredictions,
        remainingInventory,
        isPredictionsLimitReached: remainingPredictions === 0,
        isInventoryLimitReached: remainingInventory === 0,
        DAILY_LIMIT,
    };
};