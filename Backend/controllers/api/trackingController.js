const {
  applyEmployeeLocationUpdate,
} = require('../../services/employeeLocationService');
const { getIO } = require('../../socket');
const { ADMIN_ROOM } = require('../../socket/handlers/employeeTracking');
const {
  listAllEmployeesWithStatus,
  getEmployeeStatusDetail,
} = require('../../services/employeeTrackingService');

const getEmployeeLocations = async (req, res) => {
  try {
    const employees = await listAllEmployeesWithStatus();
    res.status(200).json({
      message: 'OK',
      data: employees,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Çalışan konumları alınamadı.',
      error: err.message,
    });
  }
};

const getEmployeeLocationDetail = async (req, res) => {
  try {
    const detail = await getEmployeeStatusDetail(req.params.userId);
    if (!detail) {
      return res.status(404).json({ message: 'Çalışan bulunamadı.' });
    }
    res.status(200).json({
      message: 'OK',
      data: detail,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Çalışan detayı alınamadı.',
      error: err.message,
    });
  }
};

const postEmployeeLocation = async (req, res) => {
  try {
    const result = await applyEmployeeLocationUpdate(req.user.userId, req.body);

    if (!result.ok) {
      const status =
        result.reason === 'unauthorized'
          ? 403
          : result.reason === 'outside_campus' || result.reason === 'invalid_coordinates'
            ? 400
            : 429;
      return res.status(status).json({
        message: result.message || 'Konum güncellenemedi.',
        reason: result.reason,
      });
    }

    try {
      getIO().to(ADMIN_ROOM).emit('location:employee:update', result.entry);
    } catch {
      /* Socket henüz başlamamış olabilir (test ortamı) */
    }

    res.status(200).json({
      message: 'OK',
      data: result.entry,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Konum güncellenemedi.',
      error: err.message,
    });
  }
};

module.exports = {
  getEmployeeLocations,
  getEmployeeLocationDetail,
  postEmployeeLocation,
};
