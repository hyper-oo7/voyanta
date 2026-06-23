import ResourceModulePage from '../components/ResourceModulePage.jsx';
import { activitiesService } from '../services/resourceService.js';

export default function AssetsLibraryPage() {
  return <ResourceModulePage
    resource="activities" service={activitiesService}
    title="Activities" subtitle="Imported supplier experiences."
    sidebarLabel="Activities" itemKind="activity"
    toLabel={(r) => r.name} toUnitPrice={(r) => Number(r.price || 0)}
  />;
}
