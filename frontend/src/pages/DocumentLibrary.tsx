import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Grid, List as ListIcon, Filter, ChevronDown, FileText } from 'lucide-react';
import { SpotlightCard } from '../components/ui/Card';

export function DocumentLibrary() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filtersOpen] = useState(true);

  const docs = Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    title: `Document ${i + 1}`,
    type: i % 2 === 0 ? 'PDF' : 'Handwritten',
    date: '2023-10-15',
    topic: 'Machine Learning'
  }));

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex gap-8 h-[calc(100vh-8rem)]">
      {/* Left Filter Rail */}
      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.aside 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-64 flex-shrink-0 flex flex-col gap-6"
          >
            <div className="bg-white/50 backdrop-blur rounded-xl p-5 border border-deep-slate/10 h-full overflow-y-auto">
              <h3 className="font-heading font-semibold text-lg flex items-center gap-2 mb-6">
                <Filter className="w-4 h-4" /> Filters
              </h3>
              
              <div className="space-y-6">
                <div>
                  <button className="flex items-center justify-between w-full font-medium text-sm mb-3">
                    Topics <ChevronDown className="w-4 h-4" />
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {['Machine Learning', 'System Design', 'React'].map(topic => (
                      <span key={topic} className="px-3 py-1 bg-sage/20 text-deep-slate text-xs rounded-full font-medium cursor-pointer hover:bg-sage/30">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <button className="flex items-center justify-between w-full font-medium text-sm mb-3">
                    Type <ChevronDown className="w-4 h-4" />
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {['PDF', 'Handwritten', 'Whiteboard'].map(type => (
                      <span key={type} className="px-3 py-1 bg-umber/10 text-umber border border-umber/20 text-xs rounded font-mono font-medium cursor-pointer hover:bg-umber/20">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Grid/List */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between mb-6 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-deep-slate/40" />
            <input 
              type="text" 
              placeholder="Search library..." 
              className="w-full pl-10 pr-4 py-2 bg-white/50 backdrop-blur border border-deep-slate/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-deep-slate transition-all shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 bg-white/50 backdrop-blur border border-deep-slate/10 p-1 rounded-lg">
            <button 
              onClick={() => setView('grid')}
              className={`p-1.5 rounded ${view === 'grid' ? 'bg-deep-slate text-sand' : 'text-deep-slate/50 hover:text-deep-slate'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView('list')}
              className={`p-1.5 rounded ${view === 'list' ? 'bg-deep-slate text-sand' : 'text-deep-slate/50 hover:text-deep-slate'}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-2 pb-20">
          {view === 'grid' ? (
            <motion.div 
              key="grid"
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {docs.map((doc) => (
                <motion.div key={doc.id} variants={item}>
                  <SpotlightCard className="h-64 flex flex-col p-4 cursor-pointer relative group">
                    <div className="absolute top-2 right-2 w-4 h-4 border-r border-t border-signal-red/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-l border-b border-signal-red/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="flex-1 bg-white border border-deep-slate/5 rounded flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-deep-slate/20" />
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-sm mb-1">{doc.title}</h3>
                        <span className="text-xs font-mono text-umber bg-umber/10 px-1.5 py-0.5 rounded">{doc.type}</span>
                      </div>
                      <span className="text-xs text-deep-slate/50">{doc.date}</span>
                    </div>
                  </SpotlightCard>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              variants={container}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-2"
            >
              {docs.map((doc) => (
                <motion.div key={doc.id} variants={item}>
                  <div className="group relative flex items-center gap-4 p-4 bg-white/40 hover:bg-white/70 backdrop-blur rounded-lg border border-deep-slate/5 cursor-pointer transition-all hover:-translate-y-[1px]">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-signal-red rounded-l-lg scale-y-0 group-hover:scale-y-100 transition-transform origin-center ease-custom duration-300" />
                    <div className="w-10 h-10 bg-sand rounded flex items-center justify-center border border-deep-slate/5">
                      <FileText className="h-4 w-4 text-deep-slate/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{doc.title}</h3>
                      <span className="text-xs text-deep-slate/50">{doc.topic}</span>
                    </div>
                    <span className="text-xs font-mono text-umber bg-umber/10 px-2 py-1 rounded hidden sm:block">{doc.type}</span>
                    <span className="text-xs text-deep-slate/50 whitespace-nowrap">{doc.date}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
