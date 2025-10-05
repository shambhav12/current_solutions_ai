import React, { ReactNode } from 'react';
import Modal from './Modal';
import { WarningIcon } from '../Icons';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-danger/10">
                    <WarningIcon />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                    <div className="mt-2">
                        <p className="text-sm text-text-muted leading-6">
                            {children}
                        </p>
                    </div>
                </div>
            </div>
            <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-3">
                <button
                    type="button"
                    className="inline-flex justify-center w-full rounded-md border border-border px-4 py-2 bg-surface text-base font-medium text-text-main hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-slate-500 sm:text-sm transition-colors"
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 bg-danger text-base font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-danger sm:text-sm transition-colors"
                    onClick={handleConfirm}
                >
                    Confirm Delete
                </button>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;