import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavBar, NavButton, NavSearchButton, BackButton, TabBar, DockButton } from '../../ui/chrome';
import Button from '../../ui/Button';
import AppMark from '../../ui/brand/AppMark';
import { EditSessionContext } from './editSession';
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
  '/str-status': 'STR Status',
  '/settings': 'Settings',
  '/settings/vehicles': 'Vehicles',
  '/settings/villages': 'Villages',
  '/settings/data': 'Data'
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

  const [editSession, setEditSession] = useState(null);
  const editCtx = React.useMemo(() => setEditSession, []);
  const editing = Boolean(editSession);

  const path = location.pathname;
  const isHome = path === '/';
  const isTabRoot = TABS.some((tab) => tab.value === path);
  const isAddTrip = path === '/add-entry';

  // Direct scroll listener — no hook, no ref, no guessing which element
  // scrolls. Checks both .app-content and window so it works regardless
  // of the CSS layout.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const THRESHOLD = 6;

    const read = () => {
      frame = 0;
      // Whatever actually scrolls — the window, the documentElement, or the
      // content column — the max of all of them can't miss it. Using only
      // one source was the bug: .app-content has overflow-x:clip so its
      // scrollTop is always 0, which masked window scroll.
      const contentEl = document.querySelector('.app-content');
      const y = Math.max(
        window.scrollY || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0,
        contentEl ? contentEl.scrollTop : 0
      );
      setScrolled(y > THRESHOLD);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.body.addEventListener('scroll', onScroll, { passive: true });
    const contentEl = document.querySelector('.app-content');
    if (contentEl) contentEl.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.body.removeEventListener('scroll', onScroll);
      if (contentEl) contentEl.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

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

  // After scrolling on home, switch to compact NavBar: no logo, no large
  // title, empty title — same shape as other pages.
  const showLargeTitle = isHome && !editing && !scrolled;
  const showLogo = isHome && !editing && !scrolled;

  return (
    <div className="app-shell">
      <NavBar
        title={showLargeTitle ? 'Suhel Roadlines' : (TITLES[path] || 'Suhel Roadlines')}
        subtitle={editSession?.status || null}
        largeTitle={showLargeTitle}
        transparent
        leading={
          editing ? (
            <Button variant="plain" size="sm" onClick={editSession.onCancel}>
              {editSession.cancelLabel || 'Cancel'}
            </Button>
          ) : showLogo ? (
            <AppMark size={34} className="brand-avatar" />
          ) : isTabRoot ? null : (
            <BackButton onClick={() => navigate(-1)} />
          )
        }
        trailing={
          editing ? (
            <Button
              variant="filled"
              size="sm"
              capsule
              loading={editSession.busy}
              disabled={editSession.disabled}
              onClick={editSession.onCommit}
            >
              {editSession.commitLabel || 'Save'}
            </Button>
          ) : (
            <>
              <NavSearchButton
                placeholder="Search trips"
                home={isHome && !scrolled}
                onClick={() => setSearchOpen(true)}
              />
              <NavButton
                label={dueCount > 0 ? `Notifications, ${dueCount} pending` : 'Notifications'}
                badge={dueCount > 0}
                onClick={() => setNotificationsOpen(true)}
              >
                <BellIcon size={21} />
              </NavButton>
            </>
          )
        }
      />

      <main className="app-content">
        <EditSessionContext.Provider value={editCtx}>
          {children}
        </EditSessionContext.Provider>
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
