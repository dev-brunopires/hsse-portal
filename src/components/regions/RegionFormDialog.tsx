import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe2, Loader2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COUNTRIES, getCountryName } from '@/data/countries';
import {
  useCreateRegion,
  useAssignRegionShips,
  useUpdateRegion,
  type Region,
} from '@/hooks/useRegions';
import { useShips } from '@/hooks/useShips';

interface RegionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region?: Region | null;
}

export function RegionFormDialog({ open, onOpenChange, region }: RegionFormDialogProps) {
  const { t } = useTranslation();
  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion();
  const assignRegionShips = useAssignRegionShips();
  const { data: ships = [] } = useShips();
  const isEditing = !!region;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [shipSearch, setShipSearch] = useState('');
  const [selectedShipIds, setSelectedShipIds] = useState<string[]>([]);

  useEffect(() => {
    if (region) {
      setName(region.name);
      setDescription(region.description || '');
      setCountries(region.countries || []);
      setSelectedShipIds(ships.filter((ship) => ship.region_id === region.id).map((ship) => ship.id));
    } else {
      setName('');
      setDescription('');
      setCountries([]);
      setSearch('');
      setShipSearch('');
      setSelectedShipIds([]);
    }
  }, [region, open, ships]);

  const filteredCountries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return COUNTRIES;
    return COUNTRIES.filter((country) =>
      country.name.toLowerCase().includes(term) || country.code.toLowerCase().includes(term),
    );
  }, [search]);

  const filteredShips = useMemo(() => {
    const term = shipSearch.trim().toLowerCase();
    if (!term) return ships;
    return ships.filter((ship) =>
      ship.name.toLowerCase().includes(term) || ship.code?.toLowerCase().includes(term),
    );
  }, [shipSearch, ships]);

  const toggleCountry = (code: string) => {
    setCountries((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  };

  const toggleShip = (shipId: string) => {
    setSelectedShipIds((prev) =>
      prev.includes(shipId) ? prev.filter((item) => item !== shipId) : [...prev, shipId],
    );
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || countries.length === 0) return;

    let savedRegion: Region;
    if (isEditing && region) {
      savedRegion = await updateRegion.mutateAsync({
        id: region.id,
        name: trimmedName,
        countries,
        description,
      });
    } else {
      savedRegion = await createRegion.mutateAsync({
        name: trimmedName,
        countries,
        description,
      });
    }

    await assignRegionShips.mutateAsync({
      regionId: savedRegion.id,
      shipIds: selectedShipIds,
    });
    onOpenChange(false);
  };

  const isSubmitting = createRegion.isPending || updateRegion.isPending || assignRegionShips.isPending;
  const canSubmit = name.trim().length >= 2 && countries.length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-primary" />
            {isEditing ? t('regions.editRegion') : t('regions.createRegion')}
          </DialogTitle>
          <DialogDescription>
            {t('regions.formDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('regions.regionName')} *</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: South America" />
            </div>
            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('regions.descriptionPlaceholder')}
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>{t('regions.countries')} *</Label>
                <p className="text-xs text-muted-foreground">{t('regions.countriesHelp')}</p>
              </div>
              <Badge variant="secondary">{countries.length} {t('regions.selected')}</Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('regions.searchCountries')}
              />
            </div>

            {countries.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {countries.map((code) => (
                  <Badge key={code} variant="outline">{getCountryName(code)}</Badge>
                ))}
              </div>
            )}

            <ScrollArea className="h-64 rounded-md border">
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                {filteredCountries.map((country) => (
                  <label
                    key={country.code}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={countries.includes(country.code)}
                      onCheckedChange={() => toggleCountry(country.code)}
                    />
                    <span className="font-medium">{country.name}</span>
                    <span className="text-xs text-muted-foreground">{country.code}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>{t('regions.linkedShips')}</Label>
                <p className="text-xs text-muted-foreground">{t('regions.linkedShipsHelp')}</p>
              </div>
              <Badge variant="secondary">{selectedShipIds.length} {t('regions.shipsSelected')}</Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={shipSearch}
                onChange={(event) => setShipSearch(event.target.value)}
                placeholder={t('regions.searchShips')}
              />
            </div>

            <ScrollArea className="h-56 rounded-md border">
              {filteredShips.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">{t('regions.noShipsAvailable')}</p>
              ) : (
                <div className="grid gap-1 p-3 sm:grid-cols-2">
                  {filteredShips.map((ship) => (
                    <label
                      key={ship.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedShipIds.includes(ship.id)}
                        onCheckedChange={() => toggleShip(ship.id)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{ship.name}</span>
                        {ship.code && (
                          <span className="block text-xs text-muted-foreground">{ship.code}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? t('common.save') : t('regions.createRegion')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
