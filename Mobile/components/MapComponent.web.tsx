import React, { useEffect, useRef, useState, createContext, useContext, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import ReactDOM from 'react-dom';

const MapContext = createContext<any>(null);
export const PROVIDER_DEFAULT = 'leaflet';

export const MapView = forwardRef(({ children, initialRegion, style, onRegionChangeComplete, onPress }: any, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: any, duration: number = 500) => {
      if (mapInstance) {
        mapInstance.flyTo([region.latitude, region.longitude], 17, { duration: duration / 1000 });
      }
    },
    fitToCoordinates: (coordinates: any[]) => {
      if (mapInstance && coordinates.length > 0) {
        const bounds = coordinates.map(c => [c.latitude, c.longitude]);
        mapInstance.fitBounds(bounds);
      }
    }
  }));

  useEffect(() => {
    // 1. Leaflet Dosyalarını Yükle
    const loadLeaflet = () => {
      if ((window as any).L) {
        setIsLoaded(true);
        return;
      }

      // CSS Ekle
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // JS Ekle
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
    };

    loadLeaflet();
  }, []);

  useEffect(() => {
    // 2. Motor Hazırsa Haritayı Başlat
    const L = (window as any).L;
    if (!isLoaded || !L || !mapRef.current || mapInstance) return;

    try {
      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([initialRegion.latitude, initialRegion.longitude], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      setTimeout(() => { map.invalidateSize(); }, 500);
      map.on('click', (e: any) => { if (onPress) onPress(e); });
      setMapInstance(map);
    } catch (err) {
      console.error("Harita başlatma hatası:", err);
    }

    return () => { if (mapInstance) mapInstance.remove(); };
  }, [isLoaded, mapInstance]);

  return (
    <View style={[style, { backgroundColor: '#f0f0f0' }]}>
       {!isLoaded && (
         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>Harita motoru indiriliyor...</Text>
         </View>
       )}
       <div 
         ref={mapRef} 
         style={{ 
           width: '100%', 
           height: '100%', 
           position: 'absolute',
           top: 0,
           left: 0,
           zIndex: 1,
           visibility: isLoaded ? 'visible' : 'hidden'
         }} 
       />
       {mapInstance && (
         <MapContext.Provider value={mapInstance}>
           <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
             {children}
           </div>
         </MapContext.Provider>
       )}
    </View>
  );
});

export const Marker = ({ coordinate, children, onPress }: any) => {
  const map = useContext(MapContext);
  const [container, setContainer] = useState<any>(null);

  useEffect(() => {
    const L = (window as any).L;
    if (!map || !L) return;

    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.transform = 'translate(-50%, -100%)';

    const icon = L.divIcon({
      className: 'custom-web-marker',
      html: div,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });

    const marker = L.marker([coordinate.latitude, coordinate.longitude], { icon }).addTo(map);
    if (onPress) marker.on('click', (e: any) => { L.DomEvent.stopPropagation(e); onPress(); });

    setContainer(div);
    return () => { marker.remove(); };
  }, [map, coordinate.latitude, coordinate.longitude]);

  return container ? ReactDOM.createPortal(children, container) : null;
};

export const Geojson = ({ geojson, strokeColor, fillColor, strokeWidth }: any) => {
  const map = useContext(MapContext);
  useEffect(() => {
    const L = (window as any).L;
    if (!map || !L || !geojson) return;
    const layer = L.geoJSON(geojson, {
      style: (feature: any) => ({
        color: feature.properties.stroke || strokeColor || '#ff7800',
        fillColor: feature.properties.fill || fillColor || '#ff7800',
        weight: strokeWidth || 2,
        fillOpacity: 0.1
      })
    }).addTo(map);
    return () => { layer.remove(); };
  }, [map, geojson]);
  return null;
};

export const Circle = () => null;
