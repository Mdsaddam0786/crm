import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Card, EmptyState } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <Card>
      <EmptyState icon={Compass} title="Page not found" message="The page you're looking for doesn't exist." action={<Link to="/" className="btn-primary">Go to dashboard</Link>} />
    </Card>
  );
}
