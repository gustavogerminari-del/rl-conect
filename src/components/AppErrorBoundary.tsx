import React from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';

type State = { hasError: boolean; message: string };
type Props = { children?: React.ReactNode };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Erro inesperado ao carregar esta tela.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RL Connect UI error:', error, info);
  }

  private clearLegacyData = () => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('rl_connect_v2_'))
      .forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900">Esta tela encontrou um erro, mas o sistema continua protegido.</h1>
              <p className="mt-1 text-sm text-slate-600">{this.state.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                Em vez de deixar a página totalmente branca, o RL Connect mostra esta recuperação segura. Se o erro vier de dados antigos do navegador, limpe somente os dados locais do RL Connect.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">
              <RefreshCcw className="h-4 w-4" /> Recarregar
            </button>
            <button onClick={this.clearLegacyData} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">
              <Trash2 className="h-4 w-4" /> Limpar dados locais incompatíveis
            </button>
          </div>
        </div>
      </div>
    );
  }
}
