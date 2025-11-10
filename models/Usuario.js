const db = require('./db');

const Usuario = db.sequelize.define('Usuario', {
    cod: {
        type: db.Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
    generoID: { 
        type: db.Sequelize.INTEGER, 
        allowNull: false
    },
    email: {
        type: db.Sequelize.STRING(255),
    },
    fone: {
        type: db.Sequelize.CHAR(16),
        allowNull: false
    },
    enderecoID: {
        type: db.Sequelize.INTEGER,
        allowNull: false
    },
    SUS: {
        type: db.Sequelize.CHAR(15), 
        allowNull: false
    },
    senha: {
        type: db.Sequelize.STRING(255), 
        allowNull: false
    },
    viagemID: {
        type: db.Sequelize.INTEGER,
    },
},{
  timestamps: false   
  });

module.exports = Usuario;