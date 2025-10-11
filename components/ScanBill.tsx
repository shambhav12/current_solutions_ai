import React, { useState, useRef, useEffect, useContext } from 'react';
import { ShopContext } from '../App';
import { Page, InventoryItem, CartItemForTransaction } from '../types';
import { extractSaleDataFromImage } from '../services/geminiService';
import { CameraIcon, PlusIcon, DeleteIcon, EditIcon } from './Icons';

type ExtractedItem = {
    id: number;
    productName: string;
    quantity: number;
    totalPrice: number;
    inventoryItem: InventoryItem | null;
    status: 'matched' | 'new' | 'unmatched';
};

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col justify-center items-center space-y-2">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="text-text-muted">Analyzing bill... this may take a moment.</span>
    </div>
);

const ScanBill: React.FC = () => {
    const { inventory, addTransaction, addInventoryItem, setCurrentPage } = useContext(ShopContext);

    const [imageData, setImageData] = useState<string | null>(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'Online' | 'Offline' | 'On Credit'>('Offline');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraOn(true);
            setError(null);
        } catch (err) {
            setError("Could not access the camera. Please ensure you have given permission in your browser settings.");
            console.error("Camera access error:", err);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
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
            const result = await extractSaleDataFromImage(base64Image);

            if (!inventory) { throw new Error("Inventory not loaded"); }
            const inventoryMap = new Map(inventory.map(i => [i.name.toLowerCase(), i]));

            const processedItems = result.items.map((item: any, index: number) => {
                const matchedItem = inventoryMap.get(item.productName.toLowerCase()) || null;
                return {
                    id: index,
                    productName: item.productName,
                    quantity: item.quantity,
                    totalPrice: item.totalPrice,
                    inventoryItem: matchedItem,
                    status: matchedItem ? 'matched' : 'new',
                };
            });
            setExtractedItems(processedItems);

            const payment = result.paymentMethod?.toLowerCase();
            if (payment?.includes('online')) setPaymentMethod('Online');
            else if (payment?.includes('credit')) setPaymentMethod('On Credit');
            else setPaymentMethod('Offline');

        } catch (err) {
            setError(err instanceof Error ? `Failed to analyze bill: ${err.message}` : "An unknown error occurred during analysis.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleItemChange = (id: number, field: keyof ExtractedItem, value: any) => {
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
    }
    
    const handleRemoveItem = (id: number) => {
        setExtractedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleSubmitSale = async () => {
        if (extractedItems.length === 0) {
            alert("Cannot submit an empty sale.");
            return;
        }
        setIsSubmitting(true);
        try {
            const transactionItems: CartItemForTransaction[] = [];

            for (const item of extractedItems) {
                let inventoryItemId = item.inventoryItem?.id;
                let finalProductName = item.inventoryItem?.name || item.productName;

                if (item.status === 'new' && !item.inventoryItem) {
                    // This is a new item that needs to be created in inventory first
                    const newInventoryItem = await addInventoryItem({
                        name: item.productName,
                        stock: item.quantity,
                        price: item.totalPrice / item.quantity,
                        cost: 0, // Default cost to 0, user can edit later
                        has_gst: false,
                        is_bundle: false,
                    });
                    if (!newInventoryItem) throw new Error(`Failed to create new item: ${item.productName}`);
                    inventoryItemId = newInventoryItem.id;
                    finalProductName = newInventoryItem.name;
                }

                if (!inventoryItemId) {
                    throw new Error(`Item "${item.productName}" is not linked to any inventory. Please match it or mark it as new.`);
                }
                
                const inventoryItem = inventory?.find(i => i.id === inventoryItemId);

                transactionItems.push({
                    inventoryItemId: inventoryItemId,
                    productName: finalProductName,
                    quantity: Number(item.quantity),
                    totalPrice: Number(item.totalPrice),
                    sale_type: 'loose', // Scanned items are always loose
                    items_per_bundle: inventoryItem?.items_per_bundle || 1,
                });
            }
            
            await addTransaction(transactionItems, paymentMethod);
            alert("Sale successfully recorded!");
            setCurrentPage(Page.Sales);

        } catch (error) {
            alert(error instanceof Error ? `Submission failed: ${error.message}` : "An unknown error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderContent = () => {
        if (isLoading) {
            return <LoadingSpinner />;
        }
        if (extractedItems.length > 0) {
            return renderValidationForm();
        }
        if (imageData) {
            return (
                <div className="text-center space-y-4">
                    <h3 className="text-xl font-semibold">Ready to Process</h3>
                    <img src={imageData} alt="Captured bill" className="rounded-lg max-w-full max-h-[50vh] mx-auto shadow-lg" />
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setImageData(null)} className="px-6 py-2 border border-border text-sm font-medium rounded-md text-text-main bg-surface hover:bg-surface-hover">
                            Retake
                        </button>
                        <button onClick={processImage} className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus">
                            Analyze with AI
                        </button>
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
                        <button onClick={stopCamera} className="px-6 py-2 border border-border text-sm font-medium rounded-md text-text-main bg-surface hover:bg-surface-hover">
                            Cancel
                        </button>
                        <button onClick={captureImage} className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus">
                            Capture
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center space-y-4">
                <CameraIcon />
                <h3 className="text-xl font-semibold">Scan a Bill</h3>
                <p className="text-text-muted max-w-md mx-auto">Use your device's camera to capture a handwritten or printed bill. The AI will extract the items to save you time.</p>
                <button onClick={startCamera} className="px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-focus">
                    Start Camera
                </button>
            </div>
        );
    }
    
    const renderValidationForm = () => {
        const isReadyForSubmit = extractedItems.every(item => item.status === 'matched' || item.status === 'new');
        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-bold">Validate Scanned Data</h3>
                    <p className="text-text-muted">Review the items extracted by the AI. Correct any errors and link products to your inventory before submitting.</p>
                </div>

                <div className="space-y-3">
                    {extractedItems.map((item, index) => (
                        <div key={item.id} className="bg-surface p-4 rounded-lg border border-border space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                {/* Name */}
                                <div className="md:col-span-5">
                                    <label className="block text-xs font-medium text-text-muted">Product Name</label>
                                    <input type="text" value={item.productName} onChange={e => handleItemChange(item.id, 'productName', e.target.value)} className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-1.5 px-3 text-sm" />
                                </div>
                                {/* Qty */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-text-muted">Quantity</label>
                                    <input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-1.5 px-3 text-sm" />
                                </div>
                                {/* Price */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-text-muted">Total Price</label>
                                    <input type="number" value={item.totalPrice} onChange={e => handleItemChange(item.id, 'totalPrice', e.target.value)} className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-1.5 px-3 text-sm" />
                                </div>
                                {/* Actions */}
                                <div className="md:col-span-3 flex items-end h-full">
                                    <button onClick={() => handleRemoveItem(item.id)} className="text-danger p-2 rounded-full hover:bg-surface-hover ml-auto">
                                        <DeleteIcon />
                                    </button>
                                </div>
                            </div>
                             {/* Inventory Linking */}
                            <div className={`p-3 rounded-md border ${item.status === 'matched' ? 'bg-success/10 border-success/20' : 'bg-warning/10 border-warning/20'}`}>
                               <p className="text-xs font-semibold mb-2">
                                    {item.status === 'matched' ? '✅ Matched to Inventory' : '⚠️ Action Required: Link to Inventory'}
                               </p>
                                <div className="flex items-center gap-2">
                                    <select 
                                        value={item.inventoryItem?.id || ''}
                                        onChange={e => handleInventoryLink(item.id, e.target.value)}
                                        className="block w-full bg-background border border-border rounded-md shadow-sm py-1.5 px-3 text-sm"
                                    >
                                        <option value="" disabled>{item.status === 'matched' ? 'Change item...' : 'Select from inventory...'}</option>
                                        {inventory?.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                                    </select>
                                    <button onClick={() => handleMarkAsNew(item.id)} className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${item.status === 'new' ? 'bg-primary text-white' : 'bg-surface-hover text-text-main'}`}>
                                        {item.status === 'new' ? '✓ New Item' : 'Mark as New'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="border-t border-border pt-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted">Payment Method</label>
                        <div className="mt-2 flex items-center gap-4">
                            {(['Offline', 'Online', 'On Credit'] as const).map(method => (
                                <label key={method} className="flex items-center cursor-pointer">
                                    <input type="radio" name="paymentMethod" value={method} checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} className="h-4 w-4 text-primary border-border focus:ring-primary bg-background" />
                                    <span className="ml-2 text-sm text-text-main">{method}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end">
                         <button onClick={handleSubmitSale} disabled={!isReadyForSubmit || isSubmitting} className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus disabled:bg-surface-hover disabled:cursor-not-allowed">
                           {isSubmitting ? 'Submitting...' : (isReadyForSubmit ? 'Submit Sale' : 'Resolve all items to submit')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-text-main">Scan Bill</h2>
            {error && (
                <div className="bg-danger/10 border border-danger text-red-300 p-4 rounded-lg">
                    <p>{error}</p>
                </div>
            )}
            <div className="bg-surface p-6 rounded-lg shadow-lg border border-border min-h-[60vh] flex items-center justify-center">
                <canvas ref={canvasRef} className="hidden"></canvas>
                {renderContent()}
            </div>
        </div>
    );
};

export default ScanBill;
