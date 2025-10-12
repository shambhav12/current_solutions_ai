import React, { useState, useRef, useEffect, useContext } from 'react';
import { ShopContext } from '../App';
import { Page, InventoryItem } from '../types';
import { extractInventoryDataFromImage } from '../services/geminiService';
import { BillAddIcon, DeleteIcon } from './Icons';

type ExtractedInventoryItem = {
    id: number;
    productName: string;
    quantity: string;
    costPerUnit: string;
    inventoryItem: InventoryItem | null;
    status: 'matched' | 'new' | 'unmatched';
    // For new items:
    sellingPrice: string;
    hasGst: boolean;
};

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col justify-center items-center space-y-2">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="text-text-muted">Analyzing purchase bill...</span>
    </div>
);

const ScanPurchaseBill: React.FC = () => {
    const { inventory, addInventoryItem, updateInventoryItem, setCurrentPage } = useContext(ShopContext);

    const [imageData, setImageData] = useState<string | null>(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedItems, setExtractedItems] = useState<ExtractedInventoryItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        return () => { // Cleanup on component unmount
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const startCamera = async () => {
        stopCamera(); // Ensure any previous stream is stopped
        setIsCameraOn(true);
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            setError("Could not access the camera. Please ensure you have given permission in your browser settings.");
            console.error("Camera access error:", err);
            setIsCameraOn(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOn(false);
    };

    const captureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                setImageData(dataUrl);
                stopCamera();
            }
        }
    };

    const processImage = async () => {
        if (!imageData) return;
        setIsLoading(true);
        setError(null);
        try {
            const base64Image = imageData.split(',')[1];
            const result = await extractInventoryDataFromImage(base64Image);
            
            if (!inventory) { throw new Error("Inventory not loaded"); }
            const inventoryMap = new Map(inventory.map(i => [i.name.toLowerCase(), i]));

            const processedItems: ExtractedInventoryItem[] = result.items.map((item: any, index: number) => {
                const matchedItem = inventoryMap.get(item.productName.toLowerCase()) || null;
                const costPerUnit = (item.totalCost || 0) / (item.quantity || 1);
                const suggestedPrice = costPerUnit * 1.2; // Suggest 20% markup

                return {
                    id: index,
                    productName: item.productName,
                    quantity: String(item.quantity || 1),
                    costPerUnit: costPerUnit.toFixed(2),
                    inventoryItem: matchedItem,
                    status: matchedItem ? 'matched' : 'unmatched',
                    sellingPrice: matchedItem ? String(matchedItem.price) : suggestedPrice.toFixed(2),
                    hasGst: matchedItem ? (matchedItem.has_gst || false) : false,
                };
            });
            setExtractedItems(processedItems);

        } catch (err) {
            setError(err instanceof Error ? `Failed to analyze bill: ${err.message}` : "An unknown error occurred during analysis.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleItemChange = (id: number, field: keyof ExtractedInventoryItem, value: any) => {
        setExtractedItems(prev =>
            prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    const handleInventoryLink = (itemId: number, inventoryId: string) => {
        const selectedInventoryItem = inventory?.find(i => i.id === inventoryId);
        if (selectedInventoryItem) {
            setExtractedItems(prev =>
                prev.map(item => item.id === itemId ? {
                    ...item,
                    inventoryItem: selectedInventoryItem,
                    productName: selectedInventoryItem.name,
                    status: 'matched'
                } : item)
            );
        }
    };

    const handleMarkAsNew = (id: number) => {
        setExtractedItems(prev =>
            prev.map(item => item.id === id ? {
                ...item,
                inventoryItem: null,
                status: 'new'
            } : item)
        );
    };

    const handleRemoveItem = (id: number) => {
        setExtractedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleSubmitToInventory = async () => {
        setIsSubmitting(true);
        try {
            const updates: Promise<any>[] = [];

            for (const item of extractedItems) {
                const numQuantity = Number(item.quantity);
                const numCost = Number(item.costPerUnit);
                
                if (item.status === 'matched' && item.inventoryItem) {
                    const updatedItem = {
                        ...item.inventoryItem,
                        stock: item.inventoryItem.stock + numQuantity,
                        cost: numCost, // Update cost to the latest purchase price
                    };
                    updates.push(updateInventoryItem(updatedItem));
                } else if (item.status === 'new') {
                    const numSellingPrice = Number(item.sellingPrice);
                    if (isNaN(numSellingPrice) || numSellingPrice <= 0) throw new Error(`Selling price for new item "${item.productName}" must be a positive number.`);
                    
                    const newItem = {
                        name: item.productName,
                        stock: numQuantity,
                        cost: numCost,
                        price: numSellingPrice,
                        has_gst: item.hasGst,
                        is_bundle: false,
                    };
                    updates.push(addInventoryItem(newItem));
                } else {
                    throw new Error(`Item "${item.productName}" is not resolved. Please match it or mark it as new.`);
                }
            }

            await Promise.all(updates);
            alert("Inventory successfully updated!");
            setCurrentPage(Page.Inventory);

        } catch (error) {
            alert(error instanceof Error ? `Submission failed: ${error.message}` : "An unknown error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderContent = () => {
        if (isLoading) return <LoadingSpinner />;
        
        if (extractedItems.length > 0) return renderValidationForm();
        
        if (imageData) {
            return (
                <div className="text-center space-y-4">
                    <h3 className="text-xl font-semibold">Ready to Process</h3>
                    <img src={imageData} alt="Captured bill" className="rounded-lg max-w-full max-h-[50vh] mx-auto shadow-lg" />
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setImageData(null)} className="px-6 py-2 border border-border text-sm font-medium rounded-md text-text-main bg-surface hover:bg-surface-hover">Retake</button>
                        <button onClick={processImage} className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus">Analyze with AI</button>
                    </div>
                </div>
            );
        }

        if (isCameraOn) {
            return (
                <div className="text-center space-y-4">
                    <h3 className="text-xl font-semibold">Position Bill in Frame</h3>
                    <video ref={videoRef} autoPlay playsInline className="w-full max-w-lg mx-auto rounded-lg shadow-lg border border-border"></video>
                    <div className="flex justify-center gap-4">
                        <button onClick={stopCamera} className="px-6 py-2 border border-border text-sm font-medium rounded-md text-text-main bg-surface hover:bg-surface-hover">Cancel</button>
                        <button onClick={captureImage} className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus">Capture</button>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center space-y-4">
                <BillAddIcon />
                <h3 className="text-xl font-semibold">Add Stock from Bill</h3>
                <p className="text-text-muted max-w-md mx-auto">Use your camera to scan a purchase invoice. The AI will extract the items to quickly update your inventory.</p>
                <button onClick={startCamera} className="px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-focus">Start Camera</button>
            </div>
        );
    }
    
    const renderValidationForm = () => {
        const isReadyForSubmit = extractedItems.every(item => item.status === 'matched' || item.status === 'new');
        return (
            <div className="space-y-6 w-full max-w-4xl mx-auto">
                <div>
                    <h3 className="text-2xl font-bold">Validate Scanned Items</h3>
                    <p className="text-text-muted">Review items from the bill. Match them to existing inventory or add them as new products.</p>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                    {extractedItems.map(item => (
                        <div key={item.id} className="bg-surface p-4 rounded-lg border border-border space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                <div className="md:col-span-5"><label className="block text-xs font-medium text-text-muted">Product Name</label><input type="text" value={item.productName} onChange={e => handleItemChange(item.id, 'productName', e.target.value)} className="mt-1 block w-full bg-background border-border rounded-md py-1.5 px-3 text-sm"/></div>
                                <div className="md:col-span-2"><label className="block text-xs font-medium text-text-muted">Quantity</label><input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} className="mt-1 block w-full bg-background border-border rounded-md py-1.5 px-3 text-sm"/></div>
                                <div className="md:col-span-2"><label className="block text-xs font-medium text-text-muted">Cost/Unit</label><input type="number" value={item.costPerUnit} onChange={e => handleItemChange(item.id, 'costPerUnit', e.target.value)} className="mt-1 block w-full bg-background border-border rounded-md py-1.5 px-3 text-sm"/></div>
                                <div className="md:col-span-3 flex items-end h-full"><button onClick={() => handleRemoveItem(item.id)} className="text-danger p-2 rounded-full hover:bg-surface-hover ml-auto"><DeleteIcon /></button></div>
                            </div>
                            
                            <div className={`p-3 rounded-md border ${item.status === 'matched' ? 'bg-success/10 border-success/20' : (item.status === 'new' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-warning/10 border-warning/20')}`}>
                               <p className="text-xs font-semibold mb-2">
                                    {item.status === 'matched' ? '✅ Matched: Will update stock & cost.' : (item.status === 'new' ? '＋ New: Will be added to inventory.' : '⚠️ Action Required: Link to Inventory')}
                               </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                                    <select value={item.inventoryItem?.id || ''} onChange={e => handleInventoryLink(item.id, e.target.value)} className="block w-full bg-background border-border rounded-md py-1.5 px-3 text-sm">
                                        <option value="" disabled>Select from inventory to match...</option>
                                        {inventory?.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                                    </select>
                                    <button onClick={() => handleMarkAsNew(item.id)} className={`px-3 py-1.5 text-xs font-medium rounded-md ${item.status === 'new' ? 'bg-primary text-white' : 'bg-surface-hover text-text-main'}`}>
                                        {item.status === 'new' ? '✓ Marked as New' : 'Mark as New Product'}
                                    </button>
                                </div>
                                {item.status === 'new' && (
                                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                                        <div><label className="block text-xs font-medium text-text-muted">Selling Price</label><input type="number" value={item.sellingPrice} onChange={e => handleItemChange(item.id, 'sellingPrice', e.target.value)} className="mt-1 block w-full bg-background border-border rounded-md py-1.5 px-3 text-sm" placeholder="e.g., 120.00"/></div>
                                        <label className="flex items-center cursor-pointer"><input type="checkbox" checked={item.hasGst} onChange={e => handleItemChange(item.id, 'hasGst', e.target.checked)} className="h-4 w-4 rounded text-primary border-border focus:ring-primary bg-background"/><span className="ml-2 text-sm text-text-main">Includes GST</span></label>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="border-t border-border pt-4 flex justify-end">
                    <button onClick={handleSubmitToInventory} disabled={!isReadyForSubmit || isSubmitting} className="inline-flex justify-center items-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus disabled:bg-surface-hover disabled:cursor-not-allowed">
                        {isSubmitting ? 'Updating...' : 'Add to Inventory'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-text-main">Add Stock from Bill</h2>
            {error && <div className="bg-danger/10 border border-danger text-red-300 p-4 rounded-lg"><p>{error}</p></div>}
            <div className="bg-surface p-6 rounded-lg shadow-lg border border-border min-h-[60vh] flex items-center justify-center">
                <canvas ref={canvasRef} className="hidden"></canvas>
                {renderContent()}
            </div>
        </div>
    );
};

export default ScanPurchaseBill;