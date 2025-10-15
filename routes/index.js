var express = require('express');
var router = express.Router();

/* GET home page. */
// Route ini biasanya sudah ada dan mungkin merender 'index.ejs'
router.get('/', function(req, res, next) {
  // Anda bisa arahkan ini ke halaman 'front' juga jika mau
  // res.render('front', { title: 'Kontrol Suhu Cerdas' });
  res.render('index', { title: 'Express' });
});

/* ================================================
  TAMBAHKAN ROUTE BARU DI BAWAH INI 
================================================
*/

/* GET Halaman Kontrol Suhu */
router.get('/kontrol-suhu', function(req, res, next) {
  // 'front' adalah nama file (front.ejs) di dalam folder /views
  res.render('front', { title: 'Kontrol Suhu Cerdas' }); 
});


module.exports = router;
