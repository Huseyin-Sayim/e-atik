const fs = require('fs');
const path = require('path');


// BU FONKSİYON DÜZENLENECEK

const getRegion = async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'public', 'data', 'bornova.geojson');
    fs.readFile(filePath, 'utf8', (err, data)  => {
      if (err) {
        console.log(err.message)
        return res.status(400).json({
          message: 'Dosya okunamadı' + err.message
        })
      }

      const geo = JSON.parse(data);

      return res.status(200).json({
        message: 'OK',
        data: geo
      })

    })
  } catch (err) {
    res.status(500).json({
      message: "Hata " + err.message
    })
  }
}

module.exports = {
  getRegion
}