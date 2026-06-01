import Dashboard from './Dashboard';
import { MobileHome } from '@/components/home/MobileHome';

const Index = () => {
  return (
    <>
      {/* Mobile-only home with section shortcuts */}
      <div className="md:hidden">
        <MobileHome />
      </div>
      {/* Desktop / tablet keep the full Dashboard */}
      <div className="hidden md:block">
        <Dashboard />
      </div>
    </>
  );
};

export default Index;
