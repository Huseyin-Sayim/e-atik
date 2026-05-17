const { getAllEmployeeLocations } = require('../../services/locationStore');

const getEmployeeLocations = async (req, res) => {
  try {
    const employees = getAllEmployeeLocations();
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

module.exports = {
  getEmployeeLocations,
};
