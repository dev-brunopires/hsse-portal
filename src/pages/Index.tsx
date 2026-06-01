import Dashboard from './Dashboard';
import { MobileHome } from '@/components/home/MobileHome';

const Index = () => {
  return (
    <>
      {/* Mobile & tablet home with section shortcuts */}
      <div className="lg:hidden">
        <MobileHome />
      </div>
      {/* Desktop keeps the full Dashboard */}
      <div className="hidden lg:block">
        <Dashboard />
      </div>
    </>
  );
};

export default Index;
