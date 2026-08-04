import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LandingHeroGraph } from '../components/3d/LandingHeroGraph';
import { Network, Search, Tags, Shield, Share2, Quote, PlayCircle,
         ArrowRight, Zap, Database, Lock, Users, Sparkles } from 'lucide-react';

export function Landing() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const revealVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" as const } }
  };

  const floatVariant = {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 4,
        ease: "easeInOut" as const,
        repeat: Infinity,
      }
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body-md overflow-x-hidden min-h-screen">
      <style dangerouslySetInnerHTML={{__html: `
        .glass-card {
            background: rgba(251, 233, 208, 0.4);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(144, 174, 173, 0.3);
            box-shadow: 0 8px 32px 0 rgba(8, 50, 62, 0.05);
        }
        .hero-gradient-overlay {
            background: linear-gradient(to bottom, rgba(251, 233, 208, 0.1), #fbe9d0);
        }
      `}} />

      {/* TopAppBar */}
      <header className={`fixed top-0 w-full z-50 backdrop-blur-xl bg-glass-fill border-b border-outline/30 shadow-[0_20px_20px_rgba(8,50,62,0.1)] transition-all duration-300 ${isScrolled ? 'py-2' : 'py-4'}`}>
        <nav className="flex justify-between items-center px-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Network className="text-primary w-8 h-8" />
            <span className="text-2xl font-bold text-primary font-heading">KnowFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a className="font-mono text-sm text-secondary font-bold hover:bg-primary/5 transition-colors px-3 py-2 rounded" href="#">Platform</a>
            <a className="font-mono text-sm text-on-surface-variant hover:bg-primary/5 transition-colors px-3 py-2 rounded" href="#">Solutions</a>
            <a className="font-mono text-sm text-on-surface-variant hover:bg-primary/5 transition-colors px-3 py-2 rounded" href="#">Intelligence</a>
            <a className="font-mono text-sm text-on-surface-variant hover:bg-primary/5 transition-colors px-3 py-2 rounded" href="#">Pricing</a>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="font-mono text-sm font-bold text-primary hover:text-secondary transition-colors">
              Sign In
            </Link>
            <Link to="/dashboard">
              <button className="bg-secondary text-white px-6 py-2.5 rounded-full font-mono text-sm hover:scale-95 duration-200 transition-all shadow-lg font-bold">
                Start capturing
              </button>
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
          <LandingHeroGraph />
          <div className="absolute inset-0 hero-gradient-overlay pointer-events-none z-0"></div>
          
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-20">
            <motion.div 
              variants={floatVariant} animate="animate"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 border border-secondary/20 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-mono text-xs text-secondary uppercase tracking-widest font-bold">Version 2.0 is live</span>
            </motion.div>
            
            <motion.h1 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant}
              className="font-heading text-5xl md:text-7xl font-bold text-primary mb-6 leading-tight tracking-tight"
            >
              Every note. <br className="hidden md:block"/> <span className="text-secondary italic">Actually</span> findable.
            </motion.h1>
            
            <motion.p 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant} transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-on-surface-variant mb-10 max-w-2xl mx-auto"
            >
              The enterprise intelligence layer that structures high-stakes knowledge. Built for leaders who demand clarity in the noise.
            </motion.p>
            
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant} transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link to="/login" className="w-full sm:w-auto">
                <button className="w-full bg-secondary text-white px-10 py-4 rounded-xl font-mono text-sm hover:scale-95 duration-200 transition-all shadow-xl shadow-secondary/20 font-bold">
                  Start capturing
                </button>
              </Link>
              <button className="w-full sm:w-auto glass-card text-primary px-10 py-4 rounded-xl font-mono text-sm hover:bg-white/40 transition-all flex items-center justify-center gap-2 font-bold">
                <PlayCircle className="w-5 h-5" />
                Watch Demo
              </button>
            </motion.div>
          </div>
        </section>

        {/* Bento Grid Section */}
        <section className="py-24 px-8 max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Large Card: AI Search */}
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant}
              className="md:col-span-8 glass-card rounded-3xl p-10 flex flex-col justify-between overflow-hidden relative group"
            >
              <div className="relative z-10">
                <Search className="w-10 h-10 text-secondary mb-6" />
                <h3 className="font-heading text-3xl font-bold text-primary mb-4">Semantic AI Search</h3>
                <p className="text-base text-on-surface-variant max-w-md">
                  Search by intent, not just keywords. Our neural engine understands the context of your high-stakes intelligence.
                </p>
              </div>
              <div className="mt-12 relative h-48 rounded-2xl overflow-hidden border border-outline/20">
                <div className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-700" 
                     style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAl0mUgPkPZEqYKHybyMINX-cScM8VzRxJAZl22jYG2dm7HgsmDUO-vZ12B28Wp1yh7dlV9bWGxGK18qgfuqFCs2oD_d8acwYjzm-yoaYqhvkSPig7OZMnwQrz124gr-TYpKggztdnzzo7QRq10urxtcED8EY_tjC203ITmrCA2aKzp4dWgDX1xNuHdo-JqtochHfBKxcJn-Z7Y3_e3kDww6KP4BFasfK_TwInrMvCHyijXataK77SQIMw7_AmkOxwUDRB8b-ma3W7V')" }}></div>
              </div>
            </motion.div>

            {/* Small Card: Classification */}
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant} transition={{ delay: 0.2 }}
              className="md:col-span-4 glass-card rounded-3xl p-10 flex flex-col"
            >
              <Tags className="w-10 h-10 text-primary mb-6" />
              <h3 className="font-heading text-2xl font-bold text-primary mb-4">Smart Classification</h3>
              <p className="text-sm text-on-surface-variant">
                Automatic tagging and hierarchical sorting for complex document sets.
              </p>
              <div className="mt-auto pt-8 flex gap-2">
                <span className="px-3 py-1 rounded-full bg-primary/5 text-primary text-[10px] font-mono border border-primary/10">Taxonomy</span>
                <span className="px-3 py-1 rounded-full bg-primary/5 text-primary text-[10px] font-mono border border-primary/10">NLP</span>
              </div>
            </motion.div>

            {/* Small Card: Protection */}
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant} transition={{ delay: 0.1 }}
              className="md:col-span-4 glass-card rounded-3xl p-10 flex flex-col"
            >
              <Shield className="w-10 h-10 text-primary mb-6" />
              <h3 className="font-heading text-2xl font-bold text-primary mb-4">Data Protection</h3>
              <p className="text-sm text-on-surface-variant">
                Bank-grade encryption and SOC2 compliance for your most sensitive intelligence assets.
              </p>
              <div className="mt-8 flex items-center justify-center h-full">
                <Shield className="w-20 h-20 text-primary/20" />
              </div>
            </motion.div>

            {/* Mid Card: Connections */}
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant} transition={{ delay: 0.3 }}
              className="md:col-span-8 glass-card rounded-3xl p-10 flex flex-col md:flex-row gap-8 items-center"
            >
              <div className="md:w-1/2">
                <Share2 className="w-10 h-10 text-secondary mb-6" />
                <h3 className="font-heading text-3xl font-bold text-primary mb-4">Visual Connections</h3>
                <p className="text-base text-on-surface-variant">
                  Discover non-obvious relationships between disconnected projects with our graph visualization layer.
                </p>
              </div>
              <div className="md:w-1/2 h-64 w-full glass-card border-none rounded-2xl overflow-hidden shadow-inner group">
                <div className="w-full h-full bg-cover bg-center opacity-80 group-hover:scale-105 transition-transform duration-700" 
                     style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDkBm_NvystnyVpI-78EJ6ia30K60CbMA0Mte5RQlvC-moDpwBMZToxQFKqNHGyipzSNjLJEsQ6VOPi3EUo0BOtqgcchxBZshWsbiH58FOha8OZhIHBBpPk8MhzknhlEMAvE1y_tnclK6JmHTyMrdQRhnTcCyrcpobcThDLMRAuFb04il9Ih6oW9OP5253_8K2qSrRifsoiEf8XhgHW2ADugai_PDzFpdnqDWmvnFQuCBUVZfSrhMMhecltAR9j-s3vcWkgK3ZlSz4Z')" }}></div>
              </div>
            </motion.div>

          </div>
        </section>

        {/* Social Proof & Metrics */}
        <section className="py-24 bg-primary-container relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant}
            className="max-w-7xl mx-auto px-8 text-center relative z-10"
          >
            <h2 className="font-heading text-4xl font-bold text-white mb-16 tracking-tight">Built for those who can't afford to forget</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-20">
              <div className="p-8 border-r border-white/10">
                <div className="font-heading text-5xl font-bold text-secondary mb-2">99.9%</div>
                <div className="font-mono text-sm text-on-primary-container uppercase tracking-wider font-bold">Uptime SLA</div>
              </div>
              <div className="p-8 border-r border-white/10">
                <div className="font-heading text-5xl font-bold text-secondary mb-2">25ms</div>
                <div className="font-mono text-sm text-on-primary-container uppercase tracking-wider font-bold">Search Latency</div>
              </div>
              <div className="p-8">
                <div className="font-heading text-5xl font-bold text-secondary mb-2">500+</div>
                <div className="font-mono text-sm text-on-primary-container uppercase tracking-wider font-bold">Integrations</div>
              </div>
            </div>

            <div className="glass-card max-w-3xl mx-auto p-12 rounded-3xl bg-white/5 border-white/10 backdrop-blur-md">
              <Quote className="w-12 h-12 text-secondary mb-6 mx-auto" />
              <p className="text-xl text-white italic mb-8">
                "KnowFlow changed how our executive team processes intelligence. It's no longer about where information is stored—it's about how it's instantly surfaced when the stakes are highest."
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-secondary/50">
                  <img className="w-full h-full object-cover" alt="Elena Sterling" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVKBBvWk0JBrkmkGY6BCHy4pirwHnfdUDxjB90yVMe3OkJxzN8GbaBlkmp8fexPyr2iyaIQTJRNBVpuhjvBxe-4B9POoUTMdfBsuDrsTaFejlxuaDdOHIyYB63R9cSnktdvaRt3X-cZHw5YlZsO2APVaPpZrPoRGmkJ_I4R9IWtCwfjBDDIYtWEiZyPduwzsJq3JpIRFZuuP5sJR44SRwRDMA0pVVP_W9uv7DFJ2O4ISNkz8DvxOeXQTRn1eRqCdvaO1cPxKwSsMKP"/>
                </div>
                <div className="text-left">
                  <div className="font-mono text-sm text-white font-bold">Elena Sterling</div>
                  <div className="font-mono text-xs text-on-primary-container">CTO, Nexa Global</div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-8 text-center bg-surface relative z-10">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariant}
            className="max-w-2xl mx-auto"
          >
            <h2 className="font-heading text-4xl font-bold text-primary mb-6">Ready to scale your intelligence?</h2>
            <p className="text-lg text-on-surface-variant mb-10">
              Join 5,000+ enterprise teams building the future of knowledge management on KnowFlow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="w-full sm:w-auto bg-primary text-white px-12 py-4 rounded-xl font-mono text-sm hover:bg-primary-container transition-all font-bold">
                Schedule Enterprise Demo
              </button>
              <button className="w-full sm:w-auto border-2 border-primary text-primary px-12 py-4 rounded-xl font-mono text-sm hover:bg-primary/5 transition-all font-bold">
                View Case Studies
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-surface-dim border-t border-outline/20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 px-8 max-w-7xl mx-auto mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <Network className="w-6 h-6 text-primary" />
              <span className="font-heading text-2xl font-bold text-primary">KnowFlow</span>
            </div>
            <p className="text-sm text-on-surface-variant/80 max-w-xs">
              Building the world's most sophisticated knowledge layer for high-stakes enterprise environments.
            </p>
          </div>
          <div>
            <h4 className="font-mono text-sm font-bold text-primary mb-6">Product</h4>
            <ul className="space-y-4">
              <li><a className="text-sm text-on-surface-variant/80 hover:text-secondary transition-colors" href="#">Semantic Search</a></li>
              <li><a className="text-sm text-on-surface-variant/80 hover:text-secondary transition-colors" href="#">Graph Connections</a></li>
              <li><a className="text-sm text-on-surface-variant/80 hover:text-secondary transition-colors" href="#">Compliance Engine</a></li>
              <li><a className="text-sm text-on-surface-variant/80 hover:text-secondary transition-colors" href="#">Enterprise API</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-sm font-bold text-primary mb-6">Company</h4>
            <ul className="space-y-4">
              <li><a className="text-sm text-on-surface-variant/80 hover:text-secondary transition-colors" href="#">Security Strategy</a></li>
              <li><a className="text-sm text-on-surface-variant/80 hover:text-secondary transition-colors" href="#">Privacy Policy</a></li>
              <li><a className="text-sm text-on-surface-variant/80 hover:text-secondary transition-colors" href="#">Terms of Service</a></li>
              <li><a className="text-sm text-on-surface-variant/80 hover:text-secondary transition-colors" href="#">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-sm font-bold text-primary mb-6">Connect</h4>
            <div className="flex gap-4">
              <a className="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-secondary hover:text-white transition-all group" href="#">
                <span className="font-mono text-xs font-bold">in</span>
              </a>
              <a className="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-secondary hover:text-white transition-all group" href="#">
                <span className="font-mono text-xs font-bold">𝕏</span>
              </a>
            </div>
          </div>
        </div>
        <div className="px-8 max-w-7xl mx-auto pt-8 border-t border-outline/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-mono text-xs text-on-surface-variant/60">© 2024 KnowFlow Enterprise. Built for high-stakes intelligence.</span>
          <div className="flex gap-6">
            <a className="font-mono text-xs text-on-surface-variant/60 hover:text-secondary" href="#">Security</a>
            <a className="font-mono text-xs text-on-surface-variant/60 hover:text-secondary" href="#">Enterprise API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
