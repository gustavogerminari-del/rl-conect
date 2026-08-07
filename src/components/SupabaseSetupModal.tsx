import React, { useState } from 'react';
import {
  X,
  Database,
  ShieldCheck,
  Copy,
  Check,
  Terminal,
  Server,
  Layers,
  Key,
} from 'lucide-react';
import { generateSupabaseSQLSchema, isSupabaseConfigured } from '../lib/supabase';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'sql' | 'env' | 'rls'>('sql');
  const sqlSchema = generateSupabaseSQLSchema();

  if (!isOpen) return null;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950">
              <Database className="h-5 w-5 font-bold" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Supabase PostgreSQL & RLS - Setup de Produção</h2>
              <p className="text-xs text-slate-400">
                Arquitetura Multiempresa com Isolamento Nível de Linha (Row Level Security)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Status da Conexão Direta:</span>
            {isSupabaseConfigured ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                <Check className="h-3 w-3 text-emerald-600" />
                VITE_SUPABASE_URL Configurado
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
                <Server className="h-3 w-3 text-amber-600" />
                Banco Local Persistido (Pronto para Supabase)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('sql')}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                activeTab === 'sql'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              SQL DDL
            </button>
            <button
              onClick={() => setActiveTab('rls')}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                activeTab === 'rls'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Políticas RLS
            </button>
            <button
              onClick={() => setActiveTab('env')}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                activeTab === 'env'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Variáveis .env
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-indigo-50 p-4 border border-indigo-100">
                <div>
                  <h3 className="font-bold text-indigo-950 text-sm">
                    Execução de Script no Supabase SQL Editor
                  </h3>
                  <p className="mt-0.5 text-xs text-indigo-800">
                    Copie o script DDL abaixo e cole diretamente no <strong>SQL Editor</strong> do seu projeto Supabase para criar todas as tabelas normalizadas com suporte a multi-tenancy e RLS.
                  </p>
                </div>
                <button
                  onClick={handleCopySQL}
                  className="flex items-center gap-2 shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 shadow-md"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar SQL Completo
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-emerald-400 font-mono overflow-x-auto max-h-96">
                <pre>{sqlSchema}</pre>
              </div>
            </div>
          )}

          {activeTab === 'rls' && (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Isolamento Seguro Multi-Tenant via RLS
                </h3>
                <p className="mt-1 text-emerald-900 leading-relaxed">
                  O sistema impõe estritamente a política de que NENHUMA empresa possa consultar ou alterar dados de outra empresa. Toda tabela possui o campo <code>empresa_id</code> e a verificação é realizada nativamente no PostgreSQL via Supabase JWT metadata.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Key className="h-4 w-4 text-indigo-600" />
                    1. Administrador Master
                  </div>
                  <p className="mt-1 text-slate-600">Acesso total e irrestrito a todas as empresas, com capacidade de gerenciar assinaturas, logs e planos.</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    2. Administrador de Empresa
                  </div>
                  <p className="mt-1 text-slate-600">Visualiza exclusivamente os registros pertencentes à sua <code>empresa_id</code> em todas as tabelas.</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-indigo-600" />
                    3. Recrutador & Headhunter
                  </div>
                  <p className="mt-1 text-slate-600">Gerenciam vagas e pipeline de candidatos dentro de sua empresa autorizada.</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-indigo-600" />
                    4. Portal Público de Candidatos
                  </div>
                  <p className="mt-1 text-slate-600">Permite leitura pública exclusiva de vagas com status <code>publicada = true</code>.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Para conectar sua própria instância de produção do Supabase a este aplicativo, configure as seguintes variáveis no painel <strong>Secrets</strong> ou no arquivo <code>.env</code>:
              </p>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-cyan-300">
                <p># Supabase Project Credentials</p>
                <p className="mt-2 text-emerald-400">VITE_SUPABASE_URL="https://sua-instancia.supabase.co"</p>
                <p className="text-emerald-400">VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."</p>
                <p className="mt-4"># Gemini AI API Key (Injetada automaticamente no Cloud Run)</p>
                <p className="text-amber-400">GEMINI_API_KEY="AIzaSy..."</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
