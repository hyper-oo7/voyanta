import { useProposalStore } from '../../store/proposalStore.js';
import DaySlotSuggestions from './DaySlotSuggestions.jsx';

export default function DayCard({ day }) {
  const { addVaultHotelToDay, addVaultActivityToDay, addVaultFlightToDay } = useProposalStore();

  const handleAddVaultItem = (dayNumber, slotType, item) => {
    if (slotType === 'hotel') addVaultHotelToDay(dayNumber, item);
    if (slotType === 'activity') addVaultActivityToDay(dayNumber, item);
    if (slotType === 'flight') addVaultFlightToDay(dayNumber, item);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      {/* Day Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          Day {day.day_number}: {day.title}
        </h3>
        <span className="text-sm font-medium text-gray-500">₹{day.day_total?.toLocaleString() || 0}</span>
      </div>

      <p className="text-sm text-gray-600 mb-4">{day.description}</p>

      {/* Hotels */}
      <div className="mb-3">
        {day.hotels?.map((h) => (
          <div key={h.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg mb-2">
            <span className="text-sm font-medium text-gray-900">{h.name}</span>
            <span className="text-xs text-gray-500">₹{h.price_per_night}/night • {h.meal_plan}</span>
          </div>
        ))}
        <DaySlotSuggestions
          dayNumber={day.day_number}
          slotType="hotel"
          onAdd={handleAddVaultItem}
        />
      </div>

      {/* Activities */}
      <div className="mb-3">
        {day.activities?.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg mb-2">
            <span className="text-sm font-medium text-gray-900">{a.name}</span>
            <span className="text-xs text-gray-500">{a.duration} • ₹{a.price}</span>
          </div>
        ))}
        <DaySlotSuggestions
          dayNumber={day.day_number}
          slotType="activity"
          onAdd={handleAddVaultItem}
        />
      </div>

      {/* Flights */}
      <div>
        {day.flights?.map((f) => (
          <div key={f.id} className="flex items-center gap-3 p-3 bg-sky-50 border border-sky-100 rounded-lg mb-2">
            <span className="text-sm font-medium text-gray-900">{f.airline} {f.flight_no}</span>
            <span className="text-xs text-gray-500">{f.origin}→{f.destination} • ₹{f.cost}</span>
          </div>
        ))}
        <DaySlotSuggestions
          dayNumber={day.day_number}
          slotType="flight"
          onAdd={handleAddVaultItem}
        />
      </div>
    </div>
  );
}
