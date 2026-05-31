function broadcastWasteRequestEvent(type, data) {
  if (!global.wss) return;

  global.wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type, data }));
    }
  });
}

module.exports = {
  broadcastWasteRequestCreated: (data) =>
    broadcastWasteRequestEvent('wasteRequestCreated', data),
  broadcastWasteRequestStatusChanged: (data) =>
    broadcastWasteRequestEvent('wasteRequestStatusChanged', data),
};
