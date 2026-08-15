import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService } from '../../services/firebaseService';
import { formatINR, relativeDayLabel, isStrReceived, toDate } from '../../services/homeService';
import { formatVehicleNumber } from '../../services/textService';
import { Sheet, ListSection, ListRow, EmptyState, Button, Skeleton } from '../../ui';
import { DocAlertIcon, DocCheckIcon } from './Icons';
import './NotificationsSheet.css';

/**
 * Every trip whose STR is still outstanding. Sheet-based, so it portals to
 * <body> and layers above the tab bar.
 */
const NotificationsSheet = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [dueTrips, setDueTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoading(true);

    tripService
      .getAllTrips()
      .then((trips) => {
        if (cancelled) return;
        setDueTrips(
          (trips || [])
            .filter((trip) => !isStrReceived(trip))
            .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0))
        );
      })
      .catch(() => setDueTrips([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const totalDue = dueTrips.reduce((sum, trip) => sum + (Number(trip.advanceAmount) || 0), 0);

  const go = (path) => {
    onClose();
    navigate(path);
  };

  const subtitle = loading
    ? 'Loading…'
    : dueTrips.length
    ? `${dueTrips.length} STR pending · ${formatINR(totalDue)} advance`
    : 'Nothing needs attention';

  return (
    <Sheet open={open} onClose={onClose} title="Notifications" subtitle={subtitle} detent="medium">
      {loading && (
        <div className="notif-sheet__skeleton">
          <Skeleton height={58} radius="var(--r-lg)" />
          <Skeleton height={58} radius="var(--r-lg)" />
          <Skeleton height={58} radius="var(--r-lg)" />
        </div>
      )}

      {!loading && dueTrips.length === 0 && (
        <EmptyState
          icon={<DocCheckIcon size={26} />}
          title="All caught up"
          message="Every STR is marked received."
        />
      )}

      {!loading && dueTrips.length > 0 && (
        <>
          <ListSection inset={false}>
            {dueTrips.map((trip) => (
              <ListRow
                key={trip.id}
                icon={<DocAlertIcon size={17} />}
                iconTone="danger"
                title={trip.driverName || formatVehicleNumber(trip.vehicleNumber)}
                subtitle={formatVehicleNumber(trip.vehicleNumber)}
                detail={`${formatINR(trip.advanceAmount || 0)} Due STR`}
                value={relativeDayLabel(trip.date)}
                chevron
                onClick={() => go('/str-status?filter=due')}
              />
            ))}
          </ListSection>

          <div className="notif-sheet__footer">
            <Button variant="filled" block onClick={() => go('/str-status?filter=due')}>
              Open Due STR
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
};

export default NotificationsSheet;
