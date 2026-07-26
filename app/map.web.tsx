// Веб-версия карты — полностью переработана
// • Геолокация первой (не Москва по умолчанию)
// • Полноэкранный иммёрсивный дизайн (нет топ-бара)
// • Кластеризация маркеров
// • Bottom-sheet превью при клике на маркер
// • Кнопки фильтра (GLOB / ДРУЗЬЯ / МОИ) поверх карты
// • Кнопка "мое местоположение"
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  type ViewStyle, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useEvents } from '../context/EventsContext';
import { apiRequest } from '../services/api';
import type { Event } from '../context/EventsContext';
import { AppIcon } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';

const logger = createLogger('Map');

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────
const DEFAULT_CENTER = { lat: 55.7512, lng: 37.6500 }; // Москва, fallback
const MAPSKEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY || 'e95f18c1-e796-4e6a-b2a9-0aafe5e420c4';

type FilterTab = 'GLOB' | 'FRIENDS' | 'MINE';

// ──────────────────────────────────────────────────────────────────────────────
// Build Leaflet HTML — runs entirely inside the iframe
// ──────────────────────────────────────────────────────────────────────────────
function buildMapHtml(
  eventsData: Array<{
    id: string; title: string; location: string; date: string; time: string;
    photo: string | null; isPast: boolean; lat: number; lng: number;
  }>,
  center: { lat: number; lng: number },
  zoom: number,
  userLoc: { lat: number; lng: number } | null,
): string {
  const eventsJSON = JSON.stringify(eventsData);
  const userLocJSON = JSON.stringify(userLoc);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:100%;height:100%;overflow:hidden;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif}
    #map{width:100%;height:100%;background:#0a0a0c}

    /* ── Cluster styles ── */
    .marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{
      background:rgba(255,141,50,.18)!important;
    }
    .marker-cluster-small div,.marker-cluster-medium div,.marker-cluster-large div{
      background:rgba(255,141,50,.9)!important;
      color:#fff!important;font-weight:700!important;font-size:13px!important;
    }

    /* ── Custom marker ── */
    .evt-marker{
      width:46px;height:46px;border-radius:14px;overflow:hidden;
      border:2.5px solid #FF8D32;
      box-shadow:0 4px 16px rgba(0,0,0,.55),0 0 0 1px rgba(255,141,50,.25);
      background:#18181e;cursor:pointer;
      transition:transform .15s ease,box-shadow .15s ease;
    }
    .evt-marker:hover{transform:scale(1.12);box-shadow:0 6px 22px rgba(0,0,0,.7),0 0 0 2px #FF8D32}
    .evt-marker.past{border-color:rgba(255,255,255,.2);opacity:.55}
    .evt-marker img{width:100%;height:100%;object-fit:cover;display:block}
    .evt-marker-icon{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
    .evt-marker-icon svg{opacity:.7}

    /* ── User dot ── */
    .user-dot{
      width:18px;height:18px;border-radius:50%;
      background:#4A9EFF;border:2.5px solid #fff;
      box-shadow:0 2px 8px rgba(74,158,255,.7);
    }

    /* ── Bottom preview card ── */
    #preview{
      position:fixed;bottom:-200px;left:0;right:0;
      background:#18181e;border-top:1px solid rgba(255,255,255,.09);
      border-radius:24px 24px 0 0;
      padding:0 0 28px;
      transition:bottom .32s cubic-bezier(.4,0,.2,1);
      z-index:1000;max-height:280px;
    }
    #preview.open{bottom:0}
    #preview-handle{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.2);
      margin:12px auto 0;display:block}
    #preview-inner{display:flex;gap:14px;padding:14px 18px 0;align-items:center}
    #preview-photo{
      width:64px;height:64px;border-radius:14px;flex-shrink:0;
      object-fit:cover;background:#222;
      border:1px solid rgba(255,255,255,.07);
    }
    #preview-placeholder{
      width:64px;height:64px;border-radius:14px;flex-shrink:0;
      background:#222;border:1px solid rgba(255,255,255,.07);
      display:flex;align-items:center;justify-content:center;
    }
    #preview-text{flex:1;min-width:0}
    #preview-title{color:#f4f4f5;font-size:15px;font-weight:700;letter-spacing:-.2px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}
    #preview-meta{color:rgba(244,244,245,.5);font-size:12.5px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #preview-footer{display:flex;gap:10px;padding:12px 18px 0;align-items:center}
    #preview-open{
      flex:1;padding:13px 0;border-radius:14px;background:#FF8D32;
      color:#fff;font-weight:700;font-size:14.5px;letter-spacing:-.1px;
      border:none;cursor:pointer;transition:opacity .15s
    }
    #preview-open:hover{opacity:.88}
    #preview-close{
      width:44px;height:44px;border-radius:13px;flex-shrink:0;
      background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      transition:background .15s
    }
    #preview-close:hover{background:rgba(255,255,255,.12)}

    /* ── Leaflet attribution small ── */
    .leaflet-control-attribution{font-size:9px!important;opacity:.4}
    .leaflet-control-zoom a{
      background:#18181e!important;color:#f4f4f5!important;
      border-color:rgba(255,255,255,.12)!important;
      border-radius:8px!important;
    }
    .leaflet-control-zoom{border:none!important;box-shadow:0 4px 16px rgba(0,0,0,.4)!important}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="preview">
    <div id="preview-handle"></div>
    <div id="preview-inner">
      <img id="preview-photo" src="" alt="" style="display:none"/>
      <div id="preview-placeholder">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(244,244,245,.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>
        </svg>
      </div>
      <div id="preview-text">
        <div id="preview-title"></div>
        <div id="preview-meta"></div>
      </div>
    </div>
    <div id="preview-footer">
      <button id="preview-open" onclick="openEvent()">Открыть событие</button>
      <button id="preview-close" onclick="closePreview()">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(244,244,245,.6)" stroke-width="2" stroke-linecap="round">
          <path d="M1 1l12 12M13 1L1 13"/>
        </svg>
      </button>
    </div>
  </div>
  <script>
    var EVENTS = ${eventsJSON};
    var USER_LOC = ${userLocJSON};
    var currentEventId = null;
    var map, clusterGroup;

    function initMap() {
      map = L.map('map', {
        center: [${center.lat}, ${center.lng}],
        zoom: ${zoom},
        zoomControl: true,
        attributionControl: true,
      });

      // Dark basemap
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Close preview on map click
      map.on('click', function() { closePreview(); });

      // Cluster group
      clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: function(cluster) {
          var count = cluster.getChildCount();
          return L.divIcon({
            html: '<div style="width:44px;height:44px;border-radius:14px;background:rgba(255,141,50,.9);border:2px solid rgba(255,141,50,.6);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.5);font-size:14px;font-weight:700;color:#fff">' + count + '</div>',
            className: '',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });
        },
      });

      // Build markers
      EVENTS.forEach(function(ev) {
        var icon = L.divIcon({
          html: buildMarkerHtml(ev),
          className: '',
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        });
        var m = L.marker([ev.lat, ev.lng], { icon: icon });
        m.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          showPreview(ev);
        });
        clusterGroup.addLayer(m);
      });
      map.addLayer(clusterGroup);

      // User location dot
      if (USER_LOC) {
        L.marker([USER_LOC.lat, USER_LOC.lng], {
          icon: L.divIcon({
            html: '<div class="user-dot"></div>',
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
          zIndexOffset: 1000,
        }).addTo(map);
      }

      // Receive filter updates from parent
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'flyToUser' && USER_LOC) {
          map.flyTo([USER_LOC.lat, USER_LOC.lng], 14, { duration: 1.2 });
        }
        if (e.data && e.data.type === 'filterEvents') {
          var ids = e.data.ids;
          clusterGroup.clearLayers();
          EVENTS.filter(function(ev){ return ids.includes(ev.id); }).forEach(function(ev) {
            var icon = L.divIcon({
              html: buildMarkerHtml(ev),
              className: '',
              iconSize: [46, 46],
              iconAnchor: [23, 23],
            });
            var m = L.marker([ev.lat, ev.lng], { icon: icon });
            m.on('click', function(e2) {
              L.DomEvent.stopPropagation(e2);
              showPreview(ev);
            });
            clusterGroup.addLayer(m);
          });
          var count = ids.length;
          window.parent.postMessage({ type: 'eventCount', count: count }, '*');
        }
        if (e.data && e.data.type === 'flyTo') {
          map.flyTo([e.data.lat, e.data.lng], e.data.zoom || 14, { duration: 1 });
        }
      });

      // Tell parent how many events loaded
      window.parent.postMessage({ type: 'eventCount', count: EVENTS.length }, '*');
    }

    function buildMarkerHtml(ev) {
      var pastClass = ev.isPast ? ' past' : '';
      if (ev.photo) {
        return '<div class="evt-marker' + pastClass + '"><img src="' + ev.photo + '" alt=""/></div>';
      }
      return '<div class="evt-marker' + pastClass + '"><div class="evt-marker-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF8D32" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></svg></div></div>';
    }

    function showPreview(ev) {
      currentEventId = ev.id;
      document.getElementById('preview-title').textContent = ev.title || 'Событие';
      var meta = [];
      if (ev.date) meta.push(ev.date);
      if (ev.location) meta.push(ev.location);
      document.getElementById('preview-meta').textContent = meta.join(' · ');
      var photo = document.getElementById('preview-photo');
      var placeholder = document.getElementById('preview-placeholder');
      if (ev.photo) {
        photo.src = ev.photo;
        photo.style.display = 'block';
        placeholder.style.display = 'none';
      } else {
        photo.style.display = 'none';
        placeholder.style.display = 'flex';
      }
      document.getElementById('preview').classList.add('open');
      // Smoothly pan map so event is in upper third (not covered by card)
      var offset = map.latLngToContainerPoint([ev.lat, ev.lng]);
      var target = map.containerPointToLatLng([offset.x, offset.y - 90]);
      map.panTo(target, { animate: true, duration: 0.4 });
    }

    function closePreview() {
      document.getElementById('preview').classList.remove('open');
      currentEventId = null;
    }

    function openEvent() {
      if (currentEventId) {
        window.parent.postMessage({ type: 'eventClick', eventId: currentEventId }, '*');
      }
    }

    // Init
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMap);
    } else {
      initMap();
    }
  </script>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────
export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; exploreTab?: string; eventId?: string }>();
  const { events, isEventPast, getEventPhotoForUser, getGlobalEvents, getFriendsForEvents, isUserEventMember } = useEvents();
  const { user, accessToken } = useAuth();
  const { t } = useLanguage();
  const currentUserId = user?.id ?? null;

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [singleEventFetched, setSingleEventFetched] = useState<Event | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>(() => {
    const tab = Array.isArray(params.exploreTab) ? params.exploreTab[0] : params.exploreTab;
    if (tab === 'FRIENDS') return 'FRIENDS';
    if (tab === 'MINE') return 'MINE';
    return 'GLOB';
  });
  const [eventCount, setEventCount] = useState(0);

  const mapViewRef = useRef<View | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // ── Resolve eventId ──
  const rawEventId = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const q = new URLSearchParams(window.location.search).get('eventId');
      if (q) return q;
    }
    const p = params.eventId;
    return Array.isArray(p) ? p[0] : (p ?? null);
  }, [params.eventId]);

  const rawUserId = useMemo(() => {
    const p = params.userId;
    return Array.isArray(p) ? p[0] : (p ?? null);
  }, [params.userId]);

  // ── Fetch single event if not in context ──
  useEffect(() => {
    if (!rawEventId) return;
    const inList = events.some(e => e.id === rawEventId && e.coordinates?.latitude);
    if (inList) { setSingleEventFetched(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const raw: any = await apiRequest(`/events/${rawEventId}`, { method: 'GET' }, accessToken ?? undefined);
        if (cancelled || !raw?.coordinates?.latitude) return;
        setSingleEventFetched({
          id: raw.id, title: raw.title ?? '', description: '', date: raw.date ?? '',
          time: raw.time ?? '', location: raw.location ?? '',
          coordinates: { latitude: raw.coordinates.latitude, longitude: raw.coordinates.longitude },
          mediaUrl: raw.mediaUrl, organizerId: raw.organizerId ?? '',
          participants: 0, maxParticipants: 0, price: undefined, tags: [],
          isRecurring: false, recurrenceRule: undefined, originalEventId: undefined,
          mediaType: 'image', mediaAspectRatio: 1, originalMediaUrl: undefined,
        } as unknown as Event);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [rawEventId, events, accessToken]);

  // ── Get user location ──
  const requestLocation = useCallback(async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setUserLocation(pos);
        return pos;
      }
    } catch { /* ignore */ }
    setLocLoading(false);
    return null;
  }, []);

  useEffect(() => { requestLocation(); }, []);

  // ── Build events data for map ──
  const { eventsData, center, zoom } = useMemo(() => {
    const baseEvents = (() => {
      if (rawEventId) {
        const list = events.filter(e => e.id === rawEventId && e.coordinates?.latitude);
        if (list.length > 0) return list;
        return singleEventFetched ? [singleEventFetched] : [];
      }
      if (activeFilter === 'GLOB') {
        return getGlobalEvents().filter(e => e.coordinates?.latitude);
      }
      if (activeFilter === 'FRIENDS') {
        return getFriendsForEvents().filter(e => e.coordinates?.latitude);
      }
      if (activeFilter === 'MINE' && currentUserId) {
        return events.filter(e => e.coordinates?.latitude && isUserEventMember(e, currentUserId));
      }
      if (rawUserId) {
        return events.filter(e => e.coordinates?.latitude && isUserEventMember(e, rawUserId));
      }
      return events.filter(e => e.coordinates?.latitude);
    })();

    const data = baseEvents.map(ev => {
      const photo = getEventPhotoForUser(ev.id, currentUserId ?? '', undefined) || ev.mediaUrl || null;
      const date = ev.date ? new Date(ev.date + 'T' + (ev.time || '12:00') + ':00') : null;
      const isPast = date ? date < new Date() : false;
      return {
        id: ev.id,
        title: ev.title,
        location: ev.location || '',
        date: ev.displayDate || ev.date || '',
        time: ev.time || '',
        photo: photo || null,
        isPast,
        lat: ev.coordinates!.latitude,
        lng: ev.coordinates!.longitude,
      };
    });

    // Center & zoom
    if (rawEventId && data.length === 1) {
      return { eventsData: data, center: { lat: data[0].lat, lng: data[0].lng }, zoom: 15 };
    }
    const userLoc = userLocation;
    const c = userLoc ?? DEFAULT_CENTER;
    return { eventsData: data, center: c, zoom: userLoc ? 12 : 10 };
  }, [rawEventId, activeFilter, events, singleEventFetched, userLocation, currentUserId, rawUserId,
    getGlobalEvents, getFriendsForEvents, isUserEventMember, getEventPhotoForUser]);

  const mapHtml = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return buildMapHtml(eventsData, center, zoom, userLocation);
  }, [eventsData, center, zoom, userLocation]);

  // ── Inject filter changes after initial load ──
  const sendFilterToIframe = useCallback((filter: FilterTab) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const ids = eventsData.map(e => e.id);
    iframe.contentWindow.postMessage({ type: 'filterEvents', ids }, '*');
  }, [eventsData]);

  const handleFilterChange = useCallback((f: FilterTab) => {
    setActiveFilter(f);
  }, []);

  // Re-send filter when eventsData updates after filter change
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    const ids = eventsData.map(e => e.id);
    iframeRef.current.contentWindow.postMessage({ type: 'filterEvents', ids }, '*');
  }, [eventsData]);

  // ── Fly to user ──
  const flyToUser = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    if (userLocation) {
      iframeRef.current.contentWindow.postMessage({ type: 'flyToUser' }, '*');
    } else {
      requestLocation().then(pos => {
        if (pos && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'flyTo', lat: pos.lat, lng: pos.lng, zoom: 13 }, '*');
        }
      });
    }
  }, [userLocation, requestLocation]);

  // ── Handle messages from iframe ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'eventClick' && e.data.eventId) {
        router.push(`/event-profile/${e.data.eventId}`);
      }
      if (e.data.type === 'eventCount') {
        setEventCount(e.data.count ?? 0);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [router]);

  // ── Mount iframe into DOM ──
  useEffect(() => {
    if (typeof window === 'undefined' || !mapHtml) return;

    const setupMap = () => {
      if (!mapViewRef.current) { setTimeout(setupMap, 80); return; }
      const node = (mapViewRef.current as any)?._nativeNode || (mapViewRef.current as any)?.nativeNode || mapViewRef.current;
      if (!node || node.nodeType !== 1) { setTimeout(setupMap, 80); return; }

      if (!mapContainerRef.current) {
        const div = document.createElement('div');
        Object.assign(div.style, { position:'absolute', inset:'0', width:'100%', height:'100%' });
        node.appendChild(div);
        mapContainerRef.current = div;
      }

      let iframe = iframeRef.current;
      if (!iframe) {
        iframe = document.createElement('iframe');
        Object.assign(iframe.style, { position:'absolute', inset:'0', width:'100%', height:'100%', border:'none', background:'#0a0a0c' });
        iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-forms');
        iframe.title = 'Map';
        mapContainerRef.current.appendChild(iframe);
        iframeRef.current = iframe;
      }
      iframe.srcdoc = mapHtml;
    };

    setupMap();
    return () => {
      if (mapContainerRef.current?.parentNode) {
        mapContainerRef.current.parentNode.removeChild(mapContainerRef.current);
        mapContainerRef.current = null;
      }
      iframeRef.current = null;
    };
  }, [mapHtml]);

  // Only update iframe content on filter change without remounting
  const firstMount = useRef(true);
  useEffect(() => {
    if (firstMount.current) { firstMount.current = false; return; }
    if (iframeRef.current && mapHtml) {
      iframeRef.current.srcdoc = mapHtml;
    }
  }, [mapHtml]);

  // ── Determine if filter tabs should show ──
  const showFilterTabs = !rawEventId;
  const showTitle = !!rawEventId;

  return (
    <View style={styles.root}>
      {/* Full-screen map */}
      <View
        style={styles.mapFill}
        ref={(el: any) => { mapViewRef.current = el; }}
      />

      {/* ── Floating top controls ── */}
      <View style={styles.floatingTop} pointerEvents="box-none">
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <AppIcon name="chevronLeft" size={18} color={Palette.text} />
        </TouchableOpacity>

        {/* Filter tabs or event title */}
        {showFilterTabs ? (
          <View style={styles.filterRow} pointerEvents="box-none">
            {(['GLOB', 'FRIENDS', 'MINE'] as FilterTab[]).map((f) => {
              const labels: Record<FilterTab, string> = { GLOB: 'Глобал', FRIENDS: 'Друзья', MINE: 'Мои' };
              const active = activeFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterTab, active && styles.filterTabActive]}
                  onPress={() => handleFilterChange(f)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                    {labels[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.titlePill}>
            <Text style={styles.titlePillText} numberOfLines={1}>Карта</Text>
          </View>
        )}

        {/* Event count badge */}
        {eventCount > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{eventCount}</Text>
          </View>
        )}
      </View>

      {/* ── Floating bottom-right: locate me ── */}
      <View style={styles.floatingBottomRight} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.locateBtn, locLoading && { opacity: 0.6 }]}
          onPress={flyToUser}
          activeOpacity={0.75}
        >
          <AppIcon name="map" size={19} color={userLocation ? Palette.accent : Palette.textDim} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web' && typeof window !== 'undefined' ? ({
      position: 'relative',
      overflow: 'hidden',
      height: '100dvh',
      width: '100%',
    } as unknown as ViewStyle) : {}),
  },
  mapFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ── Floating top ──
  floatingTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 100,
    // subtle gradient so controls are readable over the map
    ...(Platform.OS === 'web' && typeof window !== 'undefined' ? ({
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
    } as unknown as ViewStyle) : {}),
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(18,18,22,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web' && typeof window !== 'undefined' ? ({
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as unknown as ViewStyle) : {}),
  },
  filterRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,22,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...(Platform.OS === 'web' && typeof window !== 'undefined' ? ({
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as unknown as ViewStyle) : {}),
  },
  filterTabActive: {
    backgroundColor: 'rgba(255,141,50,0.9)',
    borderColor: 'rgba(255,141,50,0.5)',
  },
  filterTabText: {
    color: 'rgba(244,244,245,0.65)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  filterTabTextActive: {
    color: '#f4f4f5',
  },
  titlePill: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,22,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...(Platform.OS === 'web' && typeof window !== 'undefined' ? ({
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as unknown as ViewStyle) : {}),
  },
  titlePillText: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,22,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
    ...(Platform.OS === 'web' && typeof window !== 'undefined' ? ({
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as unknown as ViewStyle) : {}),
  },
  countBadgeText: {
    color: Palette.accent,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  // ── Floating bottom-right ──
  floatingBottomRight: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    zIndex: 100,
  },
  locateBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(18,18,22,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    ...(Platform.OS === 'web' && typeof window !== 'undefined' ? ({
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
    } as unknown as ViewStyle) : {}),
  },
});
