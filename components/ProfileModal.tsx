import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { useAuth } from '../AuthContext';
import { supabase } from '../services/supabaseClient';

const ProfileModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { user, updateUserMetadata } = useAuth();
    const [shopName, setShopName] = useState('');
    const [phone, setPhone] = useState('');
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        if (user) {
            setShopName(user.shop_name || 'Electricals');
            setPhone(user.phone || '');
            setSignaturePreview(user.signature_url || null);
        }
    }, [user, isOpen]);

    useEffect(() => {
        if (signatureFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSignaturePreview(reader.result as string);
            };
            reader.readAsDataURL(signatureFile);
        }
    }, [signatureFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
             if (file.size > 1 * 1024 * 1024) { // 1MB limit
                setError('File is too large. Please upload an image under 1MB.');
                return;
            }
            if (!file.type.startsWith('image/')) {
                setError('Invalid file type. Please upload an image file (e.g., PNG, JPG, GIF).');
                return;
            }
            setError(null);
            setSignatureFile(file);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        setError(null);

        try {
            let signatureUrl = user.signature_url;

            if (signatureFile) {
                // Upload new signature to Supabase Storage
                const filePath = `${user.id}/signature_${Date.now()}`;
                const { error: uploadError } = await supabase.storage
                    .from('signatures')
                    .upload(filePath, signatureFile, {
                        cacheControl: '3600',
                        upsert: true,
                    });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data } = supabase.storage
                    .from('signatures')
                    .getPublicUrl(filePath);
                
                if (!data.publicUrl) throw new Error("Could not get public URL for signature.");
                signatureUrl = data.publicUrl;
            }

            // Update user metadata in Supabase Auth
            await updateUserMetadata({
                shop_name: shopName,
                phone: phone,
                signature_url: signatureUrl,
            });

            onClose();

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            if (errorMessage.includes("Bucket not found")) {
                 setError("Storage bucket 'signatures' not found. Please ensure it has been created in your Supabase project.");
            } else {
                setError(`Failed to save profile: ${errorMessage}`);
            }
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
            <div className="space-y-6">
                {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
                <div>
                    <label htmlFor="shopName" className="block text-sm font-medium text-text-muted">Shop Name</label>
                    <input
                        type="text"
                        id="shopName"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="Your shop's name"
                        className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm"
                    />
                </div>
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-text-muted">Business Phone Number</label>
                    <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter phone number for invoices"
                        className="mt-1 block w-full bg-background border border-border rounded-md shadow-sm py-2 px-3 sm:text-sm"
                    />
                </div>
                <div>
                     <label className="block text-sm font-medium text-text-muted">Digital Signature</label>
                     <p className="text-xs text-text-muted mb-2">Upload an image of your signature (max 1MB). This will appear on generated invoices.</p>
                     <div className="mt-2 flex items-center justify-center p-4 border-2 border-dashed border-border rounded-md bg-background/50">
                        {signaturePreview ? (
                            <img src={signaturePreview} alt="Signature preview" className="max-h-24" />
                        ) : (
                            <p className="text-sm text-text-muted">No signature uploaded</p>
                        )}
                    </div>
                     <input
                        type="file"
                        id="signature-upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <label
                        htmlFor="signature-upload"
                        className="cursor-pointer mt-2 inline-block w-full text-center py-2 px-4 border border-border text-sm font-medium rounded-md text-text-main bg-surface hover:bg-surface-hover"
                    >
                        {signatureFile ? 'Change Signature' : 'Upload Signature'}
                    </label>
                </div>
                 <div className="flex justify-end pt-4 border-t border-border">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex justify-center items-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus disabled:bg-surface-hover disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ProfileModal;