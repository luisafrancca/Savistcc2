const db = require('./db');

const Motorista = db.sequelize.define('motorista', {
  cod: {
    type: db.Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  matricula: {
    type: db.Sequelize.STRING(4),
    unique: true,
    allowNull: false
  },
  img: {
    type: db.Sequelize.STRING(50),
  },
  nome: {
    type: db.Sequelize.STRING(40),
    allowNull: false
  },
  data_nasc: {
    type: db.Sequelize.DATEONLY,
    allowNull: false
  },
  CPF: {
    type: db.Sequelize.CHAR(14),
    allowNull: false,
    unique: true
  },
  fone: {
    type: db.Sequelize.CHAR(16),
    allowNull: false
  },
  email: {
    type: db.Sequelize.STRING(255),
  },
  enderecoID: {
    type: db.Sequelize.INTEGER,
    allowNull: false,
  },
  generoID: {
    type: db.Sequelize.INTEGER,
    allowNull: false,
  },
  docsID: {
    type: db.Sequelize.INTEGER,
    allowNull: false
  },
  senha: {
    type: db.Sequelize.STRING(255), 
    allowNull: false
  },
  habilitado: {
    type: db.Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'motorista',
  timestamps: false,
});

module.exports = Motorista;
