import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavBar, NavButton, NavSearchButton, BackButton, TabBar, DockButton } from '../../ui/chrome';
import SearchOverlay from '../Common/SearchOverlay';
import NotificationsSheet from '../Common/NotificationsSheet';
import { tripService } from '../../services/firebaseService';
import { isStrReceived } from '../../services/homeService';
import {
  HomeIcon,
  ClipboardCheckIcon,
  ChartIcon,
  GearIcon,
  TruckIcon,
  BellIcon
} from '../Common/Icons';
import './AppLayout.css';

const TITLES = {
  '/': 'Suhel Roadlines',
  '/add-entry': 'Add Trip',
  '/add-advance': 'Add Advance',
  '/reports': 'Reports',
  '/str-status': 'Paid STR',
  '/settings': 'Settings'
};

const TABS = [
  { value: '/', label: 'Home', icon: ({ selected }) => <HomeIcon size={23} filled={selected} /> },
  { value: '/str-status', label: 'STR', icon: <ClipboardCheckIcon size={23} /> },
  { value: '/reports', label: 'Reports', icon: <ChartIcon size={23} /> },
  { value: '/settings', label: 'Settings', icon: <GearIcon size={23} /> }
];

const AppLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  const path = location.pathname;
  const isHome = path === '/';
  const isTabRoot = TABS.some((tab) => tab.value === path);
  const isAddTrip = path === '/add-entry';

  useEffect(() => {
    let cancelled = false;
    tripService
      .getAllTrips()
      .then((trips) => {
        if (!cancelled) setDueCount((trips || []).filter((trip) => !isStrReceived(trip)).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);

  const tabs = TABS.map((tab) =>
    tab.value === '/str-status' ? { ...tab, badge: dueCount } : tab
  );

  return (
    <div className="app-shell">
      <NavBar
        title={TITLES[path] || 'Suhel Roadlines'}
        largeTitle={isHome}
        transparent
        leading={
          isTabRoot ? (
            isHome ? (
              <span className="brand-avatar" aria-hidden="true">
                SR
              </span>
            ) : null
          ) : (
            <BackButton onClick={() => navigate(-1)} />
          )
        }
        trailing={
          <>
            <NavSearchButton placeholder="Search trips" onClick={() => setSearchOpen(true)} />
            <NavButton
              label={dueCount > 0 ? `Notifications, ${dueCount} pending` : 'Notifications'}
              badge={dueCount > 0}
              onClick={() => setNotificationsOpen(true)}
            >
              <BellIcon size={21} />
            </NavButton>
          </>
        }
      />

      <main className="app-content" key={path}>
        {children}
      </main>

      <TabBar
        tabs={tabs}
        value={isTabRoot ? path : null}
        onChange={(next) => navigate(next)}
        trailing={
          <DockButton
            label="Add trip"
            tone="solid"
            active={isAddTrip}
            onClick={() => navigate('/add-entry')}
          >
            <TruckIcon size={25} />
          </DockButton>
        }
      />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsSheet open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
};

export default AppLayout;
