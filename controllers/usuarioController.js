const { Usuario, Endereco, Genero, Motorista, Documento, Viagem, Status, CidadeConsul, Solicitacao, Acompanhante, Participante, Veiculo} = require('../models');
const { Op, where } = require('sequelize');
const bcrypt = require("bcrypt");

exports.renderPerfil = async (req, res) => {
   const codUsuario = req.session.usuario.cod;

   const usuario = await Usuario.findOne({
      where: { cod: codUsuario },
      include: [
        { model: Endereco },
        { model: Genero }
      ],
    });

  res.render('usuario/perfil', {
      usuario,
      layout: 'layouts/layoutUsuario',
      paginaAtual: 'perfil'
    });

}

exports.renderMudarSenha = async (req, res) => {
   const codUsuario = req.session.usuario.cod;

   const usuario = await Usuario.findOne({
      where: { cod: codUsuario }
    });

   res.render('usuario/perfil/senha', {
    usuario,
      layout: 'layouts/layoutUsuario',
      paginaAtual: 'perfil',
      userType: 'usuario',
      erroSenha: null
    });
};

exports.atualizarSenha = async (req, res) => {
  try {
    const { senhaAtual, senhaNova } = req.body;
    const cod = req.session.usuario.cod;

    const usuario = await Usuario.findByPk(cod);

    if (!usuario) {
      return res.render('usuario/perfil/senha', {
        layout: 'layouts/layoutUsuario',
        paginaAtual: 'perfil',
        userType: 'usuario',
        erroSenha: 'Usuário não encontrado.'
      });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaCorreta) {
      return res.render('usuario/perfil/senha', {
        layout: 'layouts/layoutUsuario',
        paginaAtual: 'perfil',
        userType: 'usuario',
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
      return res.render('usuario/perfil/senha', {
        layout: 'layouts/layoutUsuario',
        paginaAtual: 'perfil',
        userType: 'usuario',
        erroSenha:
          'Nova senha inválida, verifique e tente novamente.'
      });
    }

    const hashNovaSenha = await bcrypt.hash(senhaNova, 10);
    await Usuario.update(
      { senha: hashNovaSenha },
      { where: { cod } }
    );

    
    res.redirect('/usuario/perfil');

  } catch (error) {
    console.error(error);
    return res.render('usuario/perfil/senha', {
      layout: 'layouts/layoutUsuario',
      paginaAtual: 'perfil',
      userType: 'usuario',
      erroSenha: 'Ocorreu um erro ao atualizar a senha. Tente novamente.'
    });
  }
};

exports.renderInicio = async (req, res) => {
    const codUsuario = req.session.usuario.cod;
    
    const usuario = await Usuario.findOne({
      where: { cod: codUsuario },
      include: [
        { model: Endereco },
        { model: Genero }
      ],
    
    });

    const participante = await Participante.findAll({
      where: { usuarioID: codUsuario }
    });

    const viagemIDs = participante.map(p => p.viagemID);

    const minhas_viagens = await Viagem.findAll({
      where: { cod: viagemIDs,
        statusID: [1, 2]
       },
      include: [
        { model: CidadeConsul, as: "cidadeconsul"},
        { model: Status },
        { model: Veiculo, as: "veiculo" },
        { model: Participante, as: "participantes" },
        { model: Motorista, as: "Motorista" }
      ]
    });

      const viagensComOcupacao = minhas_viagens.map((v) => {
      const qtdParticipantes = v.participantes.length;
      const qtdAcompanhantes = v.participantes.reduce(
        (soma, p) => soma + (p.acompanhanteID ? 1 : 0),
        0
      );

      return {
        ...v.toJSON(), // transforma em objeto plano
        ocupacao: qtdParticipantes + qtdAcompanhantes,
      };
    });

    res.render('usuario/inicio/index', {
      minhas_viagens: viagensComOcupacao,
      usuario,
      layout: 'layouts/layoutUsuario',
      paginaAtual: 'inicio'
    });
}

exports.renderAgenda = async (req, res) => {
  try {
    const codUsuario = req.session.usuario.cod;

    const usuario = await Usuario.findOne({
      where: { cod: codUsuario },
    });

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const cidade = req.query.cidade ? req.query.cidade.trim() : "";
    const data = req.query.data || "";

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let where = {
      data_viagem: { [Op.gte]: hoje },
      statusID: [1],
    };

    if (data) {
      where.data_viagem = { [Op.between]: [data + " 00:00:00", data + " 23:59:59"] };
    }

    const includeCidade = {
      model: CidadeConsul,
      as: "cidadeconsul",
      ...(cidade && {
        where: { descricao: { [Op.like]: `%${cidade}%` } },
      }),
    };

    const { count, rows } = await Viagem.findAndCountAll({
      where,
      include: [
        includeCidade,
        { model: Veiculo, as: "veiculo" },
        { model: Participante, as: "participantes" },
      ],
      order: [["data_viagem", "ASC"], ["horario_saida", "ASC"]],
      limit,
      offset,
      distinct: true,
    });

    const solicitacoes = await Solicitacao.findAll({
      where: { usuarioID: codUsuario },
    });

    const datasSolicitadas = solicitacoes
      .filter(sol => sol.data_consul)
      .map(sol => new Date(sol.data_consul).toISOString().slice(0, 10));

    const viagensParticipando = await Participante.findAll({
      where: { usuarioID: codUsuario },
      include: [{ model: Viagem, as: "viagem" }],
    });

    const datasParticipando = viagensParticipando
      .filter(p => p.viagem && p.viagem.data_viagem)
      .map(p => new Date(p.viagem.data_viagem).toISOString().slice(0, 10));

    const viagensComOcupacao = rows.map((v) => {
      const qtdParticipantes = v.participantes.length;
      const qtdAcompanhantes = v.participantes.reduce(
        (soma, p) => soma + (p.acompanhanteID ? 1 : 0),
        0
      );
      return {
        ...v.toJSON(),
        ocupacao: qtdParticipantes + qtdAcompanhantes,
      };
    });

    const totalPaginas = Math.max(1, Math.ceil(count / limit));

    const solicitacaoSucesso = req.session.solicitacaoSucesso;
    delete req.session.solicitacaoSucesso;

    res.render("usuario/agenda/index", {
      usuario,
      codUsuario,
      solicitacoes,
      viagens: viagensComOcupacao,
      totalPaginas,
      paginaNun: page,
      termoCidade: cidade,
      termoData: data,
      layout: "layouts/layoutUsuario",
      paginaAtual: "agenda",
      solicitacaoSucesso,
      datasSolicitadas,
      datasParticipando,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send("Erro ao carregar agenda: " + erro);
  }
};

exports.formularioParticipar = async (req, res) => {

    const cod_viagem = req.params.cod;
    const cod = req.session.usuario.cod;

    const usuario = await Usuario.findOne({
      where: { cod },
      include: [Genero, Endereco]
    });

    const viagem = await Viagem.findOne({
      where: { cod: cod_viagem },
      include: [
        {
          model: Participante,
          as: 'participantes',
          include: [
            {
              model: Acompanhante,
              as: 'acompanhante' 
            }
          ]
        },
        {
          model: Veiculo,
          as: 'veiculo'
        }
      ]
    });

    // calcula ocupação
    const qtdParticipantes = viagem.participantes.length;
    const qtdAcompanhantes = viagem.participantes.reduce(
      (soma, p) => soma + (p.acompanhante ? 1 : 0),
      0
    );

    const ocupacao = qtdParticipantes + qtdAcompanhantes;

    res.render('usuario/agenda/formulario-participar', {
    ocupacao,
    viagem,
    usuario,
    cod: cod_viagem,
    layout: 'layouts/layoutUsuario',
    paginaAtual: 'agenda',
    erros: null,
    preenchido: {},
  });
};

exports.requisitarParticipacao = async (req, res) => {
  try {
    const usuarioID = req.session.usuario.cod;
    const cod_viagem = req.body.viagemID;
    const cod = req.session.usuario.cod;

    const {
      cidadeconsulID,
      local_consul,
      data_consul,
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
        where: { cod },
        include: [Genero, Endereco]
      });

      const viagem = await Viagem.findOne({
        where: { cod: cod_viagem },
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

      return res.render('usuario/agenda/formulario-participar', {
        ocupacao,
        viagem,
        usuario,
        cod: cod_viagem,
        layout: 'layouts/layoutUsuario',
        paginaAtual: 'agenda',
        erros,
        preenchido
      });
    }

    await Solicitacao.create({
      usuarioID,
      cidadeconsulID,
      local_consul,
      data_consul,
      hora_consul,
      encaminhamento,
      objetivo,
      obs: obs || null,
      statusID: null,
      nome_acomp: temAcompanhante === "sim" ? nome_acomp : null,
      cpf_acomp: temAcompanhante === "sim" ? cpf_acomp : null,
      data_nasc_acomp: temAcompanhante === "sim" ? data_nasc_acomp : null,
      telefone_acomp: temAcompanhante === "sim" ? telefone_acomp : null,
      generoID: temAcompanhante === "sim" ? generoID : null,
      foto_acompanhante
    });

    req.session.solicitacaoSucesso = true;
    res.redirect('/usuario/agenda/index');

  } catch (err) {
    console.error("Erro ao salvar solicitação:", err);
    res.status(500).send('Erro ao salvar solicitação.');
  }
};

exports.renderSolicitar = async (req, res) => {
  const cod = req.session.usuario.cod;

  const usuario = await Usuario.findOne({
    where: { cod },
    include: [Genero, Endereco]
  });

  const cidadeconsul = await CidadeConsul.findAll();

  const solicitacaoSucesso = req.session.solicitacaoSucessoNV;
  delete req.session.solicitacaoSucessoNV;

  res.render('usuario/solicitar/index', {
    usuario,
    cidadeconsul,
    layout: 'layouts/layoutUsuario',
    paginaAtual: 'solicitar',
    erros: null,
    preenchido: {},
    solicitacaoSucesso
  });
};

exports.addSolicitar = async (req, res) => {
  try {
    const usuarioID = req.session.usuario.cod;
    const cod = req.session.usuario.cod;

    const {
      cidadeconsulID,
      local_consul,
      data_consul,
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
      cidadeconsulID,
      local_consul,
      data_consul,
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

    if (!cidadeconsulID) erros.cidadeconsulID = true;
    if (!local_consul?.trim()) erros.local_consul = true;
    if (!data_consul) {
  erros.data_consul = true;
} else {
  const hoje = new Date();
  const dataViagem = new Date(data_consul);

  hoje.setHours(0, 0, 0, 0);
  dataViagem.setHours(0, 0, 0, 0);

  if (dataViagem <= hoje) {
    erros.data_consul = 'A data da viagem deve ser posterior à data atual.';
  }
}

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
        if (isNaN(data.getTime()) || data > hoje || data.getFullYear() < 1900) {
          erros.data_nasc_acomp = 'Data de nascimento inválida. Verifique e tente novamente.';
        }
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
        where: { cod },
        include: [Genero, Endereco]
      });
      const cidadeconsul = await CidadeConsul.findAll();

      return res.render('usuario/solicitar/index', {
        usuario,
        cidadeconsul,
        layout: 'layouts/layoutUsuario',
        paginaAtual: 'solicitar',
        erros,
        preenchido,
        solicitacaoSucesso: null
      });
    }

    await Solicitacao.create({
      usuarioID,
      cidadeconsulID,
      local_consul,
      data_consul,
      hora_consul,
      encaminhamento,
      objetivo,
      obs: obs || null,
      statusID: null,
      foto_acompanhante: temAcompanhante === "sim" ? foto_acompanhante : null,
      nome_acomp: temAcompanhante === "sim" ? nome_acomp : null,
      cpf_acomp: temAcompanhante === "sim" ? cpf_acomp.replace(/\D/g, '') : null,
      data_nasc_acomp: temAcompanhante === "sim" ? data_nasc_acomp : null,
      generoID: temAcompanhante === "sim" ? generoID : null,
      telefone_acomp: temAcompanhante === "sim" ? telefone_acomp.replace(/\D/g, '') : null
    });

    req.session.solicitacaoSucessoNV = true;
    res.redirect('/usuario/solicitar/index');

  } catch (err) {
    console.error("Erro ao salvar solicitação:", err);
    res.status(500).send('Erro ao salvar solicitação.');
  }
};

exports.renderDuvidas = async(req, res) => {
    const codUsuario = req.session.usuario.cod;
    const usuario = await Usuario.findOne({
      where: { cod: codUsuario },
    });

    res.render('usuario/duvidas/index', {
      usuario,
      layout: 'layouts/layoutUsuario',
      paginaAtual: 'duvidas'
    });
}




