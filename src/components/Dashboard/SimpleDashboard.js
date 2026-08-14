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
  GlassSurface,
  BarChart
} from '../../ui';
import {
  TruckIcon,
  WalletIcon,
  DocCheckIcon,
  DocAlertIcon,
  CardIcon,
  TrendUpIcon
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
  avgAdvancePerTrip: 0,
  month: { label: '', advance: 0, trips: 0, deltaPct: null, series: [] }
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
        <div className="qa stg26">
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
            <ListSection inset={false} className="stg26">
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

      {/* --------------------------- This month + stats --------------------------- */}
      {/* Replaces a "Save on Diesel Expenses — 4% Cashback" promo that was pure
          invention: no such feature exists, nothing was ever redeemable, and it
          took the most prominent slot on the screen. What belongs there is the
          number the business actually runs on.

          It summarises rather than analyses, and taps through to Reports for the
          detail — the widget contract. The sparkline is a trend platter: shape
          only, no axes, because this is a preview of the real chart. */}
      <section className="home-grid">
        <Card padded={false} inset={false} className="month">
          <button
            type="button"
            className="month__hit"
            onClick={() => navigate('/reports?range=month')}
            aria-label={`${summary.month.label}: ${formatINR(summary.month.advance)} advanced across ${
              summary.month.trips
            } trips. Open reports.`}
          >
            <span className="month__head">
              <span className="month__label">{summary.month.label}</span>
              {summary.month.deltaPct !== null && (
                <Badge tone={summary.month.deltaPct >= 0 ? 'success' : 'danger'}>
                  {summary.month.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(summary.month.deltaPct)}%
                </Badge>
              )}
            </span>

            <span className="month__value">{formatCompactINR(summary.month.advance)}</span>
            <span className="month__caption">
              advanced · {summary.month.trips} {summary.month.trips === 1 ? 'trip' : 'trips'}
            </span>

            <span className="month__spark">
              <BarChart
                compact
                height={34}
                points={summary.month.series}
                ariaLabel="Advance over the last seven days"
              />
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
