var express = require('express');
var router = express.Router();
const indexController = require('../controllers/indexController');

router.get('/', indexController.renderEntrada);
router.post('/verificarUsuario', indexController.verificarUsuario); 

module.exports = router;
