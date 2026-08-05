import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Hotel,
  Ticket,
  Plane,
  Star,
  MapPin,
  IndianRupee,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react';
import { suggestForDaySlot, buildUsedIdSet } from '../../services/resourceMatchingService.js';
import { useProposalStore } from '../../store/proposalStore.js';

const SLOT_META = {
  hotel: {
    icon: Hotel,
    label: 'Hotel',
    emptyText: 'No hotel assigned',
    color: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  activity: {
    icon: Ticket,
    label: 'Activity',
    emptyText: 'No activities',
    color: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  flight: {
    icon: Plane,
    label: 'Flight',
    emptyText: 'No flights',
    color: 'sky',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700',
  },
};

export default function DaySlotSuggestions({ dayNumber, slotType, onAdd }) {
  const { client, proposal } = useProposalStore();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const meta = SLOT_META[slotType];
  const Icon = meta.icon;

  const usedIds = useMemo(() => buildUsedIdSet(proposal?.days || []), [proposal?.days]);

  const loadSuggestions = async () => {
    if (!client.destination) return;
    setLoading(true);
    try {
      const results = await suggestForDaySlot({
        slotType,
        dayNumber,
        destination: client.destination,
        budgetPerHead: client.budget,
        travelers: (client.num_adults || 0) + (client.num_children || 0),
        durationDays: client.duration_days,
        travelStyle: client.pace,
        usedIds,
      });
      setSuggestions(results.slice(0, 5));
    } catch (e) {
      console.warn('Suggestion load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when slot is empty and user hovers or after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      const day = proposal?.days?.find((d) => d.day_number === dayNumber);
      const slotArray = day?.[slotType === 'hotel' ? 'hotels' : slotType === 'activity' ? 'activities' : 'flights'] || [];
      if (slotArray.length === 0 && client.destination) {
        loadSuggestions();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dayNumber, slotType, client.destination, client.budget, proposal?.days]);

  const handleAdd = (item) => {
    onAdd(dayNumber, slotType, item);
    setSuggestions((prev) => prev.filter((s) => s.id !== item.id));
    setExpanded(false);
  };

  const day = proposal?.days?.find((d) => d.day_number === dayNumber);
  const slotArray = day?.[slotType === 'hotel' ? 'hotels' : slotType === 'activity' ? 'activities' : 'flights'] || [];
  const isEmpty = slotArray.length === 0;

  if (!isEmpty) return null; // Don't show suggestions if slot already filled

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-3 transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${meta.text}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${meta.text}`}>
            {meta.label} Suggestions
          </span>
          {suggestions.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${meta.badge}`}>
              {suggestions.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`text-xs font-medium flex items-center gap-0.5 hover:underline ${meta.text}`}
        >
          {expanded ? 'Collapse' : 'Browse'}
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {loading && !expanded && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
          <Sparkles className="w-3 h-3 animate-pulse" />
          Finding {meta.label.toLowerCase()}s in your vault…
        </div>
      )}

      {!loading && suggestions.length === 0 && !expanded && (
        <p className="text-xs text-gray-400 py-1">
          No matching {meta.label.toLowerCase()}s found.{' '}
          <span className="underline cursor-pointer" onClick={loadSuggestions}>Retry</span>
        </p>
      )}

      {/* Collapsed: top 2 chips */}
      {!expanded && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 2).map((item) => (
            <button
              key={item.id}
              onClick={() => handleAdd(item)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-gray-400 hover:shadow-sm transition-all group"
              title={`Match score: ${item._suggestionScore}%`}
            >
              <Plus className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
              <span className="truncate max-w-[120px]">{item.name}</span>
              {item.price_per_night !== undefined && (
                <span className={`text-[10px] font-bold ${meta.text}`}>₹{item.price_per_night}</span>
              )}
              {item.price !== undefined && (
                <span className={`text-[10px] font-bold ${meta.text}`}>₹{item.price}</span>
              )}
              {item.cost !== undefined && (
                <span className={`text-[10px] font-bold ${meta.text}`}>₹{item.cost}</span>
              )}
            </button>
          ))}
          {suggestions.length > 2 && (
            <button
              onClick={() => setExpanded(true)}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              +{suggestions.length - 2} more
            </button>
          )}
        </div>
      )}

      {/* Expanded: full cards */}
      {expanded && (
        <div className="space-y-2 mt-2">
          {suggestions.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-all"
            >
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />
              ) : (
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100`}>
                  <Icon className={`w-4 h-4 ${meta.text}`} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {item._suggestionScore >= 80 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">
                      {item._suggestionScore}% match
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{item.location || item.origin || '—'}</span>
                  {item.rating && (
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      {item.rating}
                    </span>
                  )}
                  {(item.price_per_night || item.price || item.cost) && (
                    <span className="flex items-center gap-0.5 font-medium text-gray-700">
                      <IndianRupee className="w-3 h-3" />
                      {item.price_per_night || item.price || item.cost}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleAdd(item)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-${meta.color}-600 hover:bg-${meta.color}-700 transition-colors shrink-0`}
                style={{
                  backgroundColor:
                    meta.color === 'amber' ? '#d97706' :
                    meta.color === 'emerald' ? '#059669' :
                    meta.color === 'sky' ? '#0284c7' : '#4b5563'
                }}
              >
                Add
              </button>
            </div>
          ))}
          <button
            onClick={() => setExpanded(false)}
            className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
          >
            <X className="w-3 h-3" /> Close
          </button>
        </div>
      )}
    </div>
  );
}
