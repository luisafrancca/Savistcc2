const bcrypt = require('bcrypt');

const { Usuario, Endereco, Chefe, Motorista, Documento } = require('../models');

exports.renderEntrada = (req, res) => {
  const sucesso = req.session.sucessoCadastro;
  delete req.session.sucessoCadastro; 

  res.render('index', {
    layout: 'layouts/layoutAuth',
    erroValidacao: null,
    tipoSelecionado: 'paciente',
    camposVazios: false,  
    cpf: '',
    matricula: '',
    sucesso
  });
};

exports.verificarUsuario = async (req, res) => {
  const { tipo, cpf, matricula, senha } = req.body;

  const camposVazios = 
    (tipo === 'paciente' && (!cpf || !senha)) ||
    (tipo === 'funcionario' && (!matricula || !senha));

  if (camposVazios) {
    return res.render('index', {
      layout: 'layouts/layoutAuth',
      erroValidacao: null, 
      camposVazios: true,  
      tipoSelecionado: tipo || 'paciente',
      cpf: cpf || '',
      matricula: matricula || '',
      senha: senha || '',
      sucesso: false
    });
  }

  try {
    let usuario;

    if (tipo === 'paciente') {
      const cpfLimpo = cpf.replace(/\D/g, '');
      usuario = await Usuario.findOne({ where: { CPF: cpfLimpo } });

      if (!usuario) {
        return res.render('index', {
          layout: 'layouts/layoutAuth',
          erroValidacao: 'Credenciais inválidas. Tente novamente.',
          tipoSelecionado: tipo,
          cpf,
          matricula: '',
          sucesso: false
        });
      }

      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

      if (!senhaCorreta) {
        return res.render('index', {
          layout: 'layouts/layoutAuth',
          erroValidacao: 'Credenciais inválidas. Tente novamente.',
          tipoSelecionado: tipo,
          cpf,
          matricula: '',
          sucesso: false
        });
      }

      req.session.usuario = { cod: usuario.cod, nome: usuario.nome };
      return res.redirect('/usuario/inicio/index');
    }

    if (tipo === 'funcionario') {
      usuario = await Motorista.findOne({ where: { matricula } });

      if (usuario) {
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
          return res.render('index', {
            layout: 'layouts/layoutAuth',
            erroValidacao: 'Credenciais inválidas. Tente novamente.',
            tipoSelecionado: tipo,
            cpf: '',
            matricula,
            sucesso: false
          });
        }

        req.session.motorista = { cod: usuario.cod, nome: usuario.nome };
        return res.redirect('/motorista/usuarios/index');
      }

      usuario = await Chefe.findOne({ where: { matricula } });

      if (usuario) {
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
        
        if (!senhaCorreta) {
          return res.render('index', {
            layout: 'layouts/layoutAuth',
            erroValidacao: 'Credenciais inválidas. Tente novamente.',
            tipoSelecionado: tipo,
            cpf: '',
            matricula,
            sucesso: false
          });
        }

        req.session.chefe = { cod: usuario.cod, nome: usuario.nome };
        return res.redirect('/admin/usuarios/index');
      }

      return res.render('index', {
        layout: 'layouts/layoutAuth',
        erroValidacao: 'Credenciais inválidas. Tente novamente.',
        tipoSelecionado: tipo,
        cpf: '',
        matricula,
        sucesso: false
      });
    }

    return res.render('index', {
      layout: 'layouts/layoutAuth',
      erroValidacao: 'Credenciais inválidas. Tente novamente.',
      tipoSelecionado: 'paciente',
      cpf: '',
      matricula: '',
      sucesso: false
    });

  } catch (err) {
    console.error(err);
    return res.status(500).render('index', {
      layout: 'layouts/layoutAuth',
      erroValidacao: 'Erro interno no servidor. Tente novamente.',
      tipoSelecionado: tipo || 'paciente',
      cpf: cpf || '',
      matricula: matricula || '',
      sucesso: false
    });
  }
};