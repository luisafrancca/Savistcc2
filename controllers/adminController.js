const {
  Usuario,
  Endereco,
  Genero,
  Motorista,
  Chefe,
  Documento,
  Viagem,
  Status,
  CidadeConsul,
  Solicitacao,
  Acompanhante,
  Participante,
  Veiculo,
  
} = require("../models");
const { Op } = require("sequelize");
const { Sequelize } = require("sequelize");
const bcrypt = require("bcrypt");
const { removerViagensCanceladasPassadas } = require("../utils/cronViagens");

//PARA ENSERIR O ADMIN

/*async function inserirChefeAutomatico() {
  try {
    const matricula = 5555;
    const senha = '12345Be!';
    const nome = 'Administrador';

    const senhaHash = await bcrypt.hash(senha, 10);

    const chefe = await Chefe.create({
      nome,
      matricula, 
      senha: senhaHash
    });

    console.log('Chefe inserido com sucesso:', chefe.toJSON());
  } catch (err) {
    console.error('Erro ao inserir chefe:', err);
  }
}


inserirChefeAutomatico(); */

exports.renderPerfil = async (req, res) => {
  try {
    if (!req.session.chefe) return res.status(403).send("Você precisa estar logado");

    const chefe = await Chefe.findByPk(req.session.chefe.cod);

    if (!chefe) return res.status(404).send("Admin não encontrado");

    res.render('admin/perfil/index', {
      admin: chefe,
      layout: 'layouts/layoutAdmin',
      paginaAtual: 'perfil',
      userType: 'admin'
    });
  } catch (err) {
    console.error("Erro ao carregar perfil do admin:", err);
    res.status(500).send("Erro no servidor");
  }
};

exports.renderMudarSenha = async (req, res) => {
   const codChefe = req.session.chefe.cod;

   const chefe = await Chefe.findOne({
      where: { cod: codChefe}
    });

   res.render('admin/perfil/senha', {
      chefe,
      layout: 'layouts/layoutAdmin',
      paginaAtual: 'perfil',
      userType: 'chefe',
      erroSenha: null
    });
};

exports.atualizarSenha = async (req, res) => {
  try {
    const { senhaAtual, senhaNova } = req.body;
    const cod = req.session.chefe.cod;

    const chefe = await Chefe.findByPk(cod);

    if (!chefe) {
      return res.render('admin/perfil/senha', {
        layout: 'layouts/layoutAdmin',
        paginaAtual: 'perfil',
        userType: 'chefe',
        erroSenha: 'Administrador não encontrado.'
      });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, chefe.senha);
    if (!senhaCorreta) {
      return res.render('admin/perfil/senha', {
        layout: 'layouts/layoutAdmin',
        paginaAtual: 'perfil',
        userType: 'chefe',
        erroSenha: 'Senha atual inválida, verifique e tente novamente.'
      });
    }

    const senhaValida =
      senhaNova.length >= 8 &&
      /\d/.test(senhaNova) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(senhaNova) &&
      /[A-Z]/.test(senhaNova) &&
      /[a-z]/.test(senhaNova);

    if (!senhaValida) {
      return res.render('admin/perfil/senha', {
        layout: 'layouts/layoutAdmin',
        paginaAtual: 'perfil',
        userType: 'chefe',
        erroSenha:
          'Nova senha inválida, verifique e tente novamente.'
      });
    }

    const hashNovaSenha = await bcrypt.hash(senhaNova, 10);
    await Chefe.update(
      { senha: hashNovaSenha },
      { where: { cod } }
    );

    
    res.redirect('/admin/perfil');

  } catch (error) {
    console.error(error);
    return res.render('admin/perfil/senha', {
      layout: 'layouts/layoutAdmin',
      paginaAtual: 'perfil',
      userType: 'chefe',
      erroSenha: 'Ocorreu um erro ao atualizar a senha. Tente novamente.'
    });
  }
};

exports.renderUsuarios = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const termo = req.query.q ? req.query.q.trim() : '';

    const whereCondition = termo
      ? {
          [Sequelize.Op.or]: [
            { nome: { [Sequelize.Op.like]: `%${termo}%` } },
            { CPF: { [Sequelize.Op.like]: `%${termo}%` } },
          ],
        }
      : {};

    const { count, rows } = await Usuario.findAndCountAll({
      where: whereCondition,
      include: [{ model: Endereco }, { model: Genero }],
      order: [['cod', 'DESC']],
      limit,
      offset,
    });

    const totalPaginas = Math.ceil(count / limit);

    const sucesso = req.session.sucessoCadastro;
    delete req.session.sucessoCadastro; 

    res.render('admin/usuarios/index', {
      posts: rows,
      totalPaginas,
      paginaNun: page,
      termoPesquisa: termo,
      layout: 'layouts/layoutAdmin',
      paginaAtual: 'usuarios',
      sucesso
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send('Erro ao buscar usuários: ' + erro);
  }
};

exports.deletarUsuarios = async (req, res) => {
  try {
    const { cod } = req.params;
    const usuario = await Usuario.findByPk(cod);
    if (!usuario) {
      return res.status(404).send("Usuário não encontrado");
    }
    await usuario.destroy();
    res.redirect("/admin/usuarios/index");
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    res.status(500).send("Erro interno no servidor");
  }
};

exports.editarUsuario = async (req, res) => {
  try {
    const cod = req.params.cod;
    const usuario = await Usuario.findOne({
      where: { cod },
      include: [{ model: Endereco }, { model: Genero }],
    });
    if (!usuario) {
      return res.status(404).send("Usuário não encontrado");
    }
    res.render("admin/usuarios/editar", {
      usuario,
      layout: "layouts/layoutAdmin",
      paginaAtual: "usuarios",
      erros: {},
      preenchido: {},
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao carregar usuário para edição");
  }
};

exports.salvarEdicaoUsuario = async (req, res) => {
  try {
    const cod = req.params.cod;
    const usuario = await Usuario.findByPk(cod, {
      include: [{ model: Endereco }, { model: Genero }],
    });

    if (!usuario) return res.status(404).send("Usuário não encontrado");

    const { CPF, fone, cep, email, SUS } = req.body;
    let erros = {};
    let preenchido = req.body;

    if (!CPF || CPF.replace(/\D/g, "").length !== 11) {
      erros.erroCPF = "CPF inválido. Deve conter 11 dígitos.";
    }

    if (!fone || fone.replace(/\D/g, "").length !== 11) {
      erros.erroFone = "Telefone inválido. Deve conter 11 dígitos.";
    }

    if (!cep || cep.replace(/\D/g, "").length !== 8) {
      erros.erroCEP = "CEP inválido. Deve conter 8 dígitos.";
    }

    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !regexEmail.test(email)) {
      erros.erroEmail = "Digite um email válido.";
    }

    if (!SUS || SUS.replace(/\D/g, "").length !== 15) {
      erros.erroSUS = "Número do SUS inválido. Deve conter 15 dígitos.";
    }

    if (Object.keys(erros).length > 0) {
      return res.render("admin/usuarios/editar", {
        usuario,
        layout: "layouts/layoutAdmin",
        paginaAtual: "usuarios",
        erros,
        preenchido,
      });
    }

    await Endereco.update(
      {
        rua: req.body.rua,
        numero: req.body.numero,
        bairro: req.body.bairro,
        cidade: req.body.cidade,
        UF: req.body.uf,
        CEP: req.body.cep.replace(/\D/g, ""),
      },
      { where: { cod: usuario.enderecoID } }
    );

    const fotoPerfil = req.file ? req.file.filename : usuario.img;

    await Usuario.update(
      {
        img: fotoPerfil,
        nome: req.body.nome,
        data_nasc: req.body.data_nasc,
        CPF: req.body.CPF.replace(/\D/g, ""),
        generoID: req.body.genero,
        email: req.body.email,
        fone: req.body.fone.replace(/\D/g, ""),
        SUS: req.body.SUS.replace(/\D/g, ""),
      },
      { where: { cod } }
    );

    res.redirect("/admin/usuarios/index");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao salvar edição: " + erro);
  }
};

exports.renderMotoristas = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const termo = req.query.q ? req.query.q.trim() : '';

    const whereCondition = termo
      ? {
          [Op.or]: [
            { nome: { [Op.like]: `%${termo}%` } },
            { CPF: { [Op.like]: `%${termo}%` } },
          ],
        }
      : {};

    const { count, rows } = await Motorista.findAndCountAll({
      where: whereCondition,
      include: [{ model: Endereco }, { model: Genero }, { model: Documento }],
      order: [['cod', 'DESC']],
      limit,
      offset,
    });

    const totalPaginas = Math.ceil(count / limit);

    const sucesso = req.session.sucessoCadastroMotorista;
    delete req.session.sucessoCadastroMotorista; 

    res.render('admin/motoristas/index', {
      posts: rows,
      totalPaginas,
      paginaNun: page, 
      termoPesquisa: termo,
      layout: 'layouts/layoutAdmin',
      paginaAtual: 'motoristas',
      sucesso
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send('Erro ao buscar motoristas: ' + erro);
  }
};

exports.deletarMotoristas = async (req, res) => {
  try {
    const { cod } = req.params;
    const motorista = await Motorista.findByPk(cod);
    if (!motorista) {
      return res.status(404).send("Motorista não encontrado");
    }
    await motorista.destroy();
    res.redirect("/admin/motoristas/index");
  } catch (error) {
    console.error("Erro ao deletar motorista:", error);
    res.status(500).send("Erro interno no servidor");
  }
};

exports.habilitadoMotorista = async (req, res) => {
  try {
    const { cod } = req.params; 

    const motorista = await Motorista.findByPk(cod);
    if (!motorista) {
      return res.status(404).send('Motorista não encontrado');
    }

    const novoStatus = !motorista.habilitado; //valor invertido

    await Motorista.update(
      { habilitado: novoStatus },
      { where: { cod } }
    );

    res.json({ sucesso: true, habilitado: novoStatus });
  } catch (err) {
    console.error('Erro ao alterar status do motorista:', err);
    res.status(500).send('Erro interno ao atualizar motorista');
  }
};

exports.editarMotorista = async (req, res) => {
  try {
    const cod = req.params.cod;
    const motorista = await Motorista.findOne({
      where: { cod },
      include: [{ model: Endereco }, { model: Genero }],
    });
    if (!motorista) {
      return res.status(404).send("Motorista não encontrado");
    }
    res.render("admin/motoristas/editar", {
      usuario: motorista,
      layout: "layouts/layoutAdmin",
      paginaAtual: "motoristas",
      erros: {},
      preenchido: {},
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao carregar motorista para edição");
  }
};

exports.salvarEdicaoMotorista = async (req, res) => {
  try {
    console.log(req.files);

    const cod = req.params.cod;
    const motorista = await Motorista.findByPk(cod, {
      include: [{ model: Endereco }, { model: Genero }, { model: Documento }],
    });

    if (!motorista) return res.status(404).send("Motorista não encontrado");

    const { CPF, fone, cep, email } = req.body;
    let erros = {};
    let preenchido = req.body;

    // validação CPF
    if (!CPF || CPF.replace(/\D/g, "").length !== 11) {
      erros.erroCPF = "CPF inválido. Deve conter 11 dígitos.";
    }

    // validação Telefone
    if (!fone || fone.replace(/\D/g, "").length !== 11) {
      erros.erroFone = "Telefone inválido. Deve conter 11 dígitos.";
    }

    // validação CEP
    if (!cep || cep.replace(/\D/g, "").length !== 8) {
      erros.erroCEP = "CEP inválido. Deve conter 8 dígitos.";
    }

    // validação Email
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !regexEmail.test(email)) {
      erros.erroEmail = "Digite um email válido.";
    }

    // se houver qualquer erro, renderiza de volta com mensagens
    if (Object.keys(erros).length > 0) {
      return res.render("admin/motoristas/editar", {
        usuario: motorista,
        layout: "layouts/layoutAdmin",
        paginaAtual: "motoristas",
        erros,
        preenchido,
      });
    }

    // Atualiza endereço
    await Endereco.update(
      {
        rua: req.body.rua,
        numero: req.body.numero,
        bairro: req.body.bairro,
        cidade: req.body.cidade,
        UF: req.body.uf,
        CEP: req.body.cep.replace(/\D/g, ""),
      },
      { where: { cod: motorista.enderecoID } }
    );

    // Atualiza dados do motorista
    const fotoPerfil = req.files?.foto_perfil?.[0]?.filename || motorista.img;

    await Motorista.update(
      {
        img: fotoPerfil,
        nome: req.body.nome,
        data_nasc: req.body.data_nasc,
        CPF: req.body.CPF.replace(/\D/g, ""),
        generoID: req.body.genero,
        email: req.body.email,
        fone: req.body.fone.replace(/\D/g, ""),
      },
      { where: { cod } }
    );

    // Atualiza ou cria documentos
    const camposDocumentos = [
      "carteira_trab",
      "cursos",
      "habilitacao",
      "comprov_resid",
      "comprov_escola",
      "titulo_eleitor",
      "ant_crim",
      "exame_tox",
    ];

    if (!motorista.docsID && Object.keys(req.files || {}).length > 0) {
      // cria novo Documento
      const novoDoc = {};
      camposDocumentos.forEach((campo) => {
        if (req.files[campo]) novoDoc[campo] = req.files[campo][0].filename;
      });
      const documentoCriado = await Documento.create(novoDoc);
      await Motorista.update(
        { docsID: documentoCriado.cod },
        { where: { cod } }
      );
    } else if (motorista.docsID && Object.keys(req.files || {}).length > 0) {
      // atualiza documento existente
      const novosDados = {};
      camposDocumentos.forEach((campo) => {
        if (req.files[campo]) novosDados[campo] = req.files[campo][0].filename;
      });
      if (Object.keys(novosDados).length > 0) {
        await Documento.update(novosDados, {
          where: { cod: motorista.docsID },
        });
      }
    }

    res.redirect("/admin/motoristas/index");
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao salvar edição: " + erro);
  }
};

exports.renderViagens = async (req, res) => {
  await removerViagensCanceladasPassadas();
  res.render("admin/viagens/index", {
    layout: "layouts/layoutAdmin",
    paginaAtual: "viagens",
  });
};

exports.renderBuscarEventos = async (req, res) => {
  const viagens = await Viagem.findAll({
    include: [
      { model: CidadeConsul },
    ],
  });

  const eventos = viagens.map((v) => {
 
    let corFundo = '#a2c3f2';
    let corBorda = '#87afe6';
    let corTexto = '#fff';

    switch (v.statusID) {
      case 1: // AGENDADA
        corFundo = '#a2c3f2'; 
        corBorda = '#87afe6';
        corTexto = '#fff';
        break;
      case 2: // "CANCELADA"
        corFundo = '#c38883ff'; 
        corBorda = '#ac6a64ff';
        corTexto = '#fff';
        break;
      case 3: // "CONCLUIDA"
        corFundo = '#bcde9eff'; 
        corBorda = '#a1d49fff';
        corTexto = '#fff';
        break;
    }

    return {
      title: v.cidadeconsul.descricao,
      start: v.data_viagem,
      url: `/admin/viagens/ver-viagem/${v.cod}`,
      backgroundColor: corFundo,
      borderColor: corBorda,
      textColor: corTexto,
    };
  });

  res.json(eventos);
};

exports.renderNovaViagem = async (req, res) => {
  try {
    const redirectTo = req.get('Referer');
    const cidadeconsul = await CidadeConsul.findAll();
    const motoristas = await Motorista.findAll({
      where: {
        habilitado: true
      }
    });
    const veiculos = await Veiculo.findAll();
    
    const dataSelecionada = req.query.data_viagem || "";
    const cidadeSelecionada = req.query.cidade_consul || "";
    const solicitacaoID = req.query.solicitacaoID || null;
    const preenchido = {
      data_viagem: dataSelecionada,
      cidadeconsulID: cidadeSelecionada
    };
    res.render("admin/viagens/nova-viagem", {
      layout: "layouts/layoutAdmin",
      paginaAtual: "viagens",
      veiculos,
      motoristas,
      cidadeconsul,
      dataSelecionada,
      cidadeSelecionada,
      solicitacaoID,
      redirectTo,
      erros: {}, 
      preenchido
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao carregar motoristas: " + erro);
  }
};

exports.renderCadastrarViagem = async (req, res) => {
  try {
    const { solicitacaoID, cidadeconsulID, data_viagem, horario_saida, veiculoID, motoristaID, redirectTo } = req.body;

    const erros = {};
    const preenchido = { cidadeconsulID, data_viagem, horario_saida, veiculoID, motoristaID };

    if (!cidadeconsulID || !data_viagem || !horario_saida || !veiculoID || !motoristaID) {
      erros.campos = "Preencha todos os campos.";
    }

    if (data_viagem) {
      const hoje = new Date();
      const dataViagem = new Date(data_viagem + "T00:00");
      if (dataViagem <= hoje) erros.data = "A data da viagem deve ser posterior à data atual.";
    }

    if (Object.keys(erros).length > 0) {
      const cidadeconsul = await CidadeConsul.findAll();
      const motoristas = await Motorista.findAll();
      const veiculos = await Veiculo.findAll();

      return res.render("admin/viagens/nova-viagem", {
        layout: "layouts/layoutAdmin",
        paginaAtual: "viagens",
        veiculos,
        motoristas,
        cidadeconsul,
        dataSelecionada: data_viagem,
        cidadeSelecionada: cidadeconsulID,
        solicitacaoID,
        redirectTo,
        erros,
        preenchido
      });
    }

    const novaViagem = await Viagem.create({
      cidadeconsulID,
      data_viagem,
      horario_saida,
      veiculoID,
      motoristaID,
      statusID: 1,
    });

    if (solicitacaoID) {
      const solicitacao = await Solicitacao.findByPk(solicitacaoID);
      if (solicitacao) {
        let acompanhanteCriado = null;

        if (solicitacao.nome_acomp) {
          acompanhanteCriado = await Acompanhante.create({
            nome: solicitacao.nome_acomp,
            cpf: solicitacao.cpf_acomp,
            data_nasc: solicitacao.data_nasc_acomp,
            telefone: solicitacao.telefone_acomp,
            generoID: solicitacao.generoID,
            img: solicitacao.foto_acompanhante || null,
          });
        }

        await Participante.create({
          usuarioID: solicitacao.usuarioID,
          viagemID: novaViagem.cod,
          local_consul: solicitacao.local_consul,
          hora_consul: solicitacao.hora_consul,
          encaminhamento: solicitacao.encaminhamento,
          objetivo: solicitacao.objetivo,
          obs: solicitacao.obs,
          acompanhanteID: acompanhanteCriado ? acompanhanteCriado.cod : null,
        });

        await solicitacao.destroy();
      }
    }

    res.redirect(redirectTo || '/admin/viagens/index');
  } catch (erro) {
    console.error("Erro ao cadastrar viagem:", erro);
    res.status(500).send("Erro ao cadastrar viagem: " + erro);
  }
};

exports.renderVerViagem = async (req, res) => {
  const cod = req.params.cod;
  const viagem = await Viagem.findOne({
    where: { cod },
    include: [
      { model: Motorista, as: "Motorista" },
      { model: Status },
      { model: CidadeConsul },
      { model: Veiculo, as: "veiculo" },
      { model: Participante, as: "participantes" } // precisa incluir
    ],
  });

  let ocupacao = 0;
if (viagem && viagem.participantes) {
  const qtdParticipantes = viagem.participantes.length;
  const qtdAcompanhantes = viagem.participantes.reduce(
    (soma, p) => soma + (p.acompanhanteID ? 1 : 0),
    0
  );
  ocupacao = qtdParticipantes + qtdAcompanhantes;
}

  res.render("admin/viagens/ver-viagem", {
    ocupacao,
    viagem,
    layout: "layouts/layoutAdmin",
    paginaAtual: "viagens",
  });
};

exports.editarViagem = async (req, res) => {
  try {
    const cod = req.params.cod;

    const viagem = await Viagem.findOne({
      where: { cod },
      include: [
        { model: Motorista, as: "Motorista" },
        { model: Status },
        { model: CidadeConsul, as: "cidadeconsul" },
        { model: Veiculo, as: "veiculo" },
      ],
    });

    const motoristas = await Motorista.findAll({
      where: {
        habilitado: true
      }
    });
    const statusLista = await Status.findAll();
    const cidades = await CidadeConsul.findAll();
    const veiculos = await Veiculo.findAll();

    const previousPage = req.get("Referer") || "/admin/viagens/index";

    res.render("admin/viagens/editar", {
      viagem,
      motoristas,
      statusLista,
      cidades,
      veiculos,
      previousPage,
      layout: "layouts/layoutAdmin",
      paginaAtual: "viagens",
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao carregar edição da viagem: " + erro);
  }
};

exports.salvarEdicaoViagem = async (req, res) => {
  try {
    const cod = req.params.cod;

    const viagem = await Viagem.findByPk(cod);
    if (!viagem) {
      return res.status(404).send("Viagem não encontrada");
    }

    await Viagem.update(
      {
        cidadeconsulID: req.body.cidadeconsulID,
        data_viagem: req.body.data_viagem,
        horario_saida: req.body.horario_saida,
        veiculoID: req.body.veiculoID,
        motoristaID: req.body.motoristaID,
        combustivel: req.body.combustivel,
        km_inicial: req.body.km_inicial,
        km_final: req.body.km_final,
        paradas: req.body.paradas,
        horario_chega: req.body.horario_chega,
        obs: req.body.obs,
      },
      {
        where: { cod },
      }
    );

    const redirectTo = req.body.previousPage || "/admin/viagens/index";
    res.redirect(redirectTo);
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao salvar edição da viagem: " + erro);
  }
};

exports.cancelarViagem = async (req, res) => {
  const cod = req.params.cod;

  await Viagem.update({ statusID: 2 }, { where: { cod: cod } });

  const previousPage = req.get("Referer") || "/admin/viagens/index";
  res.redirect(previousPage);
};

exports.verParticipantes = async (req, res) => {
  try {
    const cod = req.params.cod;
    const origem = req.query.origem;
    // Busca viagem e veículo
    const viagem = await Viagem.findByPk(cod, {
      include: [{ model: Veiculo, as: 'veiculo' }]
    });

    if (!viagem) return res.status(404).send('Viagem não encontrada');

    // ----- PAGINAÇÃO -----
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    // ----- PESQUISA -----
    const termo = req.query.q ? req.query.q.trim() : '';
    const whereCondition = termo
      ? {
          viagemId: cod,
          [Sequelize.Op.or]: [
            { '$Usuario.nome$': { [Sequelize.Op.like]: `%${termo}%` } },
            { '$Usuario.CPF$': { [Sequelize.Op.like]: `%${termo}%` } }
          ]
        }
      : { viagemId: cod };

    // ----- BUSCA DOS PARTICIPANTES -----
    const { count, rows } = await Participante.findAndCountAll({
      where: whereCondition,
      include: [
        { model: Usuario, include: [{ model: Genero }, { model: Endereco }] },
        { model: Acompanhante, as: 'acompanhante', include: [{ model: Genero }] }
      ],
      order: [['cod', 'ASC']],
      limit,
      offset
    });

    const totalPaginas = Math.ceil(count / limit);

    // ---- CÁLCULOS ----
    const qtdParticipantes = count;
    const qtdAcompanhantes = rows.reduce(
      (s, p) => s + (p.acompanhante ? 1 : 0),
      0
    );
    const ocupacao = qtdParticipantes + qtdAcompanhantes;

    res.render('admin/viagens/participantes', {
      viagem,
      participantes: rows,
      ocupacao,
      paginaAtual: 'viagens',
      layout: 'layouts/layoutAdmin',
      paginaNun: page,
      totalPaginas,
      termoPesquisa: termo,
      origem
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar participantes da viagem');
  }
};

exports.adicionarParticipante = async (req, res) => {
  const cod = req.params.cod;

  try {

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const termo = req.query.q ? req.query.q.trim() : "";

    const viagem = await Viagem.findOne({
      where: { cod },
      include: [{ model: Participante, as: "participantes", required: false }],
    });

    if (!viagem) {
      return res.status(404).send("Viagem não encontrada");
    }

    const codUsuariosVinculados = viagem.participantes.map(p => p.usuarioID);

    const whereCondition = {
      cod: { [Op.notIn]: codUsuariosVinculados.length ? codUsuariosVinculados : [0] },
      ...(termo
        ? {
            [Op.or]: [
              { nome: { [Op.like]: `%${termo}%` } },
              { CPF: { [Op.like]: `%${termo}%` } },
            ],
          }
        : {}),
    };

    const { count, rows } = await Usuario.findAndCountAll({
      where: whereCondition,
      include: [{ model: Endereco }, { model: Genero }],
      order: [["cod", "DESC"]],
      limit,
      offset,
    });

    const totalPaginas = Math.ceil(count / limit);

    res.render("admin/viagens/adicionar-participante", {
      cod,
      posts: rows, 
      layout: "layouts/layoutAdmin",
      paginaAtual: "viagens",
      totalPaginas,
      paginaNun: page,
      termoPesquisa: termo,
    });
  } catch (error) {
    console.error("Erro ao carregar participantes:", error);
    res.status(500).send("Erro ao carregar participantes");
  }
};

exports.formularioParticipante = async (req, res) => {
  const { cod } = req.params;
  const { usuarioSelecionado } = req.query;

  const usuario = await Usuario.findOne({
    where: { cod: usuarioSelecionado },
    include: [Genero, Endereco],
  });

  const viagem = await Viagem.findOne({
    where: { cod },
    include: [
      {
        model: Participante,
        as: "participantes",
        include: [
          {
            model: Acompanhante,
            as: "acompanhante",
          },
        ],
      },
      {
        model: Veiculo,
        as: "veiculo",
      },
    ],
  });

  // calcula ocupação
  const qtdParticipantes = viagem.participantes.length;
  const qtdAcompanhantes = viagem.participantes.reduce(
    (soma, p) => soma + (p.acompanhante ? 1 : 0),
    0
  );

  const ocupacao = qtdParticipantes + qtdAcompanhantes;

  res.render("admin/viagens/formulario-participante", {
    viagem,
    ocupacao,
    cod,
    usuario,
    layout: "layouts/layoutAdmin",
    paginaAtual: "viagens",
    erros: null,
    preenchido: {}
  });
};

exports.vincularUsuario = async (req, res) => {
  try {
    const cod = req.params.cod; // viagemID
    const usuarioID = req.body.usuarioID; // vem do input hidden

   const {
      local_consul,
      hora_consul,
      objetivo,
      temAcompanhante,
      nome_acomp,
      cpf_acomp,
      data_nasc_acomp,
      telefone_acomp,
      generoID,
      obs
    } = req.body;

    const encaminhamento = req.files?.encaminhamento?.[0]?.filename || null;
    const foto_acompanhante = req.files?.foto_acompanhante?.[0]?.filename || null;

    const erros = {};
    const preenchido = {
      local_consul,
      hora_consul,
      objetivo,
      obs,
      temAcompanhante,
      nome_acomp,
      cpf_acomp,
      data_nasc_acomp,
      telefone_acomp,
      generoID
    };

    if (!local_consul?.trim()) erros.local_consul = true;
    if (!hora_consul) erros.hora_consul = true;
    if (!objetivo?.trim()) erros.objetivo = true;
    if (!encaminhamento) erros.encaminhamento = true;

    if (temAcompanhante === "sim") {

      if (!nome_acomp?.trim()) erros.nome_acomp = true;

      if (!cpf_acomp?.trim()) {
        erros.cpf_acomp = true;
      } else {
        const cpfLimpo = cpf_acomp.replace(/\D/g, '');
        if (cpfLimpo.length !== 11) erros.cpf_acomp = 'CPF inválido. Verifique e tente novamente.';
      }

      if (!data_nasc_acomp) {
        erros.data_nasc_acomp = true;
      } else {
        const data = new Date(data_nasc_acomp);
        const hoje = new Date();
        const anoMinimo = 1900;
        if (isNaN(data.getTime()) || data > hoje || data.getFullYear() < anoMinimo)
          erros.data_nasc_acomp = 'Data de nascimento inválida. Verifique e tente novamente.';
      }

      if (!telefone_acomp?.trim()) {
        erros.telefone_acomp = true;
      } else {
        const telefoneLimpo = telefone_acomp.replace(/\D/g, '');
        if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11)
          erros.telefone_acomp = 'Telefone inválido. Verifique e tente novamente.';
      }

      if (!generoID) erros.generoID = true;
    }

    if (Object.keys(erros).length > 0) {
      const usuario = await Usuario.findOne({
        where: { cod: usuarioID },
        include: [Genero, Endereco]
      });

      const viagem = await Viagem.findOne({
        where: { cod },
        include: [
          {
            model: Participante,
            as: 'participantes',
            include: [{ model: Acompanhante, as: 'acompanhante' }]
          },
          { model: Veiculo, as: 'veiculo' }
        ]
      });

      const qtdParticipantes = viagem.participantes.length;
      const qtdAcompanhantes = viagem.participantes.reduce(
        (soma, p) => soma + (p.acompanhante ? 1 : 0),
        0
      );
      const ocupacao = qtdParticipantes + qtdAcompanhantes;

      return res.render('admin/viagens/formulario-participante', {
        ocupacao,
        viagem,
        usuario,
        cod: usuarioID,
        layout: 'layouts/layoutAdmin',
        paginaAtual: 'agenda',
        erros,
        preenchido
      });
    }

    let acompanhanteID = null;
    
    if (temAcompanhante === "sim") {
      const novoAcomp = await Acompanhante.create({
        img: foto_acompanhante, 
        nome: nome_acomp,
        cpf: cpf_acomp,
        data_nasc: data_nasc_acomp,
        generoID,
        telefone: telefone_acomp,
      });

      acompanhanteID = novoAcomp.cod; 
    }

    let encaminhamentoFile = encaminhamento;
    if (
      req.files &&
      req.files["encaminhamento"] &&
      req.files["encaminhamento"][0]
    ) {
      encaminhamentoFile = req.files["encaminhamento"][0].filename;
    }

    await Participante.create({
      usuarioID,
      viagemID: cod,
      local_consul,
      hora_consul,
      encaminhamento: encaminhamentoFile,
      objetivo,
      obs: obs || null,
      acompanhanteID, 
      statusID: 1,
    });

    res.redirect(`/admin/viagens/participantes/${cod}`);
  } catch (error) {
    console.error("Erro ao vincular usuário:", error);
    res.status(500).send("Erro ao vincular usuário à viagem");
  }
};

exports.renderViagensLista = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const cidade = req.query.cidade ? req.query.cidade.trim() : '';
    const data = req.query.data || '';

    let where = {};
    if (data) {
      where.data_viagem = { [Op.between]: [data + ' 00:00:00', data + ' 23:59:59'] };
    }
    const includeCidade = {
      model: CidadeConsul,
      as: 'cidadeconsul',
      ...(cidade && { where: { descricao: { [Op.like]: `%${cidade}%` } } })
    };

    const { count, rows } = await Viagem.findAndCountAll({
      where,
      include: [
        { model: Motorista, as: 'Motorista' },
        { model: Status, as: 'status' },
        includeCidade,
        { model: Veiculo, as: 'veiculo' },
        { model: Participante, as: 'participantes' }
      ],
      order: [['data_viagem', 'DESC'], ['horario_saida', 'DESC']],
      limit,
      offset,
      distinct: true 
    });

    // calcula ocupação
    const viagensComOcupacao = rows.map(v => {
      const qtdParticipantes = v.participantes.length;
      const qtdAcompanhantes = v.participantes.reduce((soma, p) => soma + (p.acompanhanteID ? 1 : 0), 0);
      return { ...v.toJSON(), ocupacao: qtdParticipantes + qtdAcompanhantes };
    });

    const viagensComCores = viagensComOcupacao.map(v => {
      let corFundo, corCabeca;
      switch (v.statusID) {
        case 1: corFundo = '#d1e3fd'; corCabeca = '#a7c9f9'; break;
        case 2: corFundo = '#c38883'; corCabeca = '#ac6a64'; break;
        case 3: corFundo = '#bcde9e'; corCabeca = '#a1d49f'; break;
        default: corFundo = '#d1e3fd'; corCabeca = '#a7c9f9';
      }
      return { ...v, corFundo, corCabeca };
    });

    const totalPaginas = Math.max(1, Math.ceil(count / limit));

    res.render('admin/viagens/lista', {
      viagens: viagensComCores,
      layout: 'layouts/layoutAdmin',
      paginaAtual: 'viagens',
      totalPaginas,
      paginaNun: page,
      termoCidade: cidade,
      termoData: data
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).send('Erro ao buscar viagens: ' + erro);
  }
};

exports.desvincularParticipante = async (req, res) => {
  try {
    const { cod } = req.params;
    
    const participante = await Participante.findByPk(cod);
    if (!participante) {
      return res.status(404).send("Participante não encontrado");
    }

    const viagemID = participante.viagemID;

    await Participante.destroy({ where: { cod } });

    res.redirect(`/admin/viagens/participantes/${viagemID}`);
  } catch (error) {
    console.error("Erro ao desvincular", error);
  }
};

exports.renderSolicitacoes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Página atual (default: 1)
    const limit = 5; // Quantos registros por página
    const offset = (page - 1) * limit;

    const solicitacoes = await Solicitacao.findAll({
      include: [
        { model: CidadeConsul },
        { model: Usuario }
      ]
    });

    const viagens = await Viagem.findAll({
      include: [
        { model: CidadeConsul },
        { model: Status, where: { cod: '1' } },
        { model: Veiculo, as: "veiculo" },
        { model: Participante, as: "participantes" }
      ]
    });

    // Calcular ocupação
    const viagensComOcupacao = viagens.map((v) => {
      const qtdParticipantes = v.participantes.length;
      const qtdAcompanhantes = v.participantes.reduce(
        (soma, p) => soma + (p.acompanhanteID ? 1 : 0),
        0
      );
      return {
        ...v.toJSON(),
        ocupacao: qtdParticipantes + qtdAcompanhantes
      };
    });

    // Normaliza data para formato YYYY-MM-DD
    const normalizarData = (data) => {
      if (!data) return null;
      const d = new Date(data);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Filtrar solicitações compatíveis
    const solicitacoesFiltradas = solicitacoes.filter((sol) => {
      const dataSolicitacao = normalizarData(sol.data_consul);
      const viagemCompatível = viagensComOcupacao.find((v) => {
        const dataViagem = normalizarData(v.data_viagem);
        return (
          v.cidadeconsulID === sol.cidadeconsulID &&
          dataViagem === dataSolicitacao &&
          v.ocupacao < v.veiculo.lugares_dispo
        );
      });
      return !viagemCompatível;
    });

    // Aplicar paginação manual (slice)
    const totalSolicitacoes = solicitacoesFiltradas.length;
    const totalPaginas = Math.ceil(totalSolicitacoes / limit);
    const solicitacoesPaginadas = solicitacoesFiltradas.slice(offset, offset + limit);

    res.render("admin/solicitacoes/index", {
      layout: "layouts/layoutAdmin",
      paginaAtual: "solicitacoes",
      solicitacoes: solicitacoesPaginadas,
      totalPaginas,
      paginaNun: page,
    });

  } catch (erro) {
    console.error("Erro ao carregar solicitações:", erro);
    res.status(500).send("Erro ao carregar solicitações");
  }
};

exports.renderParticipacoes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const solicitacoes = await Solicitacao.findAll({
      include: [
        { model: CidadeConsul },
        { model: Usuario }
      ]
    });

    const viagens = await Viagem.findAll({
      include: [
        { model: CidadeConsul },
        { model: Status, where: { cod: '1' } },
        { model: Veiculo, as: "veiculo" },
        { model: Participante, as: "participantes" }
      ]
    });

    // Calcular ocupação
    const viagensComOcupacao = viagens.map((v) => {
      const qtdParticipantes = v.participantes.length;
      const qtdAcompanhantes = v.participantes.reduce(
        (soma, p) => soma + (p.acompanhanteID ? 1 : 0),
        0
      );
      return {
        ...v.toJSON(),
        ocupacao: qtdParticipantes + qtdAcompanhantes
      };
    });

    const normalizarData = (data) => {
      if (!data) return null;
      const d = new Date(data);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const solicitacoesFiltradas = solicitacoes.filter((sol) => {
      const dataSolicitacao = normalizarData(sol.data_consul);
      const viagemCompatível = viagensComOcupacao.find((v) => {
        const dataViagem = normalizarData(v.data_viagem);
        return (
          v.cidadeconsulID === sol.cidadeconsulID &&
          dataViagem === dataSolicitacao &&
          v.ocupacao < v.veiculo.lugares_dispo
        );
      });
      return viagemCompatível;
    });

    // Paginação
    const totalSolicitacoes = solicitacoesFiltradas.length;
    const totalPaginas = Math.ceil(totalSolicitacoes / limit);
    const solicitacoesPaginadas = solicitacoesFiltradas.slice(offset, offset + limit);

    res.render("admin/solicitacoes/participacoes", {
      layout: "layouts/layoutAdmin",
      paginaAtual: "solicitacoes",
      solicitacoes: solicitacoesPaginadas,
      totalPaginas,
      paginaNun: page,
    });

  } catch (erro) {
    console.error("Erro ao carregar solicitações:", erro);
    res.status(500).send("Erro ao carregar solicitações");
  }
};

exports.rejeitarSolicitacoe = async (req, res) => {
  const { cod } = req.params;

  const solicitacao = await Solicitacao.findByPk(cod);

  await solicitacao.destroy();

  res.redirect("/admin/solicitacoes/index");
};

exports.rejeitarSolicitacoeParticipacao = async (req, res) => {
  const { cod } = req.params;

  const solicitacao = await Solicitacao.findByPk(cod);

  await solicitacao.destroy();

  res.redirect("/admin/solicitacoes/participacoes");
};

exports.aceitarSolicitacoe = async (req, res) => {
  try {
    const solicitacaoID = req.params.cod;

    // Busca a solicitação
    const solicitacao = await Solicitacao.findByPk(solicitacaoID);
    if (!solicitacao) return res.status(404).send("Solicitação não encontrada");

    // Função para normalizar datas (YYYY-MM-DD)
    const normalizarData = (data) => {
      if (!data) return null;
      const d = new Date(data);
      return d.toISOString().slice(0, 10);
    };

    const dataSolicitacao = normalizarData(solicitacao.data_consul);

    // Buscar viagens compatíveis na mesma cidade
    const viagens = await Viagem.findAll({
      where: { cidadeconsulID: solicitacao.cidadeconsulID },
      include: [
        { model: Veiculo, as: "veiculo" },
        { model: Participante, as: "participantes" }
      ]
    });

    // Encontrar primeira viagem compatível com vaga
    const viagemCompatível = viagens.find((v) => {
      const dataViagem = normalizarData(v.data_viagem);
      const ocupacao = v.participantes.length + v.participantes.reduce(
        (soma, p) => soma + (p.acompanhanteID ? 1 : 0),
        0
      );
      return dataViagem === dataSolicitacao && ocupacao < v.veiculo.lugares_dispo;
    });

    if (!viagemCompatível) {
      return res.status(400).send("Nenhuma viagem compatível encontrada");
    }

    let acompanhanteCriado = null;
    if (solicitacao.nome_acomp) {
      acompanhanteCriado = await Acompanhante.create({
        nome: solicitacao.nome_acomp,
        cpf: solicitacao.cpf_acomp,
        data_nasc: solicitacao.data_nasc_acomp,
        telefone: solicitacao.telefone_acomp,
        generoID: solicitacao.generoID, 
        img: solicitacao.foto_acompanhante || null
      });
    }

    await Participante.create({
      usuarioID: solicitacao.usuarioID,
      viagemID: viagemCompatível.cod,
      local_consul: solicitacao.local_consul,
      hora_consul: solicitacao.hora_consul,
      encaminhamento: solicitacao.encaminhamento,
      objetivo: solicitacao.objetivo,
      obs: solicitacao.obs,
      acompanhanteID: acompanhanteCriado ? acompanhanteCriado.cod : null
    });


    // Apagar solicitação
    await solicitacao.destroy();

    res.redirect("/admin/solicitacoes/participacoes");
  } catch (erro) {
    console.error("Erro ao aceitar solicitação:", erro);
    res.status(500).send("Erro ao aceitar solicitação");
  }
};

exports.renderVeiculos = async (req, res) => {
  const origem = req.query.origem; 
  const veiculos = await Veiculo.findAll();

  res.render("admin/viagens/gerenciar/veiculos", {
      origem,
      veiculos,
      layout: "layouts/layoutAdmin",
      paginaAtual: "viagens",
  });
};

exports.adicionarVeiculo = async (req, res) => {
  try {
    const { modelo_veiculo, placa, lugares_dispo } = req.body;

    if (!modelo_veiculo || !placa || !lugares_dispo) {
      return res.status(400).send("Todos os campos são obrigatórios.");
    }

    await Veiculo.create({
      modelo_veiculo,
      placa,
      lugares_dispo
    });

    res.redirect("/admin/viagens/gerenciar/veiculos");
  } catch (error) {
    console.error("Erro ao adicionar veículo:", error);
    res.status(500).send("Erro ao cadastrar veículo.");
  }
};

exports.excluirVeiculo = async (req, res) => {
  try {
    const { cod } = req.params;
    await Veiculo.destroy({ where: { cod } });

    res.redirect("/admin/viagens/gerenciar/veiculos");
  } catch (error) {
    console.error("Erro ao excluir veículo:", error);
    res.status(500).send("Erro ao excluir veículo.");
  }
};

exports.renderCidades = async (req, res) => {
  const origem = req.query.origem; 
  const cidades = await CidadeConsul.findAll();

  res.render("admin/viagens/gerenciar/cidades", {
      origem,
      cidades,
      layout: "layouts/layoutAdmin",
      paginaAtual: "viagens",
  });
};

exports.adicionarCidade = async (req, res) => {
  try {
    const { descricao } = req.body;

    if (!descricao) {
      return res.status(400).send("Todos os campos são obrigatórios.");
    }

    await CidadeConsul.create({
      descricao
    });

    res.redirect("/admin/viagens/gerenciar/cidades");
  } catch (error) {
    console.error("Erro ao adicionar cidade:", error);
    res.status(500).send("Erro ao cadastrar cidade.");
  }
};

exports.excluirCidade = async (req, res) => {
  try {
    const { cod } = req.params;
    await CidadeConsul.destroy({ where: { cod } });

    res.redirect("/admin/viagens/gerenciar/cidades");
  } catch (error) {
    console.error("Erro ao excluir cidade:", error);
    res.status(500).send("Erro ao excluir cidade.");
  }
};
