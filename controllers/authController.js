const bcrypt = require('bcrypt');

const { Usuario, Endereco, Chefe, Motorista, Documento } = require('../models');

exports.renderEtapa1Usuario = (req, res) => {
  let retornoCadastro = '/'

  if (req.session.chefe) {
    retornoCadastro = '/admin/usuarios/index'
  } 
  
  res.render('auth/cadastro/etapa1', {
    layout: 'layouts/layoutAuth',
    preenchido: {
      ...req.session.cadastro?.etapa1, 
    },
    erroCPF: null,
    erroData_nasc: null,
    retornoCadastro
  });
};

exports.processarEtapa1Usuario = async (req, res) => {
  const { nome, CPF, data_nasc, genero } = req.body;
   if (req.session.chefe) {
    retornoCadastro = '/admin/usuarios/index'
  } 
  
  if (req.file) {
    req.session.cadastro = {
      ...req.session.cadastro,
      etapa1: {
        ...req.session.cadastro?.etapa1,
        foto_perfil: req.file.filename
      }
    };
  }

  const foto_perfil = req.file?.filename || req.session.cadastro?.etapa1?.foto_perfil || null;
  
  const erros = {};

  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
  
  const cpfLimpo = CPF.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) 
      erros.CPF = 'CPF inválido. Verifique e tente novamente.';

  const usuarioExistente = await Usuario.findOne({ where: { CPF: cpfLimpo } });
    if (usuarioExistente) 
      erros.CPF = 'Este CPF já está cadastrado.';

    const data = new Date(data_nasc);
    const hoje = new Date();
    const anoMinimo = 1900;

    if (isNaN(data.getTime()) || data > hoje || data.getFullYear() < anoMinimo)
      erros.data_nasc = 'Data de nascimento inválida. Verifique e tente novamente.';


  if (Object.keys(erros).length > 0) {
    return res.render('auth/cadastro/etapa1', {
      layout: 'layouts/layoutAuth',
      preenchido: {
        nome: nomeLimpo,
        CPF: cpfLimpo,
        data_nasc,
        genero,
        foto_perfil, 
      },
      erroCPF: erros.CPF || null,
      erroData_nasc: erros.data_nasc || null,
    });
  }

  req.session.cadastro = {
    ...req.session.cadastro,
    etapa1: {
      foto_perfil,
      nome: nomeLimpo,
      CPF: cpfLimpo,
      data_nasc,
      genero
    }
  };

  res.redirect('/auth/cadastro/etapa2');
};

exports.renderEtapa2Usuario = (req, res) => {
  res.render('auth/cadastro/etapa2', {
    layout: 'layouts/layoutAuth',
    preenchido: req.body,
    erroCEP: null,
  });
};

exports.processarEtapa2Usuario = async (req, res) => {
  const { rua, numero, cidade, bairro, uf, cep } = req.body;

  if (!rua || !numero || !cidade || !bairro || !uf || !cep) {
    return res.render('auth/cadastro/etapa2', {
      layout: 'layouts/layoutAuth',
      preenchido: req.body,
    });
  }

  const cepLimpo = cep.replace(/\D/g, '');
  
  if (cepLimpo.length !== 8) {
    return res.render('auth/cadastro/etapa2', {
      layout: 'layouts/layoutAuth',
      preenchido: req.body,
      erroCEP: 'CEP inválido. Verifique e tente novamente.',
    });
  }

  req.session.cadastro = {
    ...req.session.cadastro,
    etapa2: { rua, numero, bairro, cidade, uf, cep }
  };

  res.redirect('/auth/cadastro/etapa3');
};

exports.renderEtapa3Usuario = (req, res) => {
  res.render('auth/cadastro/etapa3', {
    layout: 'layouts/layoutAuth',
    preenchido: req.body,
    erroEmail: null,
    erroFone: null,
    erroSUS: null,
    erroSenha: null
  });
};

exports.processarEtapa3Usuario = async (req, res) => {
  const { email, fone, senha, SUS } = req.body;
  const erros = {}; 

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    erros.email = 'Email inválido. Verifique e tente novamente.';

  const foneLimpo = fone.replace(/\D/g, '');

  if (foneLimpo.length < 10 || foneLimpo.length > 11)
    erros.fone = 'Telefone inválido. Verifique e tente novamente.';

  const susLimpo = SUS.replace(/\D/g, '');

  if (susLimpo.length !== 15) 
    erros.SUS = 'Número inválido. Verifique e tente novamente.';

  const susExistente = await Usuario.findOne({ where: { SUS: susLimpo } });
  
  if (susExistente) 
    erros.SUS = 'Este CNS já está cadastrado.';
  
  const senhaValida = senha.length >= 8 &&
                      /\d/.test(senha) &&
                      /[!@#$%^&*(),.?":{}|<>]/.test(senha) &&
                      /[A-Z]/.test(senha) &&
                      /[a-z]/.test(senha);

  if (!senhaValida) {
    erros.senha = 'Senha inválida. Verifique e tente novamente.';
  }

  if (Object.keys(erros).length > 0) {
    return res.render('auth/cadastro/etapa3', {
      layout: 'layouts/layoutAuth',
      preenchido: req.body,
      erroEmail: erros.email || null,
      erroFone: erros.fone || null,
      erroSUS: erros.SUS || null,
      erroSenha: erros.senha || null
    });
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const etapa1 = req.session.cadastro?.etapa1;
  const etapa2 = req.session.cadastro?.etapa2;

  try {
    const novoEndereco = await Endereco.create({
      rua: etapa2.rua,
      numero: etapa2.numero,
      bairro: etapa2.bairro,
      cidade: etapa2.cidade,
      UF: etapa2.uf,
      CEP: etapa2.cep
    });

    await Usuario.create({
      img: etapa1.foto_perfil,
      nome: etapa1.nome,
      CPF: etapa1.CPF,
      data_nasc: etapa1.data_nasc,
      generoID: etapa1.genero,
      email,
      fone: foneLimpo,
      senha: senhaHash,
      SUS: susLimpo,
      enderecoID: novoEndereco.cod
    });
   
    req.session.cadastro = null;
    req.session.sucessoCadastro = true;

  if (req.session.chefe) {
    res.redirect('/admin/usuarios/index');
  } else {
    res.redirect('/auth/entrada')
  }

  } catch (err) {
    console.error('Erro ao salvar usuário:', err);
    res.render('auth/cadastro/etapa3', {
      layout: 'layouts/layoutAuth',
      preenchido: req.body,
      erroEmail: null,
      erroFone: null,
      erroSUS: null,
      erroSenha: 'Erro interno. Tente novamente mais tarde.'
    });
  }
};

exports.renderEtapa1Motorista = (req, res) => {
  res.render('auth/cadastro-motorista/etapa1', {
    layout: 'layouts/layoutAuth',
    preenchido: {
      ...req.session.cadastroMotorista?.etapa1, 
    },
    erroCPF: null,
    erroData_nasc: null
  });
};

exports.processarEtapa1Motorista = async (req, res) => {
  const { nome, CPF, data_nasc, genero } = req.body;

  if (req.file) {
    req.session.cadastroMotorista = {
      ...req.session.cadastroMotorista,
      etapa1: {
        ...req.session.cadastroMotorista?.etapa1,
        foto_perfil: req.file.filename
      }
    };
  }

  const foto_perfil = req.file?.filename || req.session.cadastroMotorista?.etapa1?.foto_perfil || null;

  const erros = {};

  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');

  const cpfLimpo = CPF.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) erros.CPF = 'CPF inválido. Verifique e tente novamente.';

  const cpfExistente = await Motorista.findOne({ where: { CPF: cpfLimpo } });
  if (cpfExistente) erros.CPF = 'Este CPF já está cadastrado.';

  if (!data_nasc) erros.data_nasc = 'Data de nascimento é obrigatória.';
  
    const data = new Date(data_nasc);
    const hoje = new Date();
    const anoMinimo = 1900;

    if (isNaN(data.getTime()) || data > hoje || data.getFullYear() < anoMinimo)
      erros.data_nasc = 'Data de nascimento inválida. Verifique e tente novamente.';

  if (Object.keys(erros).length > 0) {
    return res.render('auth/cadastro-motorista/etapa1', {
      layout: 'layouts/layoutAuth',
      preenchido: {
        nome: nomeLimpo,
        CPF: cpfLimpo,
        data_nasc,
        genero,
        foto_perfil, 
      },
      erroCPF: erros.CPF || null,
      erroData_nasc: erros.data_nasc || null
    });
  }

  req.session.cadastroMotorista = {
    ...req.session.cadastroMotorista,
    etapa1: { nome: nomeLimpo, CPF: cpfLimpo, data_nasc, genero, foto_perfil }
  };

  res.redirect('/auth/cadastro-motorista/etapa2');
};

exports.renderEtapa2Motorista = (req, res) => {
  res.render('auth/cadastro-motorista/etapa2', {
    layout: 'layouts/layoutAuth',
    preenchido: req.body,
    erroCEP: null
  });
};

exports.processarEtapa2Motorista = (req, res) => {
  const { rua, numero, bairro, cidade, uf, cep } = req.body;
  const erros = {};

  if (!rua || !numero || !bairro || !cidade || !uf || !cep){
    return res.render('auth/cadastro-motorista/etapa2', {
        layout: 'layouts/layoutAuth',
        preenchido: req.body,
      });
  };
  
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) erros.CEP = 'CEP inválido. Verifique e tente novamente.';

  if (Object.keys(erros).length > 0) {
    return res.render('auth/cadastro-motorista/etapa2', {
      layout: 'layouts/layoutAuth',
      preenchido: req.body,
      erroCEP: erros.CEP || null
    });
  }

  req.session.cadastroMotorista = {
    ...req.session.cadastroMotorista,
    etapa2: { rua, numero, bairro, cidade, uf, cep }
  };

  res.redirect('/auth/cadastro-motorista/etapa3');
};

exports.renderEtapa3Motorista = (req, res) => {
  res.render('auth/cadastro-motorista/etapa3', {
    layout: 'layouts/layoutAuth',
    erroDocs: null
  });
};

exports.processarEtapa3Motorista = async (req, res) => {
  try {
    const arquivos = req.files;

    if (!arquivos || Object.keys(arquivos).length === 0) {
      return res.render('auth/cadastro-motorista/etapa3', {
        layout: 'layouts/layoutAuth',
        erroDocs: 'Envie todos os documentos obrigatórios.'
      });
    }

    req.session.cadastroMotorista = {
      ...req.session.cadastroMotorista,
      etapa3: {
        carteira_trab: arquivos?.carteira_trab?.[0]?.filename,
        cursos: arquivos?.cursos?.[0]?.filename,
        habilitacao: arquivos?.habilitacao?.[0]?.filename,
        comprov_resid: arquivos?.comprov_resid?.[0]?.filename,
        comprov_escola: arquivos?.comprov_escola?.[0]?.filename,
        titulo_eleitor: arquivos?.titulo_eleitor?.[0]?.filename,
        ant_crim: arquivos?.ant_crim?.[0]?.filename,
        exame_tox: arquivos?.exame_tox?.[0]?.filename
      }
    };

    res.redirect('/auth/cadastro-motorista/etapa4');

  } catch (err) {
    console.error('Erro ao processar documentos:', err);
    res.render('auth/cadastro-motorista/etapa3', {
      layout: 'layouts/layoutAuth',
      erroDocs: 'Erro ao processar documentos. Tente novamente.'
    });
  }
};

exports.renderEtapa4Motorista = (req, res) => {
  res.render('auth/cadastro-motorista/etapa4', {
    layout: 'layouts/layoutAuth',
    preenchido: req.body,
    erroFone: null,
    erroEmail: null,
    erroMatricula: null,
    erroSenha: null
  });
};

exports.processarEtapa4Motorista = async (req, res) => {
  const { fone, email, matricula, senha } = req.body;
  const erros = {};

  const foneLimpo = fone.replace(/\D/g, '');
  if (foneLimpo.length < 10 || foneLimpo.length > 11)
    erros.fone = 'Telefone inválido. Verifique e tente novamente.';

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    erros.email = 'Email inválido. Verifique e tente novamente.';

  const matriculaVerificando = matricula.replace(/\D/g, '');
  if (!/^\d{4}$/.test(matriculaVerificando))
    erros.matricula = 'Matrícula inválida. Deve conter 4 dígitos.';
  const matriculaExistente = await Motorista.findOne({ where: { matricula: matriculaVerificando } });
  if (matriculaExistente) erros.matricula = 'Esta matrícula já está cadastrada.';

  const senhaValida = senha.length >= 8 &&
                      /\d/.test(senha) &&
                      /[!@#$%^&*(),.?":{}|<>]/.test(senha) &&
                      /[A-Z]/.test(senha) &&
                      /[a-z]/.test(senha);
  if (!senhaValida) erros.senha = 'Senha inválida. Verifique e tente novamente.';

  if (Object.keys(erros).length > 0) {
    return res.render('auth/cadastro-motorista/etapa4', {
      layout: 'layouts/layoutAuth',
      preenchido: req.body,
      erroFone: erros.fone || null,
      erroEmail: erros.email || null,
      erroMatricula: erros.matricula || null,
      erroSenha: erros.senha || null
    });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const etapa1 = req.session.cadastroMotorista?.etapa1;
  const etapa2 = req.session.cadastroMotorista?.etapa2;
  const etapa3 = req.session.cadastroMotorista?.etapa3;

  try {
    const docsCriado = await Documento.create({
      carteira_trab: etapa3.carteira_trab,
      cursos: etapa3.cursos,
      habilitacao: etapa3.habilitacao,
      comprov_resid: etapa3.comprov_resid,
      comprov_escola: etapa3.comprov_escola,
      titulo_eleitor: etapa3.titulo_eleitor,
      ant_crim: etapa3.ant_crim,
      exame_tox: etapa3.exame_tox
    });

    const enderecoCriado = await Endereco.create({
      rua: etapa2.rua,
      numero: etapa2.numero,
      bairro: etapa2.bairro,
      cidade: etapa2.cidade,
      UF: etapa2.uf,
      CEP: etapa2.cep
    });

    await Motorista.create({
      img: etapa1.foto_perfil,
      nome: etapa1.nome,
      data_nasc: etapa1.data_nasc,
      CPF: etapa1.CPF,
      fone: foneLimpo,
      email,
      generoID: etapa1.genero,
      enderecoID: enderecoCriado.cod,
      docsID: docsCriado.cod,
      senha: senhaHash,
      matricula: matriculaVerificando
    });

    req.session.cadastroMotorista = null;
    req.session.sucessoCadastroMotorista = true;
    res.redirect('/admin/motoristas/index');

  } catch (err) {
    console.error('Erro ao salvar motorista:', err);
    res.render('auth/cadastro-motorista/etapa4', {
      layout: 'layouts/layoutAuth',
      preenchido: req.body,
      erroSenha: 'Erro interno. Tente novamente mais tarde.'
    });
  }
};

exports.verificarSessaoUsuario = (req, res, next) => {
  if (!req.session.usuario) {
    return res.redirect('/'); 
  }
  next();
};

exports.verificarSessaoMotorista = (req, res, next) => {
  if (!req.session.motorista) {
    return res.redirect('/');
  }
  next();
};

exports.verificarSessaoChefe = (req, res, next) => {
  if (!req.session.chefe) {
    return res.redirect('/');
  }
  next();
};

exports.logout = (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error("Erro ao destruir sessão:", err);
      }
      res.redirect('/'); 
    });
  } else {
    res.redirect('/');
  }
};