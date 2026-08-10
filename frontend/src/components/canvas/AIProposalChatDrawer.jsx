import React, { useState, useRef, useEffect } from 'react';
import { useProposalStore } from '../../store/proposalStore.js';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import FlyingLoader from '../common/FlyingLoader.jsx';

export default function AIProposalChatDrawer({ isOpen, onClose }) {
  const toast = useToast();
  const { proposal, updateProposal } = useProposalStore();
  
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: "Hi! I'm Voyanta AI. How would you like me to refine this itinerary? (e.g. 'Make it cheaper', 'Add an adventure activity on Day 2')" }
  ]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isProcessing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;

    const userText = prompt.trim();
    setPrompt('');
    setChatHistory(prev => [...prev, { role: 'user', text: userText }]);
    setIsProcessing(true);

    try {
      const { client } = useProposalStore.getState();
      const enrichedProposal = {
        ...proposal,
        destination: proposal?.destination || client?.destination,
        num_travelers: proposal?.num_travelers || client?.num_adults,
      };

      const res = await api.post('/api/refine-itinerary', {
        proposal: enrichedProposal,
        user_prompt: userText
      });

      if (res?.modified_proposal) {
        updateProposal(res.modified_proposal);
        setChatHistory(prev => [...prev, { role: 'ai', text: 'I have updated the itinerary as requested! You can review the changes on the canvas.' }]);
        toast.success('Itinerary successfully updated via AI.');
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (err) {
      console.error('[AI Refine] Error:', err);
      toast.error('Failed to update itinerary.');
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Sorry, I encountered an error while trying to update the itinerary.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-surface border-l border-outline-variant shadow-2xl z-[60] flex flex-col transition-transform transform translate-x-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-outline-variant bg-surface-container-low">
        <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">auto_awesome</span>
          AI Curator Chat
        </h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-primary text-on-primary rounded-tr-sm shadow-md' 
                : 'bg-surface border border-outline-variant text-on-surface rounded-tl-sm shadow-sm'
            }`}>
              {msg.text}
            </div>
            <span className="text-[10px] text-on-surface-variant mt-1 px-1">
              {msg.role === 'user' ? 'You' : 'Voyanta AI'}
            </span>
          </div>
        ))}
        {isProcessing && (
          <div className="flex flex-col items-start">
            <div className="px-4 py-3 rounded-2xl bg-surface border border-outline-variant rounded-tl-sm shadow-sm flex items-center gap-2">
              <FlyingLoader size="text-[16px]" />
              <span className="text-sm text-on-surface-variant font-medium">Refining itinerary...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-outline-variant bg-surface">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isProcessing}
            placeholder="Type your edits here..."
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-outline-variant bg-surface-container-low text-sm text-on-surface focus:border-primary outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isProcessing}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
