import React from 'react';
import type { BackupRecord } from '../types/master';

export function MasterBackupModal({ open = false, backups = [], onClose }: { open?: boolean; backups?: BackupRecord[]; onClose?: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white"><div className="flex justify-between gap-3"><h2 className="font-black">Backups</h2><button type="button" onClick={onClose} className="text-slate-400">Fechar</button></div><div className="mt-4 space-y-2">{backups.length ? backups.map((item) => <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"><b>{item.tenantName}</b><p className="mt-1 text-slate-400">{item.status} • {item.createdAt}</p></div>) : <p className="text-sm text-slate-400">Nenhum backup registrado.</p>}</div></div></div>;
}
