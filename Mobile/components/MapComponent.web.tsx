import React, { useEffect, useRef, useState, createContext, useContext, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import ReactDOM from 'react-dom';

const MapContext = createContext<any>(null);
export const PROVIDER_DEFAULT = 'leaflet';
export const UrlTile = () => null; // Web tarafında UrlTile gerekmediği için boş dönüyoruz.

const getPinColor = (fillPercentage: number) => {
  if (fillPercentage < 50) return '#4caf50'; // Yeşil
  if (fillPercentage < 80) return '#ff9800'; // Turuncu
  return '#f44336'; // Kırmızı
};

export const MapView = forwardRef(({ children, initialRegion, style, onRegionChangeComplete, onPress, bins, campusParcels, onMarkerPress }: any, ref) => {
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
    // 1. Leaflet Dosyalarını ve Özel Pin Stillerini Yükle
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

      // Materyal ikonları ekle (Web uyumluluğu için)
      if (!document.getElementById('material-icons-css')) {
        const link = document.createElement('link');
        link.id = 'material-icons-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.2.96/css/materialdesignicons.min.css';
        document.head.appendChild(link);
      }

      // Özel Pin Stillerini Enjekte Et (Mobille birebir görsel eşitlik)
      if (!document.getElementById('custom-pin-styles')) {
        const style = document.createElement('style');
        style.id = 'custom-pin-styles';
        style.innerHTML = `
          .custom-pin-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; width: 95px; height: 60px; cursor: pointer; }
          .tooltip-container { display: flex; flex-direction: row; align-items: center; justify-content: center; width: 95px; height: 34px; border-radius: 12px; }
          .tooltip-content { display: flex; flex-direction: row; align-items: center; justify-content: center; }
          .divider { width: 1px; height: 16px; background-color: rgba(255,255,255,0.4); margin: 0 6px; }
          .tooltip-text { color: #fff; font-size: 13px; font-weight: bold; width: 36px; text-align: center; font-family: sans-serif; }
          .tail-triangle { width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 12px solid; margin-top: -1px; pointer-events: none; }
        `;
        document.head.appendChild(style);
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
             
             {/* Web GeoJSON Çizimi */}
             {campusParcels && (
               <Geojson geojson={campusParcels} strokeColor="#ff7800" fillColor="rgba(255, 120, 0, 0.1)" strokeWidth={2} />
             )}

             {/* Web Pinlerinin Dinamik Çizimi (Mobille %100 Uyumlu) */}
             {bins && bins.map((bin: any) => {
               const color = getPinColor(bin.fillPercentage);
               return (
                 <Marker
                   key={`web-bin-${bin.id}`}
                   coordinate={{ latitude: bin.latitude, longitude: bin.longitude }}
                   onPress={() => onMarkerPress && onMarkerPress(bin)}
                 >
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', width: 95, height: 60, cursor: 'pointer' }}>
                     <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 95, height: 34, borderRadius: 12, backgroundColor: color }}>
                       <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
                           <polyline points="3 6 5 6 21 6"></polyline>
                           <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                           <line x1="10" y1="11" x2="10" y2="17"></line>
                           <line x1="14" y1="11" x2="14" y2="17"></line>
                         </svg>
                         <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.4)', marginLeft: 6, marginRight: 6 }}></div>
                         <div style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', width: 36, textAlign: 'center', fontFamily: 'sans-serif' }}>
                           %{bin.fillPercentage}
                         </div>
                       </div>
                     </div>
                     <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: `12px solid ${color}`, marginTop: -1, pointerEvents: 'none' }}></div>
                   </div>
                 </Marker>
               );
             })}
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
