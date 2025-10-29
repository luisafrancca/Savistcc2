const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authController = require('../controllers/authController');

// configuração do Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

router.get('/cadastro/etapa1', authController.renderEtapa1Usuario);
router.post('/cadastro/etapa1/processar', upload.single('foto_perfil'), authController.processarEtapa1Usuario);

router.get('/cadastro/etapa2', authController.renderEtapa2Usuario);
router.post('/cadastro/etapa2/processar', authController.processarEtapa2Usuario);

router.get('/cadastro/etapa3', authController.renderEtapa3Usuario);
router.post('/cadastro/etapa3/processar', authController.processarEtapa3Usuario);

router.get('/cadastro-motorista/etapa1', authController.renderEtapa1Motorista);
router.post('/cadastro-motorista/etapa1/processar', upload.single('foto_perfil'), authController.processarEtapa1Motorista);

router.get('/cadastro-motorista/etapa2', authController.renderEtapa2Motorista);
router.post('/cadastro-motorista/etapa2/processar', authController.processarEtapa2Motorista);

router.get('/cadastro-motorista/etapa3', authController.renderEtapa3Motorista);
router.post(
  '/cadastro-motorista/etapa3/processar',
  upload.fields([
    { name: 'carteira_trab', maxCount: 1 },
    { name: 'cursos', maxCount: 1 },
    { name: 'habilitacao', maxCount: 1 },
    { name: 'comprov_resid', maxCount: 1 },
    { name: 'comprov_escola', maxCount: 1 },
    { name: 'titulo_eleitor', maxCount: 1 },
    { name: 'ant_crim', maxCount: 1 },
    { name: 'exame_tox', maxCount: 1 }
  ]),
  authController.processarEtapa3Motorista
);


router.get('/cadastro-motorista/etapa4', authController.renderEtapa4Motorista);
router.post('/cadastro-motorista/etapa4/processar', authController.processarEtapa4Motorista);

router.get('/sair', authController.logout);

module.exports = router;
