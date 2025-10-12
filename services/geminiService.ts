import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, Sale, SalesPrediction, InventoryInsight } from "../types";
import { GEMINI_API_KEY } from "../config";

// The API key is obtained from the config file.
// For local development, this is read from env.ts.
if (!GEMINI_API_KEY) {
    throw new Error("A Gemini API key is not configured for this environment. Please ensure the GEMINI_API_KEY is set in your config file (env.ts).");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const generateContent = async (prompt: string, schema: any) => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });
    
    const responseText = response.text;
    return JSON.parse(responseText);
};

export const extractSaleDataFromImage = async (base64Image: string) => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
        },
    };

    const textPart = {
        text: `You are an expert data entry clerk specializing in reading handwritten and printed receipts from an electrical shop. Analyze the provided image of a bill. Extract all line items, including the product name, quantity, and total price for each item. Also, try to identify the grand total, payment method (if mentioned, otherwise default to 'Offline'), and the date of the transaction. For product names, be concise. For quantities, default to 1 if not specified. For prices, extract the total price for the line item. Structure the output as a JSON object matching the provided schema.`,
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING, description: 'The date of the transaction in YYYY-MM-DD format. If not found, use today\'s date.' },
            paymentMethod: { type: Type.STRING, description: 'The payment method (e.g., "Cash", "Card", "Online", "Credit"). Default to "Offline" if not found.' },
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        productName: { type: Type.STRING, description: 'The name of the product.' },
                        quantity: { type: Type.NUMBER, description: 'The quantity of the product sold. Default to 1 if not specified.' },
                        totalPrice: { type: Type.NUMBER, description: 'The total price for this line item.' },
                    },
                    required: ['productName', 'quantity', 'totalPrice'],
                },
            },
            grandTotal: { type: Type.NUMBER, description: 'The final total amount on the receipt.' },
        },
        required: ['date', 'items'],
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });

    const responseText = response.text;
    return JSON.parse(responseText);
}

export const extractInventoryDataFromImage = async (base64Image: string) => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
        },
    };

    const textPart = {
        text: `You are an expert data entry clerk specializing in reading purchase invoices for an electrical shop. Analyze the provided image of a purchase bill. Extract all line items, including the product name, quantity, and the total price (cost) for each item. Do not invent items not on the bill. If a grand total is present, you can use it for verification but do not include it as a line item. Structure the output as a JSON object matching the provided schema.`,
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        productName: { type: Type.STRING, description: 'The name of the purchased product.' },
                        quantity: { type: Type.NUMBER, description: 'The quantity of the product purchased. Default to 1 if not specified.' },
                        totalCost: { type: Type.NUMBER, description: 'The total cost for this line item (price the shop paid).' },
                    },
                    required: ['productName', 'quantity', 'totalCost'],
                },
            },
        },
        required: ['items'],
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });

    const responseText = response.text;
    return JSON.parse(responseText);
};

export const getSalesPredictions = async (salesData: Sale[]): Promise<{ predictions: SalesPrediction[] }> => {
    const prompt = `You are a senior business analyst for a small electric retail shop. Based on the following daily sales data in JSON format, provide a 7-day sales forecast.
    
    Analyze trends, seasonality, and recent performance to make your predictions as accurate as possible.

    Sales Data:
    ${JSON.stringify(salesData, null, 2)}`;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            predictions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING, description: 'The date of the prediction in YYYY-MM-DD format.' },
                        predictedSales: { type: Type.NUMBER, description: 'The predicted total sales amount for that date.' },
                        reasoning: { type: Type.STRING, description: 'A brief justification for the prediction, mentioning any trends observed.' },
                    },
                    required: ['date', 'predictedSales', 'reasoning'],
                },
            },
        },
        required: ['predictions'],
    };

    return generateContent(prompt, schema);
};

export const getInventoryInsights = async (inventory: InventoryItem[], sales: Sale[]): Promise<{ slowMovingItems: InventoryInsight[], restockAlerts: InventoryInsight[] }> => {
    const inventoryWithSalesData = inventory.map(item => {
        const lastSale = sales
            .filter(s => s.inventoryItemId === item.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return {
            id: item.id,
            name: item.name,
            stock: item.stock,
            lastSoldDate: lastSale ? lastSale.date.split('T')[0] : 'Never'
        };
    });

    const recentSales = sales.filter(s => new Date(s.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const prompt = `You are an expert inventory manager for a small electric retail shop. Analyze the following data to identify slow-moving products and items that need restocking.

    Current Inventory (with stock count and last sold date):
    ${JSON.stringify(inventoryWithSalesData, null, 2)}

    Recent Sales History (last 30 days):
    ${JSON.stringify(recentSales, null, 2)}

    Your task is to identify slow-moving items (not sold in the last 30 days) and items that need restocking (low stock <= 10 units but sold well recently). Provide specific, actionable advice for each.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            slowMovingItems: {
                type: Type.ARRAY,
                description: 'A list of items that have not sold in the last 30 days.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        itemName: { type: Type.STRING, description: 'The name of the product.' },
                        insight: { type: Type.STRING, description: 'Why it\'s slow-moving (e.g., "Not sold since YYYY-MM-DD").' },
                        suggestion: { type: Type.STRING, description: 'A specific, actionable promotional idea (e.g., "Bundle with a fast-selling item" or "Offer a 15% discount").' },
                    },
                    required: ['itemName', 'insight', 'suggestion'],
                },
            },
            restockAlerts: {
                type: Type.ARRAY,
                description: 'A list of items with low stock (<= 10 units) that have sold well recently.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        itemName: { type: Type.STRING, description: 'The name of the product.' },
                        insight: { type: Type.STRING, description: 'Why it needs a restock (e.g., "Only 5 left in stock, sold 12 in the last week").' },
                        suggestion: { type: Type.STRING, description: 'A specific reorder quantity recommendation (e.g., "Reorder 50 units").' },
                    },
                    required: ['itemName', 'insight', 'suggestion'],
                },
            },
        },
        required: ['slowMovingItems', 'restockAlerts'],
    };

    return generateContent(prompt, schema);
};