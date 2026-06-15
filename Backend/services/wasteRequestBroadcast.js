/**
 * Prisma'nın döndürdüğü wasteType objesini mobile app'in beklediği
 * legacy string enum'a dönüştürür.
 */
function mapForBroadcast(data) {
  if (!data) return data;
  const mapped = { ...data };
  if (mapped.wasteType !== null && typeof mapped.wasteType === 'object') {
    mapped.wasteTypeDetails = mapped.wasteType;
    mapped.wasteType = mapped.wasteType.legacyEnum || 'DOMESTIC';
  } else if (!mapped.wasteType) {
    mapped.wasteType = 'DOMESTIC';
  }
  return mapped;
}

function broadcastWasteRequestEvent(type, data) {
  if (!global.wss) return;

  const payload = JSON.stringify({ type, data: mapForBroadcast(data) });
  global.wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

module.exports = {
  broadcastWasteRequestCreated: (data) =>
    broadcastWasteRequestEvent('wasteRequestCreated', data),
  broadcastWasteRequestStatusChanged: (data) =>
    broadcastWasteRequestEvent('wasteRequestStatusChanged', data),
};
