import { useEffect, useMemo, useRef } from 'react';
import useStore from '@/store/useStore';
import { useWS } from '@/services/WSProvider';
import { computeEtaMs, computeRemainingDistance, distanceMeters, LatLng } from '@/utils/eta';

function toCoords(geometry: any): LatLng[] {
  if (!geometry?.coordinates || !Array.isArray(geometry.coordinates)) return [];
  return geometry.coordinates.map((c: number[]) => ({ latitude: c[1], longitude: c[0] }));
}

function selectActiveRoute(ride: any) {
  const routes = ride?.routes || {};
  const status = String(ride?.status || '').toUpperCase();
  if (status === 'ACCEPTED' && routes.driverToPickup?.geometry) return routes.driverToPickup;
  if (routes.initial?.geometry) return routes.initial;
  if (ride?.routeGeometry) {
    return { geometry: ride.routeGeometry, distance: ride.distance, duration: ride.estimatedDuration };
  }
  return null;
}

export default function useGlobalRideTracking() {
  const { currentRide, setCurrentRide, setRideProgress, setDriverLocation } = useStore();
  const { emit, on, off } = useWS();

  const activeRoute = useMemo(() => selectActiveRoute(currentRide), [currentRide]);
  const coords = useMemo<LatLng[]>(() => toCoords(activeRoute?.geometry), [activeRoute?.geometry]);

  const totalDistance = useMemo(() => {
    if (!coords || coords.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < coords.length; i++) sum += distanceMeters(coords[i - 1], coords[i]);
    return sum;
  }, [coords]);

  const routeDurationSeconds = useMemo(() => {
    const d = activeRoute?.legs?.[0]?.duration?.value ?? activeRoute?.duration;
    if (typeof d === 'number' && d > 0) return d > 60 * 60 ? d : d * 60;
    return 0;
  }, [activeRoute]);

  const riderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentRide?._id) return;
    emit('subscribeRide', currentRide._id);

    const handleRideData = (data: any) => {
      const r = data?.ride;
      if (!r) return;
      setCurrentRide(r);
    };
    const handleRideUpdate = (data: any) => {
      const r = data?.ride;
      if (!r) return;
      setCurrentRide(r);
    };

    on('rideData', handleRideData);
    on('rideUpdate', handleRideUpdate);

    return () => {
      off('rideData', handleRideData);
      off('rideUpdate', handleRideUpdate);
      emit('unsubscribeRide', currentRide._id);
    };
  }, [currentRide?._id, emit, on, off, setCurrentRide]);

  useEffect(() => {
    const rid = currentRide?.rider?._id as string | undefined;
    if (!rid) return;

    if (riderIdRef.current && riderIdRef.current !== rid) emit('unsubscribeToriderLocation', riderIdRef.current);
    if (riderIdRef.current !== rid) {
      emit('subscribeToriderLocation', rid);
      riderIdRef.current = rid;
    }

    const handleRiderLoc = (data: any) => {
      const c = data?.coords;
      if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return;
      setDriverLocation({ latitude: c.latitude, longitude: c.longitude, heading: typeof c.heading === 'number' ? c.heading : 0 });
      if (coords && coords.length > 1) {
        const remaining = computeRemainingDistance({ latitude: c.latitude, longitude: c.longitude }, coords);
        const etaMs = computeEtaMs(remaining, totalDistance, routeDurationSeconds);
        setRideProgress(etaMs, remaining);
      }
    };

    on('riderLocationUpdate', handleRiderLoc);

    return () => {
      off('riderLocationUpdate', handleRiderLoc);
    };
  }, [currentRide?.rider?._id, coords, totalDistance, routeDurationSeconds, emit, on, off, setDriverLocation, setRideProgress]);
}
