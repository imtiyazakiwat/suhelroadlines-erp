import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeService, formatCompactINR, formatINR } from '../../services/homeService';
import {
  Card,
  SectionHeader,
  ListSection,
  ListRow,
  Badge,
  Stat,
  EmptyState,
  Skeleton,
  Button,
  GlassSurface
} from '../../ui';
import {
  TruckIcon,
  WalletIcon,
  DocCheckIcon,
  DocAlertIcon,
  CardIcon,
  TrendUpIcon,
  FuelIcon
} from '../Common/Icons';
import './Dashboard.css';

const EMPTY_SUMMARY = {
  todayTrips: 0,
  advanceToday: 0,
  paidStrCount: 0,
  dueStrCount: 0,
  vehicles: { total: 0, active: 0, inTransit: 0, inactive: 0 },
  reminders: [],
  totalSettlement: 0,
  avgAdvancePerTrip: 0
};

const SimpleDashboard = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await Promise.race([
        homeService.getHomeSummary(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000))
      ]);
      setSummary(data);
    } catch (error) {
      console.warn('Home summary unavailable:', error.message);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const quickActions = [
    {
      key: 'today',
      label: 'Today',
      sublabel: 'Trips',
      Icon: TruckIcon,
      badge: summary.todayTrips,
      to: '/reports?range=today&tab=trips'
    },
    { key: 'advance', label: 'Advance', Icon: WalletIcon, to: '/add-advance' },
    { key: 'paid', label: 'Paid', sublabel: 'STR', Icon: DocCheckIcon, to: '/str-status?filter=paid' },
    {
      key: 'due',
      label: 'Due',
      sublabel: 'STR',
      Icon: DocAlertIcon,
      badge: summary.dueStrCount,
      to: '/str-status?filter=due'
    }
  ];

  const shortcuts = [
    { key: 'advance', label: 'Add Advance', to: '/add-advance' },
    { key: 'export', label: 'Export CSV', to: '/reports?tab=trips' },
    { key: 'fleet', label: 'Vehicles & Villages', to: '/settings' }
  ];

  if (loading) {
    return (
      <div className="home">
        <div className="home-skeleton">
          <Skeleton height={92} radius="var(--r-lg)" />
          <Skeleton height={128} radius="var(--r-lg)" />
          <Skeleton height={240} radius="var(--r-lg)" />
          <Skeleton height={120} radius="var(--r-lg)" />
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      {/* ------------------------------- Quick actions ------------------------------- */}
      <section className="home-block">
        <h2 className="home-block__title">Quick Actions</h2>
        <div className="qa">
          {quickActions.map(({ key, label, sublabel, Icon, badge, to }) => (
            <button type="button" key={key} className="qa__tile" onClick={() => navigate(to)}>
              <GlassSurface variant="regular" capsule className="qa__disc">
                <Icon size={25} />
                {badge > 0 && <span className="qa__badge">{badge > 99 ? '99+' : badge}</span>}
              </GlassSurface>
              <span className="qa__label">
                <span>{label}</span>
                {sublabel && <span>{sublabel}</span>}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ------------------------------- Fleet summary ------------------------------- */}
      <Card className="home-card">
        <SectionHeader title="Total Vehicles" onAction={() => navigate('/settings')} />

        <div className="fleet">
          <span className="fleet__icon">
            <TruckIcon size={28} />
          </span>

          <div className="fleet__count">
            <span className="fleet__value">{summary.vehicles.total}</span>
            <span className="fleet__caption">Total Vehicles</span>
          </div>

          <div className="fleet__stats">
            <Stat value={summary.vehicles.active} label="Active" tone="success" dot />
            <Stat value={summary.vehicles.inTransit} label="In Transit" tone="accent" dot />
            <Stat value={summary.vehicles.inactive} label="Inactive" tone="neutral" dot />
          </div>
        </div>
      </Card>

      {/* --------------------------------- Reminders --------------------------------- */}
      <section className="home-block">
        <SectionHeader
          title="Reminders"
          onAction={() => navigate('/str-status?filter=due')}
          className="home-block__header"
        />

        {summary.reminders.length > 0 ? (
          <>
            <ListSection inset={false}>
              {summary.reminders.map((reminder) => (
                <ListRow
                  key={reminder.id}
                  icon={<DocAlertIcon size={17} />}
                  iconTone="danger"
                  title={reminder.title}
                  subtitle={reminder.vehicleNumber}
                  detail={`${formatCompactINR(reminder.amount)} Due STR`}
                  value={reminder.dayLabel}
                  chevron
                  onClick={() => navigate('/str-status?filter=due')}
                />
              ))}
            </ListSection>

            <Button
              variant="plain"
              block
              className="home-block__footer-link"
              onClick={() => navigate('/str-status?filter=due')}
            >
              View All Due STR Alerts
            </Button>
          </>
        ) : (
          <Card padded={false} inset={false}>
            <EmptyState
              icon={<DocCheckIcon size={26} />}
              title="All caught up"
              message="Every STR is marked received."
            />
          </Card>
        )}
      </section>

      {/* ------------------------------ Promo + stats ------------------------------ */}
      <section className="home-grid">
        <Card padded={false} inset={false} className="promo">
          <button type="button" className="promo__hit" onClick={() => navigate('/add-advance')}>
            <span className="promo__icon">
              <FuelIcon size={24} />
              <span className="promo__icon-badge">₹</span>
            </span>
            <span className="promo__title">Save on Diesel Expenses</span>
            <Badge tone="success">Get 4% Cashback</Badge>
            <span className="promo__art" aria-hidden="true">
              <TruckIcon size={74} />
            </span>
          </button>
        </Card>

        <div className="home-grid__stack">
          <ListSection inset={false}>
            <ListRow
              icon={<CardIcon size={17} />}
              iconTone="accent"
              title={formatCompactINR(summary.totalSettlement)}
              subtitle="Total Settlement"
              chevron
              onClick={() => navigate('/reports')}
              className="mini-row"
            />
          </ListSection>

          <ListSection inset={false}>
            <ListRow
              icon={<TrendUpIcon size={17} />}
              iconTone="brand"
              title={`Avg ${
                summary.avgAdvancePerTrip >= 100000
                  ? formatCompactINR(summary.avgAdvancePerTrip)
                  : formatINR(summary.avgAdvancePerTrip)
              }`}
              subtitle="Per Trip Advance"
              chevron
              onClick={() => navigate('/reports')}
              className="mini-row"
            />
          </ListSection>
        </div>
      </section>

      {/* --------------------------------- Shortcuts --------------------------------- */}
      <div className="shortcuts">
        {shortcuts.map(({ key, label, to }) => (
          <Button key={key} variant="glass" size="sm" capsule onClick={() => navigate(to)}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default SimpleDashboard;
