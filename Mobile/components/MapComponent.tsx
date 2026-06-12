import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

// Geriye dönük uyumluluk için boş bileşenler (Hata vermemesi için)
export const PROVIDER_DEFAULT = 'leaflet';
export const Marker = () => null;
export const Geojson = () => null;
export const UrlTile = () => null;
export const Polyline = () => null;

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
      .custom-pin-wrapper { display: inline-flex; flex-direction: column; align-items: center; justify-content: flex-start; height: 60px; transform: translate(-50%, -100%); width: max-content; }
      .tooltip-container { display: flex; flex-direction: row; align-items: center; justify-content: center; min-width: 95px; padding: 0 10px; height: 34px; border-radius: 12px; pointer-events: none; box-sizing: border-box; }
      .tooltip-content { display: flex; flex-direction: row; align-items: center; justify-content: center; }
      .divider { width: 1px; height: 16px; background-color: rgba(255,255,255,0.4); margin: 0 6px; }
      .tooltip-text { color: #fff; font-size: 13px; font-weight: bold; text-align: center; font-family: sans-serif; white-space: nowrap; }
      .tail-triangle { width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 12px solid; margin-top: -1px; pointer-events: none; }
      .leaflet-tooltip.region-tooltip { background: transparent; border: none; box-shadow: none; padding: 0; }
      .leaflet-tooltip.region-tooltip::before { display: none; }
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
          if (data.campusParcels) {
            if (geojsonLayer) {
              map.removeLayer(geojsonLayer);
            }
            const features = data.campusParcels.features.filter(f => f.geometry.type !== 'Point');
            let regionCounter = 1;
            geojsonLayer = L.geoJSON(features, {
              style: function(feature) {
                if (data.selectedParcelId && feature.id === data.selectedParcelId) {
                  return { color: "#2563eb", weight: 3, fillColor: "rgba(37, 99, 235, 0.5)", fillOpacity: 1 };
                }
                return { color: "#ff7800", weight: 2, fillColor: "rgba(255, 120, 0, 0.25)", fillOpacity: 1 };
              },
              onEachFeature: function(feature, layer) {
                layer.on('click', function() {
                  var msg = JSON.stringify({ type: 'parcelPress', parcelId: feature.id, parcelName: feature.properties.name });
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(msg);
                  } else if (window.parent) {
                    window.parent.postMessage(msg, '*');
                  }
                });
                if (data.showRegionLabels && feature.properties && feature.properties.name) {
                  layer.bindTooltip(
                    "<div style='background:rgba(255,255,255,0.9); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#1e293b; font-size:20px; border:3px solid #2563eb; box-shadow:0 2px 5px rgba(0,0,0,0.3);'>" + regionCounter + "</div>", 
                    {
                      permanent: true,
                      direction: 'center',
                      className: 'region-tooltip',
                      opacity: 1,
                      interactive: false
                    }
                  );
                  regionCounter++;
                }
              }
            }).addTo(map);
          }

          // Atık Kutularını (Pinleri) Çiz
          if (data.bins) {
            markers.forEach(m => map.removeLayer(m));
            markers = [];

            data.bins.forEach(bin => {
              const isReq = bin.isRequest;
              const isStore = bin.isStore;
              const color = isStore ? '#10b981' : isReq ? '#2563eb' : getPinColor(bin.fillPercentage);
              const iconClass = isStore ? 'mdi-store' : isReq ? 'mdi-home-map-marker' : 'mdi-trash-can';
              const labelText = isStore ? (bin.name || 'Mağaza') : isReq ? 'Talep' : '%' + bin.fillPercentage;
              
              const wrapper = document.createElement('div');
              wrapper.className = 'custom-pin-wrapper';
              
              const textStyle = isStore 
                ? 'width: 58px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;' 
                : 'width: 36px; text-align: center;';
              
              wrapper.innerHTML = 
                '<div class="tooltip-container" style="background-color: ' + color + '; pointer-events: none;">' +
                  '<div class="tooltip-content">' +
                    '<i class="mdi ' + iconClass + '" style="color: #fff; font-size: 18px;"></i>' +
                    '<div class="divider"></div>' +
                    '<div class="tooltip-text" style="' + textStyle + '">' + labelText + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="tail-triangle" style="border-top-color: ' + color + ';"></div>';

              // Tıklama olayını direkt fiziksel DIV nesnesine bağlıyoruz
              wrapper.onclick = function(e) {
                var msg = JSON.stringify({ type: 'markerPress', bin: bin });
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(msg);
                } else if (window.parent) {
                  window.parent.postMessage(msg, '*');
                }
                e.stopPropagation();
              };

              const icon = L.divIcon({
                html: wrapper,
                className: '',
                iconSize: [0, 0],
                iconAnchor: [0, 0]
              });

              const marker = L.marker([bin.latitude, bin.longitude], { icon: icon }).addTo(map);
              markers.push(marker);
            });
          }
          // Personel Konumunu (Mavi İkon) Çiz
          if (data.staffLocation) {
            if (window.staffMarker) {
              map.removeLayer(window.staffMarker);
            }
            const staffPulseHtml = 
              '<div style="' +
                'background-color: #3b82f6; ' +
                'width: 18px; ' +
                'height: 18px; ' +
                'border-radius: 9px; ' +
                'border: 3px solid #fff; ' +
                'box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);' +
                'animation: pulse 1.5s infinite ease-in-out;' +
              '"></div>' +
              '<style>' +
                '@keyframes pulse {' +
                  '0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }' +
                  '70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }' +
                  '100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }' +
                '}' +
              '</style>';
            const staffIcon = L.divIcon({
              html: staffPulseHtml,
              className: '',
              iconSize: [18, 18],
              iconAnchor: [9, 9]
            });
            window.staffMarker = L.marker([data.staffLocation.latitude, data.staffLocation.longitude], { icon: staffIcon, zIndexOffset: 1000 }).addTo(map);
          } else {
            if (window.staffMarker) {
              map.removeLayer(window.staffMarker);
              window.staffMarker = null;
            }
          }

          // Rota Çiz (Polyline)
          if (data.routeCoordinates && data.routeCoordinates.length > 0) {
            if (window.routePolyline) {
              map.removeLayer(window.routePolyline);
            }
            const latlngs = data.routeCoordinates.map(c => [c.latitude, c.longitude]);
            const color = data.routeColor === 'red' ? '#ef4444' : data.routeColor === 'green' ? '#10b981' : '#3b82f6';
            
            window.routePolyline = L.polyline(latlngs, {
              color: color,
              weight: 6,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          } else {
            if (window.routePolyline) {
              map.removeLayer(window.routePolyline);
              window.routePolyline = null;
            }
          }

        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: e.message }));
        }
      }

      initMap(38.4553, 27.2290);
      
      // Web'den gelen güncellemeleri dinle
      window.addEventListener('message', function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type === 'updateData') {
            updateData(decodeURIComponent(msg.data));
          }
        } catch(err) {}
      });
    </script>
  </body>
  </html>
`;

const MAP_HTML_SOURCE = { html: htmlContent };

export const MapView = forwardRef(({ style, initialRegion, campusParcels, bins, selectedParcelId, onMarkerPress, onParcelPress, staffLocation, routeCoordinates, routeColor, showRegionLabels }: any, ref) => {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const [isWebViewLoaded, setIsWebViewLoaded] = useState(false);

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

  useEffect(() => {
    if (webViewRef.current && isWebViewLoaded && Platform.OS !== 'web') {
      const data = { campusParcels, bins, selectedParcelId, staffLocation, routeCoordinates, routeColor, showRegionLabels };
      // Olası tırnak işareti sorunlarını önlemek için encodeURIComponent kullanalım
      const encodedData = encodeURIComponent(JSON.stringify(data));
      webViewRef.current.injectJavaScript(`updateData(decodeURIComponent('${encodedData}')); true;`);
    }
  }, [campusParcels, bins, selectedParcelId, staffLocation, routeCoordinates, routeColor, showRegionLabels, isWebViewLoaded]);

  useEffect(() => {
    if (Platform.OS === 'web' && iframeRef.current) {
      const data = { campusParcels, bins, selectedParcelId, staffLocation, routeCoordinates, routeColor, showRegionLabels };
      const encodedData = encodeURIComponent(JSON.stringify(data));
      try {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ type: 'updateData', data: encodedData }), '*');
      } catch (e) {}
    }
  }, [campusParcels, bins, selectedParcelId, staffLocation, routeCoordinates, routeColor, showRegionLabels]);

  useEffect(() => {
    if (webViewRef.current && initialRegion) {
      webViewRef.current.injectJavaScript(`map.setView([${initialRegion.latitude}, ${initialRegion.longitude}], 15);`);
    }
  }, [initialRegion]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (event: any) => {
        try {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            if (data.type === 'markerPress' && onMarkerPress) {
              onMarkerPress(data.bin);
            } else if (data.type === 'parcelPress' && onParcelPress) {
              onParcelPress(data.parcelId, data.parcelName);
            } else if (data.type === 'error') {
              console.log("Leaflet Web Error:", data.msg);
            }
          }
        } catch (e) {
          // ignore
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [onMarkerPress, onParcelPress]);

  if (Platform.OS === 'web') {
    // @ts-ignore
    return (
      <View style={[style, { flex: 1, backgroundColor: '#f5f5f5' }]}>
        <iframe 
          ref={iframeRef}
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' }}
          onLoad={() => {
            // iframe load olduğunda ilk datayı gönder
            const data = { campusParcels, bins, selectedParcelId, staffLocation, routeCoordinates, routeColor, showRegionLabels };
            const encodedData = encodeURIComponent(JSON.stringify(data));
            try {
              iframeRef.current.contentWindow.postMessage(JSON.stringify({ type: 'updateData', data: encodedData }), '*');
            } catch (e) {}
          }}
        />
      </View>
    );
  }

  return (
    <View style={[style, { flex: 1, backgroundColor: '#f5f5f5' }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={MAP_HTML_SOURCE}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadEnd={() => setIsWebViewLoaded(true)}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'markerPress' && onMarkerPress) {
              onMarkerPress(data.bin);
            } else if (data.type === 'parcelPress' && onParcelPress) {
              onParcelPress(data.parcelId, data.parcelName);
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
