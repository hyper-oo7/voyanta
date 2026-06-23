import ResourceModulePage from '../components/ResourceModulePage.jsx';
import { templatesService } from '../services/resourceService.js';

export default function TemplatesPage() {
  return <ResourceModulePage
    resource="templates" service={templatesService}
    title="Templates" subtitle="Reusable proposal blueprints."
    sidebarLabel="Templates" itemKind="custom"
    toLabel={(r) => r.name} toUnitPrice={(r) => Number(r.price_from || 0)}
  />;
}
