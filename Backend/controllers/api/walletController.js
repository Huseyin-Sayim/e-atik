const { getWalletBalance } = require('../../services/coinLedger');

const getMyWallet = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Giriş yapınız.' });
    }
    const balance = await getWalletBalance(userId);
    res.status(200).json({
      message: 'success',
      data: { balance },
    });
  } catch (err) {
    res.status(500).json({ message: 'Cüzdan bilgisi alınamadı.', error: err.message });
  }
};

module.exports = {
  getMyWallet,
};
