import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, PlusCircle, Package, FileText, Globe, 
  Sparkles, TrendingUp, User, Paperclip, 
  LayoutGrid, Mic, Terminal, Send 
} from 'lucide-react';
import { cn } from '../components/ui/Button';

export function Assistant() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: (
        <>
          I've analyzed the <span className="font-bold">Q3 Intelligence Briefing</span>. Based on current trajectories, we're seeing a significant 12% shift in market sentiment within the energy sector <sup className="inline-flex items-center justify-center w-4 h-4 bg-secondary text-white rounded-full text-[9px] font-bold cursor-pointer hover:bg-primary transition-colors ml-1 -top-2">1</sup>.
        </>
      ),
      hasProjection: true
    },
    {
      id: 2,
      role: 'user',
      content: "Compare this shift with the historical data from 2019. Does it follow the same cyclical pattern we identified earlier?"
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: input }]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: 'Request received. Syncing historical parameters with active context model...'
      }]);
    }, 1500);
  };
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 w-full grid grid-cols-12 gap-6 h-[calc(100vh-6rem)] overflow-hidden">
      {/* Left Sidebar: Active Context & Recent Sources */}
      <aside className="hidden lg:flex col-span-4 xl:col-span-3 flex-col gap-6 h-full overflow-hidden">
        {/* Active Context Card */}
        <div className="bg-glass-fill backdrop-blur-md rounded-2xl p-6 flex flex-col gap-4 border border-outline/30 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold text-primary">Active Context</h3>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-white/40 rounded-xl border border-outline/10 hover:border-primary/30 transition-all cursor-pointer group">
              <p className="text-sm font-medium text-primary">Q3 Strategic Intelligence Report</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Updated 2h ago • 48 citations</p>
            </div>
            <div className="p-3 bg-white/40 rounded-xl border border-outline/10 hover:border-primary/30 transition-all cursor-pointer group">
              <p className="text-sm font-medium text-primary">Market Dynamics: Semiconductor</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Pinned Context • AI Analyzed</p>
            </div>
          </div>
          <button className="mt-2 text-xs font-mono text-secondary flex items-center gap-1.5 hover:underline w-fit">
            <PlusCircle className="w-3.5 h-3.5" /> Add new context
          </button>
        </div>

        {/* Recent Sources Bento */}
        <div className="bg-glass-fill backdrop-blur-md rounded-2xl p-6 flex-1 border border-outline/30 overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-heading text-lg font-semibold text-primary">Recent Sources</h3>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant bg-white/50 px-2 py-0.5 rounded-full">12 Total</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            <div className="flex items-center gap-3 p-2.5 hover:bg-primary/5 rounded-xl transition-colors group cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium text-on-surface">Annual_Review_2023.pdf</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">PDF</span>
                  <span className="text-[10px] text-secondary">Verified</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 hover:bg-primary/5 rounded-xl transition-colors group cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium text-on-surface">FinancialTimes_Article_XJ2</p>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mt-0.5 block">Web Link</span>
              </div>
            </div>

            {/* Source Placeholder with image */}
            <div className="mt-4 relative rounded-xl overflow-hidden h-32 group cursor-pointer border border-outline/20">
              <div 
                className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA5uzhj70IQnp-BKTE-tqQrVhDTIjv5_OOZmCieRQIMQk6hNhsZfQSvfkwe4Vn6srRcxcXQZUO9npbCA_VFgEpfCMwx1G4P-L-zLWZaIqqSF_zB1aFPdgdsNOSZ326VnKg8nPZRX-z08NvrwrzcX87kpm9wY_pxr4oYZH5-0MPZveGFMWqr7gDOtYoNlTiJTJm8cZIoTQs1TK9sXrdHTcQr7ZPLeVUgH-kJTprqlwAHRf2YaVlO6_Nk06n7wbHm9BtF1SkCupBrqAYv')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent flex items-end p-4">
                <p className="text-white text-xs font-mono tracking-wide">Browse Knowledge Base</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Center: Chat Interface */}
      <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col h-full gap-4 relative">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-4 pb-4 custom-scrollbar">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, type: 'spring', stiffness: 400, damping: 30 }}
                className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}
              >
                {msg.role === 'assistant' ? (
                  <div className="w-10 h-10 rounded-full bg-primary flex-shrink-0 flex items-center justify-center shadow-lg shadow-primary/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center shadow-lg shadow-secondary/20">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}

                <div className={cn("flex-1 space-y-4", msg.role === 'user' ? "max-w-[80%] flex justify-end" : "max-w-[85%]")}>
                  {msg.role === 'assistant' ? (
                    <>
                      <div className="bg-glass-fill backdrop-blur-md p-6 rounded-2xl rounded-tl-none border border-outline/20 shadow-sm">
                        <p className="text-[15px] sm:text-base text-on-surface leading-relaxed">
                          {msg.content}
                        </p>
                        
                        {msg.hasProjection && (
                          <div className="mt-6 p-5 bg-primary-container rounded-xl border border-outline/20 overflow-hidden relative">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-mono text-xs font-semibold tracking-wider text-on-primary-container">DATA PROJECTION</h4>
                              <TrendingUp className="w-4 h-4 text-on-primary-container" />
                            </div>
                            <div className="flex items-end gap-2 h-20">
                              {[40, 60, 45, 85, 100].map((h, i) => (
                                <motion.div 
                                  key={i}
                                  initial={{ height: 0 }}
                                  animate={{ height: `${h}%` }}
                                  transition={{ delay: 0.5 + (i * 0.1), duration: 0.8, type: 'spring' }}
                                  className="flex-1 bg-secondary rounded-t relative overflow-hidden group"
                                >
                                  {/* Shimmer effect */}
                                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button className="px-4 py-1.5 bg-white/50 border border-outline/20 rounded-full text-[11px] font-mono text-primary hover:bg-white hover:border-primary/30 transition-all shadow-sm">Explain logic</button>
                        <button className="px-4 py-1.5 bg-white/50 border border-outline/20 rounded-full text-[11px] font-mono text-primary hover:bg-white hover:border-primary/30 transition-all shadow-sm">Export visualization</button>
                      </div>
                    </>
                  ) : (
                    <div className="bg-primary p-5 sm:p-6 rounded-2xl rounded-tr-none shadow-xl shadow-primary/10">
                      <p className="text-[15px] sm:text-base text-white">{msg.content}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {/* AI Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 items-center"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <div className="flex gap-1.5 p-4 px-6 bg-glass-fill backdrop-blur-md border border-outline/20 rounded-full shadow-sm">
                  <motion.div animate={{ scale: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <motion.div animate={{ scale: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <motion.div animate={{ scale: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </AnimatePresence>
        </div>

        {/* Input Area: Command Center */}
        <div className="bg-glass-fill backdrop-blur-xl p-3 sm:p-4 rounded-3xl border border-outline/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus-within:shadow-[0_8px_30px_rgba(230,72,51,0.1)] transition-all duration-300 relative flex-shrink-0">
          <div className="flex items-end gap-2 sm:gap-3">
            {/* Tools/Attachment Trigger */}
            <div className="flex flex-col gap-1 sm:gap-2 mb-1 hidden sm:flex">
              <button className="w-10 h-10 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all group" title="Attach Files">
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 duration-200" />
              </button>
              <button className="w-10 h-10 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all group" title="AI Tools">
                <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 duration-200" />
              </button>
            </div>
            
            {/* Main Input */}
            <div className="flex-1 flex flex-col bg-white/60 rounded-2xl border border-outline/30 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 transition-all p-1.5 sm:p-2">
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                className="w-full bg-transparent border-none focus:ring-0 resize-none py-2.5 sm:py-3 px-3 sm:px-4 text-[15px] sm:text-base text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none" 
                placeholder="Ask KnowFlow anything about your workspace..." 
                rows={1}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex gap-2">
                  <span className="text-[9px] sm:text-[10px] font-mono font-medium text-on-surface-variant flex items-center gap-1.5 bg-white/50 px-2.5 py-1 rounded-full border border-outline/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Context Ready
                  </span>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-primary/10 text-on-surface-variant flex items-center justify-center transition-all" title="Speech to Text">
                    <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-primary/10 text-on-surface-variant flex items-center justify-center transition-all" title="Commands">
                    <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Send Button */}
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-secondary hover:bg-secondary-container disabled:opacity-50 disabled:hover:bg-secondary text-white flex items-center justify-center transition-all shadow-lg shadow-secondary/20 active:scale-95 group mb-1 flex-shrink-0"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
