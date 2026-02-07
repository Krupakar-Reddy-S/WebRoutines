import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { normalizeRoutineUrl } from '@/lib/routines';
import { getDisplayUrl } from '@/lib/url';

interface TabOption {
  id: number;
  url: string;
  title: string;
  display: string;
  checked: boolean;
  disabled: boolean;
  reason?: string;
}

interface ImportFromTabsDialogProps {
  open: boolean;
  existingUrls: string[];
  onOpenChange: (open: boolean) => void;
  onAddUrls: (urls: string[]) => Promise<void>;
}

export function ImportFromTabsDialog({
  open,
  existingUrls,
  onOpenChange,
  onAddUrls,
}: ImportFromTabsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [tabOptions, setTabOptions] = useState<TabOption[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    const existingSet = new Set(existingUrls);

    async function loadTabs() {
      setLoading(true);

      try {
        const tabs = await browser.tabs.query({ currentWindow: true });
        const options: TabOption[] = [];

        for (const tab of tabs) {
          const rawUrl = typeof tab.url === 'string' ? tab.url : '';
          const normalizedUrl = normalizeRoutineUrl(rawUrl);

          if (!normalizedUrl) {
            continue;
          }

          const disabled = existingSet.has(normalizedUrl);
          options.push({
            id: typeof tab.id === 'number' ? tab.id : Math.floor(Math.random() * 1_000_000),
            url: normalizedUrl,
            title: tab.title ?? 'Untitled tab',
            display: getDisplayUrl(normalizedUrl),
            checked: !disabled,
            disabled,
            reason: disabled ? 'Already in routine' : undefined,
          });
        }

        if (active) {
          setTabOptions(options);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTabs();

    return () => {
      active = false;
    };
  }, [existingUrls, open]);

  const selectedUrls = useMemo(
    () => tabOptions.filter((tab) => tab.checked && !tab.disabled).map((tab) => tab.url),
    [tabOptions],
  );

  function toggleTab(id: number) {
    setTabOptions((previous) => previous.map((tab) => {
      if (tab.id !== id || tab.disabled) {
        return tab;
      }

      return {
        ...tab,
        checked: !tab.checked,
      };
    }));
  }

  async function onConfirm() {
    setBusy(true);

    try {
      if (selectedUrls.length > 0) {
        await onAddUrls(selectedUrls);
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[22rem]" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Import from open tabs</DialogTitle>
          <DialogDescription>
            Select which currently open tabs should be added to this routine.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1.5 overflow-auto">
          {loading && <p className="text-sm text-muted-foreground">Loading tabs...</p>}
          {!loading && tabOptions.length === 0 && (
            <p className="text-sm text-muted-foreground">No eligible tabs found.</p>
          )}

          {tabOptions.map((tab) => (
            <label
              key={tab.id}
              className={`flex items-start gap-2 rounded-lg border border-border/70 px-2 py-1.5 text-xs ${
                tab.disabled ? 'opacity-60' : 'cursor-pointer'
              }`}
            >
              <Checkbox
                checked={tab.checked}
                disabled={tab.disabled}
                onCheckedChange={() => toggleTab(tab.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{tab.display}</span>
                <span className="text-muted-foreground block truncate">
                  {tab.title}
                  {tab.reason ? ` • ${tab.reason}` : ''}
                </span>
              </span>
            </label>
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className="flex-1"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="flex-1" disabled={busy} onClick={() => void onConfirm()}>
            {selectedUrls.length > 0 ? `Add ${selectedUrls.length} selected` : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
