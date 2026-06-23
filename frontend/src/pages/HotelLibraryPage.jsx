import ResourceModulePage from '../components/ResourceModulePage.jsx';
import { hotelsService } from '../services/resourceService.js';

export default function HotelLibraryPage() {
  return <ResourceModulePage
    resource="hotels" service={hotelsService}
    title="Hotels" subtitle="Imported supplier inventory."
    sidebarLabel="Hotels" itemKind="hotel"
    toLabel={(r) => r.name} toUnitPrice={(r) => Number(r.price_per_night || 0)}
  />;
}
