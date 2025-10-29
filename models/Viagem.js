const db = require('./db');

const Viagem = db.sequelize.define('viagem', {
  cod: {
    type: db.Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  cidadeconsulID: { 
  type: db.Sequelize.INTEGER, 
  allowNull: false
  },
  data_viagem: {
    type: db.Sequelize.DATEONLY,
  },
  horario_saida: {
    type: db.Sequelize.TIME,
  },
  veiculoID: {
    type: db.Sequelize.INTEGER,
    allowNull: false,
  },
  motoristaID: {
    type: db.Sequelize.INTEGER,
    allowNull: false,
  },
  statusID: {
    type: db.Sequelize.INTEGER,
    allowNull: false,
  },
  usuarioID: {
    type: db.Sequelize.INTEGER,
  },
  km_inicial: {
    type: db.Sequelize.FLOAT,
  },
  km_final: {
    type: db.Sequelize.FLOAT,
  },
  paradas: {
    type: db.Sequelize.STRING(200),
  },
  horario_chega: {
    type: db.Sequelize.TIME,
  },
  obs: {
    type: db.Sequelize.STRING(255),
  }
}, {
  timestamps: false
});

module.exports = Viagem;
