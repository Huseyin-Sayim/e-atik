import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Geriye dönük uyumluluk için boş bileşenler (Hata vermemesi için)
export const PROVIDER_DEFAULT = 'leaflet';
export const Marker = () => null;
export const Geojson = () => null;
export const UrlTile = () => null;

export const MapView = forwardRef(({ style, initialRegion, campusParcels, bins, onMarkerPress }: any, ref) => {
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: any, duration: number = 500) => {
      if (webViewRef.current && region) {
        webViewRef.current.injectJavaScript(`map.flyTo([${region.latitude}, ${region.longitude}], 17, { animate: true, duration: ${duration / 1000} });`);
      }
    },
    fitToCoordinates: (coordinates: any[], options: any = {}) => {
      if (webViewRef.current && coordinates && coordinates.length > 0) {
        const bounds = coordinates.map(c => `[${c.latitude}, ${c.longitude}]`).join(',');
        webViewRef.current.injectJavaScript(`map.fitBounds([${bounds}], { padding: [50, 50], maxZoom: 17 });`);
      }
    }
  }));

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link href="https://cdn.jsdelivr.net/npm/@mdi/font@7.2.96/css/materialdesignicons.min.css" rel="stylesheet">
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; background-color: #f5f5f5; }
        html, body, #map { height: 100%; width: 100%; }
        .custom-pin-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; width: 95px; height: 60px; }
        .tooltip-container { display: flex; flex-direction: row; align-items: center; justify-content: center; width: 95px; height: 34px; border-radius: 12px; pointer-events: none; }
        .tooltip-content { display: flex; flex-direction: row; align-items: center; justify-content: center; }
        .divider { width: 1px; height: 16px; background-color: rgba(255,255,255,0.4); margin: 0 6px; }
        .tooltip-text { color: #fff; font-size: 13px; font-weight: bold; width: 36px; text-align: center; font-family: sans-serif; }
        .tail-triangle { width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 12px solid; margin-top: -1px; pointer-events: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        let map;
        let markers = [];
        let geojsonLayer;

        function getPinColor(percentage) {
          if (percentage < 30) return '#2e7d32';
          if (percentage < 70) return '#f59e0b';
          return '#e74c3c';
        }

        function initMap(lat, lng) {
          map = L.map('map', { zoomControl: false, attributionControl: false, tap: false }).setView([lat, lng], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        }

        function updateData(dataStr) {
          try {
            const data = JSON.parse(dataStr);
            
            // Kampüs Parsellerini Çiz (GeoJSON)
            if (data.campusParcels && !geojsonLayer) {
              const features = data.campusParcels.features.filter(f => f.geometry.type !== 'Point');
              geojsonLayer = L.geoJSON(features, {
                style: { color: "#ff7800", weight: 2, fillColor: "rgba(255, 120, 0, 0.1)", fillOpacity: 1 }
              }).addTo(map);
            }

            // Atık Kutularını (Pinleri) Çiz
            if (data.bins) {
              markers.forEach(m => map.removeLayer(m));
              markers = [];

              data.bins.forEach(bin => {
                const color = getPinColor(bin.fillPercentage);
                
                const wrapper = document.createElement('div');
                wrapper.className = 'custom-pin-wrapper';
                
                // İçeriği doldur (pointer-events: none ekliyoruz ki tıklama direkt wrapper'a düşsün)
                wrapper.innerHTML = \`
                  <div class="tooltip-container" style="background-color: \${color}; pointer-events: none;">
                    <div class="tooltip-content">
                      <i class="mdi mdi-trash-can" style="color: #fff; font-size: 18px;"></i>
                      <div class="divider"></div>
                      <div class="tooltip-text">%\${bin.fillPercentage}</div>
                    </div>
                  </div>
                  <div class="tail-triangle" style="border-top-color: \${color};"></div>
                \`;

                // Tıklama olayını direkt fiziksel DIV nesnesine bağlıyoruz
                wrapper.onclick = function(e) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', bin: bin }));
                  e.stopPropagation();
                };

                const icon = L.divIcon({
                  html: wrapper,
                  className: '',
                  iconSize: [95, 60],
                  iconAnchor: [47, 60] // Pin ucu tam lokasyona değecek şekilde hizalanır
                });

                const marker = L.marker([bin.latitude, bin.longitude], { icon: icon }).addTo(map);
                markers.push(marker);
              });
            }
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: e.message }));
          }
        }

        initMap(38.4553, 27.2290);
      </script>
    </body>
    </html>
  `;

  useEffect(() => {
    if (webViewRef.current && campusParcels && bins) {
      const data = { campusParcels, bins };
      webViewRef.current.injectJavaScript(`updateData('${JSON.stringify(data)}')`);
    }
  }, [campusParcels, bins]);

  useEffect(() => {
    if (webViewRef.current && initialRegion) {
      webViewRef.current.injectJavaScript(`map.setView([${initialRegion.latitude}, ${initialRegion.longitude}], 15);`);
    }
  }, [initialRegion]);

  return (
    <View style={[style, { flex: 1, backgroundColor: '#f5f5f5' }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'markerPress' && onMarkerPress) {
              onMarkerPress(data.bin);
            } else if (data.type === 'error') {
              console.log("Leaflet WebView Error:", data.msg);
            }
          } catch (e) {
            // JSON olmayan rastgele WebView mesajlarını yoksay
          }
        }}
      />
    </View>
  );
});
