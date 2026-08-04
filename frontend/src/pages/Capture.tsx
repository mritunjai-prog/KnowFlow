import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, Edit3, Clipboard, Mic, Database, ChevronDown, Lock, Square } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';

export function Capture() {
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const stagger = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 h-full flex flex-col">
      {/* ── Page Header ── */}
      <motion.div initial="hidden" animate="show" variants={stagger} className="mb-8 shrink-0">
        <motion.h1 variants={item} className="font-heading text-4xl font-bold text-primary tracking-tight flex items-center gap-3">
          <Database className="w-8 h-8" />
          Capture Intelligence
        </motion.h1>
        <motion.p variants={item} className="text-on-surface-variant/70 mt-2 font-mono text-sm tracking-widest uppercase">
          Phase: Acquisition & Analysis
        </motion.p>
      </motion.div>

      {/* ── Two-Column Grid ── */}
      <motion.div 
        variants={stagger} 
        initial="hidden" 
        animate="show" 
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0"
      >
        
        {/* Left Column (7 cols): Files & Draft */}
        <div className="col-span-1 lg:col-span-7 flex flex-col gap-6 h-full">
          
          {/* File Drop Zone */}
          <motion.div variants={item} className="flex-1 min-h-[250px]">
            <div 
              className={`h-full rounded-xl p-8 flex flex-col items-center justify-center border-dashed border-2 transition-all duration-300 cursor-pointer
                ${isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-outline/40 hover:border-primary/80 bg-glass-fill/40 hover:bg-glass-fill/60'}`}
              style={{
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
            >
              <div className={`p-6 rounded-full bg-primary/5 mb-6 transition-transform duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-110'}`}>
                <UploadCloud className="w-12 h-12 text-primary" />
              </div>
              <h3 className="font-heading text-2xl font-semibold text-primary mb-2">File Drop Zone</h3>
              <p className="text-on-surface-variant mb-6 text-center max-w-sm">
                Seamlessly ingest your technical documentation and data logs.
              </p>
              <div className="flex gap-4">
                <span className="font-mono text-xs px-3 py-1 rounded bg-white/40 border border-glass-border">PDF</span>
                <span className="font-mono text-xs px-3 py-1 rounded bg-white/40 border border-glass-border">DOCX</span>
                <span className="font-mono text-xs px-3 py-1 rounded bg-white/40 border border-glass-border">TXT</span>
              </div>
            </div>
          </motion.div>

          {/* Draft Intake */}
          <motion.div variants={item} className="flex-1 min-h-[300px]">
            <GlassCard className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <Edit3 className="w-5 h-5 text-primary" />
                  <h3 className="font-heading text-xl font-semibold text-primary">Draft Intake</h3>
                </div>
                <button className="flex items-center gap-2 font-mono text-xs font-medium bg-primary text-on-primary px-4 py-2 rounded hover:bg-primary-container transition-colors shadow-sm active:scale-95 duration-200">
                  <Clipboard className="w-4 h-4" />
                  PASTE
                </button>
              </div>
              <textarea 
                className="flex-1 w-full bg-surface-container-low/50 border border-outline/20 rounded-lg p-6 focus:ring-2 focus:ring-primary focus:border-transparent resize-none placeholder:text-on-surface-variant/40"
                placeholder="Input raw intelligence or paste transcriptions here for real-time processing..."
              />
            </GlassCard>
          </motion.div>
        </div>

        {/* Right Column (5 cols): Voice & Metadata */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-6 h-full">
          
          {/* Voice Protocol */}
          <motion.div variants={item} className="flex-[3] min-h-[300px]">
            <GlassCard className="h-full flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-6">
                <span className="font-mono text-sm text-primary tracking-widest uppercase">Voice Protocol</span>
              </div>
              
              {/* Waveform Bars */}
              <div className="flex items-center justify-center gap-2 mb-10 mt-8 h-16">
                {[0.1, 0.3, 0.2, 0.5, 0.4, 0.1, 0.6].map((delay, i) => (
                  <motion.div
                    key={i}
                    animate={isRecording ? { height: ['12px', '40px', '12px'] } : { height: '12px' }}
                    transition={isRecording ? { duration: 1.2, repeat: Infinity, delay, ease: "easeInOut" } : {}}
                    className="w-1 bg-primary rounded-full"
                    style={{ height: '12px' }}
                  />
                ))}
              </div>

              {/* Record Button */}
              <div className="relative flex flex-col items-center">
                <motion.button 
                  onClick={() => setIsRecording(!isRecording)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={isRecording ? { 
                    boxShadow: ['0 0 0 0 rgba(230, 72, 51, 0.7)', '0 0 0 15px rgba(230, 72, 51, 0)', '0 0 0 0 rgba(230, 72, 51, 0)'] 
                  } : { boxShadow: 'none' }}
                  transition={isRecording ? { duration: 2, repeat: Infinity } : {}}
                  className={`w-24 h-24 rounded-full flex items-center justify-center relative z-10 shadow-xl transition-colors duration-300
                    ${isRecording ? 'bg-error text-white' : 'bg-signal-red text-white'}`}
                >
                  {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-10 h-10" />}
                </motion.button>
                <p className="mt-8 font-mono text-sm text-primary tracking-widest font-bold">
                  {isRecording ? 'RECORDING IN PROGRESS' : 'TAP TO RECORD'}
                </p>
                <p className="mt-2 text-on-surface-variant text-xs opacity-60 italic">Voice intelligence is encrypted in-transit</p>
              </div>
            </GlassCard>
          </motion.div>

          {/* Enrichment Metadata */}
          <motion.div variants={item} className="flex-[2] min-h-[250px]">
            <GlassCard className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Database className="w-5 h-5 text-primary" />
                  <h3 className="font-heading text-xl font-semibold text-primary">Enrichment Metadata</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-xs text-on-surface-variant uppercase ml-1">Context / Project</label>
                    <div className="relative">
                      <select className="w-full bg-surface-container-low/50 border border-outline/20 rounded-lg py-2.5 px-4 appearance-none focus:ring-2 focus:ring-primary">
                        <option>Q4 Strategy Planning</option>
                        <option>Technical Architecture</option>
                        <option>Market Intelligence</option>
                        <option>Internal R&D</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-on-surface-variant" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-xs text-on-surface-variant uppercase ml-1">Sensitivity Level</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                      <select className="w-full bg-surface-container-low/50 border border-outline/20 rounded-lg py-2.5 pl-10 pr-4 appearance-none focus:ring-2 focus:ring-primary">
                        <option>Restricted - Internal Only</option>
                        <option>Confidential - Project Leads</option>
                        <option>Public Domain</option>
                        <option>Top Secret - Executive</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-on-surface-variant" />
                    </div>
                  </div>
                </div>
              </div>

              <button className="w-full bg-primary text-on-primary font-heading text-lg font-medium py-3 rounded-lg mt-6 hover:bg-primary/90 transition-all shadow-lg active:scale-[0.98]">
                Process Knowledge
              </button>
            </GlassCard>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}
