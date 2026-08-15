import React from 'react';

interface Props {
  section: string;
  onGoHome: () => void;
  children: React.ReactNode;
}

interface State { hasError: boolean; message: string }

export class MasterSectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Falha ao renderizar a seção.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RL_CONNECT_MASTER_SECTION_RENDER_FAILED', { section: this.props.section, error, info });
  }

  componentDidUpdate(previous: Props) {
    if (previous.section !== this.props.section && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-100"><h3 className="font-black">Esta área não pôde ser exibida.</h3><p className="mt-2 text-sm text-rose-200/80">{this.state.message}</p><button type="button" onClick={this.props.onGoHome} className="mt-4 rounded-xl bg-rose-500 px-4 py-2 text-sm font-black text-white">Voltar à Visão Geral</button></div>;
  }
}
