import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { villageService } from '../../services/firebaseService';
import {
  Button,
  SearchField,
  TextField,
  ListSection,
  ListRow,
  Badge,
  EmptyState,
  Skeleton,
  Sheet,
  Alert,
  useToast
} from '../../ui';
import {
  normaliseVillageName,
  normaliseVillageCode,
  suggestVillageCode,
  sameText
} from '../../services/textService';
import { MapPinIcon, PlusIcon } from '../Common/Icons';
import './SettingsPage.css';

/* =============================================================================
   Villages — pushed from /settings.

   Codes are the short forms that go on paperwork, so they are a first-class
   field here: shown as a monospaced badge on every row, suggested from the name,
   and unique. Trips still store village *names*, so nothing had to be migrated;
   the code is resolved for display from this list.

   Names are stored Title Cased and matched case-insensitively. Before that,
   "bagalkot" and "Bagalkot" were two villages and both showed up in the picker.
   ========================================================================== */

const VillagesPage = () => {
  const toast = useToast();

  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setVillages((await villageService.getAllVillages(true)) || []);
    } catch (error) {
      console.error('Error loading villages:', error);
      toast.error('Could not load villages');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => villages.filter((item) => item.isActive !== false), [villages]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return active;
    return active.filter((item) =>
      `${item.villageName || ''} ${item.code || ''}`.toLowerCase().includes(term)
    );
  }, [active, query]);

  const openNew = () => {
    setErrors({});
    setDraft({ villageName: '', code: '', codeTouched: false });
  };

  const openEdit = (village) => {
    setErrors({});
    setDraft({
      id: village.id,
      villageName: village.villageName || '',
      code: village.code || '',
      codeTouched: true
    });
  };

  const setField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  };

  /* The code follows the name until the user edits it, then it stops moving.
     Auto-filling forever would fight anyone entering a local code that does not
     match the spelling, which is common. */
  const onNameChange = (raw) => {
    setDraft((prev) => {
      const villageName = raw;
      const code = prev.codeTouched
        ? prev.code
        : suggestVillageCode(
            villageName,
            villages.filter((item) => item.id !== prev.id).map((item) => item.code)
          );
      return { ...prev, villageName, code };
    });
    setErrors((prev) => (prev.villageName ? { ...prev, villageName: null } : prev));
  };

  const save = async () => {
    const villageName = normaliseVillageName(draft.villageName);
    const code = normaliseVillageCode(draft.code);
    const others = villages.filter((item) => item.id !== draft.id);
    const next = {};

    if (!villageName) next.villageName = 'Village name is required';
    else if (others.some((item) => sameText(item.villageName, villageName)))
      next.villageName = 'That village is already on record';

    if (code && others.some((item) => sameText(item.code, code)))
      next.code = 'That code is already used';

    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      if (draft.id) {
        await villageService.updateVillage(draft.id, { villageName, code });
        toast.success(`${villageName} updated`);
      } else {
        await villageService.addVillage({ villageName, code, isActive: true, usageCount: 0 });
        toast.success(`${villageName} added`);
      }

      setDraft(null);
      await load();
    } catch (error) {
      console.error('Error saving village:', error);
      toast.error(error?.message || 'Could not save the village');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const village = pendingDelete;
    if (!village) return;

    try {
      await villageService.deleteVillage(village.id);
      toast.success(`${village.villageName} removed`);
      await load();
    } catch (error) {
      console.error('Error removing village:', error);
      toast.error(error?.message || 'Could not remove the village');
    } finally {
      setPendingDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="fleet">
        <div className="set__skeleton">
          <Skeleton height={40} radius="var(--r-capsule)" />
          <Skeleton height={200} radius="var(--r-lg)" />
        </div>
      </div>
    );
  }

  return (
    <div className="fleet">
      <div className="fleet__toolbar">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Village or code"
        />
      </div>

      {visible.length === 0 ? (
        <ListSection inset={false}>
          <EmptyState
            icon={<MapPinIcon size={26} />}
            title={query ? 'No matches' : 'No villages yet'}
            message={
              query
                ? `Nothing matched “${query.trim()}”.`
                : 'Villages are also created as you type them into a trip.'
            }
            action={
              query ? (
                <Button variant="tinted" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button variant="tinted" onClick={openNew}>
                  Add Village
                </Button>
              )
            }
          />
        </ListSection>
      ) : (
        <ListSection
          inset={false}
          className="stg26"
          header={`${visible.length} ${visible.length === 1 ? 'village' : 'villages'}`}
          footer="Ordered by how often each is used, so the busiest are easiest to find."
        >
          {visible.map((village) => (
            <ListRow
              key={village.id}
              icon={<MapPinIcon size={17} />}
              iconTone="accent"
              title={village.villageName}
              subtitle={`Used ${village.usageCount || 0}×`}
              badge={
                village.code ? (
                  <Badge tone="neutral" className="fleet__code">
                    {village.code}
                  </Badge>
                ) : null
              }
              chevron
              onClick={() => openEdit(village)}
            />
          ))}
        </ListSection>
      )}

      <ListSection inset={false}>
        <ListRow
          className="set__add-row"
          icon={<PlusIcon size={17} />}
          iconTone="accent"
          title="Add Village"
          onClick={openNew}
        />
      </ListSection>

      <Sheet
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit village' : 'New village'}
        secondaryAction={
          <Button variant="plain" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        }
        primaryAction={
          <Button variant="plain" loading={saving} onClick={save}>
            Save
          </Button>
        }
      >
        {draft && (
          <ListSection
            inset={false}
            footer={
              errors.villageName ||
              errors.code ||
              'The code is suggested from the name. Edit it to match your paperwork.'
            }
          >
            <ListRow>
              <TextField
                label="Name"
                layout="row"
                value={draft.villageName}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Village name"
                autoCapitalize="words"
                error={errors.villageName}
                data-autofocus
              />
            </ListRow>
            <ListRow>
              <TextField
                label="Code"
                layout="row"
                value={draft.code}
                onChange={(event) => {
                  setField('code', normaliseVillageCode(event.target.value));
                  setDraft((prev) => ({ ...prev, codeTouched: true }));
                }}
                placeholder="e.g. BGK"
                autoCapitalize="characters"
                error={errors.code}
              />
            </ListRow>
          </ListSection>
        )}

        {draft?.id && (
          <ListSection inset={false}>
            <ListRow
              title="Remove village"
              destructive
              onClick={() => setPendingDelete({ id: draft.id, villageName: draft.villageName })}
            />
          </ListSection>
        )}
      </Sheet>

      <Alert
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove this village?"
        message={`${pendingDelete?.villageName} will stop appearing in the trip form. Existing trips keep it.`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default VillagesPage;
