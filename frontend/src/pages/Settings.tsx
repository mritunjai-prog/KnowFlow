import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, User, Database, Shield, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/Button';

function AccordionItem({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-deep-slate/10 rounded-lg overflow-hidden bg-white/50">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/50 transition-colors"
      >
        <span className="font-medium text-sm">{title}</span>
        <ChevronDown className={cn("w-4 h-4 text-deep-slate/50 transition-transform duration-200", isOpen ? "rotate-180" : "")} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-deep-slate/10 text-sm">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const [saved, setSaved] = useState(false);
  
  // Form State
  const [firstName, setFirstName] = useState('Knowledge');
  const [lastName, setLastName] = useState('Worker');
  const [email, setEmail] = useState('knowledge@worker.com');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) newErrors.email = "Valid email is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (activeTab === 'account' && !validateForm()) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-10">
        <h1 className="font-heading text-3xl font-bold mb-2 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-signal-red" />
          Settings
        </h1>
        <p className="text-deep-slate/70">Manage your account, models, and application preferences.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0 space-y-1">
          {[
            { id: 'account', label: 'Account Profile', icon: User },
            { id: 'app', label: 'App Preferences', icon: SettingsIcon },
            { id: 'models', label: 'AI Models', icon: Database },
            { id: 'security', label: 'Security', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive 
                    ? "bg-white shadow-sm text-signal-red border border-deep-slate/5" 
                    : "text-deep-slate/70 hover:bg-white/50 hover:text-deep-slate"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white/40 backdrop-blur-md border border-deep-slate/10 rounded-2xl p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-heading font-semibold mb-4">Profile Information</h2>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-medium text-deep-slate/80">First Name</label>
                        <input 
                          type="text" 
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={cn("w-full px-4 py-2 bg-white/50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-signal-red/50", errors.firstName ? "border-signal-red/60" : "border-deep-slate/20")} 
                        />
                        {errors.firstName && <p className="text-xs text-signal-red flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.firstName}</p>}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-medium text-deep-slate/80">Last Name</label>
                        <input 
                          type="text" 
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className={cn("w-full px-4 py-2 bg-white/50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-signal-red/50", errors.lastName ? "border-signal-red/60" : "border-deep-slate/20")} 
                        />
                        {errors.lastName && <p className="text-xs text-signal-red flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.lastName}</p>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-deep-slate/80">Email Address</label>
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn("w-full px-4 py-2 bg-white/50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-signal-red/50", errors.email ? "border-signal-red/60" : "border-deep-slate/20")} 
                      />
                      {errors.email && <p className="text-xs text-signal-red flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.email}</p>}
                    </div>
                  </div>
                </div>

                <hr className="border-deep-slate/10" />

                <div>
                  <h2 className="text-lg font-heading font-semibold mb-4">Workspace Settings</h2>
                  <div className="p-4 bg-white/50 rounded-lg border border-deep-slate/10 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">Default Workspace</h4>
                      <p className="text-xs text-deep-slate/60">Where new captures are saved</p>
                    </div>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-deep-slate/10 rounded-md text-sm shadow-sm hover:border-signal-red transition-colors">
                      Personal Hub <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'models' && (
              <motion.div
                key="models"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-heading font-semibold mb-4">LLM Provider</h2>
                  <div className="space-y-3">
                    {['OpenAI (GPT-4o)', 'Anthropic (Claude 3.5 Sonnet)', 'Local (Ollama)'].map((model, i) => (
                      <label key={i} className="flex items-center gap-3 p-4 bg-white/50 border border-deep-slate/10 rounded-lg cursor-pointer hover:border-signal-red transition-colors">
                        <input type="radio" name="model" defaultChecked={i === 0} className="w-4 h-4 text-signal-red border-deep-slate/30 focus:ring-signal-red" />
                        <span className="font-medium text-sm">{model}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            
            {activeTab === 'app' && (
               <motion.div
                key="app"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-heading font-semibold mb-4">App Preferences</h2>
                <AccordionItem title="Notifications" defaultOpen>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="text-signal-red focus:ring-signal-red" />
                      Email notifications for new tasks
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="text-signal-red focus:ring-signal-red" />
                      In-app task reminders
                    </label>
                  </div>
                </AccordionItem>
                <AccordionItem title="Appearance">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="theme" defaultChecked className="text-signal-red focus:ring-signal-red" />
                      Light Mode
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="theme" className="text-signal-red focus:ring-signal-red" />
                      Dark Mode
                    </label>
                  </div>
                </AccordionItem>
              </motion.div>
            )}

            {activeTab === 'security' && (
               <motion.div
                key="security"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-heading font-semibold mb-4">Security</h2>
                <AccordionItem title="Password Management" defaultOpen>
                  <div className="space-y-3">
                    <input type="password" placeholder="Current Password" className="w-full px-4 py-2 bg-white/50 border border-deep-slate/20 rounded-lg text-sm" />
                    <input type="password" placeholder="New Password" className="w-full px-4 py-2 bg-white/50 border border-deep-slate/20 rounded-lg text-sm" />
                    <Button variant="secondary" className="w-full text-sm">Update Password</Button>
                  </div>
                </AccordionItem>
                <AccordionItem title="Two-Factor Authentication">
                  <p className="text-xs text-deep-slate/70 mb-3">Add an extra layer of security to your account.</p>
                  <Button variant="primary" className="text-sm">Enable 2FA</Button>
                </AccordionItem>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-deep-slate/10 flex justify-end">
            <Button variant="primary" onClick={handleSave} className="min-w-[120px]">
              {saved ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" /> Saved
                </span>
              ) : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
