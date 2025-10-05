
import React, { useState } from 'react';
import Modal from './Modal';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
    const [key, setKey] = useState('');

    const handleSave = () => {
        if (key.trim()) {
            onSave(key.trim());
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Set Your Gemini API Key">
            <div className="space-y-4">
                <p className="text-sm text-dark-text-muted">
                    To use the AI-powered features, please enter your Google Gemini API key. Your key will be stored securely in your browser's local storage and will not be shared.
                </p>
                <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-dark-text-muted">API Key</label>
                    <input
                        type="password"
                        id="apiKey"
                        value={key}
                        onChange={e => setKey(e.target.value)}
                        placeholder="Enter your API key"
                        className="mt-1 block w-full bg-dark-bg border border-dark-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                    />
                     <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-primary hover:underline mt-1 inline-block">
                        Get your API key from Google AI Studio
                    </a>
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
                    >
                        Save Key
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ApiKeyModal;
