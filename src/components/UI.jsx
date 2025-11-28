import React from 'react';
import { X, AlertTriangle, Trash2, Flame, Zap } from 'lucide-react';
import { THEME_COLOR } from '../lib/utils';

export const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh] border border-white/20`}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur-sm shrink-0 rounded-t-3xl">
          <h3 className="text-lg font-bold text-gray-800 tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors rounded-full p-1.5"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 transform transition-all scale-100">
        <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0"><AlertTriangle size={20} /></div>
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed pl-1">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm">取消</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-md shadow-red-200 transition-all text-sm flex items-center gap-2"><Trash2 size={16} /> 確認執行</button>
        </div>
      </div>
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const map = {
    active: ['bg-green-50 text-[#007130]', '進行中'], transferred: ['bg-blue-50 text-blue-600', '轉交給他人'],
    completed: ['bg-gray-100 text-gray-500', '已完成'], unassigned: ['bg-slate-100 text-slate-600', '待分配'],
    pending: ['bg-orange-50 text-orange-600', '待核准'], closed: ['bg-gray-100 text-gray-500', '已結案'],
    approved: ['bg-theme-light text-theme', '已核准'], rejected: ['bg-red-50 text-red-600', '已駁回']
  };
  const [cls, label] = map[status] || map.unassigned;
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm border border-black/5 ${cls} whitespace-nowrap`}>{label}</span>;
};

export const UrgencyBadge = ({ level }) => {
  if (!level || level === 'normal') return null;
  const isVery = level === 'very_urgent';
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm border whitespace-nowrap ${isVery ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
      {isVery ? <Flame size={10} fill="currentColor"/> : <Zap size={10} fill="currentColor"/>}
      {isVery ? '非常緊急' : '緊急'}
    </span>
  );
};

export const MobileRequestCard = ({ title, status, meta, actions, children }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex justify-between items-start">
            <div><h4 className="font-bold text-gray-800 text-lg mb-1">{title}</h4><div className="text-xs text-gray-400 font-mono">{meta}</div></div>
            <StatusBadge status={status} />
        </div>
        <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600 border border-gray-50/50">{children}</div>
        {actions && <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 mt-1">{actions}</div>}
    </div>
);
