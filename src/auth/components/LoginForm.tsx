import React, { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { ArrowLeft, ArrowRight, Globe, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../../shared';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface LoginFormProps {
  onBackToJobs?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onBackToJobs }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [invalidCredential, setInvalidCredential] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    setInvalidCredential(false);
    setIsLoading(true);
    try {
      const authenticated = await login(email, password);
      if (!authenticated) setErrorMsg('E-mail ou senha inválidos. Verifique os dados e tente novamente.');
    } catch (error) {
      const authCode = error instanceof FirebaseError && error.code.startsWith('auth/')
        ? error.code
        : 'auth/unknown';
      if (authCode === 'auth/invalid-credential' || authCode === 'auth/user-not-found' || authCode === 'auth/wrong-password') {
        setInvalidCredential(true);
        setErrorMsg('E-mail ou senha incorretos. Para recuperar o acesso MASTER, redefina a senha pelo e-mail cadastrado.');
      } else {
        const profileMessage = error instanceof Error ? error.message : '';
        setErrorMsg(
          authCode === 'auth/unknown' && profileMessage
            ? profileMessage
            : `Não foi possível entrar agora (${authCode}). Tente novamente.`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 bg-white rounded-2xl border border-[#D5DEE8] shadow-lg overflow-hidden">
        <div className="md:col-span-5 bg-gradient-to-br from-[#123657] to-[#082747] text-white p-6 sm:p-8 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl border border-white/20 tracking-wider">RL</div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">RL Connect</h2>
              <p className="text-sm text-white/90 mt-1 font-medium">R Lourenço Recrutamento e Seleção</p>
            </div>
          </div>
          <div className="space-y-3 bg-[#082747]/80 p-4 rounded-xl border border-white/15 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="w-4 h-4 text-[#20D9A0]" />
              <span>Acesso seguro</span>
            </div>
            <p className="text-[11px] text-white/80 leading-relaxed">Sua sessão e suas permissões são verificadas diretamente pelo Firebase.</p>
          </div>
          <p className="text-[11px] text-white/70">© 2026 RL Connect. Todos os direitos reservados.</p>
        </div>

        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-6 bg-white">
          <div className="space-y-2">
            {onBackToJobs && (
              <button type="button" onClick={onBackToJobs} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#123657] hover:text-[#082747] bg-[#EAF2F8] px-3 py-1.5 rounded-lg mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /><Globe className="w-3.5 h-3.5" /> Voltar ao Site de Vagas
              </button>
            )}
            <h3 className="text-xl font-extrabold text-[#0F172A]">Acessar sua conta</h3>
            <p className="text-xs text-[#475569]">Digite o e-mail e a senha cadastrados pelo administrador.</p>
          </div>

          {errorMsg && <div role="alert" className="p-3 bg-[#FFF1F2] border border-[#FCA5A5] text-[#DC2626] text-xs rounded-xl font-semibold space-y-2"><p>{errorMsg}</p>{invalidCredential && <button type="button" onClick={() => setIsForgotOpen(true)} className="underline underline-offset-2 font-extrabold">Redefinir senha do acesso MASTER</button>}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input type="email" label="E-mail de Acesso" placeholder="seuemail@empresa.com.br" value={email} onChange={event => setEmail(event.target.value)} leftIcon={<Mail className="w-4 h-4 text-[#475569]" />} required />
            <Input type="password" label="Senha de Acesso" placeholder="••••••••" value={password} onChange={event => setPassword(event.target.value)} leftIcon={<Lock className="w-4 h-4 text-[#475569]" />} required />
            <div className="flex justify-end">
              <button type="button" onClick={() => setIsForgotOpen(true)} className="text-xs font-bold text-[#123657] hover:text-[#082747]">Esqueceu a senha?</button>
            </div>
            <Button type="submit" variant="primary" className="w-full bg-[#123657] hover:bg-[#082747]" isLoading={isLoading} rightIcon={<ArrowRight className="w-4 h-4" />}>Entrar no Sistema</Button>
          </form>

          <div className="pt-3 border-t border-[#D5DEE8] text-center">
            <p className="text-[11px] text-[#475569] font-medium">Acesso seguro via Firebase Authentication</p>
          </div>
        </div>
      </div>
      <ForgotPasswordModal isOpen={isForgotOpen} initialEmail={email} onClose={() => setIsForgotOpen(false)} />
    </div>
  );
};
