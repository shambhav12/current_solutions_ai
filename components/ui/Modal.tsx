
import React, { ReactNode } from 'react';
import { CloseIcon } from '../Icons';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300" onClick={onClose}>
            <div
                className="bg-surface rounded-xl shadow-2xl w-full max-w-md m-4 p-6 transform transition-all duration-300 ease-out"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center pb-4 border-b border-border">
                    <h3 className="text-xl font-semibold text-text-main">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                        <CloseIcon />
                    </button>
                </div>
                <div className="mt-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;