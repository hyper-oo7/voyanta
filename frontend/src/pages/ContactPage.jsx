import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';

export default function ContactPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    agencyName: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: ''
  });

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      toast.success('Thank you for reaching out! A Voyanta representative will contact you shortly.');
      setFormData({
        name: '',
        agencyName: '',
        email: '',
        phone: '',
        subject: 'General Inquiry',
        message: ''
      });
      setSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body pb-20 selection:bg-primary/20">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-outline-variant px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-none p-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Home
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg shadow-sm">
              <span className="material-symbols-outlined text-white text-[18px]">travel_explore</span>
            </div>
            <span className="font-display font-bold text-xl text-primary">Voyanta</span>
          </div>
          <button
            onClick={() => navigate('/login?signup=true')}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium text-xs rounded-xl shadow-md transition-all border-none cursor-pointer"
          >
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-32 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Side: Contact Information */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
                📞 Get In Touch
              </span>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-on-surface leading-tight mb-4">
                We'd love to hear from you.
              </h1>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Whether you need help onboarding your agency's supplier contracts, want a tailored team demo, or need technical support, our team is always ready to assist.
              </p>
            </div>

            <div className="space-y-6">
              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface">Email Us</h4>
                  <a href="mailto:support@voyanta.com" className="text-sm text-primary hover:underline font-semibold block mt-0.5">
                    support@voyanta.com
                  </a>
                  <span className="text-xs text-on-surface-variant">Response within 12 hours</span>
                </div>
              </div>

              {/* Call */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">call</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface">Concierge Hotline</h4>
                  <a href="tel:+1800VOYANTA" className="text-sm text-primary hover:underline font-semibold block mt-0.5">
                    +1-800-VOYANTA
                  </a>
                  <span className="text-xs text-on-surface-variant">Mon-Sat, 9:00 AM - 7:00 PM IST</span>
                </div>
              </div>

              {/* Offices */}
              <div className="flex items-start gap-4 border-t border-outline-variant/60 pt-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">apartment</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-sm text-on-surface">Headquarters (Bangalore)</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                      Voyanta Technologies Pvt. Ltd.<br />
                      100 Feet Road, Indiranagar,<br />
                      Bengaluru, Karnataka 560038
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-on-surface">Regional Office (Srinagar)</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                      Boulevard Road, Dal Lake,<br />
                      Srinagar, Jammu & Kashmir 190001
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Contact Form Card */}
          <div className="lg:col-span-7 bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-lg">
            <h3 className="font-display text-2xl font-bold text-on-surface mb-6">Send us a Message</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-surface border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    placeholder="Alex Sterling"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Agency Name</label>
                  <input
                    type="text"
                    name="agencyName"
                    required
                    value={formData.agencyName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-surface border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    placeholder="Sterling Luxury Travel"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-surface border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    placeholder="alex@sterling.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-surface border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase">Subject</label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Supplier Onboarding Support">Supplier Onboarding Support</option>
                  <option value="Custom Demo Request">Custom Demo Request</option>
                  <option value="Billing & Pricing Inquiry">Billing & Pricing Inquiry</option>
                  <option value="Partnerships">Partnerships</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase">Message</label>
                <textarea
                  name="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none"
                  placeholder="How can we help you?"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 mt-2 border-none cursor-pointer"
              >
                {submitting ? 'Sending Message...' : 'Send Message'}
              </button>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}
