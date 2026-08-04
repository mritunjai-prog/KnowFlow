import { motion } from 'framer-motion';
import { FileText, ArrowLeft, MoreVertical, Search, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DocumentDetail() {
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-4 sm:-m-8">
      {/* Topbar */}
      <header className="h-16 border-b border-deep-slate/10 bg-white/50 backdrop-blur flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/library" className="p-2 hover:bg-deep-slate/5 rounded-full transition-colors text-deep-slate/60 hover:text-deep-slate">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 border-l border-deep-slate/10 pl-4">
            <div className="w-8 h-8 bg-sage/20 rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-sage" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-sm leading-tight">Q3 Strategy Meeting Notes</h2>
              <div className="text-xs text-deep-slate/50 flex gap-2">
                <span>Handwritten</span>
                <span>•</span>
                <span>Oct 15, 2023</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="p-2 hover:bg-deep-slate/5 rounded-lg text-deep-slate/60"><Search className="w-5 h-5" /></button>
          <button className="p-2 hover:bg-deep-slate/5 rounded-lg text-deep-slate/60"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </header>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Original Document Viewer */}
        <div className="flex-1 bg-deep-slate/5 border-r border-deep-slate/10 p-6 flex items-center justify-center relative overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg aspect-[3/4] bg-white shadow-md rounded-sm border border-deep-slate/10 flex flex-col items-center justify-center text-deep-slate/30"
          >
            <FileText className="w-24 h-24 mb-4 opacity-50" />
            <p className="font-heading text-lg">Original Source Image</p>
          </motion.div>
          
          <div className="absolute bottom-6 right-6 flex gap-2">
            <button className="px-3 py-1.5 bg-white/80 backdrop-blur rounded shadow-sm text-xs font-medium text-deep-slate/70 hover:text-deep-slate border border-deep-slate/10">Zoom In</button>
            <button className="px-3 py-1.5 bg-white/80 backdrop-blur rounded shadow-sm text-xs font-medium text-deep-slate/70 hover:text-deep-slate border border-deep-slate/10">Zoom Out</button>
          </div>
        </div>

        {/* Right: Extracted Text & Metadata */}
        <div className="w-[450px] bg-white/30 backdrop-blur flex flex-col shrink-0">
          <div className="p-6 border-b border-deep-slate/10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-deep-slate/50 mb-3">Auto-Generated Tags</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-deep-slate/5 rounded-md text-xs font-medium">Machine Learning</span>
              <span className="px-2.5 py-1 bg-deep-slate/5 rounded-md text-xs font-medium">Q3</span>
              <span className="px-2.5 py-1 bg-deep-slate/5 rounded-md text-xs font-medium">Strategy</span>
            </div>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-deep-slate/50">Extracted Text</h3>
              <button className="text-xs text-signal-red hover:underline flex items-center gap-1">
                Open in Editor <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="font-mono text-sm leading-relaxed text-deep-slate/80 p-4 bg-white/50 rounded-lg border border-deep-slate/5 selection:bg-signal-red/20"
            >
              <p className="mb-4">1. We need to transition the core pipeline to a vector database by end of Q4.</p>
              <p className="mb-4">2. Current bottlenecks: OCR latency is too high (~3s per page).</p>
              <p className="mb-4">
                <span className="bg-signal-red/10 border border-signal-red/20 rounded px-1 -mx-1 text-signal-red font-medium">ACTION ITEM: John to investigate Pinecone vs Weaviate</span>
              </p>
              <p>3. Budget approved for 2 more ML engineers.</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
