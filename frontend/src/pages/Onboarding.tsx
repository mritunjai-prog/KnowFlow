import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Bot, FolderTree, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Aurora } from '../components/ui/Aurora';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const steps = [
    {
      icon: Camera,
      title: "Omnivorous Capture",
      desc: "Upload anything. Screenshots, photos of whiteboards, or scribbled notes. We'll read it.",
    },
    {
      icon: FolderTree,
      title: "Auto-Classification",
      desc: "No more manual tagging. Our ML models automatically categorize and link your knowledge.",
    },
    {
      icon: Bot,
      title: "Instant Recall",
      desc: "Just ask. The RAG assistant will synthesize answers grounded exactly in your own documents.",
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <Aurora />
      
      <div className="relative z-10 w-full max-w-lg">
        <div className="bg-white/50 backdrop-blur-xl border border-deep-slate/10 p-10 rounded-3xl shadow-[0_8px_32px_rgba(36,72,85,0.1)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-sage/10 rounded-2xl flex items-center justify-center mb-6 border border-sage/20">
                {(() => {
                  const Icon = steps[step].icon;
                  return <Icon className="w-10 h-10 text-sage" />;
                })()}
              </div>
              
              <h2 className="font-heading text-3xl font-bold text-deep-slate mb-3">
                {steps[step].title}
              </h2>
              <p className="text-deep-slate/70 leading-relaxed max-w-sm">
                {steps[step].desc}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 flex items-center justify-between">
            <div className="flex gap-2">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 bg-signal-red' : 'w-2 bg-deep-slate/20'
                  }`}
                />
              ))}
            </div>
            
            <Button variant="primary" magnet onClick={handleNext} className="gap-2 px-6">
              {step === steps.length - 1 ? "Enter KnowFlow" : "Next"} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
