const { getRecyclingStatsForDashboard } = require('../../services/recyclingStats');

const getRecyclingStats = async (req, res) => {
  try {
    const stats = await getRecyclingStatsForDashboard();
    res.status(200).json({
      message: 'OK',
      data: stats,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Geri dönüşüm istatistikleri alınamadı.',
      error: err.message,
    });
  }
};

module.exports = {
  getRecyclingStats,
};
