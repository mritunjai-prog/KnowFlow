import { useState } from 'react';
import { motion } from 'framer-motion';
import { Network, ArrowLeft, LayoutGrid, Share2, Sparkles, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ShaderBackground } from '../components/3d/ShaderBackground';
import { NetworkGraph } from '../components/3d/NetworkGraph';
import { PixelCard } from '../components/ui/PixelCard';

export function Login() {
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => navigate('/dashboard'), 800);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => navigate('/onboarding'), 800);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 md:p-8 overflow-hidden perspective-1000">
      <ShaderBackground />
      <NetworkGraph />
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10 relative">
        {/* Left Side: Recent Activity */}
        <div className="hidden lg:flex flex-col gap-6 order-2 lg:order-1">
          <motion.div 
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, type: 'spring' }}
            className="bg-[#fbe9d0]/30 backdrop-blur-md border border-[#90aead]/40 p-6 rounded-xl flex items-center gap-4 shadow-[0_8px_32px_rgba(8,50,62,0.1)]"
          >
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <p className="font-mono text-sm text-primary font-bold">Project Alpha categorized</p>
              <p className="text-xs text-on-surface-variant mt-1">2 mins ago • AI Pipeline</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, type: 'spring' }}
            className="bg-[#fbe9d0]/30 backdrop-blur-md border border-[#90aead]/40 p-6 rounded-xl flex items-center gap-4 shadow-[0_8px_32px_rgba(8,50,62,0.1)] translate-x-8"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-mono text-sm text-primary font-bold">3 new connections mapped</p>
              <p className="text-xs text-on-surface-variant mt-1">15 mins ago • Knowledge Graph</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, type: 'spring' }}
            className="bg-[#fbe9d0]/30 backdrop-blur-md border border-[#90aead]/40 p-6 rounded-xl flex items-center gap-4 shadow-[0_8px_32px_rgba(8,50,62,0.1)]"
          >
            <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-mono text-sm text-primary font-bold">Daily digest ready</p>
              <p className="text-xs text-on-surface-variant mt-1">1 hour ago • Intelligence Layer</p>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Main Login Card */}
        <div className="flex justify-center lg:justify-end order-1 lg:order-2 perspective-1000">
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0, rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            className="relative w-full max-w-md h-[700px]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* FRONT FACE - LOGIN */}
            <div className="absolute inset-0 backface-hidden" style={{ backfaceVisibility: 'hidden' }}>
              <PixelCard className="w-full h-full rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] p-8 opacity-5 pointer-events-none">
                  <Network className="w-48 h-48 text-primary" />
                </div>
                <div className="relative z-10 h-full flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-10">
                    <Network className="text-primary w-8 h-8" />
                    <span className="text-2xl font-bold text-primary font-heading">KnowFlow</span>
                  </div>
                  
                  <h2 className="text-4xl font-bold text-primary mb-2 font-heading tracking-tight">Welcome back</h2>
                  <p className="text-sm text-on-surface-variant mb-8">Access your intelligence engine.</p>
                  
                  <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                      <label className="block text-xs font-mono font-medium text-primary mb-2">EMAIL ADDRESS</label>
                      <input 
                        className="w-full bg-white/50 border border-outline/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all" 
                        placeholder="name@company.com" 
                        type="email" 
                        defaultValue="knowledge@worker.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono font-medium text-primary mb-2">PASSWORD</label>
                      <input 
                        className="w-full bg-white/50 border border-outline/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all" 
                        placeholder="••••••••" 
                        type="password" 
                        defaultValue="password123"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input className="rounded border-outline/30 text-secondary focus:ring-secondary/20 h-4 w-4" type="checkbox"/>
                        <span className="text-xs text-on-surface-variant">Remember me</span>
                      </label>
                      <a className="text-xs text-secondary hover:underline" href="#">Forgot password?</a>
                    </div>
                    <button className="w-full bg-secondary hover:bg-secondary/90 text-white font-mono text-sm font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] mt-4" type="submit">
                        Sign In to KnowFlow
                    </button>
                  </form>
                  
                  <div className="mt-8 flex items-center gap-4">
                    <div className="h-px flex-1 bg-outline/20"></div>
                    <span className="text-xs text-on-surface-variant/60 font-mono">OR CONTINUE WITH</span>
                    <div className="h-px flex-1 bg-outline/20"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button className="flex items-center justify-center gap-2 py-3 rounded-xl border border-outline/30 bg-white/30 hover:bg-white/50 transition-colors">
                      <img alt="Google" className="w-4 h-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMD3id9SNvRT1NoSOZk2ESMJZo5epYKaEZ4g1fLIwSncMRnPFt0QjkieRmTEJTgZ6c8M_deHMHyEPRA4kqGUyy5XifszAM_2u2bz_CrOxzve3HJQVJ5ub1iBmU3PcipXs2xNQYu_zitmRKejceOglkf1gkwlnueQWKRhnwCeQ2eUz4C-t1bdBEMg6CDUHlCZ_wT3Mh17Pm6ram0eEBfLlV7Gw9aUGxc4dSbhT98kxvz7w2564pb1-ER3IpCkMSZieS_kuG3GCh3E-W"/>
                      <span className="text-xs font-bold text-primary">Google</span>
                    </button>
                    <button className="flex items-center justify-center gap-2 py-3 rounded-xl border border-outline/30 bg-white/30 hover:bg-white/50 transition-colors">
                      <Terminal className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-primary">SSO</span>
                    </button>
                  </div>
                  <p className="text-center mt-8 text-xs text-on-surface-variant">
                    Don't have an account?{' '}
                    <button onClick={() => setIsFlipped(true)} className="text-secondary font-bold hover:underline" type="button">
                      Request access
                    </button>
                  </p>
                </div>
              </PixelCard>
            </div>

            {/* BACK FACE - REGISTER */}
            <div className="absolute inset-0 backface-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <PixelCard className="w-full h-full rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
                <button onClick={() => setIsFlipped(false)} className="absolute top-6 left-6 p-2 rounded-full hover:bg-deep-slate/5 transition-colors text-primary z-20">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="relative z-10 h-full flex flex-col justify-center">
                  <h2 className="text-4xl font-bold text-primary mb-2 font-heading tracking-tight mt-8">Create Account</h2>
                  <p className="text-sm text-on-surface-variant mb-8">Start organizing your knowledge.</p>
                  
                  <form className="space-y-6" onSubmit={handleRegister}>
                    <div>
                      <label className="block text-xs font-mono font-medium text-primary mb-2">FULL NAME</label>
                      <input 
                        className="w-full bg-white/50 border border-outline/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all" 
                        placeholder="Jane Doe" 
                        type="text" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono font-medium text-primary mb-2">EMAIL ADDRESS</label>
                      <input 
                        className="w-full bg-white/50 border border-outline/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all" 
                        placeholder="name@company.com" 
                        type="email" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono font-medium text-primary mb-2">PASSWORD</label>
                      <input 
                        className="w-full bg-white/50 border border-outline/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all" 
                        placeholder="Create a password" 
                        type="password" 
                      />
                    </div>
                    <button className="w-full bg-secondary hover:bg-secondary/90 text-white font-mono text-sm font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] mt-4" type="submit">
                        Request Access
                    </button>
                  </form>
                </div>
              </PixelCard>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
